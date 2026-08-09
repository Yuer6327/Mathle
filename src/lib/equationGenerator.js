// 等式生成器
// 根据难度生成包含隐藏槽位的数学等式
//
// 难度设计（槽位数量严格递增，符号池也是上一档的超集，只增不减）：
//   入门  beginner: 5-8  槽，sqrt/幂/取模/乘减，符号池最小
//   简单  easy:     7-11 槽，引入 pi / ÷ / sin / cos / log
//   中等  medium:   10-21 槽，引入 tan，函数+幂组合
//   困难  hard:     20-31 槽，引入 e / ln，多段长式（4-7 个幂项）
//   极难  expert:   30-45 槽，引入 abs，超长组合式（5-8 个幂项）
//
// 幂指数不固定为 2/3：会在难度对应的集合（简单/中等 2/3/4、困难 2-4、极难 2-5）中变化，
//   以增加生成式子多样性；指数仍是单个数字槽（^ 与数字都在对应难度的符号池里，保证可猜）。
// 数字一律拆成单个数字槽位（含表达式内的多位数），保证每个槽位只占一个可猜符号。
// generateEquation 会按 SLOT_RANGES 重试，保证命中各难度槽位数范围。
//
// 特殊角根式组合（中等+，结果必为整数，天然带多层括号）：
//   (sin(π÷3)+cos(π÷6))=√3、(sin(π÷4)+cos(π÷4))=√2，乘上 sqrt(3)/sqrt(2) 化为整数 3/2，
//   例：2×(sin(π÷3)+cos(π÷6))×√3=6、((sin(π÷3)+cos(π÷6))×√3)²=9；困难/极难再与幂项连乘连加。

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

// ─── 可复用片段（每次调用都新建 token，避免跨等式共享状态）───
// 特殊角函数值：sin(pi÷2)=1, sin(0)=0, sin(pi)=0, cos(0)=1, cos(pi÷2)=0, cos(pi)=-1,
//               tan(pi÷4)=1, tan(0)=0；log 以 10 为底；ln 以 e 为底
const sinHalf = () => [tok('function','sin'), tok('lparen','(',false), tok('number','pi'), tok('operator','÷'), tok('number','2'), tok('rparen',')',false)];
const sinZero = () => [tok('function','sin'), tok('lparen','(',false), tok('number','0'), tok('rparen',')',false)];
const sinPi   = () => [tok('function','sin'), tok('lparen','(',false), tok('number','pi'), tok('rparen',')',false)];
const cosZero = () => [tok('function','cos'), tok('lparen','(',false), tok('number','0'), tok('rparen',')',false)];
const cosHalf = () => [tok('function','cos'), tok('lparen','(',false), tok('number','pi'), tok('operator','÷'), tok('number','2'), tok('rparen',')',false)];
const cosPi   = () => [tok('function','cos'), tok('lparen','(',false), tok('number','pi'), tok('rparen',')',false)];
const tanZero = () => [tok('function','tan'), tok('lparen','(',false), tok('number','0'), tok('rparen',')',false)];
const tanQuarter = () => [tok('function','tan'), tok('lparen','(',false), tok('number','pi'), tok('operator','÷'), tok('number','4'), tok('rparen',')',false)];
const sqrtOf  = (a) => [tok('function','sqrt'), tok('lparen','(',false), tok('number',String(a)), tok('rparen',')',false)];
const logOf   = (n) => [tok('function','log'), tok('lparen','(',false), tok('number',String(n)), tok('rparen',')',false)];
const lnOf    = (n) => [tok('function','ln'), tok('lparen','(',false), tok('number',String(n)), tok('rparen',')',false)];
const absSub  = (a, b) => [tok('function','abs'), tok('lparen','(',false), tok('number',String(a)), tok('operator','-'), tok('number',String(b)), tok('rparen',')',false)];
const powTerm = (base, exp) => [tok('number',String(base)), tok('operator','^'), tok('number',String(exp))];
const ePow0   = () => powTerm('e', '0'); // e^0=1
const sinOf   = (d) => [tok('function','sin'), tok('lparen','(',false), tok('number','pi'), tok('operator','÷'), tok('number',String(d)), tok('rparen',')',false)]; // sin(pi÷d)
const cosOf   = (d) => [tok('function','cos'), tok('lparen','(',false), tok('number','pi'), tok('operator','÷'), tok('number',String(d)), tok('rparen',')',false)]; // cos(pi÷d)

// 特殊角根式组合（结果必为整数，天然带多层括号）：
//   (sin(pi÷3)+cos(pi÷6)) = √3，再乘 sqrt(3) → 3
//   (sin(pi÷4)+cos(pi÷4)) = √2，再乘 sqrt(2) → 2
const gSqrt3 = () => [tok('lparen','(',false), ...sinOf(3), tok('operator','+'), ...cosOf(6), tok('rparen',')',false)];
const gSqrt2 = () => [tok('lparen','(',false), ...sinOf(4), tok('operator','+'), ...cosOf(4), tok('rparen',')',false)];
const timesSqrt = (n) => [tok('operator','×'), tok('function','sqrt'), tok('lparen','(',false), tok('number',String(n)), tok('rparen',')',false)];
// 与 evaluate 完全一致的计算值（evaluate 里用 Math.sin(Math.PI/3)+Math.cos(Math.PI/6) 等）
const VAL_SQRT3 = Math.sin(Math.PI / 3) + Math.cos(Math.PI / 6); // sin(π/3)+cos(π/6) = √3
const VAL_SQRT2 = Math.sin(Math.PI / 4) + Math.cos(Math.PI / 4); // sin(π/4)+cos(π/4) = √2

// 连续 pow 项（base^exp 用 + 连接，n 个）：返回 { tokens, sum }
function powRun(rng, n, bmin, bmax, expPool) {
  const { int, pick } = rng;
  const tokens = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) tokens.push(tok('operator', '+'));
    const b = int(bmin, bmax);
    const e = pick(expPool);
    tokens.push(...powTerm(b, e));
    sum += Math.pow(b, e);
  }
  return { tokens, sum };
}

const SQUARES = [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100];
const BIG_SQUARES = [4, 9, 16, 25, 36, 49, 64, 81, 100]; // 困难/极难避免 √0/√1
const HARD_EXP = [2, 2, 3, 3, 4];
const EXPERT_EXP = [2, 2, 3, 3, 4, 5];

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

// 简单: 7-11 槽。特殊角 sin/cos + log + 简单运算 + 一层括号
//   sin(pi÷2)+a+b=c / sin(pi÷2)+a×b=c / sin(0)+a×b+c=d / sin(pi)+a×b+c=d
//   cos(0)+log(10)+a=b / cos(pi÷2)+log(100)=c / cos(pi)+log(1000)=c
//   sin(0)+log(10)+a×b=c / sqrt(a)+log(100)=c / cos(0)+sin(pi÷2)+a=b
//   (a+b)×(c−d)=e / a×(b+c)+d=e
function genEasy(rng) {
  const { int, pick } = rng;
  const one9 = () => int(1, 9);
  const template = pick([
    'sin_half_add2', 'sin_half_mul', 'sin_zero_mul_add', 'sin_pi_mul_add',
    'cos_zero_log10_add', 'cos_half_log100', 'cos_pi_log1000',
    'sin_zero_log10_mul', 'sqrt_log100', 'cos_zero_sin_half_add',
    'nest_mul_diff', 'nest_mul_add'
  ]);
  switch (template) {
    case 'sin_half_add2': { // sin(pi÷2)+a+b=c → 1+a+b
      const a = one9(), b = one9();
      return buildEquation([...sinHalf(), tok('operator','+'), tok('number',String(a)), tok('operator','+'), tok('number',String(b))], 1 + a + b);
    }
    case 'sin_half_mul': { // sin(pi÷2)+a×b=c → 1+a×b
      const a = one9(), b = one9();
      return buildEquation([...sinHalf(), tok('operator','+'), tok('number',String(a)), tok('operator','×'), tok('number',String(b))], 1 + a * b);
    }
    case 'sin_zero_mul_add': { // sin(0)+a×b+c=d → a×b+c
      const a = one9(), b = one9(), c = one9();
      return buildEquation([...sinZero(), tok('operator','+'), tok('number',String(a)), tok('operator','×'), tok('number',String(b)), tok('operator','+'), tok('number',String(c))], a * b + c);
    }
    case 'sin_pi_mul_add': { // sin(pi)+a×b+c=d → a×b+c
      const a = one9(), b = one9(), c = one9();
      return buildEquation([...sinPi(), tok('operator','+'), tok('number',String(a)), tok('operator','×'), tok('number',String(b)), tok('operator','+'), tok('number',String(c))], a * b + c);
    }
    case 'cos_zero_log10_add': { // cos(0)+log(10)+a=b → 2+a
      const a = one9();
      return buildEquation([...cosZero(), tok('operator','+'), ...logOf(10), tok('operator','+'), tok('number',String(a))], 2 + a);
    }
    case 'cos_half_log100': { // cos(pi÷2)+log(100)=c → 2
      return buildEquation([...cosHalf(), tok('operator','+'), ...logOf(100)], 2);
    }
    case 'cos_pi_log1000': { // cos(pi)+log(1000)=c → 2
      return buildEquation([...cosPi(), tok('operator','+'), ...logOf(1000)], 2);
    }
    case 'sin_zero_log10_mul': { // sin(0)+log(10)+a×b=c → 1+a×b
      const a = one9(), b = one9();
      return buildEquation([...sinZero(), tok('operator','+'), ...logOf(10), tok('operator','+'), tok('number',String(a)), tok('operator','×'), tok('number',String(b))], 1 + a * b);
    }
    case 'sqrt_log100': { // sqrt(a)+log(100)=c → √a+2
      const a = pick(SQUARES);
      return buildEquation([...sqrtOf(a), tok('operator','+'), ...logOf(100)], Math.sqrt(a) + 2);
    }
    case 'cos_zero_sin_half_add': { // cos(0)+sin(pi÷2)+a=b → 2+a
      const a = one9();
      return buildEquation([...cosZero(), tok('operator','+'), ...sinHalf(), tok('operator','+'), tok('number',String(a))], 2 + a);
    }
    case 'nest_mul_diff': { // (a+b)×(c−d)=e，c>d 保证为正
      const a = one9(), b = one9(), c = one9(), d = one9();
      if (c <= d) return genEasy(rng); // 重试
      return buildEquation([
        tok('lparen','(',false), tok('number',String(a)), tok('operator','+'), tok('number',String(b)), tok('rparen',')',false),
        tok('operator','×'),
        tok('lparen','(',false), tok('number',String(c)), tok('operator','-'), tok('number',String(d)), tok('rparen',')',false)
      ], (a + b) * (c - d));
    }
    case 'nest_mul_add': { // a×(b+c)+d=e
      const a = one9(), b = one9(), c = one9(), d = one9();
      return buildEquation([
        tok('number',String(a)), tok('operator','×'),
        tok('lparen','(',false), tok('number',String(b)), tok('operator','+'), tok('number',String(c)), tok('rparen',')',false),
        tok('operator','+'), tok('number',String(d))
      ], a * (b + c) + d);
    }
  }
}

// 中等: 10-21 槽。引入 tan，函数片段 + 幂组合
//   sin(pi÷2)+sqrt(a)×b+c=d / cos(0)+log(1000)+sqrt(a)+b=c / tan(pi÷4)+sqrt(a)+b×c=d
//   tan(0)+sin(pi÷2)+a+b+c=d / a^x+b^y+c+d+e=f / a^x×b+c^y+d=e
//   sin(pi÷2)+cos(0)+a^x+b=c / sin(0)+cos(pi)+a×b+c+d=e / sqrt(a)+log(100)+b×c=d
//   sqrt(a)+log(1000)+b^c=d
//   特殊角根式组合：2×(sin(pi÷3)+cos(pi÷6))×sqrt(3)=6 / (sin(pi÷3)+cos(pi÷6))^2=3
//   (sin(pi÷4)+cos(pi÷4))^2=2 / (sin(pi÷3)+cos(pi÷6))×(sqrt(3)+sqrt(3))=6
//   2×((sin(pi÷3)+cos(pi÷6))×sqrt(3))=6 / 4×(sin(pi÷6)×cos(pi÷3))=1
//   2×(sin(pi÷2)−cos(pi÷3))=1 / (sin(pi÷3)+cos(pi÷6))×sqrt(3)+a=3+a
function genMedium(rng) {
  const { int, pick } = rng;
  const one9 = () => int(1, 9);
  const base = () => int(2, 5);
  const exp = () => pick([2, 2, 3, 4]);
  const template = pick([
    'sin_sqrt_mul_add', 'cos_log_sqrt_add', 'tan_sqrt_mul', 'tan_sin_adds',
    'pow_pow_adds', 'pow_mul_pow_add', 'sin_cos_pow_add',
    'sin_cos_pow_mul', 'sqrt_log100_mul', 'sqrt_log1000_pow',
    'surd_user_example', 'surd3_sq', 'surd2_sq', 'surd3_double_root',
    'surd_deep_nest', 'surd_quarter_mul', 'surd_half_diff', 'surd3_add_const'
  ]);
  switch (template) {
    case 'sin_sqrt_mul_add': { // sin(pi÷2)+sqrt(a)×b+c=d → 1+√a×b+c
      const a = pick(SQUARES), b = one9(), c = one9();
      return buildEquation([...sinHalf(), tok('operator','+'), ...sqrtOf(a), tok('operator','×'), tok('number',String(b)), tok('operator','+'), tok('number',String(c))], 1 + Math.sqrt(a) * b + c);
    }
    case 'cos_log_sqrt_add': { // cos(0)+log(1000)+sqrt(a)+b=c → 4+√a+b
      const a = pick(SQUARES), b = one9();
      return buildEquation([...cosZero(), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...sqrtOf(a), tok('operator','+'), tok('number',String(b))], 4 + Math.sqrt(a) + b);
    }
    case 'tan_sqrt_mul': { // tan(pi÷4)+sqrt(a)+b×c=d → 1+√a+b×c
      const a = pick(SQUARES), b = one9(), c = one9();
      return buildEquation([...tanQuarter(), tok('operator','+'), ...sqrtOf(a), tok('operator','+'), tok('number',String(b)), tok('operator','×'), tok('number',String(c))], 1 + Math.sqrt(a) + b * c);
    }
    case 'tan_sin_adds': { // tan(0)+sin(pi÷2)+a+b+c=d → 1+a+b+c
      const a = one9(), b = one9(), c = one9();
      return buildEquation([...tanZero(), tok('operator','+'), ...sinHalf(), tok('operator','+'), tok('number',String(a)), tok('operator','+'), tok('number',String(b)), tok('operator','+'), tok('number',String(c))], 1 + a + b + c);
    }
    case 'pow_pow_adds': { // a^x+b^y+c+d+e=f
      const a = base(), x = exp(), b = base(), y = exp(), c = one9(), d = one9(), e = one9();
      return buildEquation(
        [...powTerm(a, x), tok('operator','+'), ...powTerm(b, y), tok('operator','+'), tok('number',String(c)), tok('operator','+'), tok('number',String(d)), tok('operator','+'), tok('number',String(e))],
        Math.pow(a, x) + Math.pow(b, y) + c + d + e
      );
    }
    case 'pow_mul_pow_add': { // a^x×b+c^y+d=e
      const a = base(), x = exp(), b = one9(), c = base(), y = exp(), d = one9();
      return buildEquation(
        [...powTerm(a, x), tok('operator','×'), tok('number',String(b)), tok('operator','+'), ...powTerm(c, y), tok('operator','+'), tok('number',String(d))],
        Math.pow(a, x) * b + Math.pow(c, y) + d
      );
    }
    case 'sin_cos_pow_add': { // sin(pi÷2)+cos(0)+a^x+b=c → 2+a^x+b
      const a = base(), x = exp(), b = one9();
      return buildEquation([...sinHalf(), tok('operator','+'), ...cosZero(), tok('operator','+'), ...powTerm(a, x), tok('operator','+'), tok('number',String(b))], 2 + Math.pow(a, x) + b);
    }
    case 'sin_cos_pow_mul': { // sin(0)+cos(pi)+a×b+c+d=e → a×b+c+d-1
      const a = one9(), b = one9(), c = one9(), d = one9();
      return buildEquation([...sinZero(), tok('operator','+'), ...cosPi(), tok('operator','+'), tok('number',String(a)), tok('operator','×'), tok('number',String(b)), tok('operator','+'), tok('number',String(c)), tok('operator','+'), tok('number',String(d))], a * b + c + d - 1);
    }
    case 'sqrt_log100_mul': { // sqrt(a)+log(100)+b×c=d → √a+2+b×c
      const a = pick(SQUARES), b = one9(), c = one9();
      return buildEquation([...sqrtOf(a), tok('operator','+'), ...logOf(100), tok('operator','+'), tok('number',String(b)), tok('operator','×'), tok('number',String(c))], Math.sqrt(a) + 2 + b * c);
    }
    case 'sqrt_log1000_pow': { // sqrt(a)+log(1000)+b^c=d → √a+3+b^c
      const a = pick(SQUARES), b = base(), c = exp();
      return buildEquation([...sqrtOf(a), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...powTerm(b, c)], Math.sqrt(a) + 3 + Math.pow(b, c));
    }
    case 'surd_user_example': { // 2×(sin(pi÷3)+cos(pi÷6))×sqrt(3)=6（用户示例）
      return buildEquation([tok('number','2'), tok('operator','×'), ...gSqrt3(), ...timesSqrt(3)], 2 * VAL_SQRT3 * Math.sqrt(3));
    }
    case 'surd3_sq': { // (sin(pi÷3)+cos(pi÷6))^2=3
      return buildEquation([...gSqrt3(), tok('operator','^'), tok('number','2')], Math.pow(VAL_SQRT3, 2));
    }
    case 'surd2_sq': { // (sin(pi÷4)+cos(pi÷4))^2=2
      return buildEquation([...gSqrt2(), tok('operator','^'), tok('number','2')], Math.pow(VAL_SQRT2, 2));
    }
    case 'surd3_double_root': { // (sin(pi÷3)+cos(pi÷6))×(sqrt(3)+sqrt(3))=6
      return buildEquation([...gSqrt3(), tok('operator','×'), tok('lparen','(',false), ...sqrtOf(3), tok('operator','+'), ...sqrtOf(3), tok('rparen',')',false)], VAL_SQRT3 * (Math.sqrt(3) + Math.sqrt(3)));
    }
    case 'surd_deep_nest': { // 2×((sin(pi÷3)+cos(pi÷6))×sqrt(3))=6（双层括号）
      return buildEquation([tok('number','2'), tok('operator','×'), tok('lparen','(',false), ...gSqrt3(), ...timesSqrt(3), tok('rparen',')',false)], 2 * VAL_SQRT3 * Math.sqrt(3));
    }
    case 'surd_quarter_mul': { // 4×(sin(pi÷6)×cos(pi÷3))=1
      return buildEquation([tok('number','4'), tok('operator','×'), tok('lparen','(',false), ...sinOf(6), tok('operator','×'), ...cosOf(3), tok('rparen',')',false)], 4 * (Math.sin(Math.PI / 6) * Math.cos(Math.PI / 3)));
    }
    case 'surd_half_diff': { // 2×(sin(pi÷2)−cos(pi÷3))=1
      return buildEquation([tok('number','2'), tok('operator','×'), tok('lparen','(',false), ...sinOf(2), tok('operator','-'), ...cosOf(3), tok('rparen',')',false)], 2 * (Math.sin(Math.PI / 2) - Math.cos(Math.PI / 3)));
    }
    case 'surd3_add_const': { // (sin(pi÷3)+cos(pi÷6))×sqrt(3)+a=3+a
      const a = one9();
      return buildEquation([...gSqrt3(), ...timesSqrt(3), tok('operator','+'), tok('number',String(a))], VAL_SQRT3 * Math.sqrt(3) + a);
    }
  }
}

// 困难: 20-31 槽。引入 e / ln，多段长式（4-7 个幂项），幂指数 2-4
//   sin(pi÷2)+cos(0)+ln(e)+a^p+b^q+c^r+d^s=e
//   ln(1)+e^0+sin(pi÷2)+a^p+b^q+c^r+d^s=e
//   sqrt(a)+log(1000)+e^0+b^p+c^q+d^r+e^s=f
//   tan(pi÷4)+sin(pi÷2)×sqrt(a)+b^p+c^q+d^r=e
//   a^p×b+c^q+d^r+e^s+f^t+g^u=h
//   ln(e)+sqrt(a)+sqrt(b)+c^p+d^q+e^r+f^s=g
//   cos(0)+sin(0)+tan(0)+e^0+a^p+b^q+c^r=d
//   sqrt(a)+sqrt(b)+log(100)+c^p+d^q+e^r+f^s=g
//   a^p+b^q+c^r+d^s+e^t+f^u+g^v=h
//   sin(pi÷2)×sqrt(a)+cos(0)×sqrt(b)+ln(e)+c^p+d^q=e
//   e^0+ln(1)+a^p+b^q+c^r+d^s+e^t=f
//   sqrt(a)+sin(pi÷2)+log(1000)+b^p+c^q+d^r=e
//   特殊角根式组合（与幂项连乘连加）：
//   (sin(pi÷3)+cos(pi÷6))×sqrt(3)×a^p+b^q+c^r+d^s=e / (sin(pi÷4)+cos(pi÷4))×sqrt(2)×a^p+b^q+c^r+d^s=e
//   ((sin(pi÷3)+cos(pi÷6))×sqrt(3))^2+a^p+b^q=e / 2×(sin(pi÷3)+cos(pi÷6))×sqrt(3)+a^p+b^q+c^r=e
//   (sin(pi÷3)+cos(pi÷6))×sqrt(3)+(sin(pi÷4)+cos(pi÷4))×sqrt(2)+a^p=e
//   4×(sin(pi÷6)×cos(pi÷3))×a^p+b^q+c^r+d^s=e
function genHard(rng) {
  const { int, pick } = rng;
  const one9 = () => int(1, 9);
  const template = pick([
    'sin_cos_ln_pows4', 'ln1_e0_sin_pows4', 'sqrt_log_e0_pows4',
    'tan_sin_sqrt_pows3', 'powmul_pows5', 'ln_sqrt_sqrt_pows4',
    'cos_sin_tan_e0_pows3', 'sqrt_sqrt_log_pows4', 'pows7',
    'sin_sqrt_cos_sqrt_ln_pows2', 'e0_ln1_pows5', 'sqrt_sin_log_pows3',
    'surd3_mul_pows4', 'surd2_mul_pows4', 'surd_deep_sq_pows2',
    'surd2x_pows3', 'surd3_surd2_pow', 'surd_quarter_mul_pows4'
  ]);
  switch (template) {
    case 'sin_cos_ln_pows4': { // 3+sum4
      const pc = powRun(rng, 4, 2, 5, HARD_EXP);
      return buildEquation([...sinHalf(), tok('operator','+'), ...cosZero(), tok('operator','+'), ...lnOf('e'), tok('operator','+'), ...pc.tokens], 3 + pc.sum);
    }
    case 'ln1_e0_sin_pows4': { // 0+1+1+sum4 = 2+sum4
      const pc = powRun(rng, 4, 2, 5, HARD_EXP);
      return buildEquation([...lnOf(1), tok('operator','+'), ...ePow0(), tok('operator','+'), ...sinHalf(), tok('operator','+'), ...pc.tokens], 2 + pc.sum);
    }
    case 'sqrt_log_e0_pows4': { // √a+3+1+sum4 = √a+4+sum4
      const a = pick(BIG_SQUARES);
      const pc = powRun(rng, 4, 2, 5, HARD_EXP);
      return buildEquation([...sqrtOf(a), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...ePow0(), tok('operator','+'), ...pc.tokens], Math.sqrt(a) + 4 + pc.sum);
    }
    case 'tan_sin_sqrt_pows3': { // 1+√a+sum3
      const a = pick(BIG_SQUARES);
      const pc = powRun(rng, 3, 2, 5, HARD_EXP);
      return buildEquation([...tanQuarter(), tok('operator','+'), ...sinHalf(), tok('operator','×'), ...sqrtOf(a), tok('operator','+'), ...pc.tokens], 1 + Math.sqrt(a) + pc.sum);
    }
    case 'powmul_pows5': { // a^p×b+sum5
      const a = int(2, 5), p = pick(HARD_EXP), b = one9();
      const pc = powRun(rng, 5, 2, 5, HARD_EXP);
      return buildEquation([...powTerm(a, p), tok('operator','×'), tok('number',String(b)), tok('operator','+'), ...pc.tokens], Math.pow(a, p) * b + pc.sum);
    }
    case 'ln_sqrt_sqrt_pows4': { // 1+√a+√b+sum4
      const a = pick(BIG_SQUARES), b = pick(BIG_SQUARES);
      const pc = powRun(rng, 4, 2, 5, HARD_EXP);
      return buildEquation([...lnOf('e'), tok('operator','+'), ...sqrtOf(a), tok('operator','+'), ...sqrtOf(b), tok('operator','+'), ...pc.tokens], 1 + Math.sqrt(a) + Math.sqrt(b) + pc.sum);
    }
    case 'cos_sin_tan_e0_pows3': { // 1+0+0+1+sum3 = 2+sum3
      const pc = powRun(rng, 3, 2, 5, HARD_EXP);
      return buildEquation([...cosZero(), tok('operator','+'), ...sinZero(), tok('operator','+'), ...tanZero(), tok('operator','+'), ...ePow0(), tok('operator','+'), ...pc.tokens], 2 + pc.sum);
    }
    case 'sqrt_sqrt_log_pows4': { // √a+√b+2+sum4
      const a = pick(BIG_SQUARES), b = pick(BIG_SQUARES);
      const pc = powRun(rng, 4, 2, 5, HARD_EXP);
      return buildEquation([...sqrtOf(a), tok('operator','+'), ...sqrtOf(b), tok('operator','+'), ...logOf(100), tok('operator','+'), ...pc.tokens], Math.sqrt(a) + Math.sqrt(b) + 2 + pc.sum);
    }
    case 'pows7': { // sum7
      const pc = powRun(rng, 7, 2, 5, HARD_EXP);
      return buildEquation([...pc.tokens], pc.sum);
    }
    case 'sin_sqrt_cos_sqrt_ln_pows2': { // √a+√b+1+sum2
      const a = pick(BIG_SQUARES), b = pick(BIG_SQUARES);
      const pc = powRun(rng, 2, 2, 5, HARD_EXP);
      return buildEquation([...sinHalf(), tok('operator','×'), ...sqrtOf(a), tok('operator','+'), ...cosZero(), tok('operator','×'), ...sqrtOf(b), tok('operator','+'), ...lnOf('e'), tok('operator','+'), ...pc.tokens], Math.sqrt(a) + Math.sqrt(b) + 1 + pc.sum);
    }
    case 'e0_ln1_pows5': { // 1+0+sum5 = 1+sum5
      const pc = powRun(rng, 5, 2, 5, HARD_EXP);
      return buildEquation([...ePow0(), tok('operator','+'), ...lnOf(1), tok('operator','+'), ...pc.tokens], 1 + pc.sum);
    }
    case 'sqrt_sin_log_pows3': { // √a+1+3+sum3 = √a+4+sum3
      const a = pick(BIG_SQUARES);
      const pc = powRun(rng, 3, 2, 5, HARD_EXP);
      return buildEquation([...sqrtOf(a), tok('operator','+'), ...sinHalf(), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...pc.tokens], Math.sqrt(a) + 4 + pc.sum);
    }
    case 'surd3_mul_pows4': { // (sin(pi÷3)+cos(pi÷6))×sqrt(3)×a^p+b^q+c^r+d^s = 3a^p+sum3
      const a = int(2, 5), p = pick(HARD_EXP);
      const pc = powRun(rng, 3, 2, 5, HARD_EXP);
      return buildEquation([...gSqrt3(), ...timesSqrt(3), tok('operator','×'), ...powTerm(a, p), tok('operator','+'), ...pc.tokens], VAL_SQRT3 * Math.sqrt(3) * Math.pow(a, p) + pc.sum);
    }
    case 'surd2_mul_pows4': { // (sin(pi÷4)+cos(pi÷4))×sqrt(2)×a^p+b^q+c^r+d^s = 2a^p+sum3
      const a = int(2, 5), p = pick(HARD_EXP);
      const pc = powRun(rng, 3, 2, 5, HARD_EXP);
      return buildEquation([...gSqrt2(), ...timesSqrt(2), tok('operator','×'), ...powTerm(a, p), tok('operator','+'), ...pc.tokens], VAL_SQRT2 * Math.sqrt(2) * Math.pow(a, p) + pc.sum);
    }
    case 'surd_deep_sq_pows2': { // ((sin(pi÷3)+cos(pi÷6))×sqrt(3))^2+a^p+b^q = 9+a^p+b^q
      const a = int(2, 5), p = pick(HARD_EXP), b = int(2, 5), q = pick(HARD_EXP);
      return buildEquation([
        tok('lparen','(',false), ...gSqrt3(), ...timesSqrt(3), tok('rparen',')',false), tok('operator','^'), tok('number','2'),
        tok('operator','+'), ...powTerm(a, p), tok('operator','+'), ...powTerm(b, q)
      ], Math.pow(VAL_SQRT3 * Math.sqrt(3), 2) + Math.pow(a, p) + Math.pow(b, q));
    }
    case 'surd2x_pows3': { // 2×(sin(pi÷3)+cos(pi÷6))×sqrt(3)+a^p+b^q+c^r = 6+sum3
      const pc = powRun(rng, 3, 2, 5, HARD_EXP);
      return buildEquation([tok('number','2'), tok('operator','×'), ...gSqrt3(), ...timesSqrt(3), tok('operator','+'), ...pc.tokens], 2 * VAL_SQRT3 * Math.sqrt(3) + pc.sum);
    }
    case 'surd3_surd2_pow': { // (sin(pi÷3)+cos(pi÷6))×sqrt(3)+(sin(pi÷4)+cos(pi÷4))×sqrt(2)+a^p = 5+a^p
      const a = int(2, 5), p = pick(HARD_EXP);
      return buildEquation([...gSqrt3(), ...timesSqrt(3), tok('operator','+'), ...gSqrt2(), ...timesSqrt(2), tok('operator','+'), ...powTerm(a, p)], VAL_SQRT3 * Math.sqrt(3) + VAL_SQRT2 * Math.sqrt(2) + Math.pow(a, p));
    }
    case 'surd_quarter_mul_pows4': { // 4×(sin(pi÷6)×cos(pi÷3))×a^p+b^q+c^r+d^s = a^p+sum3
      const a = int(2, 5), p = pick(HARD_EXP);
      const pc = powRun(rng, 3, 2, 5, HARD_EXP);
      return buildEquation([
        tok('number','4'), tok('operator','×'), tok('lparen','(',false), ...sinOf(6), tok('operator','×'), ...cosOf(3), tok('rparen',')',false),
        tok('operator','×'), ...powTerm(a, p), tok('operator','+'), ...pc.tokens
      ], 4 * (Math.sin(Math.PI / 6) * Math.cos(Math.PI / 3)) * Math.pow(a, p) + pc.sum);
    }
  }
}

// 极难: 30-45 槽。引入 abs，超长组合式（5-8 个幂项），幂指数 2-5
//   sin(pi÷2)+cos(0)+log(1000)+sqrt(a)+b^p+c^q+d^r+e^s+f^t+g^u=h
//   sin(pi÷2)×sqrt(a)+cos(0)×sqrt(b)+tan(pi÷4)+c^p+d^q+e^r+f^s+g^t=h
//   sqrt(a)+sqrt(b)+sqrt(c)+log(100)+d^p+e^q+f^r+g^s+h^t=i
//   ln(e)+ln(1)+e^0+a^p+b^q+c^r+d^s+e^t+f^u+g^v+h^w=i
//   abs(a-b)+sin(pi÷2)+cos(0)+c^p+d^q+e^r+f^s+g^t+h^u=i
//   abs(a-b)+abs(c-d)+e^p+f^q+g^r+h^s+i^t+j^u+log(1000)=k
//   sin(pi÷2)+tan(pi÷4)+log(1000)+sqrt(a)+sqrt(b)+c^p+d^q+e^r+f^s=g
//   e^0+sin(pi)+cos(pi)+tan(0)+a^p+b^q+c^r+d^s+e^t+f^u+g^v=h
//   sqrt(a)+sqrt(b)+sqrt(c)+sqrt(d)+log(1000)+ln(e)+e^p+f^q+g^r=h
//   abs(a-b)×c+d^p+e^q+f^r+g^s+h^t+i^u+log(1000)=j
//   sin(pi÷2)+cos(0)+log(1000)+sqrt(a)+b^p+c^q+d^r+e^s+f^t+g^u=h
//   tan(pi÷4)+ln(e)+e^0+a^p+b^q+c^r+d^s+e^t+f^u+g^v=h
//   sqrt(a)+log(1000)+abs(b-c)+d^p+e^q+f^r+g^s+h^t+i^u=j
//   sin(pi÷2)+cos(0)+tan(pi÷4)+log(1000)+sqrt(a)+sqrt(b)+e^0+c^p+d^q=e
//   特殊角根式组合（深层括号 + 幂项）：
//   (sin(pi÷3)+cos(pi÷6))×sqrt(3)+(sin(pi÷4)+cos(pi÷4))×sqrt(2)+a^p+b^q+c^r+d^s=e
//   ((sin(pi÷3)+cos(pi÷6))×sqrt(3))^2+((sin(pi÷4)+cos(pi÷4))×sqrt(2))^2+a^p+b^q=e
//   2×(sin(pi÷3)+cos(pi÷6))×sqrt(3)+(sin(pi÷4)+cos(pi÷4))×sqrt(2)+a^p+b^q+c^r=e
//   (sin(pi÷3)+cos(pi÷6))×sqrt(3)×a^p+b^q+c^r+d^s+e^t+f^u=g
//   ((sin(pi÷3)+cos(pi÷6))×sqrt(3)+(sin(pi÷4)+cos(pi÷4))×sqrt(2))^2+a^p=e
//   4×(sin(pi÷6)×cos(pi÷3))×(sin(pi÷4)+cos(pi÷4))×sqrt(2)+a^p+b^q+c^r=e
function genExpert(rng) {
  const { int, pick } = rng;
  const one9 = () => int(1, 9);
  const template = pick([
    'sin_cos_log_sqrt_pows6', 'sin_sqrt_cos_sqrt_tan_pows5', 'sqrt3_log_pows5',
    'lns_e0_pows8', 'abs_sin_cos_pows6', 'abs2_pows6_log',
    'sin_tan_log_sqrt2_pows5', 'e0_sin_cos_tan_pows7', 'sqrt4_log_ln_pows3',
    'absmul_pows6_log', 'sin_log_sqrt_pows7', 'tan_ln_e0_pows7',
    'sqrt_log_abs_pows6', 'bigmix_pows2',
    'surd3_surd2_pows4', 'surd_deep_sq2_pows2', 'surd2x_surd2_pows3',
    'surd3_mul_pows5', 'surd_big_deep_sq_pow', 'surd_quarter_surd2_pows3'
  ]);
  switch (template) {
    case 'sin_cos_log_sqrt_pows6': { // 1+1+3+√a+sum6 = 5+√a+sum6
      const a = pick(BIG_SQUARES);
      const pc = powRun(rng, 6, 2, 4, EXPERT_EXP);
      return buildEquation([...sinHalf(), tok('operator','+'), ...cosZero(), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...sqrtOf(a), tok('operator','+'), ...pc.tokens], 5 + Math.sqrt(a) + pc.sum);
    }
    case 'sin_sqrt_cos_sqrt_tan_pows5': { // √a+√b+1+sum5
      const a = pick(BIG_SQUARES), b = pick(BIG_SQUARES);
      const pc = powRun(rng, 5, 2, 4, EXPERT_EXP);
      return buildEquation([...sinHalf(), tok('operator','×'), ...sqrtOf(a), tok('operator','+'), ...cosZero(), tok('operator','×'), ...sqrtOf(b), tok('operator','+'), ...tanQuarter(), tok('operator','+'), ...pc.tokens], Math.sqrt(a) + Math.sqrt(b) + 1 + pc.sum);
    }
    case 'sqrt3_log_pows5': { // √a+√b+√c+2+sum5
      const a = pick(BIG_SQUARES), b = pick(BIG_SQUARES), c = pick(BIG_SQUARES);
      const pc = powRun(rng, 5, 2, 4, EXPERT_EXP);
      return buildEquation([...sqrtOf(a), tok('operator','+'), ...sqrtOf(b), tok('operator','+'), ...sqrtOf(c), tok('operator','+'), ...logOf(100), tok('operator','+'), ...pc.tokens], Math.sqrt(a) + Math.sqrt(b) + Math.sqrt(c) + 2 + pc.sum);
    }
    case 'lns_e0_pows8': { // 1+0+1+sum8 = 2+sum8
      const pc = powRun(rng, 8, 2, 4, EXPERT_EXP);
      return buildEquation([...lnOf('e'), tok('operator','+'), ...lnOf(1), tok('operator','+'), ...ePow0(), tok('operator','+'), ...pc.tokens], 2 + pc.sum);
    }
    case 'abs_sin_cos_pows6': { // |a-b|+1+1+sum6 = |a-b|+2+sum6
      const a = one9(), b = one9();
      const pc = powRun(rng, 6, 2, 4, EXPERT_EXP);
      return buildEquation([...absSub(a, b), tok('operator','+'), ...sinHalf(), tok('operator','+'), ...cosZero(), tok('operator','+'), ...pc.tokens], Math.abs(a - b) + 2 + pc.sum);
    }
    case 'abs2_pows6_log': { // |a-b|+|c-d|+sum6+3
      const a = one9(), b = one9(), c = one9(), d = one9();
      const pc = powRun(rng, 6, 2, 4, EXPERT_EXP);
      return buildEquation([...absSub(a, b), tok('operator','+'), ...absSub(c, d), tok('operator','+'), ...pc.tokens, tok('operator','+'), ...logOf(1000)], Math.abs(a - b) + Math.abs(c - d) + pc.sum + 3);
    }
    case 'sin_tan_log_sqrt2_pows5': { // 1+1+3+√a+√b+sum5 = 5+√a+√b+sum5
      const a = pick(BIG_SQUARES), b = pick(BIG_SQUARES);
      const pc = powRun(rng, 5, 2, 4, EXPERT_EXP);
      return buildEquation([...sinHalf(), tok('operator','+'), ...tanQuarter(), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...sqrtOf(a), tok('operator','+'), ...sqrtOf(b), tok('operator','+'), ...pc.tokens], 5 + Math.sqrt(a) + Math.sqrt(b) + pc.sum);
    }
    case 'e0_sin_cos_tan_pows7': { // 1+0-1+0+sum7 = sum7
      const pc = powRun(rng, 7, 2, 4, EXPERT_EXP);
      return buildEquation([...ePow0(), tok('operator','+'), ...sinPi(), tok('operator','+'), ...cosPi(), tok('operator','+'), ...tanZero(), tok('operator','+'), ...pc.tokens], pc.sum);
    }
    case 'sqrt4_log_ln_pows3': { // √a+√b+√c+√d+3+1+sum3 = 4+√a+√b+√c+√d+sum3
      const a = pick(BIG_SQUARES), b = pick(BIG_SQUARES), c = pick(BIG_SQUARES), d = pick(BIG_SQUARES);
      const pc = powRun(rng, 3, 2, 4, EXPERT_EXP);
      return buildEquation([...sqrtOf(a), tok('operator','+'), ...sqrtOf(b), tok('operator','+'), ...sqrtOf(c), tok('operator','+'), ...sqrtOf(d), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...lnOf('e'), tok('operator','+'), ...pc.tokens], 4 + Math.sqrt(a) + Math.sqrt(b) + Math.sqrt(c) + Math.sqrt(d) + pc.sum);
    }
    case 'absmul_pows6_log': { // |a-b|×c+sum6+3
      const a = one9(), b = one9(), c = one9();
      const pc = powRun(rng, 6, 2, 4, EXPERT_EXP);
      return buildEquation([...absSub(a, b), tok('operator','×'), tok('number',String(c)), tok('operator','+'), ...pc.tokens, tok('operator','+'), ...logOf(1000)], Math.abs(a - b) * c + pc.sum + 3);
    }
    case 'sin_log_sqrt_pows7': { // 1+3+√a+sum7 = 4+√a+sum7
      const a = pick(BIG_SQUARES);
      const pc = powRun(rng, 7, 2, 4, EXPERT_EXP);
      return buildEquation([...sinHalf(), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...sqrtOf(a), tok('operator','+'), ...pc.tokens], 4 + Math.sqrt(a) + pc.sum);
    }
    case 'tan_ln_e0_pows7': { // 1+1+1+sum7 = 3+sum7
      const pc = powRun(rng, 7, 2, 4, EXPERT_EXP);
      return buildEquation([...tanQuarter(), tok('operator','+'), ...lnOf('e'), tok('operator','+'), ...ePow0(), tok('operator','+'), ...pc.tokens], 3 + pc.sum);
    }
    case 'sqrt_log_abs_pows6': { // √a+3+|b-c|+sum6
      const a = pick(BIG_SQUARES), b = one9(), c = one9();
      const pc = powRun(rng, 6, 2, 4, EXPERT_EXP);
      return buildEquation([...sqrtOf(a), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...absSub(b, c), tok('operator','+'), ...pc.tokens], Math.sqrt(a) + 3 + Math.abs(b - c) + pc.sum);
    }
    case 'bigmix_pows2': { // 1+1+1+3+√a+√b+1+sum2 = 7+√a+√b+sum2
      const a = pick(BIG_SQUARES), b = pick(BIG_SQUARES);
      const pc = powRun(rng, 2, 2, 4, EXPERT_EXP);
      return buildEquation([...sinHalf(), tok('operator','+'), ...cosZero(), tok('operator','+'), ...tanQuarter(), tok('operator','+'), ...logOf(1000), tok('operator','+'), ...sqrtOf(a), tok('operator','+'), ...sqrtOf(b), tok('operator','+'), ...ePow0(), tok('operator','+'), ...pc.tokens], 7 + Math.sqrt(a) + Math.sqrt(b) + pc.sum);
    }
    case 'surd3_surd2_pows4': { // (√3组)×√3+(√2组)×√2+a^p+b^q+c^r+d^s = 5+sum4
      const pc = powRun(rng, 4, 2, 4, EXPERT_EXP);
      return buildEquation([...gSqrt3(), ...timesSqrt(3), tok('operator','+'), ...gSqrt2(), ...timesSqrt(2), tok('operator','+'), ...pc.tokens], VAL_SQRT3 * Math.sqrt(3) + VAL_SQRT2 * Math.sqrt(2) + pc.sum);
    }
    case 'surd_deep_sq2_pows2': { // ((√3组)×√3)^2+((√2组)×√2)^2+a^p+b^q = 13+a^p+b^q
      const a = int(2, 4), p = pick(EXPERT_EXP), b = int(2, 4), q = pick(EXPERT_EXP);
      return buildEquation([
        tok('lparen','(',false), ...gSqrt3(), ...timesSqrt(3), tok('rparen',')',false), tok('operator','^'), tok('number','2'),
        tok('operator','+'),
        tok('lparen','(',false), ...gSqrt2(), ...timesSqrt(2), tok('rparen',')',false), tok('operator','^'), tok('number','2'),
        tok('operator','+'), ...powTerm(a, p), tok('operator','+'), ...powTerm(b, q)
      ], Math.pow(VAL_SQRT3 * Math.sqrt(3), 2) + Math.pow(VAL_SQRT2 * Math.sqrt(2), 2) + Math.pow(a, p) + Math.pow(b, q));
    }
    case 'surd2x_surd2_pows3': { // 2×(√3组)×√3+(√2组)×√2+a^p+b^q+c^r = 8+sum3
      const pc = powRun(rng, 3, 2, 4, EXPERT_EXP);
      return buildEquation([tok('number','2'), tok('operator','×'), ...gSqrt3(), ...timesSqrt(3), tok('operator','+'), ...gSqrt2(), ...timesSqrt(2), tok('operator','+'), ...pc.tokens], 2 * VAL_SQRT3 * Math.sqrt(3) + VAL_SQRT2 * Math.sqrt(2) + pc.sum);
    }
    case 'surd3_mul_pows5': { // (√3组)×√3×a^p+b^q+c^r+d^s+e^t+f^u = 3a^p+sum5
      const a = int(2, 4), p = pick(EXPERT_EXP);
      const pc = powRun(rng, 5, 2, 4, EXPERT_EXP);
      return buildEquation([...gSqrt3(), ...timesSqrt(3), tok('operator','×'), ...powTerm(a, p), tok('operator','+'), ...pc.tokens], VAL_SQRT3 * Math.sqrt(3) * Math.pow(a, p) + pc.sum);
    }
    case 'surd_big_deep_sq_pow': { // ((√3组)×√3+(√2组)×√2)^2+a^p = 25+a^p
      const a = int(2, 4), p = pick(EXPERT_EXP);
      return buildEquation([
        tok('lparen','(',false), ...gSqrt3(), ...timesSqrt(3), tok('operator','+'), ...gSqrt2(), ...timesSqrt(2), tok('rparen',')',false),
        tok('operator','^'), tok('number','2'), tok('operator','+'), ...powTerm(a, p)
      ], Math.pow(VAL_SQRT3 * Math.sqrt(3) + VAL_SQRT2 * Math.sqrt(2), 2) + Math.pow(a, p));
    }
    case 'surd_quarter_surd2_pows3': { // 4×(sin(pi÷6)×cos(pi÷3))×(√2组)×√2+a^p+b^q+c^r = 2+sum3
      const pc = powRun(rng, 3, 2, 4, EXPERT_EXP);
      return buildEquation([
        tok('number','4'), tok('operator','×'), tok('lparen','(',false), ...sinOf(6), tok('operator','×'), ...cosOf(3), tok('rparen',')',false),
        tok('operator','×'), ...gSqrt2(), ...timesSqrt(2), tok('operator','+'), ...pc.tokens
      ], 4 * (Math.sin(Math.PI / 6) * Math.cos(Math.PI / 3)) * VAL_SQRT2 * Math.sqrt(2) + pc.sum);
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

// 统计隐藏槽位数量
function countHidden(tokens) {
  return tokens.filter((t) => t.hidden).length;
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
  const [minSlots, maxSlots] = SLOT_RANGES[difficulty] || [1, Infinity];
  let tokens;
  let attempts = 0;
  do {
    tokens = gen(rng);
    attempts++;
    if (attempts > 80) break;
  } while (!verifyEquation(tokens) || !(countHidden(tokens) >= minSlots && countHidden(tokens) <= maxSlots));

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
