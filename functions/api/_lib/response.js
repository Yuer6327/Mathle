// 响应与中间件工具

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  'Access-Control-Allow-Credentials': 'true'
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}

export function error(msg, status = 400) {
  return json({ error: msg }, status);
}

// CORS 中间件 + OPTIONS 预检
export function withCors(handler) {
  return async (context) => {
    if (context.request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const response = await handler(context);
    // 确保响应有 CORS 头
    if (response instanceof Response) {
      for (const [k, v] of Object.entries(CORS_HEADERS)) {
        response.headers.set(k, v);
      }
    }
    return response;
  };
}

// 统一认证会话校验：直接查 auth-db（与 auth.yuer6327.top 共用同一 D1）。
// 登录/注册已上移到 auth 平台，本地不再自签 JWT；会话 cookie 名为 s（HttpOnly）。
const enc = new TextEncoder();
async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function requireAuth(context) {
  const m = (context.request.headers.get('cookie') || '').match(/(?:^|;\s*)s=([A-Za-z0-9_-]+)/);
  if (!m || !context.env.AUTH_DB) return null;
  const row = await context.env.AUTH_DB.prepare(
    'SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id ' +
    'WHERE s.token_hash = ? AND s.expires_at > ? AND u.banned = 0'
  ).bind(await sha256Hex(m[1]), Date.now()).first();
  if (!row) return null;
  return { sub: row.id, nickname: row.name || row.email.split('@')[0], email: row.email, role: row.role };
}
