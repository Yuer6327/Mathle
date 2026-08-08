// GET /api/auth/me
// returns: { user: { id, nickname } } or { user: null }
import { requireAuth } from '../_lib/response.js';
import { json } from '../_lib/response.js';

export async function onRequestGet(context) {
  const payload = await requireAuth(context);
  if (!payload) {
    return json({ user: null });
  }
  return json({ user: { id: payload.sub, nickname: payload.nickname } });
}
