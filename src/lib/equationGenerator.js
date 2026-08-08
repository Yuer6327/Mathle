// 等式生成器
// 根据难度生成包含隐藏槽位的数学等式
// 难度（整体上调后）：
//   入门 = 原中等：sqrt / 幂 / 取模 / 乘减
//   简单 = 原困难：sin / cos+log / sin+乘
//   中等 = 原极难：sin(pi÷2)+sqrt× / cos(0)+sqrt+log / 平方和
//   困难 = 新增：带幂的较长表达式
//   极难 = 新增：超长表达式
//
// 数字一律拆成单个数字槽位（含表达式内的多位数），保证每个槽位只占一个可猜符号。

import { createRNG, makeRNGHelpers } from './seededRandom.js';
import { evaluate } from './evaluator.js';
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

// 多位数拆成单个数字槽位；常量 pi/e 保持整体
function expandNumber(t) {
  if (t.type === 'number' && t.symbol !== 'pi' && t.symbol !== 'e' && t.symbol.length > 1) {
    return t.symbol.split('').map((d) => tok('number', d));
  }
  return [t];
}

// ─── 难度模板 ───

// 入门: sqrt(a)+b=c / a^b+c=d / a%b+c=d / a×b-c=d
function genBeginner(rng) {
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
      if (d > 99) return genBeginner(rng); // 重试
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
      if (d < 0) return genBeginner(rng); // 重试
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

// 简单: sin(a)+b=c / cos(a)+log(b)=c / sin(a)+b×c=d
function genEasy(rng) {
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
      if (c < 0) return genEasy(rng); // 重试
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

// 中等: sin(pi÷2)+sqrt(a)×b=c / cos(0)+sqrt(a)+log(b)=c / a²+b²=c
function genMedium(rng) {
  const { int, pick } = rng;
  const template = pick(['sinsqrtmul', 'cossqrtlog', 'powpow']);
  switch (template) {
    case 'sinsqrtmul': {
      // sin(pi÷2)=1 → 1 + sqrt(a)×b
      const squares = [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100];
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(1, 9);
      const c = 1 + root * b;
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
      // cos(0)=1 → 1 + sqrt(a) + log(b)
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
    case 'powpow': {
      // a² + b² = c（平方）
      const a = int(2, 6);
      const b = int(2, 6);
      const c = a * a + b * b;
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '^'),
        tok('number', '2'),
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '^'),
        tok('number', '2')
      ], c);
    }
  }
}

// 困难: a²+b×c=d / sqrt(a)+b²=c / a²+b²-c=d / a³+b×c=d
function genHard(rng) {
  const { int, pick } = rng;
  const template = pick(['powmul', 'sqrtpow', 'powsub', 'cubemul']);
  switch (template) {
    case 'powmul': {
      const a = int(2, 9);
      const b = int(2, 9);
      const c = int(1, 9);
      const d = a * a + b * c;
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '^'),
        tok('number', '2'),
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '×'),
        tok('number', String(c))
      ], d);
    }
    case 'sqrtpow': {
      const squares = [4, 9, 16, 25, 36, 49, 64, 81, 100];
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(2, 6);
      const c = root + b * b;
      return buildEquation([
        tok('function', 'sqrt'),
        tok('lparen', '(', false),
        tok('number', String(a)),
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '^'),
        tok('number', '2')
      ], c);
    }
    case 'powsub': {
      const a = int(2, 6);
      const b = int(2, 6);
      const c = int(1, a * a + b * b - 1);
      const d = a * a + b * b - c;
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '^'),
        tok('number', '2'),
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '^'),
        tok('number', '2'),
        tok('operator', '-'),
        tok('number', String(c))
      ], d);
    }
    case 'cubemul': {
      const a = int(2, 4);
      const b = int(2, 9);
      const c = int(1, 9);
      const d = a * a * a + b * c;
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '^'),
        tok('number', '3'),
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '×'),
        tok('number', String(c))
      ], d);
    }
  }
}

// 极难: 超长表达式
//   sin(pi÷2)+sqrt(a)+b²=c
//   cos(0)+sqrt(a)×b+c²=d
//   a³+sqrt(b)+c=d
//   sin(pi÷2)×sqrt(a)+b²×c=d
function genExpert(rng) {
  const { int, pick } = rng;
  const template = pick(['sin_sqrt_pow', 'cos_sqrt_mul_pow', 'cube_sqrt_add', 'sin_sqrt_mul_pow']);
  const squares = [4, 9, 16, 25, 36, 49, 64, 81, 100];
  switch (template) {
    case 'sin_sqrt_pow': {
      // sin(pi÷2)=1 → 1 + sqrt(a) + b²
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(2, 6);
      const c = 1 + root + b * b;
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
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '^'),
        tok('number', '2')
      ], c);
    }
    case 'cos_sqrt_mul_pow': {
      // cos(0)=1 → 1 + sqrt(a)×b + c²
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(2, 5);
      const c = int(2, 5);
      const d = 1 + root * b + c * c;
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
        tok('operator', '×'),
        tok('number', String(b)),
        tok('operator', '+'),
        tok('number', String(c)),
        tok('operator', '^'),
        tok('number', '2')
      ], d);
    }
    case 'cube_sqrt_add': {
      const a = int(2, 4);
      const b = pick(squares);
      const root = Math.sqrt(b);
      const c = int(1, 9);
      const d = a * a * a + root + c;
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '^'),
        tok('number', '3'),
        tok('operator', '+'),
        tok('function', 'sqrt'),
        tok('lparen', '(', false),
        tok('number', String(b)),
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(c))
      ], d);
    }
    case 'sin_sqrt_mul_pow': {
      // sin(pi÷2)×sqrt(a)=sqrt(a) → sqrt(a) + b²×c
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(2, 4);
      const c = int(2, 4);
      const d = root + b * b * c;
      return buildEquation([
        tok('function', 'sin'),
        tok('lparen', '(', false),
        tok('number', 'pi'),
        tok('operator', '÷'),
        tok('number', '2'),
        tok('rparen', ')', false),
        tok('operator', '×'),
        tok('function', 'sqrt'),
        tok('lparen', '(', false),
        tok('number', String(a)),
        tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '^'),
        tok('number', '2'),
        tok('operator', '×'),
        tok('number', String(c))
      ], d);
    }
  }
}

// 构建完整等式 tokens (左侧 + = + 右侧)；多位数数字会被拆成单个数字槽位
function buildEquation(leftTokens, result) {
  const resultStr = String(Math.round(result));
  const resultDigits = resultStr.split('').map((d) => tok('number', d));
  const tokens = [
    ...leftTokens.flatMap(expandNumber),
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
