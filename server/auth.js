// WS ticket 校验（JWT HMAC-SHA256，与 Worker 共用同一个 JWT_SECRET）
// ticket 由 Worker 的 /api/ws-ticket 用同样算法签发，scope 必须为 'ws'，有效期 60s
import { createHmac, timingSafeEqual } from 'node:crypto';

// 复刻 Worker _lib/jwt.js 的 base64url（无 padding）编码，保证两端一致
function b64urlDecode(str) {
  return Buffer.from(str, 'base64url');
}

/**
 * 校验 WS ticket
 * @param {string|null} ticket
 * @param {string} secret
 * @returns {{sub:string, nickname:string|null}|null}
 */
export function verifyTicket(ticket, secret) {
  if (!ticket || !secret) return null;
  const parts = ticket.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, sigB64] = parts;
  const data = `${headerB64}.${bodyB64}`;

  let expected;
  try {
    expected = createHmac('sha256', secret).update(data).digest('base64url');
  } catch {
    return null;
  }

  // 常量时间比较，防时序攻击
  const given = b64urlDecode(sigB64);
  const want = Buffer.from(expected, 'base64url');
  if (given.length !== want.length) return null;
  if (!timingSafeEqual(given, want)) return null;

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(bodyB64).toString('utf8'));
  } catch {
    return null;
  }

  if (payload.scope !== 'ws') return null;           // 只接受 WS ticket，拒绝长期 JWT 直接当 ticket 用
  if (typeof payload.exp === 'number' && Date.now() > payload.exp) return null;
  if (!payload.sub) return null;

  return { sub: payload.sub, nickname: typeof payload.nickname === 'string' ? payload.nickname : null };
}
