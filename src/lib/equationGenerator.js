// 等式生成器
// 根据难度生成包含隐藏槽位的数学等式
// 难度（整体上调后）：
//   入门 = 原中等：sqrt / 幂 / 取模 / 乘减
//   简单 = 原困难：sin / cos+log / sin+乘
//   中等 = 原极难：sin(pi÷2)+sqrt× / cos(0)+sqrt+log / 幂和
//   困难 = 新增：带幂的较长表达式（题干翻倍，约 15-19 槽）
//   极难 = 新增：超长表达式（题干翻 3 倍，约 27-39 槽）
//
// 幂（含“平方”）：指数不固定为 2/3，会在难度对应的集合（如 2/3/4、2-5）中变化，
//   以增加生成式子多样性；指数仍是单个数字槽（^ 与数字都在对应难度的符号池里，保证可猜）。
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
      const b = pick([2, 2, 3, 4]); // 指数不再固定为 2/3，偶尔出现 4 次方（重试保证结果 ≤99）
      const a = int(2, 5);
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
      // a^x + b^y = c（“平方和”推广：指数可在 2/3/4 中变化，仍可猜：^ 与单个数字槽）
      const a = int(2, 4);
      const b = int(2, 4);
      const x = pick([2, 2, 3, 4]);
      const y = pick([2, 2, 3, 4]);
      const c = Math.pow(a, x) + Math.pow(b, y);
      return buildEquation([
        tok('number', String(a)),
        tok('operator', '^'),
        tok('number', String(x)),
        tok('operator', '+'),
        tok('number', String(b)),
        tok('operator', '^'),
        tok('number', String(y))
      ], c);
    }
  }
}

// 困难: 题干翻倍（约 15-19 槽），多段式长表达式，幂指数在 2/3/4 中变化
//   a^w+b^x+c^y+d^z=e
//   a^p+b^q+c^r+d=e
//   a^p×b+c^q+d^r=e
//   sqrt(a)+b^p+c^q+d^r=e
function genHard(rng) {
  const { int, pick } = rng;
  const squares = [4, 9, 16, 25, 36, 49, 64, 81, 100];
  const template = pick(['quad_pow', 'cube_sq_sq', 'pow_mul_sq_sq', 'sqrt_sq_cube_sq']);
  switch (template) {
    case 'quad_pow': {
      // a^w + b^x + c^y + d^z = e（四项幂，指数各自在 2/3/4 中变化）
      const a = int(2, 4);
      const b = int(2, 4);
      const c = int(2, 4);
      const d = int(2, 4);
      const w = pick([2, 2, 3, 3, 4]);
      const x = pick([2, 2, 3, 3, 4]);
      const y = pick([2, 2, 3, 3, 4]);
      const z = pick([2, 2, 3, 3, 4]);
      const total = Math.pow(a, w) + Math.pow(b, x) + Math.pow(c, y) + Math.pow(d, z);
      return buildEquation([
        tok('number', String(a)), tok('operator', '^'), tok('number', String(w)),
        tok('operator', '+'),
        tok('number', String(b)), tok('operator', '^'), tok('number', String(x)),
        tok('operator', '+'),
        tok('number', String(c)), tok('operator', '^'), tok('number', String(y)),
        tok('operator', '+'),
        tok('number', String(d)), tok('operator', '^'), tok('number', String(z))
      ], total);
    }
    case 'cube_sq_sq': {
      // a^p + b^q + c^r + d = e（指数在 2/3/4 中变化）
      const a = int(2, 4);
      const b = int(2, 4);
      const c = int(2, 4);
      const d = int(1, 9);
      const p = pick([2, 2, 3, 3, 4]);
      const q = pick([2, 2, 3, 3, 4]);
      const r = pick([2, 2, 3, 3, 4]);
      const total = Math.pow(a, p) + Math.pow(b, q) + Math.pow(c, r) + d;
      return buildEquation([
        tok('number', String(a)), tok('operator', '^'), tok('number', String(p)),
        tok('operator', '+'),
        tok('number', String(b)), tok('operator', '^'), tok('number', String(q)),
        tok('operator', '+'),
        tok('number', String(c)), tok('operator', '^'), tok('number', String(r)),
        tok('operator', '+'),
        tok('number', String(d))
      ], total);
    }
    case 'pow_mul_sq_sq': {
      // a^p × b + c^q + d^r = e（指数在 2/3/4 中变化）
      const a = int(2, 4);
      const b = int(2, 4);
      const c = int(2, 4);
      const d = int(2, 4);
      const p = pick([2, 2, 3, 3, 4]);
      const q = pick([2, 2, 3, 3, 4]);
      const r = pick([2, 2, 3, 3, 4]);
      const total = Math.pow(a, p) * b + Math.pow(c, q) + Math.pow(d, r);
      return buildEquation([
        tok('number', String(a)), tok('operator', '^'), tok('number', String(p)),
        tok('operator', '×'),
        tok('number', String(b)),
        tok('operator', '+'),
        tok('number', String(c)), tok('operator', '^'), tok('number', String(q)),
        tok('operator', '+'),
        tok('number', String(d)), tok('operator', '^'), tok('number', String(r))
      ], total);
    }
    case 'sqrt_sq_cube_sq': {
      // sqrt(a) + b^p + c^q + d^r = e（指数在 2/3/4 中变化）
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(2, 4);
      const c = int(2, 4);
      const d = int(2, 4);
      const p = pick([2, 2, 3, 3, 4]);
      const q = pick([2, 2, 3, 3, 4]);
      const r = pick([2, 2, 3, 3, 4]);
      const total = root + Math.pow(b, p) + Math.pow(c, q) + Math.pow(d, r);
      return buildEquation([
        tok('function', 'sqrt'), tok('lparen', '(', false), tok('number', String(a)), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(b)), tok('operator', '^'), tok('number', String(p)),
        tok('operator', '+'),
        tok('number', String(c)), tok('operator', '^'), tok('number', String(q)),
        tok('operator', '+'),
        tok('number', String(d)), tok('operator', '^'), tok('number', String(r))
      ], total);
    }
  }
}

// 极难: 题干翻 3 倍（约 27-39 槽），多段超长表达式，幂指数在 2-5 中变化
//   sin(pi÷2)+cos(0)+log(1000)+sqrt(a)+b^p+c^q+d^r=e
//   sin(pi÷2)×sqrt(a)+cos(0)×sqrt(b)+c^p+d^q+e^r=f
//   a^p+b^q+c^r+d^s+e^t+f^u+g^v=h
//   sin(pi÷2)+sqrt(a)+log(1000)+b^p+c^q+d^r+e^s=f
//   sin(pi÷2)+cos(0)+log(1000)+sqrt(a)+b^p+c^q+d^r+e^s+f=g
function genExpert(rng) {
  const { int, pick } = rng;
  const squares = [4, 9, 16, 25, 36, 49, 64, 81, 100];
  const template = pick([
    'sin_cos_log_sqrt_sq',
    'sin_sqrt_cos_sqrt_sq',
    'cube_sq_cube_sq_cube_sq_sq',
    'sin_sqrt_log_cube_sq_cube_sq',
    'sin_cos_log_sqrt_cube_sq_cube_sq_sq'
  ]);
  switch (template) {
    case 'sin_cos_log_sqrt_sq': {
      // sin(pi÷2)=1, cos(0)=1, log(1000)=3；b/c/d 的指数可在 2-5 中变化
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(2, 3);
      const c = int(2, 3);
      const d = int(2, 3);
      const p = pick([2, 2, 3, 3, 4, 5]);
      const q = pick([2, 2, 3, 3, 4, 5]);
      const r = pick([2, 2, 3, 3, 4, 5]);
      const total = 1 + 1 + 3 + root + Math.pow(b, p) + Math.pow(c, q) + Math.pow(d, r);
      return buildEquation([
        tok('function', 'sin'), tok('lparen', '(', false), tok('number', 'pi'), tok('operator', '÷'), tok('number', '2'), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'cos'), tok('lparen', '(', false), tok('number', '0'), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'log'), tok('lparen', '(', false), tok('number', '1000'), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'sqrt'), tok('lparen', '(', false), tok('number', String(a)), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(b)), tok('operator', '^'), tok('number', String(p)),
        tok('operator', '+'),
        tok('number', String(c)), tok('operator', '^'), tok('number', String(q)),
        tok('operator', '+'),
        tok('number', String(d)), tok('operator', '^'), tok('number', String(r))
      ], total);
    }
    case 'sin_sqrt_cos_sqrt_sq': {
      // sin(pi÷2)×sqrt(a)=sqrt(a), cos(0)×sqrt(b)=sqrt(b)；c/d/e 的指数可在 2-5 中变化
      const a = pick(squares);
      const rootA = Math.sqrt(a);
      const b = pick(squares);
      const rootB = Math.sqrt(b);
      const c = int(2, 3);
      const d = int(2, 3);
      const e = int(2, 3);
      const p = pick([2, 2, 3, 3, 4, 5]);
      const q = pick([2, 2, 3, 3, 4, 5]);
      const r = pick([2, 2, 3, 3, 4, 5]);
      const total = rootA + rootB + Math.pow(c, p) + Math.pow(d, q) + Math.pow(e, r);
      return buildEquation([
        tok('function', 'sin'), tok('lparen', '(', false), tok('number', 'pi'), tok('operator', '÷'), tok('number', '2'), tok('rparen', ')', false),
        tok('operator', '×'),
        tok('function', 'sqrt'), tok('lparen', '(', false), tok('number', String(a)), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'cos'), tok('lparen', '(', false), tok('number', '0'), tok('rparen', ')', false),
        tok('operator', '×'),
        tok('function', 'sqrt'), tok('lparen', '(', false), tok('number', String(b)), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(c)), tok('operator', '^'), tok('number', String(p)),
        tok('operator', '+'),
        tok('number', String(d)), tok('operator', '^'), tok('number', String(q)),
        tok('operator', '+'),
        tok('number', String(e)), tok('operator', '^'), tok('number', String(r))
      ], total);
    }
    case 'cube_sq_cube_sq_cube_sq_sq': {
      // 7 个幂项；a/c/e（原立方槽）指数 2-4，b/d/f/g（原平方槽）指数 2-5
      const a = int(2, 3);
      const b = int(2, 3);
      const c = int(2, 3);
      const d = int(2, 3);
      const e = int(2, 3);
      const f = int(2, 3);
      const g = int(2, 3);
      const p = pick([2, 2, 3, 3, 4]);
      const q = pick([2, 2, 3, 3, 4, 5]);
      const r = pick([2, 2, 3, 3, 4]);
      const s = pick([2, 2, 3, 3, 4, 5]);
      const t = pick([2, 2, 3, 3, 4]);
      const u = pick([2, 2, 3, 3, 4, 5]);
      const v = pick([2, 2, 3, 3, 4, 5]);
      const total = Math.pow(a, p) + Math.pow(b, q) + Math.pow(c, r) + Math.pow(d, s) + Math.pow(e, t) + Math.pow(f, u) + Math.pow(g, v);
      return buildEquation([
        tok('number', String(a)), tok('operator', '^'), tok('number', String(p)),
        tok('operator', '+'),
        tok('number', String(b)), tok('operator', '^'), tok('number', String(q)),
        tok('operator', '+'),
        tok('number', String(c)), tok('operator', '^'), tok('number', String(r)),
        tok('operator', '+'),
        tok('number', String(d)), tok('operator', '^'), tok('number', String(s)),
        tok('operator', '+'),
        tok('number', String(e)), tok('operator', '^'), tok('number', String(t)),
        tok('operator', '+'),
        tok('number', String(f)), tok('operator', '^'), tok('number', String(u)),
        tok('operator', '+'),
        tok('number', String(g)), tok('operator', '^'), tok('number', String(v))
      ], total);
    }
    case 'sin_sqrt_log_cube_sq_cube_sq': {
      // sin(pi÷2)=1, log(1000)=3；b/d（立方槽）指数 2-4，c/e（平方槽）指数 2-5
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(2, 3);
      const c = int(2, 3);
      const d = int(2, 3);
      const e = int(2, 3);
      const p = pick([2, 2, 3, 3, 4]);
      const q = pick([2, 2, 3, 3, 4, 5]);
      const r = pick([2, 2, 3, 3, 4]);
      const s = pick([2, 2, 3, 3, 4, 5]);
      const total = 1 + root + 3 + Math.pow(b, p) + Math.pow(c, q) + Math.pow(d, r) + Math.pow(e, s);
      return buildEquation([
        tok('function', 'sin'), tok('lparen', '(', false), tok('number', 'pi'), tok('operator', '÷'), tok('number', '2'), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'sqrt'), tok('lparen', '(', false), tok('number', String(a)), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'log'), tok('lparen', '(', false), tok('number', '1000'), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(b)), tok('operator', '^'), tok('number', String(p)),
        tok('operator', '+'),
        tok('number', String(c)), tok('operator', '^'), tok('number', String(q)),
        tok('operator', '+'),
        tok('number', String(d)), tok('operator', '^'), tok('number', String(r)),
        tok('operator', '+'),
        tok('number', String(e)), tok('operator', '^'), tok('number', String(s))
      ], total);
    }
    case 'sin_cos_log_sqrt_cube_sq_cube_sq_sq': {
      // sin(pi÷2)=1, cos(0)=1, log(1000)=3；b/d（立方槽）指数 2-4，c/e（平方槽）指数 2-5
      const a = pick(squares);
      const root = Math.sqrt(a);
      const b = int(2, 3);
      const c = int(2, 3);
      const d = int(2, 3);
      const e = int(2, 3);
      const f = int(1, 9);
      const p = pick([2, 2, 3, 3, 4]);
      const q = pick([2, 2, 3, 3, 4, 5]);
      const r = pick([2, 2, 3, 3, 4]);
      const s = pick([2, 2, 3, 3, 4, 5]);
      const total = 1 + 1 + 3 + root + Math.pow(b, p) + Math.pow(c, q) + Math.pow(d, r) + Math.pow(e, s) + f;
      return buildEquation([
        tok('function', 'sin'), tok('lparen', '(', false), tok('number', 'pi'), tok('operator', '÷'), tok('number', '2'), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'cos'), tok('lparen', '(', false), tok('number', '0'), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'log'), tok('lparen', '(', false), tok('number', '1000'), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('function', 'sqrt'), tok('lparen', '(', false), tok('number', String(a)), tok('rparen', ')', false),
        tok('operator', '+'),
        tok('number', String(b)), tok('operator', '^'), tok('number', String(p)),
        tok('operator', '+'),
        tok('number', String(c)), tok('operator', '^'), tok('number', String(q)),
        tok('operator', '+'),
        tok('number', String(d)), tok('operator', '^'), tok('number', String(r)),
        tok('operator', '+'),
        tok('number', String(e)), tok('operator', '^'), tok('number', String(s)),
        tok('operator', '+'),
        tok('number', String(f))
      ], total);
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
