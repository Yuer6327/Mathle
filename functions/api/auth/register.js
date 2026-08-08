// POST /api/auth/register
// body: { nickname, password }
// returns: { token, user: { id, nickname } }
import { hashPassword, generateSalt, generateUUID } from '../_lib/crypto.js';
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

  if (!nickname || nickname.length < 1 || nickname.length > 20) {
    return error('昵称长度需 1-20 字符');
  }
  if (!password || password.length < 4) {
    return error('密码至少 4 位');
  }

  // 检查昵称是否已存在
  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE nickname = ?'
  ).bind(nickname).first();

  if (existing) {
    return error('该昵称已被使用', 409);
  }

  const id = generateUUID();
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  const storedHash = `${salt}:${hash}`;

  await env.DB.prepare(
    'INSERT INTO users (id, nickname, password_hash) VALUES (?, ?, ?)'
  ).bind(id, nickname, storedHash).run();

  const token = await signJWT(
    { sub: id, nickname, iat: Date.now(), exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
    env.JWT_SECRET
  );

  return json(
    { token, user: { id, nickname } },
    200,
    { 'Set-Cookie': setAuthCookie(token) }
  );
}
