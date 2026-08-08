// POST /api/auth/logout
// 清除浏览器端 auth cookie
import { clearAuthCookie } from '../_lib/jwt.js';
import { json } from '../_lib/response.js';

export async function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearAuthCookie() });
}
