// POST /api/auth/login
// body: { nickname, password }
// returns: { token, user: { id, nickname } }
import { verifyPassword } from '../_lib/crypto.js';
import { signJWT, setAuthCookie } from '../_lib/jwt.js';
import { json, error } from '../_lib/response.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const nickname = (body.nickname || '').trim();
  const password = body.password || '';

  if (!nickname || !password) {
    return error('请输入昵称和密码');
  }

  const user = await env.DB.prepare(
    'SELECT id, nickname, password_hash FROM users WHERE nickname = ?'
  ).bind(nickname).first();

  if (!user) {
    return error('用户不存在', 404);
  }

  const [salt, hash] = (user.password_hash || '').split(':');
  const valid = await verifyPassword(password, salt, hash);

  if (!valid) {
    return error('密码错误', 401);
  }

  const token = await signJWT(
    { sub: user.id, nickname: user.nickname, iat: Date.now(), exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
    env.JWT_SECRET
  );

  return json(
    { token, user: { id: user.id, nickname: user.nickname } },
    200,
    { 'Set-Cookie': setAuthCookie(token) }
  );
}
