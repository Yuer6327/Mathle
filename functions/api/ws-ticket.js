// GET /api/ws-ticket → 签发短时效(60s) WS ticket
// 联机时浏览器把 HttpOnly Cookie 交给本端点换取 ticket，再凭 ticket 连 wss://api.yuer6327.top/ws
// ticket 用同一 JWT_SECRET 签发，VPS 侧用相同算法验证（scope 必须为 'ws'）
// 未登录（游客）也可联机：带 ?guest=<浏览器UUID>&nickname=xxx 签发匿名 ticket（sub = anon:<uuid>）
import { signJWT, verifyJWT, getTokenFromRequest } from './_lib/jwt.js';
import { json, error } from './_lib/response.js';

const TICKET_TTL_MS = 60 * 1000;

export async function onRequestGet(context) {
  const token = getTokenFromRequest(context.request);
  const payload = token ? await verifyJWT(token, context.env.JWT_SECRET) : null;

  let sub, nickname;
  if (payload) {
    // 已登录：用真实用户身份
    sub = payload.sub;
    nickname = payload.nickname;
  } else {
    // 游客：凭 ?guest=<uuid> 签发匿名身份（数据只存浏览器本地，不上传云端）
    const url = new URL(context.request.url);
    const guestId = (url.searchParams.get('guest') || '').trim();
    if (!guestId) return error('未登录', 401);
    sub = 'anon:' + guestId;
    nickname = (url.searchParams.get('nickname') || '').trim() || '游客';
  }

  const now = Date.now();
  const ticket = await signJWT(
    { sub, nickname, scope: 'ws', iat: now, exp: now + TICKET_TTL_MS },
    context.env.JWT_SECRET
  );

  return json({ ticket, expires_in: TICKET_TTL_MS });
}
