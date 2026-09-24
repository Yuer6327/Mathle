// D1 定期清理（Cron Trigger 调用，见 wrangler.toml [triggers] + src/worker.js 的 scheduled）
//
// 目的：让「会无界增长」的表保持有界，避免库体积与查询成本随时间线性上涨。
//   hint_usage   —— 每个 (配额主体, 日) 一行，游客 cookie 换一次就多一个主体。保留 CLEANUP_HINT_DAYS 天。
//   game_records —— 每局一行。前端只读「最近 20 条」，聚合数据都在 leaderboard 里。保留 CLEANUP_RECORD_DAYS 天。
// 明确不碰：users（账号本体）、leaderboard（聚合结果，行数只跟用户数×难度有关）。
//
// 为什么分批：D1 单条查询改几十万行会超执行限制；官方要求按 1000 行左右切批。
// 为什么有 maxBatches 上限：Workers Free 单次调用 subrequest 有限额，批数必须封顶。
// 注意：本作业失败不影响线上请求——scheduled 里已 try/catch。

const DAY_MS = 86_400_000;
const UTC8_OFFSET_MS = 8 * 3600 * 1000;

const DEFAULT_HINT_DAYS = 30;
const DEFAULT_RECORD_DAYS = 180;
const BATCH_SIZE = 1000;
/** 单次运行最多删多少批（Free 计划 subrequest 有限额，别调太大） */
const DEFAULT_MAX_BATCHES = 20;

/** hint_usage.day 的口径是 UTC+8 自然日字符串，cutoff 必须同口径 */
export function utc8Day(now = Date.now()) {
  return new Date(now + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * 分批删除，直到删不满一批或触顶。
 * SQLite 的 `DELETE ... LIMIT` 在 D1 上不可用，必须用 rowid 子查询的形式。
 */
async function deleteBatched(db, sql, cutoff, maxBatches) {
  let deleted = 0;
  let batches = 0;
  for (let i = 0; i < maxBatches; i++) {
    const res = await db.prepare(sql).bind(cutoff, BATCH_SIZE).run();
    const changes = Number(res?.meta?.changes) || 0;
    deleted += changes;
    batches++;
    if (changes < BATCH_SIZE) break; // 没有更多过期行
  }
  return { deleted, batches };
}

async function countRows(db, sql, cutoff) {
  const row = await db.prepare(sql).bind(cutoff).first();
  return Number(row?.n) || 0;
}

/**
 * @param {*} env Worker env（需 env.DB）
 * @param {{now?:number, hintDays?:number, recordDays?:number, maxBatches?:number, dryRun?:boolean}} [opts]
 */
export async function runD1Cleanup(env, opts = {}) {
  if (!env?.DB) return { skipped: 'no_d1_binding' };

  const now = opts.now ?? Date.now();
  const hintDays = toPositiveInt(opts.hintDays ?? env.CLEANUP_HINT_DAYS, DEFAULT_HINT_DAYS);
  const recordDays = toPositiveInt(opts.recordDays ?? env.CLEANUP_RECORD_DAYS, DEFAULT_RECORD_DAYS);
  const maxBatches = toPositiveInt(opts.maxBatches ?? env.CLEANUP_MAX_BATCHES, DEFAULT_MAX_BATCHES);

  const db = env.DB;
  const hintCutoff = utc8Day(now - hintDays * DAY_MS);
  const recordCutoff = Math.floor(now / 1000) - recordDays * 86400;

  const summary = {
    hint_days: hintDays,
    record_days: recordDays,
    hint_cutoff: hintCutoff,
    record_cutoff: recordCutoff,
    dry_run: !!opts.dryRun,
    hint_deleted: 0,
    records_deleted: 0,
    batches: 0
  };

  if (opts.dryRun) {
    summary.hint_pending = await countRows(
      db, 'SELECT COUNT(*) AS n FROM hint_usage WHERE day < ?', hintCutoff
    );
    summary.records_pending = await countRows(
      db, 'SELECT COUNT(*) AS n FROM game_records WHERE created_at < ?', recordCutoff
    );
    return summary;
  }

  const hint = await deleteBatched(
    db,
    'DELETE FROM hint_usage WHERE rowid IN (SELECT rowid FROM hint_usage WHERE day < ? LIMIT ?)',
    hintCutoff,
    maxBatches
  );
  summary.hint_deleted = hint.deleted;
  summary.batches += hint.batches;

  const remaining = Math.max(0, maxBatches - hint.batches);
  if (remaining > 0) {
    const records = await deleteBatched(
      db,
      'DELETE FROM game_records WHERE id IN (SELECT id FROM game_records WHERE created_at < ? LIMIT ?)',
      recordCutoff,
      remaining
    );
    summary.records_deleted = records.deleted;
    summary.batches += records.batches;
  }

  return summary;
}

export const CLEANUP_DEFAULTS = {
  hintDays: DEFAULT_HINT_DAYS,
  recordDays: DEFAULT_RECORD_DAYS,
  batchSize: BATCH_SIZE,
  maxBatches: DEFAULT_MAX_BATCHES
};
