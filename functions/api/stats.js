// GET  /api/stats        → 获取当前用户统计
// POST /api/stats        → 提交一局游戏记录
import { requireAuth, json, error } from './_lib/response.js';

// 获取用户统计
export async function onRequestGet(context) {
  const payload = await requireAuth(context);
  if (!payload) return error('未登录', 401);

  const userId = payload.sub;

  // 获取各难度聚合统计
  const leaderboards = await context.env.DB.prepare(
    `SELECT difficulty, best_steps, best_time, total_wins, total_games, current_streak, best_streak
     FROM leaderboard WHERE user_id = ?`
  ).bind(userId).all();

  // 获取最近 20 条游戏记录
  const recent = await context.env.DB.prepare(
    `SELECT difficulty, mode, result, steps, time_seconds, seed, created_at
     FROM game_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
  ).bind(userId).all();

  const stats = {};
  for (const row of (leaderboards.results || [])) {
    const wr = row.total_games > 0 ? (row.total_wins / row.total_games * 100).toFixed(1) + '%' : '0%';
    stats[row.difficulty] = {
      total: row.total_games,
      wins: row.total_wins,
      winRate: wr,
      currentStreak: row.current_streak,
      bestStreak: row.best_streak,
      bestSteps: row.best_steps >= 999999 ? null : row.best_steps,
      bestTime: row.best_time >= 999999 ? null : row.best_time
    };
  }

  return json({ stats, recent: recent.results || [] });
}

// 提交游戏记录
export async function onRequestPost(context) {
  const payload = await requireAuth(context);
  if (!payload) return error('未登录', 401);

  const userId = payload.sub;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return error('Invalid JSON body');
  }

  const { difficulty, mode, result, steps, time_seconds, seed } = body;

  // 参数校验
  if (!difficulty || !result || typeof steps !== 'number' || typeof time_seconds !== 'number') {
    return error('参数缺失: difficulty, result, steps, time_seconds 必填');
  }
  const validDifficulties = ['beginner', 'easy', 'medium', 'hard', 'expert'];
  if (!validDifficulties.includes(difficulty)) {
    return error('难度无效');
  }
  const validResults = ['win', 'loss'];
  if (!validResults.includes(result)) {
    return error('结果无效');
  }

  const isWin = result === 'win';

  // 插入游戏记录
  await context.env.DB.prepare(
    `INSERT INTO game_records (user_id, difficulty, mode, result, steps, time_seconds, seed)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(userId, difficulty, mode || 'solo', result, steps, time_seconds, seed || null).run();

  // 更新排行榜 (upsert)
  const existing = await context.env.DB.prepare(
    'SELECT * FROM leaderboard WHERE user_id = ? AND difficulty = ?'
  ).bind(userId, difficulty).first();

  if (!existing) {
    // 新建
    await context.env.DB.prepare(
      `INSERT INTO leaderboard (user_id, difficulty, best_steps, best_time, total_wins, total_games, current_streak, best_streak)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(
      userId, difficulty,
      isWin ? steps : 999999,
      isWin ? time_seconds : 999999,
      isWin ? 1 : 0,
      isWin ? 1 : 0,
      isWin ? 1 : 0
    ).run();
  } else {
    // 更新
    const newWins = (existing.total_wins || 0) + (isWin ? 1 : 0);
    const newGames = (existing.total_games || 0) + 1;
    const newStreak = isWin ? (existing.current_streak || 0) + 1 : 0;
    const newBestStreak = Math.max(existing.best_streak || 0, newStreak);
    const newBestSteps = isWin ? Math.min(existing.best_steps || 999999, steps) : (existing.best_steps || 999999);
    const newBestTime = isWin ? Math.min(existing.best_time || 999999, time_seconds) : (existing.best_time || 999999);

    await context.env.DB.prepare(
      `UPDATE leaderboard SET total_wins = ?, total_games = ?, current_streak = ?, best_streak = ?, best_steps = ?, best_time = ?, updated_at = unixepoch()
       WHERE user_id = ? AND difficulty = ?`
    ).bind(newWins, newGames, newStreak, newBestStreak, newBestSteps, newBestTime, userId, difficulty).run();
  }

  return json({ ok: true });
}
