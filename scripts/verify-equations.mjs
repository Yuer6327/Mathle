#!/usr/bin/env node
// 等式生成器自检脚本：确认去掉 % 后各难度仍能稳定生成合法等式
// 运行: node scripts/verify-equations.mjs （本机与 VPS 部署后均可跑）
//
// 检查项（任一项失败都会让脚本以非零码退出）:
//   1. 隐藏槽位不出现 %（本次改动核心）
//   2. 每个隐藏符号都在对应难度的 SYMBOL_POOLS 里（保证可猜）
//   3. 槽位数落在该难度 SLOT_RANGES 区间
//   4. 等式可求值且左右相等、结果为整数
import { generateEquation, getAvailableSymbols } from '../src/lib/equationGenerator.js';
import { DIFFICULTIES, SLOT_RANGES, SYMBOL_DISPLAY } from '../src/lib/constants.js';
import { evaluate } from '../src/lib/evaluator.js';

const PER_DIFFICULTY = 200; // 每个难度生成条数
const SAMPLES_PER_DIFF = 2;  // 每个难度打印的示例条数
const MAX_SHOW = 70;         // 示例展示的最大字符数

// 重构求值串：与 equationGenerator.verifyEquation 相同的符号映射
function toEvalString(tokens) {
  let left = '', right = '', afterEqual = false;
  const MAP = { '×': '*', '÷': '/', pi: 'pi', e: 'e' };
  for (const t of tokens) {
    if (t.type === 'equal') { afterEqual = true; continue; }
    const sym = MAP[t.symbol] ?? t.symbol;
    if (afterEqual) right += sym;
    else left += sym;
  }
  return { left, right };
}

// 展示串：隐藏槽位显示为 _，其余照常显示
function toDisplayString(tokens) {
  return tokens.map((t) => {
    if (t.type === 'equal') return '=';
    if (t.type === 'lparen') return '(';
    if (t.type === 'rparen') return ')';
    if (t.hidden) return '_';
    return SYMBOL_DISPLAY[t.symbol] ?? t.symbol;
  }).join('');
}

let failures = 0;
for (const diff of DIFFICULTIES) {
  const [minSlots, maxSlots] = SLOT_RANGES[diff];
  const pool = getAvailableSymbols(diff);
  const poolSet = new Set([...pool.numbers, ...pool.operators, ...pool.functions]);
  let okCount = 0, bad = 0, samples = [];
  const slotCounts = [];

  for (let seed = 1; seed <= PER_DIFFICULTY; seed++) {
    let reason = '';
    let ok = true;
    try {
      const { tokens } = generateEquation(diff, seed);
      const hidden = tokens.filter((t) => t.hidden);
      const slots = hidden.length;
      slotCounts.push(slots);

      if (hidden.some((t) => t.symbol === '%')) {
        ok = false; reason = '出现 %';
      } else if (!hidden.every((t) => poolSet.has(t.symbol))) {
        ok = false; reason = '槽位符号不在符号池';
      } else if (slots < minSlots || slots > maxSlots) {
        ok = false; reason = `槽位 ${slots} 不在 [${minSlots}, ${maxSlots}]`;
      } else {
        const { left, right } = toEvalString(tokens);
        const lv = evaluate(left);
        const rv = parseFloat(right);
        if (Math.abs(lv - rv) > 1e-9) {
          ok = false; reason = `左右不等 (${lv} vs ${rv})`;
        } else if (Math.abs(lv - Math.round(lv)) > 1e-6) {
          ok = false; reason = `结果非整数 (${lv})`;
        }
      }

      if (ok && samples.length < SAMPLES_PER_DIFF) {
        const disp = toDisplayString(tokens);
        samples.push(disp.length > MAX_SHOW ? disp.slice(0, MAX_SHOW) + '…' : disp);
      }
    } catch (err) {
      ok = false; reason = `抛异常: ${err.message}`;
    }

    if (ok) okCount++;
    else { bad++; if (bad <= 3) console.error(`  ✗ seed=${seed} ${reason}`); }
  }

  const pct = (okCount / PER_DIFFICULTY * 100).toFixed(1);
  const lo = Math.min(...slotCounts), hi = Math.max(...slotCounts);
  console.log(`\n[${diff}] ${okCount}/${PER_DIFFICULTY} 通过 (${pct}%)  槽位 ${lo}~${hi}（区间 ${minSlots}~${maxSlots}）`);
  for (const s of samples) console.log(`  例: ${s}`);
  if (bad > 0) failures += bad;
}

console.log(failures === 0
  ? '\n✓ 全部通过：无 %、结果整数、槽位命中、符号可猜'
  : `\n✗ 共 ${failures} 条失败，请检查 equationGenerator / constants`);
process.exit(failures === 0 ? 0 : 1);
