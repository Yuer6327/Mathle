-- 提示（Jev 概率提示）每日用量
-- subject: 'u:<user_id>'（登录用户）或 'g:<guest_uuid>'（游客，HttpOnly cookie）
-- day:     UTC+8 自然日，格式 YYYY-MM-DD
-- tokens:  当日 Jev 实际消耗的输入 token 累计（用于全局预算监控）
CREATE TABLE IF NOT EXISTS hint_usage (
  subject    TEXT NOT NULL,
  day        TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  tokens     INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (subject, day)
);

-- 全局每日预算按 day 聚合统计，需要该索引
CREATE INDEX IF NOT EXISTS idx_hint_usage_day ON hint_usage(day);
