// 等式生成器
// 根据难度生成包含隐藏槽位的数学等式

import { createRNG, makeRNGHelpers } from './seededRandom.js';
import { evaluate, isInteger } from './evaluator.js';
import { SYMBOL_POOLS, SLOT_RANGES } from './constants.js';

/**
 * Token 结构:
 * { type: 'number'|'operator'|'function'|'lparen'|'rparen'|'equal',
 *   symbol: string,    // 原始符号 (如 '3', '+', 'sin', 'pi')
 *   hidden: boolean,    // 是否为可猜测的槽位
 *   slotIndex: number|null // 槽位索引 (仅 hidden=true 时)
 * }
 */

function tok(type, symbol, hidden = false) {
  return { type, symbol, hidden, slotIndex: null };
}

// ─── 难度模板 ───

// 入门: a + b = c / a - b = c (单数字, 保证 c ≤ 9)
function genBeginner(rng) {
  const { int, pick } = rng;
  const op = pick(['+', '-']);
  if (op === '+') {
    const a = int(1, 8);
    const b = int(1, 9 - a);
    return buildEquation([
      tok('number', String(a)),
      tok('operator', '+'),
      tok('number', String(b))
    ], a + b);
  } else {
    const a = int(2, 9);
    const b = int(1, a - 1);
    return buildEquation([
      tok('number', String(a)),
      tok('operator', '-'),
      tok('number', String(b))
    ], a - b);
  }
}

// 简单: a × b = c / a ÷ b = c / a + b - c = d
function genEasy(rng) {
  const { int, pick } = rng;
  const template = pick(['mul', 'div', 'addsub']);
  switch (template) {
    case 'mul': {
      const a = int(2, 9);
      const b = int(2, 9);
      const c = a * b;
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '×'),
        tok('number', String(b))
      ], c);
    }
    case 'div': {
      const b = int(2, 9);
      const c = int(2, 9);
      const a = b * c;
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '÷'),
        tok('number', String(b))
      ], c);
    }
    case 'addsub': {
      const a = int(1, 9);
      const b = int(1, 9);
      const c = int(1, a + b > 9 ? 9 : a + b);
      const d = a + b - c;
      if (d < 0 || d > 9) return genEasy(rng); // 重试
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '-'),
        tok('number', String(c))
      ], d);
    }
  }
}

// 中等: sqrt(a)+b=c / a^b+c=d / a%b+c=d / a×b-c=d
function genMedium(rng) {
  const { int, pick } = rng;
  const template = pick(['sqrt', 'pow', 'mod', 'mulsub']);
  switch (template) {
    case 'sqrt': {
      const squares = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100];
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(1, 9);
      const c = root + b;
      return buildEquation([
        tok('function', 'sqrt'),
        tok('lparen', '(', false),
        tok('number', String(a)),
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(b))
      ], c);
    }
    case 'pow': {
      const b = int(2, 3);
      const a = int(2, 6);
      const c = int(1, 9);
      const d = Math.pow(a, b) + c;
      if (d > 99) return genMedium(rng);
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '^'),
        tok('number', String(b)),
        tok('operator', '+'),
        tok('number', String(c))
      ], d);
    }
    case 'mod': {
      const b = int(3, 9);
      const a = int(1, 10) * b + int(1, b - 1);
      const c = int(1, 9);
      const d = (a % b) + c;
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '%'),
        tok('number', String(b)),
        tok('operator', '+'),
        tok('number', String(c))
      ], d);
    }
    case 'mulsub': {
      const a = int(2, 9);
      const b = int(2, 9);
      const c = int(1, 9);
      const d = a * b - c;
      if (d < 0) return genMedium(rng);
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '×'),
        tok('number', String(b)),
        tok('operator', '-'),
        tok('number', String(c))
      ], d);
    }
  }
}

// 困难: sin(a)+b=c / cos(a)+log(b)=c / sin(a)+b×c=d
function genHard(rng) {
  const { int, pick } = rng;
  const template = pick(['sin', 'coslog', 'sinmul']);
  switch (template) {
    case 'sin': {
      // 用特殊角度: 0 → sin=0, pi/2 → sin=1, pi → sin=0
      const angles = [
        { tokens: [tok('number', '0')], sinVal: 0 },
        { tokens: [tok('number', 'pi'), tok('operator', '÷'), tok('number', '2')], sinVal: 1 },
        { tokens: [tok('number', 'pi')], sinVal: 0 }
      ];
      const ang = pick(angles);
      const b = int(1, 9);
      const c = ang.sinVal + b;
      return buildEquation([
        tok('function', 'sin'),
        tok('lparen', '(', false),
        ...ang.tokens,
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(b))
      ], c);
    }
    case 'coslog': {
      // cos(0)=1, cos(pi÷2)=0, cos(pi)=-1
      // log(10)=1, log(100)=2, log(1000)=3
      const cosAngles = [
        { tokens: [tok('number', '0')], cosVal: 1 },
        { tokens: [tok('number', 'pi'), tok('operator', '÷'), tok('number', '2')], cosVal: 0 },
        { tokens: [tok('number', 'pi')], cosVal: -1 }
      ];
      const logArgs = [
        { tokens: [tok('number', '10')], logVal: 1 },
        { tokens: [tok('number', '100')], logVal: 2 },
        { tokens: [tok('number', '1000')], logVal: 3 }
      ];
      const ca = pick(cosAngles);
      const la = pick(logArgs);
      const c = ca.cosVal + la.logVal;
      if (c < 0) return genHard(rng);
      return buildEquation([
        tok('function', 'cos'),
        tok('lparen', '(', false),
        ...ca.tokens,
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'log'),
        tok('lparen', '(', false),
        ...la.tokens,
        tok('rparen', ')', false)
      ], c);
    }
    case 'sinmul': {
      const angles = [
        { tokens: [tok('number', '0')], sinVal: 0 },
        { tokens: [tok('number', 'pi'), tok('operator', '÷'), tok('number', '2')], sinVal: 1 },
        { tokens: [tok('number', 'pi')], sinVal: 0 }
      ];
      const ang = pick(angles);
      const b = int(1, 9);
      const c = int(1, 9);
      const d = ang.sinVal + b * c;
      return buildEquation([
        tok('function', 'sin'),
        tok('lparen', '(', false),
        ...ang.tokens,
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '×'),
        tok('number', String(c))
      ], d);
    }
  }
}

// 极难: sin(sqrt(a))+b=c / cos(sqrt(a))+log(b)=c / sin(pi÷2)+sqrt(a)×b=c
function genExpert(rng) {
  const { int, pick } = rng;
  const template = pick(['sinsqrt', 'cossqrtlog', 'sinsqrtmul']);
  switch (template) {
    case 'sinsqrt': {
      // sin(sqrt(0)) = sin(0) = 0
      // sin(sqrt(4)) = sin(2) ≈ 0.909 (不理想)
      // 只用 sqrt(0) → sin(0) = 0 和 sqrt(pi^2) 但这不好用
      // 实际可以用: cos(sqrt(0)) = cos(0) = 1
      // sin(sqrt(a)) 只在 a=0 时干净
      // 改用: sin(pi ÷ 2) + sqrt(a) × b = c → 1 + root * b
      const squares = [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100];
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(1, 9);
      const c = 1 + root * b; // sin(pi/2) = 1
      return buildEquation([
        tok('function', 'sin'),
        tok('lparen', '(', false),
        tok('number', 'pi'),
        tok('operator', '÷'),
        tok('number', '2'),
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'sqrt'),
        tok('lparen', '(', false),
        tok('number', String(a)),
        tok('rparen', ')', false),
        tok('operator', '×'),
        tok('number', String(b))
      ], c);
    }
    case 'cossqrtlog': {
      // cos(0) + sqrt(a) + log(b) = c → 1 + root + logVal
      const squares = [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100];
      const a = pick(squares);
      const root = Math.sqrt(a);
      const logArgs = [
        { tokens: [tok('number', '10')], logVal: 1 },
        { tokens: [tok('number', '100')], logVal: 2 },
        { tokens: [tok('number', '1000')], logVal: 3 }
      ];
      const la = pick(logArgs);
      const c = 1 + root + la.logVal;
      return buildEquation([
        tok('function', 'cos'),
        tok('lparen', '(', false),
        tok('number', '0'),
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'sqrt'),
        tok('lparen', '(', false),
        tok('number', String(a)),
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'log'),
        tok('lparen', '(', false),
        ...la.tokens,
        tok('rparen', ')', false)
      ], c);
    }
    case 'sinsqrtmul': {
      // sin(pi ÷ 2) + sqrt(a) × b = c → 1 + root * b
      const squares = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100];
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(1, 9);
      const c = 1 + root * b;
      if (c > 999) return genExpert(rng);
      return buildEquation([
        tok('function', 'sin'),
        tok('lparen', '(', false),
        tok('number', 'pi'),
        tok('operator', '÷'),
        tok('number', '2'),
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'sqrt'),
        tok('lparen', '(', false),
        tok('number', String(a)),
        tok('rparen', ')', false),
        tok('operator', '×'),
        tok('number', String(b))
      ], c);
    }
  }
}

// 构建完整等式 tokens (左侧 + = + 右侧)
function buildEquation(leftTokens, result) {
  const resultStr = String(Math.round(result));
  const resultDigits = resultStr.split('').map(d => tok('number', d));
  const tokens = [
    ...leftTokens,
    tok('equal', '=', false),
    ...resultDigits
  ];
  // 标记隐藏槽位：非括号、非等号的 token 都是可猜测槽位
  const VISIBLE_TYPES = new Set(['equal', 'lparen', 'rparen']);
  let slotIdx = 0;
  for (const t of tokens) {
    if (!VISIBLE_TYPES.has(t.type)) {
      t.hidden = true;
      t.slotIndex = slotIdx++;
    }
  }
  return tokens;
}

// 验证等式
function verifyEquation(tokens) {
  // 构建左侧表达式字符串
  let leftStr = '';
  let rightStr = '';
  let afterEqual = false;
  for (const t of tokens) {
    if (t.type === 'equal') { afterEqual = true; continue; }
    const sym = t.symbol;
    let evalSym = sym;
    if (sym === '×') evalSym = '*';
    else if (sym === '÷') evalSym = '/';
    else if (sym === 'pi') evalSym = 'pi';
    else if (sym === 'e') evalSym = 'e';
    // 函数名保持原样
    if (afterEqual) {
      rightStr += evalSym;
    } else {
      leftStr += evalSym;
    }
  }
  try {
    const leftVal = evaluate(leftStr);
    const rightVal = parseFloat(rightStr);
    return Math.abs(leftVal - rightVal) < 1e-9;
  } catch {
    return false;
  }
}

// 主生成函数
const GENERATORS = {
  beginner: genBeginner,
  easy: genEasy,
  medium: genMedium,
  hard: genHard,
  expert: genExpert
};

export function generateEquation(difficulty, seed) {
  const rng = makeRNGHelpers(createRNG(seed));
  const gen = GENERATORS[difficulty];
  let tokens;
  let attempts = 0;
  do {
    tokens = gen(rng);
    attempts++;
    if (attempts > 50) break;
  } while (!verifyEquation(tokens));

  // 提取槽位答案
  const answer = tokens.filter(t => t.hidden).map(t => t.symbol);
  return { tokens, answer, difficulty, seed };
}

// 获取所有隐藏槽位的符号（答案数组）
export function getAnswer(equation) {
  return equation.answer;
}

// 获取所有可用符号（基于难度）
export function getAvailableSymbols(difficulty) {
  const pool = SYMBOL_POOLS[difficulty];
  return {
    numbers: pool.numbers,
    operators: pool.operators,
    functions: pool.functions
  };
}
