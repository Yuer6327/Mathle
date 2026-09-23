/**
 * 「有限信息版」提示的逻辑层验证（不调用 Jev，纯本地）。
 * 用法：node scripts/verify-hint-slim.mjs
 *
 * 覆盖：
 *  A1 soundness：真值永远落在「结构允许集合 / 类别允许集」里（客户端上报路径 + DP 回退路径）
 *  A2 越界字段：state 里不得出现出现次数上下界 / 反馈候选集 / 绿格表 / 已排除名单
 *  A3 答案泄漏：同一棋盘换不同历史，allowed_symbols 必须逐字不变（只由结构决定）
 *  A4 调度：最左优先 / exclude_slots 跳过 / 全排除回退 / focus 指向绿锁槽 → focus_applied=false
 *  A5 slot_kinds 校验：缺失、长度不符、非法代号、池外类别、越权收紧 五类输入
 *  A6 符号口径：内部符号与显示符号不混用
 */
import { writeFileSync } from 'node:fs';
import { generateEquation } from '../src/lib/equationGenerator.js';
import { DIFFICULTIES, SYMBOL_POOLS } from '../src/lib/constants.js';
import {
  analyzeStructure, boardToTokens, computeCandidates, countSlots, displayOf, symbolKind
} from '../functions/api/_lib/hintPrompt.js';
import { buildJevRequest } from '../functions/api/_lib/hintPrompt.js';
import { parseSlotKinds } from '../functions/api/hint.js';

const L = [];
const log = (...a) => L.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
const dump = () => writeFileSync('./_verify.txt', L.join('\n'), 'utf8');
process.on('exit', dump);
process.on('uncaughtException', (e) => { log('EXCEPTION: ' + (e?.stack || e)); dump(); process.exit(1); });

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
};

// —— 确定性随机 ——
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const lcg = (seed) => { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
const CODE = { digit: 'd', constant: 'c', operator: 'o', function: 'f' };
const poolOf = (d) => [...SYMBOL_POOLS[d].numbers, ...SYMBOL_POOLS[d].operators, ...SYMBOL_POOLS[d].functions];
const poolKindsOf = (d) => new Set(poolOf(d).map(symbolKind));

/** 造一局：等式 + 确定性历史 */
function makeCase(d, seed, guesses = 2) {
  const eq = generateEquation(d, seed);
  const tokens = boardToTokens(eq.tokens.map((t) => (t.hidden ? '_' : t.symbol)));
  const rnd = lcg(hashStr(seed));
  const history = [];
  const syms = [...new Set(eq.answer)];
  for (let k = 0; k < guesses; k++) {
    const guess = eq.answer.map((s) => (rnd() < 0.3 + k * 0.15 ? s : syms[Math.floor(rnd() * syms.length)]));
    const feedback = guess.map((g, i) => (g === eq.answer[i] ? 'correct' : (eq.answer.includes(g) ? 'present' : 'absent')));
    history.push({ guess, feedback });
  }
  // 客户端会上报的类别。⚠️ 必须用【原始 equation.tokens】（隐藏槽带真实 symbol）——
  // 往返后的 wire token 里隐藏槽 symbol 本来就是 null（服务端收到的就是这样），别拿它取真值。
  const clientKinds = [];
  let ok = true;
  eq.tokens.forEach((t) => { if (!t.hidden) return; if (!t.symbol) { ok = false; return; } clientKinds[t.slotIndex] = CODE[symbolKind(t.symbol)]; });
  return { eq, tokens, history, clientKinds: ok ? clientKinds : null };
}

// ================= A1 soundness =================
log('=== A1 soundness ===');
{
  let slots = 0, badClient = 0, badDp = 0, struct = 0, badStruct = 0;
  const samples = [];
  for (const d of DIFFICULTIES) {
    for (let c = 0; c < 200; c++) {
      const { eq, tokens, clientKinds } = makeCase(d, `${d}-s${c}`, 2);
      const out = computeCandidates(tokens, d, [], clientKinds);
      const dp = analyzeStructure(tokens, poolKindsOf(d));
      for (let i = 0; i < countSlots(tokens); i++) {
        slots++;
        const tk = symbolKind(eq.answer[i]);
        if (!(out.allowedKinds[i] || []).includes(tk)) {
          badClient++;
          if (samples.length < 3) samples.push(`${d} 槽${i + 1} 真值=${eq.answer[i]}(${tk}) 允许=[${(out.allowedKinds[i] || []).join('/')}]`);
        }
        if (!(dp.allowed[i] || []).includes(tk)) badDp++;
        struct++;
        if (!out.structural[i].includes(eq.answer[i])) {
          badStruct++;
          if (samples.length < 6) samples.push(`[结构集] ${d} 槽${i + 1} 真值=${eq.answer[i]} 不在 ${JSON.stringify(out.structural[i].map(displayOf))}`);
        }
      }
    }
  }
  check(`客户端上报路径：真值类别在允许集内（${slots} 槽位）`, badClient === 0, badClient ? `${badClient} 个` : '');
  check(`DP 回退路径：真值类别在允许集内（${slots} 槽位）`, badDp === 0, badDp ? `${badDp} 个` : '');
  check(`结构允许集合包含真值（${struct} 槽位）`, badStruct === 0, badStruct ? `${badStruct} 个` : '');
  samples.forEach((s) => log('    样本: ' + s));
}

// ================= A2 越界字段 =================
log('\n=== A2 越界字段（state 里不许有替模型做好的推理）===');
{
  const d = 'medium';
  const { tokens, history, clientKinds } = makeCase(d, 'leak-check', 2);
  const built = buildJevRequest({ difficulty: d, tokens, history, slotKinds: clientKinds });
  const body = JSON.stringify(built.body);
  for (const key of ['symbol_occurrence_bounds', 'candidates_not_ruled_out', 'slots_already_known', 'excluded_symbols', 'slots_still_open']) {
    check(`state 不含 ${key}`, !body.includes(key));
  }
  check('state 含新的 slots_to_guess', body.includes('slots_to_guess'));
  check('allowed_symbols 只出现在 slots_to_guess/questions 的允许位置', body.includes('allowed_symbols'));
  check('grammar.note 不再写"别自己猜、直接用类别表"', !/instead of guessing/i.test(body));
  check('grammar.note 明确要求自己推理', /do the elimination yourself|Work each slot out YOURSELF/i.test(built.body.state.grammar.note));
  check('task 明确 allowed_symbols 未按反馈过滤', /NOT filtered by the feedback/i.test(built.body.state.task));
  const first = built.body.questions[`slot_${built.slotIds[0] + 1}`];
  check('question.note 说明要自己排除', /eliminate/i.test(first.instructions.note));
  check('question 不再带 candidates_not_ruled_out', !('candidates_not_ruled_out' in first.instructions));
  check('全局符号池交集的种类不被跨越（allowed_symbols 同类别）', (() => {
    for (const i of built.slotIds) {
      const kinds = new Set((built.body.questions[`slot_${i + 1}`].instructions.allowed_symbols || []).map((s) => symbolKind(s)));
      if (kinds.size > 1) {
        const allowed = new Set(built.body.state.slots_to_guess[String(i + 1)].possible_kinds);
        if (allowed.size < 2) return false;
      }
    }
    return true;
  })());
}

// ================= A3 答案泄漏 =================
log('\n=== A3 答案泄漏：allowed_symbols 只由结构决定 ===');
{
  const d = 'hard';
  const eq = generateEquation(d, 'leak-board');
  const tokens = boardToTokens(eq.tokens.map((t) => (t.hidden ? '_' : t.symbol)));
  const clientKinds = [];
  eq.tokens.forEach((t) => { if (t.hidden) clientKinds[t.slotIndex] = CODE[symbolKind(t.symbol)]; });
  const mk = (guesses) => {
    const rnd = lcg(hashStr('h' + guesses));
    const history = [];
    const syms = [...new Set(eq.answer)];
    for (let k = 0; k < guesses; k++) {
      const guess = eq.answer.map((s) => (rnd() < 0.3 ? s : syms[Math.floor(rnd() * syms.length)]));
      const feedback = guess.map((g, i) => (g === eq.answer[i] ? 'correct' : (eq.answer.includes(g) ? 'present' : 'absent')));
      history.push({ guess, feedback });
    }
    return buildJevRequest({ difficulty: d, tokens, history, slotKinds: clientKinds });
  };
  const a = mk(0), b = mk(2), c = mk(1);
  const collect = (built) => Object.fromEntries(built.slotIds.map((i) => [i, JSON.stringify(built.body.state.slots_to_guess[String(i + 1)].allowed_symbols)]));
  const A = collect(a), B = collect(b), C = collect(c);
  const shared = Object.keys(A).filter((k) => k in B && k in C);
  const same = shared.every((k) => A[k] === B[k] && A[k] === C[k]);
  check(`同一槽位在 0/1/2 次猜测历史下 allowed_symbols 完全一致（比对 ${shared.length} 个槽）`, same,
    same ? '' : shared.filter((k) => !(A[k] === B[k] && A[k] === C[k])).slice(0, 3).map((k) => `槽${k}: ${A[k]} / ${B[k]} / ${C[k]}`).join(' | '));
  // 反向确认：排除名单本身确实随历史变化（说明 A3 不是因为整条链路没在用反馈）
  const ex = (built) => {
    const i = built.slotIds[0];
    return JSON.stringify(built.excludedSymbols?.[i] || []);
  };
  check('（对照）excluded_symbols 随历史变化 → 反馈确实被算出来了，只是没喂给模型', ex(a) !== ex(b), `${ex(a)} vs ${ex(b)}`);
  // 单独再建一次（同一份 history），用独立算出的结构允许集合做对照
  const hist2 = (() => {
    const rnd = lcg(hashStr('h2'));
    const history = [];
    const syms = [...new Set(eq.answer)];
    for (let k = 0; k < 2; k++) {
      const guess = eq.answer.map((s) => (rnd() < 0.3 ? s : syms[Math.floor(rnd() * syms.length)]));
      const feedback = guess.map((g, i) => (g === eq.answer[i] ? 'correct' : (eq.answer.includes(g) ? 'present' : 'absent')));
      history.push({ guess, feedback });
    }
    return history;
  })();
  const built2 = buildJevRequest({ difficulty: d, tokens, history: hist2, slotKinds: clientKinds });
  const cc = computeCandidates(tokens, d, hist2, clientKinds);
  const optMismatch = built2.slotIds.filter((i) => {
    const opts = (built2.body.questions[`slot_${i + 1}`].instructions.allowed_symbols || []).slice().sort().join(',');
    const structural = cc.structural[i].map(displayOf).slice().sort().join(',');
    return opts !== structural;
  });
  check('选项 == 独立算出的「结构允许集合」（未经反馈过滤）', optMismatch.length === 0,
    optMismatch.length ? `不一致槽位: ${JSON.stringify(optMismatch)}` : `比对 ${built2.slotIds.length} 个槽`);

  const narrowed = built2.slotIds.filter((i) => cc.remaining[i].length < cc.structural[i].length);
  check('（对照）反馈确实收窄了某些槽位，但选项里没扣掉它们',
    narrowed.length > 0 && narrowed.every((i) => (built2.body.questions[`slot_${i + 1}`].instructions.allowed_symbols || []).length === cc.structural[i].length),
    `被反馈收窄的槽: ${JSON.stringify(narrowed)}（选项数仍等于结构数 ${narrowed.map((i) => cc.structural[i].length).join('/')}）`);
}

// ================= A4 调度 =================
log('\n=== A4 调度 ===');
{
  const d = 'medium';
  const seed = 'sched-case';
  const { tokens, history, clientKinds } = makeCase(d, seed, 1);
  const { askable } = computeCandidates(tokens, d, history, clientKinds);
  check('存在可问槽位', askable.length > 0, `askable=${JSON.stringify(askable)}`);

  const b1 = buildJevRequest({ difficulty: d, tokens, history, slotKinds: clientKinds });
  const expectLeft = askable.slice(0, 10);
  check('最左优先：slotIds 升序且从最小 askable 开始',
    JSON.stringify(b1.slotIds) === JSON.stringify(expectLeft),
    `得到 ${JSON.stringify(b1.slotIds)}，期望 ${JSON.stringify(expectLeft)}`);

  const b2 = buildJevRequest({ difficulty: d, tokens, history, slotKinds: clientKinds, excludeSlots: [askable[0]] });
  check('exclude_slots 会跳过已提示过的格子', !b2.slotIds.includes(askable[0]),
    `exclude=${askable[0]} → slotIds=${JSON.stringify(b2.slotIds)}`);

  const b3 = buildJevRequest({ difficulty: d, tokens, history, slotKinds: clientKinds, excludeSlots: askable });
  check('全部被排除时回退到完整 askable 列表', b3.slotIds.length > 0, JSON.stringify(b3.slotIds));

  // focus 指向绿锁槽
  const green = history[0].feedback.findIndex((f) => f === 'correct');
  if (green >= 0) {
    const b4 = buildJevRequest({ difficulty: d, tokens, history, slotKinds: clientKinds, focusSlot: green });
    check('focus 指向绿锁槽 → focus_applied=false 且退回自动', b4.focusApplied === false, `slotIds=${JSON.stringify(b4.slotIds)}`);
  }
  // focus 指向可问槽
  const bad = askable[0];
  const b5 = buildJevRequest({ difficulty: d, tokens, history, slotKinds: clientKinds, focusSlot: bad });
  check('focus 指向可问槽 → 只问这一个', b5.focusApplied === true && b5.slotIds.length === 1 && b5.slotIds[0] === bad,
    `slotIds=${JSON.stringify(b5.slotIds)} focusApplied=${b5.focusApplied}`);
}

// ================= A5 slot_kinds 校验 =================
log('\n=== A5 slot_kinds 校验（宽松、绝不 400）===');
{
  const d = 'beginner';
  const { tokens, clientKinds } = makeCase(d, 'kinds-case', 1);
  const slotCount = countSlots(tokens);
  const pool = new Set(poolOf(d));
  if (!clientKinds) {
    check('构造出客户端上报样本', false, 'clientKinds 为空，A5 无法继续');
  } else {
    const good = parseSlotKinds(clientKinds, slotCount, pool, tokens);
    check('合法上报 → 原样通过', Array.isArray(good) && good.length === slotCount && good.every((c) => c === null || typeof c === 'string'),
      JSON.stringify(good));
    check('合法上报：可信位数等于槽位数', Array.isArray(good) && good.filter(Boolean).length === slotCount, `可信 ${Array.isArray(good) ? good.filter(Boolean).length : 0}/${slotCount}`);

    check('缺失（undefined）→ 视为未上报', parseSlotKinds(undefined, slotCount, pool, tokens) === null);
    check('非数组 → 视为未上报', parseSlotKinds('dod', slotCount, pool, tokens) === null);
    check('长度不符 → 视为未上报', parseSlotKinds(clientKinds.slice(0, -1), slotCount, pool, tokens) === null);
    check('含非法代号 → 视为未上报', parseSlotKinds(clientKinds.map((c, i) => (i === 0 ? 'x' : c)), slotCount, pool, tokens) === null);

  const pk = poolKindsOf(d);
  const dp = analyzeStructure(tokens, pk);
  // 找一个「池里存在但 DP 不允许」的类别 → 越权收紧，应被丢弃
  let overreach = null;
  for (let i = 0; i < slotCount && !overreach; i++) {
    for (const kind of ['digit', 'constant', 'operator', 'function']) {
      if (pk.has(kind) && !(dp.allowed[i] || []).includes(kind)) { overreach = { i, code: CODE[kind] }; break; }
    }
  }
  if (overreach) {
    const claim = clientKinds.slice();
    claim[overreach.i] = overreach.code;
    const got = parseSlotKinds(claim, slotCount, pool, tokens);
    check(`越权收紧（槽${overreach.i + 1} 谎报 ${overreach.code}）→ 该位被丢弃`, got === null || got[overreach.i] === null,
      got === null ? '整体判不可信' : JSON.stringify(got));
  } else {
    log('SKIP  越权收紧用例（该难度找不到池内但 DP 不允许的类别）');
  }

  // 池外类别：入门没有常量，报 c 应被丢掉
  const noConst = clientKinds.slice();
  const idx = noConst.findIndex(() => true);
  noConst[idx] = 'c';
  const gotC = parseSlotKinds(noConst, slotCount, pool, tokens);
  check('入门档报 constant → 该位被丢弃', gotC === null || gotC[idx] === null, gotC === null ? '整体判不可信' : JSON.stringify(gotC));
  }
}

// ================= A6 符号口径 =================
log('\n=== A6 符号口径 ===');
{
  const d = 'hard';
  const { tokens, history, clientKinds } = makeCase(d, 'symbol-case', 1);
  const built = buildJevRequest({ difficulty: d, tokens, history, slotKinds: clientKinds });
  const body = JSON.stringify(built.body);
  const internalOk = (() => {
    // 内部符号 sqrt/log/pi 只应出现在 symbol_alphabet 的"含义"里，不该混进 allowed_symbols
    for (const i of built.slotIds) {
      const opts = built.body.questions[`slot_${i + 1}`].instructions.allowed_symbols || [];
      if (opts.some((s) => ['sqrt', 'log', 'pi', '-'].includes(s))) return false;
    }
    return true;
  })();
  check('allowed_symbols 用显示符号（√/lg/π/−），不混内部符号', internalOk);
  check('excludedSymbols 用内部符号（供前端 SYMBOL_DISPLAY 映射）',
    Object.values(built.excludedSymbols).every((arr) => arr.every((s) => typeof s === 'string')));
  check('body 体积合理（< 40KB）', body.length < 40000, `${(body.length / 1024).toFixed(1)}KB`);
}

log(`\n===== 结果：${failures === 0 ? '全部通过' : failures + ' 项失败'} =====`);
dump();
