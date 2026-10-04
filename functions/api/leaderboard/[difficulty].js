// GET /api/leaderboard/:difficulty
// returns: { entries: [{ nickname, best_steps, best_time, total_wins, total_games, ... }] }
import { json, error } from '../_lib/response.js';

export async function onRequestGet(context) {
  const { params, env } = context;
  const difficulty = params.difficulty;

  const validDifficulties = ['beginner', 'easy', 'medium', 'hard', 'expert'];
  if (!validDifficulties.includes(difficulty)) {
    return error('难度无效');
  }

  // 按 best_steps 升序排名（步数少的排前面，相同步数按时间少的排前面）
  const result = await env.DB.prepare(
    `SELECT
       l.user_id,
       l.best_steps,
       l.best_time,
       l.total_wins,
       l.total_games,
       l.current_streak,
       l.best_streak
     FROM leaderboard l
     WHERE l.difficulty = ? AND l.total_wins > 0
     ORDER BY l.best_steps ASC, l.best_time ASC
     LIMIT 50`
  ).bind(difficulty).all();

  // 昵称来自统一认证库：新用户只存在于 auth-db，本地遗留 users 表不再参与展示
  const ids = [...new Set((result.results || []).map(r => r.user_id))];
  const names = {};
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const u = await env.AUTH_DB.prepare(
      `SELECT id, COALESCE(NULLIF(name, ''), email, id) AS nickname FROM users WHERE id IN (${placeholders})`
    ).bind(...ids).all();
    for (const row of u.results || []) names[row.id] = row.nickname;
  }

  const entries = (result.results || []).map((row, idx) => ({
    rank: idx + 1,
    nickname: names[row.user_id] ?? '未知用户',
    bestSteps: row.best_steps >= 999999 ? null : row.best_steps,
    bestTime: row.best_time >= 999999 ? null : row.best_time,
    totalWins: row.total_wins,
    totalGames: row.total_games,
    winRate: row.total_games > 0 ? (row.total_wins / row.total_games * 100).toFixed(1) + '%' : '0%',
    currentStreak: row.current_streak,
    bestStreak: row.best_streak
  }));

  return json({ difficulty, entries });
}
