-- D1 手动清理（与 Cron 作业同口径，见 functions/jobs/d1-cleanup.js）
-- 用法：npm run db:cleanup:remote   （本地：npm run db:cleanup:local）
-- ⚠️ 删除不可逆；D1 Time Travel 免费档只保留 7 天，删之前先确认。

-- 提示配额记录：保留最近 30 天（更早的只用于历史监控，线上查询只读当天）
DELETE FROM hint_usage WHERE day < date('now', '+8 hours', '-30 days');

-- 游戏记录：保留最近 180 天（前端只展示最近 20 条，聚合数据在 leaderboard 表里）
DELETE FROM game_records WHERE created_at < unixepoch() - 180 * 86400;

-- users / leaderboard 不清理：前者是账号本体，后者行数只跟「用户数 × 难度」有关
