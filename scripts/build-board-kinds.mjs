/**
 * 生成「棋盘形状 → 每个槽位真实可能的符号类别」精确表。
 *
 * 为什么需要它：`analyzeStructure` 里的语法 DP 是通用语法，比生成器的实际模板宽松，
 * 会凭空造出「这格可能是数字也可能是运算符」的假歧义（实测：同一形状下生成器 100% 确定，
 * 而语法 DP 只有 52%~60% 唯一）。这里直接**穷举采样生成器**，把每个形状下每格真正出现过的
 * 类别记录下来，得到与生成器完全一致的答案。
 *
 * 用法：node scripts/build-board-kinds.mjs [--out <path>]
 * 产物：functions/api/_lib/boardKinds.js（形状 → 每格类别码，多类别用逗号分隔）
 * 形状编码：可见 token 原样（'(' ')' '='），隐藏槽位用 '.'，槽位顺序即出现顺序。
 * 类别码：d 数字 / c 常量 / o 运算符 / f 函数（多类别按字母序拼接，如 'cd'）。
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateEquation } from '../src/lib/equationGenerator.js';
import { DIFFICULTIES } from '../src/lib/constants.js';
import { boardToTokens, symbolKind, KIND_CODE } from '../functions/api/_lib/hintPrompt.js';

// 每轮采样量 / 连续多少轮无新形状就认为饱和 / 上限
const BATCH = 25000;
const QUIET_ROUNDS = 40;   // 连续 100 万局没有新形状
const MAX = 4000000;

let cursor = 0;
const nextSeed = () => `bk${(cursor++).toString(36)}`;

const tables = {};
const report = [];

for (const d of DIFFICULTIES) {
  const union = new Map();      // shape -> Set<string>[]
  let quiet = 0, n = 0;
  while (n < MAX && quiet < QUIET_ROUNDS) {
    let fresh = false;
    for (let i = 0; i < BATCH; i++) {
      const eq = generateEquation(d, nextSeed());
      const tk = boardToTokens(eq.tokens.map((t) => (t.hidden ? '_' : t.symbol)));
      const shape = tk.map((t) => (t.hidden ? '.' : t.symbol)).join('');
      let per = union.get(shape);
      if (!per) { per = tk.map(() => new Set()); union.set(shape, per); fresh = true; }
      tk.forEach((t) => { if (t.hidden) per[t.slotIndex].add(KIND_CODE[symbolKind(eq.answer[t.slotIndex])]); });
      n++;
    }
    quiet = fresh ? 0 : quiet + 1;
  }

  const table = {};
  let slots = 0, multi = 0;
  for (const [shape, per] of union) {
    const slotCount = (shape.match(/\./g) || []).length;
    const kinds = per.slice(0, slotCount).map((s) => [...s].sort().join(''));
    table[shape] = kinds.join(',');
    for (const k of kinds) { slots++; if (k.length > 1) multi++; }
  }
  tables[d] = table;
  report.push({ d, n, shapes: union.size, slots, multi, saturated: quiet >= QUIET_ROUNDS });
}

// ---------- 独立校验：另抽样本，确认「真值类别」永远在表里 ----------
const CHECK = 400000;
let checked = 0, bad = 0; const badSamples = [];
for (const d of DIFFICULTIES) {
  const table = tables[d];
  for (let i = 0; i < CHECK; i++) {
    const eq = generateEquation(d, nextSeed());
    const tk = boardToTokens(eq.tokens.map((t) => (t.hidden ? '_' : t.symbol)));
    const shape = tk.map((t) => (t.hidden ? '.' : t.symbol)).join('');
    const entry = table[shape];
    if (entry === undefined) { bad++; if (badSamples.length < 5) badSamples.push(`${d} 形状未收录: ${shape}`); continue; }
    const kinds = entry.split(',');
    eq.answer.forEach((sym, slot) => {
      checked++;
      if (!kinds[slot] || !kinds[slot].includes(KIND_CODE[symbolKind(sym)])) {
        bad++;
        if (badSamples.length < 5) badSamples.push(`${d} 形状=${shape} 槽${slot + 1} 真值类别=${KIND_CODE[symbolKind(sym)]} 表里=${kinds[slot]}`);
      }
    });
  }
}

const lines = [];
lines.push('// 本文件由 scripts/build-board-kinds.mjs 自动生成，请勿手改。');
lines.push('// 形状 → 每格真实可能的符号类别（多类别按字母序，如 "cd"）。');
lines.push('// 形状编码：可见 token 原样（( ) =），隐藏槽位用 "."；类别码 d/c/o/f。');
lines.push('// 用途：消除语法 DP 相对生成器的「假歧义」——生成器模板比通用语法窄得多。');
lines.push(`// 构建于 ${new Date().toISOString()}；穷举采样见脚本头部。`);
lines.push('');
lines.push('export const BOARD_KINDS = {');
for (const d of DIFFICULTIES) {
  lines.push(`  ${/^[a-z]+$/.test(d) ? d : JSON.stringify(d)}: {`);
  const keys = Object.keys(tables[d]).sort();
  for (const k of keys) lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(tables[d][k])},`);
  lines.push('  },');
}
lines.push('};');
lines.push('');
lines.push('/**');
lines.push(" * 棋盘形状编码：可见 token 原样（'(' ')' '='），隐藏槽位用 '.'。");
lines.push(' * 这就是玩家在棋盘上看到的东西（括号直接显示、槽位是下划线或灰框）。');
lines.push(' * @param {{hidden:boolean,symbol:string}[]} tokens');
lines.push(' */');
lines.push('export function shapeOfBoard(tokens) {');
lines.push("  return tokens.map((t) => (t.hidden ? '.' : t.symbol)).join('');");
lines.push('}');
lines.push('');
lines.push('/**');
lines.push(' * 查某个难度下该形状每个槽位真实可能的类别。');
lines.push(" * @returns {string[]|null} 与槽位序号对齐的类别串数组（如 ['d','o','d']）；未收录返回 null（调用方回退语法 DP）");
lines.push(' */');
lines.push('export function lookupKinds(difficulty, shape) {');
lines.push('  const t = BOARD_KINDS[difficulty];');
lines.push('  if (!t) return null;');
lines.push('  const v = t[shape];');
lines.push("  return v === undefined ? null : v.split(',');");
lines.push('}');
lines.push('');

const outArg = process.argv.indexOf('--out');
const outPath = resolve(outArg > -1 ? process.argv[outArg + 1] : 'src/lib/boardKinds.js');
writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log('=== 构建结果 ===');
for (const r of report) {
  console.log(`  ${r.d.padEnd(9)} 采样 ${String(r.n).padStart(8)} 局 | 形状 ${String(r.shapes).padStart(4)} | 槽位 ${String(r.slots).padStart(6)} | 多类别 ${String(r.multi).padStart(3)} (${(r.multi / r.slots * 100).toFixed(2)}%) | 饱和=${r.saturated ? '是' : '否(达上限)'}`);
}
console.log(`\n=== 独立校验（每难度另抽 ${CHECK} 局）===`);
console.log(`  检查 ${checked} 个槽位，真值类别不在表里 ${bad} 个 → ${bad === 0 ? 'PASS' : 'FAIL'}`);
badSamples.forEach((s) => console.log('  ✗ ' + s));
console.log(`\n写入 ${outPath}（${(lines.join('\n').length / 1024).toFixed(1)}KB）`);
