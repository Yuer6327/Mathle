// 用假 D1 验证 runD1Cleanup 的分批逻辑（不联网、不碰生产库）
// 用法：npm run db:cleanup:test
import { runD1Cleanup, utc8Day, CLEANUP_DEFAULTS } from '../functions/jobs/d1-cleanup.js';

function makeFakeDb({ hintRows = [], recordRows = [] }) {
  const hint = [...hintRows];
  const rec = [...recordRows];
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              calls.push({ sql, args });
              if (sql.includes('hint_usage')) {
                const [cutoff, limit] = args;
                const hit = hint.filter((d) => d < cutoff).slice(0, limit);
                hit.forEach((d) => hint.splice(hint.indexOf(d), 1));
                return { meta: { changes: hit.length } };
              }
              const [cutoff, limit] = args;
              const hit = rec.filter((t) => t < cutoff).slice(0, limit);
              hit.forEach((t) => rec.splice(rec.indexOf(t), 1));
              return { meta: { changes: hit.length } };
            },
            async first() {
              const [cutoff] = args;
              if (sql.includes('hint_usage')) return { n: hint.filter((d) => d < cutoff).length };
              return { n: rec.filter((t) => t < cutoff).length };
            }
          };
        }
      };
    }
  };
  return { db, calls, hint, rec };
}

const now = Date.parse('2026-09-24T15:00:00Z');
const DAY = 86400000;
const oldDay = utc8Day(now - 40 * DAY);
const newDay = utc8Day(now);
const oldTs = Math.floor(now / 1000) - 200 * 86400;
const newTs = Math.floor(now / 1000) - DAY / 1000;

let pass = 0, fail = 0;
const eq = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✅' : '❌'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ' != ' + JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
};

eq('utc8Day(北京 09-24 23:00)', utc8Day(Date.parse('2026-09-24T15:00:00Z')), '2026-09-24');
eq('utc8Day(UTC 09-24 17:00 = 北京 09-25 01:00)', utc8Day(Date.parse('2026-09-24T17:00:00Z')), '2026-09-25');
eq('hint cutoff = 30 天前(北京)', utc8Day(now - 30 * DAY), '2026-08-25');

// 1) dry-run 只统计不删
{
  const { db, hint, rec } = makeFakeDb({
    hintRows: [oldDay, oldDay, newDay],
    recordRows: [oldTs, newTs]
  });
  const s = await runD1Cleanup({ DB: db }, { now, dryRun: true });
  eq('dry-run 待删 hint', s.hint_pending, 2);
  eq('dry-run 待删 records', s.records_pending, 1);
  eq('dry-run 不真的删', [hint.length, rec.length], [3, 2]);
}

// 2) 正常清理：跨批 + 批尾 break
{
  const { db, hint, rec, calls } = makeFakeDb({
    hintRows: Array.from({ length: 2500 }, () => oldDay).concat([newDay]),
    recordRows: [oldTs, oldTs, newTs]
  });
  const s = await runD1Cleanup({ DB: db }, { now });
  eq('hint 删除数', s.hint_deleted, 2500);
  eq('hint 批数(=3)', s.batches >= 3, true);
  eq('records 删除数', s.records_deleted, 2);
  eq('hint 剩余(仅今天)', hint, [newDay]);
  eq('record 剩余(仅新的)', rec, [newTs]);
  eq('SQL 用 rowid 子查询 + LIMIT 绑定', calls[0].args.length, 2);
}

// 3) 触顶保护：hint 吃满 maxBatches 后不再动 records
{
  const { db } = makeFakeDb({
    hintRows: Array.from({ length: 30000 }, () => oldDay),
    recordRows: [oldTs]
  });
  const s = await runD1Cleanup({ DB: db }, { now, maxBatches: 20 });
  eq('触顶时 hint 删 20×1000', s.hint_deleted, 20000);
  eq('触顶时 records 不删', s.records_deleted, 0);
  eq('总批数 = 20', s.batches, 20);
}

// 4) 无过期数据 → 1 批就退
{
  const { db } = makeFakeDb({ hintRows: [newDay], recordRows: [newTs] });
  const s = await runD1Cleanup({ DB: db }, { now });
  eq('无过期 hint 删除数', s.hint_deleted, 0);
  eq('无过期 record 删除数', s.records_deleted, 0);
  eq('无过期总批数 = 2', s.batches, 2);
}

// 5) 边界：env 覆盖 / 无 DB 绑定
{
  const { db } = makeFakeDb({ hintRows: [utc8Day(now - 10 * DAY)] });
  const s = await runD1Cleanup({ DB: db }, { now, hintDays: 5 });
  eq('hintDays=5 时 10 天前的行被删', s.hint_deleted, 1);
  eq('无 DB 绑定 → skipped', await runD1Cleanup({}), { skipped: 'no_d1_binding' });
}

eq('默认保留期', CLEANUP_DEFAULTS, { hintDays: 30, recordDays: 180, batchSize: 1000, maxBatches: 20 });

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILED'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
