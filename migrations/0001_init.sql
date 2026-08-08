-- MathWordle D1 初始化
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  nickname    TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 游戏记录表
CREATE TABLE IF NOT EXISTS game_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  mode        TEXT NOT NULL,
  result      TEXT NOT NULL,
  steps       INTEGER NOT NULL,
  time_seconds INTEGER NOT NULL,
  seed        TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 排行榜聚合表
CREATE TABLE IF NOT EXISTS leaderboard (
  user_id     TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  best_steps  INTEGER NOT NULL DEFAULT 999999,
  best_time   INTEGER NOT NULL DEFAULT 999999,
  total_wins  INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, difficulty),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_records_user ON game_records(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_diff ON leaderboard(difficulty, best_steps ASC, best_time ASC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_wins ON leaderboard(difficulty, total_wins DESC);
