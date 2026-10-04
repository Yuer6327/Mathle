// OAuth2 授权码模式接入统一认证（示范实现）
// GET /api/auth/oauth-start  → 生成 state cookie 并跳转 auth.yuer6327.top/authorize
// GET /auth/callback         → 校验 state → 换 access_token → 取 userinfo → 回首页
// 后续 API 鉴权仍走共享根域 cookie（requireAuth 直查 AUTH_DB）；本流程用于演示/打通 Provider 全链路

import { error } from '../_lib/response.js';

const AUTH_URL = 'https://auth.yuer6327.top';
// 注意端点前缀：授权 /oauth/authorize、换令牌 /oauth/token、用户信息 /api/userinfo
const AUTHORIZE_URL = `${AUTH_URL}/oauth/authorize`;
const TOKEN_URL = `${AUTH_URL}/oauth/token`;
const USERINFO_URL = `${AUTH_URL}/api/userinfo`;
const STATE_COOKIE = 'mst';
const STATE_TTL_S = 600;

function stateCookie(value) {
  return `${STATE_COOKIE}=${value}; Path=/; Max-Age=${STATE_TTL_S}; Secure; HttpOnly; SameSite=Lax`;
}

// Workers 运行时无 nodejs_compat，不能用 Buffer；统一走 TextEncoder/atob
const b64url = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

function readStateCookie(request) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([A-Za-z0-9_.-]+)`));
  return m ? m[1] : null;
}

/** GET /api/auth/oauth-start：?next=（仅站内相对路径）决定授权完成后的回跳地址 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const clientId = env.OAUTH_CLIENT_ID;
  if (!clientId) return error('OAuth 未配置（缺 OAUTH_CLIENT_ID）', 500);
  const url = new URL(request.url);
  const nextParam = url.searchParams.get('next') || '/';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
  // state = 随机数.回跳地址(b64url)：回调时同时校验 CSRF 与还原回跳目标
  const state = `${crypto.randomUUID().replace(/-/g, '')}.${b64url(next)}`;
  const target = new URL(AUTHORIZE_URL);
  target.searchParams.set('response_type', 'code');
  target.searchParams.set('client_id', clientId);
  target.searchParams.set('redirect_uri', `${url.origin}/auth/callback`);
  target.searchParams.set('state', state);
  return new Response(null, {
    status: 303,
    headers: {
      location: `${target.origin}${target.pathname}?${target.searchParams}`,
      'set-cookie': stateCookie(state),
      'cache-control': 'no-store',
    },
  });
}

/** GET /auth/callback：授权码换令牌（client_secret 只在服务端使用） */
export async function onRequestGetCallback(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const cookieState = readStateCookie(request);
  let next = '/';
  if (cookieState && cookieState.split('.').length === 2) {
    try { next = b64urlDecode(cookieState.split('.')[1]) || '/'; } catch { /* 保持默认 */ }
  }
  if (!next.startsWith('/') || next.startsWith('//')) next = '/';

  const fail = () => new Response(null, { status: 303, headers: { location: '/?auth=login' } });
  if (!code || !cookieState || state !== cookieState) return fail();

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/auth/callback`,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tokenJson = await tokenRes.json().catch(() => null);
  if (!tokenJson?.access_token) return fail();

  // 取 userinfo 确认身份（本应用 API 鉴权走共享 cookie 的 requireAuth，此处完成全链路验证）
  const me = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
    signal: AbortSignal.timeout(10_000),
  }).then(r => r.json()).catch(() => null);
  if (!me?.id) return fail();

  return new Response(null, {
    status: 303,
    headers: {
      location: next,
      'set-cookie': `${STATE_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`,
      'cache-control': 'no-store',
    },
  });
}
