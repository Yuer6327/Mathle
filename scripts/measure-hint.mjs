/**
 * 测量 Jev 提示的命中率，用于「改动前后对照」。
 *
 * 设计要点（保证两次运行可比）：
 *  1. 用例完全确定：固定难度 + 固定 seed 生成等式；中局猜测用 seed 派生的 LCG，不用 Math.random。
 *  2. 被问槽位由脚本自己选（第 k 个「未绿锁且结构上允许 ≥2 个符号」的槽），并把 focus_slot 固定住，
 *     这样两次运行问的是同一批槽位——不受「选格策略」变化干扰，可逐槽归因。
 *  3. 选项集合、每题 token 数都记录下来，便于确认新旧 state 的差异。
 *
 * 用法：
 *   node scripts/measure-hint.mjs --label baseline
 *   node scripts/measure-hint.mjs --label after --with-kinds
 * 输出：<系统临时目录>/mathle-hint-<label>.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateEquation, getAvailableSymbols } from '../src/lib/equationGenerator.js';
import { DIFFICULTIES } from '../src/lib/constants.js';
import {
  analyzeStructure, boardToTokens, countSlots, displayOf, symbolKind, symbolPool
} from '../functions/api/_lib/hintPrompt.js';
import { buildJevRequest } from '../functions/api/_lib/hintPrompt.js';

const argv = process.argv.slice(2);
const label = (argv[argv.indexOf('--label') + 1]) || 'run';
const withKinds = argv.includes('--with-kinds');
const PER_DIFF = 3;          // 每难度取几个等式
const MAX_TARGETS = 3;       // 每个等式问几个槽位

// ---------- 确定性随机 ----------
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function lcg(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}

const poolKindsOf = (d) => {
  const p = getAvailableSymbols(d);
  return new Set([...p.numbers, ...p.operators, ...p.functions].map(symbolKind));
};
const CODE_OF = { digit: 'd', constant: 'c', operator: 'o', function: 'f' };

const key = (readFileSync('.dev.vars', 'utf8').match(/^JEV_KEY=(.+)$/m) || [])[1]?.trim();
if (!key) { console.error('缺 JEV_KEY（.dev.vars）'); process.exit(1); }

const callJev = async (body) => {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000)
  });
  if (!res.ok) return { error: res.status };
  return res.json();
};

const records = [];
let calls = 0, totalTokens = 0;

for (const d of DIFFICULTIES) {
  const pk = poolKindsOf(d);
  const pool = symbolPool(d);
  for (let c = 0; c < PER_DIFF; c++) {
    const seed = `${d}-case${c}`;
    const eq = generateEquation(d, seed);
    const tokens = boardToTokens(eq.tokens.map((t) => (t.hidden ? '_' : t.symbol)));
    const slotCount = countSlots(tokens);
    const rnd = lcg(hashStr(seed));

    // 确定性中局：2 次猜测
    const history = [];
    const syms = [...new Set(eq.answer)];
    const hitRate = [0.30, 0.45];
    for (let k = 0; k < 2; k++) {
      const guess = eq.answer.map((s) => (rnd() < hitRate[k] ? s : syms[Math.floor(rnd() * syms.length)]));
      const feedback = guess.map((g, i) => (g === eq.answer[i] ? 'correct' : (syms.includes(g) && eq.answer.includes(g) ? 'present' : 'absent')));
      history.push({ guess, feedback });
    }
    const currentGuess = eq.answer.map((s) => (rnd() < 0.5 ? s : null));

    // 绿锁槽（版本无关的独立判定）
    const greenLocked = new Set();
    for (const h of history) h.feedback.forEach((f, i) => { if (f === 'correct') greenLocked.add(i); });

    // 目标槽位：未绿锁 且 结构允许 ≥2 个符号
    const { allowed } = analyzeStructure(tokens, pk);
    const targets = [];
    for (let i = 0; i < slotCount && targets.length < MAX_TARGETS; i++) {
      if (greenLocked.has(i)) continue;
      const structural = pool.filter((s) => (allowed[i] || []).includes(symbolKind(s)));
      if (structural.length >= 2) targets.push(i);
    }

    // ⚠️ 必须从【原始 eq.tokens】推类别：wire board 里隐藏槽的 symbol 本来就是 null
    const slotKinds = withKinds
      ? (() => {
        const arr = [];
        let ok = true;
        eq.tokens.forEach((t) => { if (!t.hidden) return; if (!t.symbol) { ok = false; return; } arr[t.slotIndex] = CODE_OF[symbolKind(t.symbol)]; });
        return ok && arr.length === slotCount ? arr : null;
      })()
      : null;

    for (const slot of targets) {
      const built = buildJevRequest({
        difficulty: d, tokens, history, currentGuess,
        focusSlot: slot, slotKinds
      });
      if (built.error) { records.push({ d, seed, slot: slot + 1, error: built.error }); continue; }
      const data = await callJev(built.body);
      calls++;
      totalTokens += data.usage?.input_tokens || 0;
      if (data.error) { records.push({ d, seed, slot: slot + 1, error: 'http ' + data.error }); continue; }
      const ans = data.answers?.[`slot_${slot + 1}`];
      const truth = displayOf(eq.answer[slot]);
      const probs = ans ? Object.entries(ans.probabilities).sort((a, b) => b[1] - a[1]) : [];
      const rank = probs.findIndex(([s]) => s === truth) + 1;
      const optionKey = Object.keys(built.body.questions[`slot_${slot + 1}`]?.criteria || {});
      const omitted = built.body.questions[`slot_${slot + 1}`]?.instructions;
      records.push({
        d, seed, slot: slot + 1,
        truthKind: symbolKind(eq.answer[slot]),
        focusApplied: !!built.focusApplied,
        askedSlots: built.slotIds.map((x) => x + 1),
        nAsked: built.slotIds.length,
        nOptions: optionKey.length,
        options: optionKey,
        // 新版本用 allowed_symbols，旧版本用 candidates_not_ruled_out —— 都记下来便于核对
        declaredOptions: omitted?.allowed_symbols || omitted?.candidates_not_ruled_out || null,
        hasLegacyFields: {
          occurrenceBounds: 'symbol_occurrence_bounds' in built.body.state,
          candidates: !!omitted?.candidates_not_ruled_out,
          knownSlots: 'slots_already_known' in built.body.state
        },
        truth, rank: rank || probs.length + 1, top1: probs.length > 0 && probs[0][0] === truth,
        pTruth: ans?.probabilities?.[truth] ?? 0,
        confidence: ans?.confidence ?? 0,
        choice: ans?.choice ?? null,
        inputTokens: data.usage?.input_tokens || 0,
        truthInOptions: optionKey.includes(truth),
        truthExcludedByFeedback: (omitted?.allowed_symbols || []).includes(truth) && !optionKey.includes(truth)
      });
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

// ---------- 汇总 ----------
const ok = records.filter((r) => !r.error);
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const agg = (rows) => ({
  n: rows.length,
  nOptions: rows.reduce((a, r) => a + r.nOptions, 0) / rows.length,
  top1: rows.filter((r) => r.top1).length / rows.length,
  top2: rows.filter((r) => r.rank <= 2).length / rows.length,
  pTruth: rows.reduce((a, r) => a + r.pTruth, 0) / rows.length,
  conf: rows.reduce((a, r) => a + r.confidence, 0) / rows.length
});

console.log(`=== measure: ${label}${withKinds ? '（客户端上报 slot_kinds）' : ''} ===`);
console.log(`用例 ${records.length} 条（失败 ${records.length - ok.length}）| Jev 调用 ${calls} 次 | ${totalTokens} input tokens ≈ $${(totalTokens * 0.042 / 1e6).toFixed(4)}`);
if (ok.length) {
  const a = agg(ok);
  console.log(`总体：选项均 ${a.nOptions.toFixed(1)} 个 | 首选命中 ${pct(a.top1)} | 前2 ${pct(a.top2)} | 真值平均概率 ${pct(a.pTruth)} | 平均信心 ${a.conf.toFixed(3)}`);
  for (const d of DIFFICULTIES) {
    const rows = ok.filter((r) => r.d === d);
    if (!rows.length) continue;
    const g = agg(rows);
    console.log(`  ${d.padEnd(9)} n=${String(g.n).padStart(2)} 选项均 ${g.nOptions.toFixed(1)} | 首选 ${pct(g.top1).padStart(6)} | 前2 ${pct(g.top2).padStart(6)} | 真值均概率 ${pct(g.pTruth)}`);
  }
  for (const kind of ['digit', 'constant', 'operator', 'function']) {
    const rows = ok.filter((r) => r.truthKind === kind);
    if (!rows.length) continue;
    const g = agg(rows);
    console.log(`  [${kind.padEnd(8)}] n=${String(g.n).padStart(2)} 选项均 ${g.nOptions.toFixed(1)} | 首选 ${pct(g.top1).padStart(6)} | 真值均概率 ${pct(g.pTruth)}`);
  }
  const leak = ok.filter((r) => Object.values(r.hasLegacyFields).some(Boolean)).length;
  console.log(`越界字段（出现次数上下界/候选集/绿格表）出现于 ${leak}/${ok.length} 条`);
  const inOpt = ok.filter((r) => r.truthInOptions).length;
  console.log(`真值落在可选项内：${inOpt}/${ok.length}`);
}

const out = join(tmpdir(), `mathle-hint-${label}.json`);
writeFileSync(out, JSON.stringify({ label, withKinds, calls, totalTokens, records }, null, 1), 'utf8');
console.log(`\n写入 ${out}`);
