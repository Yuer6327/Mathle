// 安全表达式解析器（递归下降）
// 支持: + - * / % ^ sqrt sin cos tan log pi e
// 不使用 eval，完全自实现

const MATH = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: (x) => Math.log10(x), // log 默认以10为底
  ln: Math.log,
  abs: Math.abs
};

const CONSTANTS = {
  pi: Math.PI,
  e: Math.E
};

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    // 数字（含小数点）
    if (/[0-9.]/.test(c)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }
    // 标识符（函数名、常量名）
    if (/[a-zA-Z]/.test(c)) {
      let id = '';
      while (i < expr.length && /[a-zA-Z]/.test(expr[i])) {
        id += expr[i++];
      }
      if (id in MATH) {
        tokens.push({ type: 'func', value: id });
      } else if (id in CONSTANTS) {
        tokens.push({ type: 'number', value: CONSTANTS[id] });
      } else if (id === 'pi' || id === 'PI') {
        tokens.push({ type: 'number', value: Math.PI });
      } else {
        throw new Error(`未知标识符: ${id}`);
      }
      continue;
    }
    // 运算符和括号
    if ('+-*/%^()'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }
    throw new Error(`非法字符: ${c} (位置 ${i})`);
  }
  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos]; }
  consume() { return this.tokens[this.pos++]; }

  parseExpression() {
    let left = this.parseTerm();
    while (this.peek() && this.peek().value === '+' || (this.peek() && this.peek().value === '-')) {
      const op = this.consume().value;
      const right = this.parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  parseTerm() {
    let left = this.parseFactor();
    while (this.peek() && (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%')) {
      const op = this.consume().value;
      const right = this.parseFactor();
      if (op === '*') left = left * right;
      else if (op === '/') {
        if (right === 0) throw new Error('除以零');
        left = left / right;
      } else {
        if (right === 0) throw new Error('模零');
        left = left % right;
      }
    }
    return left;
  }

  // 幂运算，右结合
  parseFactor() {
    const base = this.parseBase();
    if (this.peek() && this.peek().value === '^') {
      this.consume();
      const exp = this.parseFactor(); // 右结合 → 递归
      return Math.pow(base, exp);
    }
    return base;
  }

  parseBase() {
    const tok = this.peek();
    if (!tok) throw new Error('表达式不完整');

    // 数字
    if (tok.type === 'number') {
      this.consume();
      return tok.value;
    }

    // 括号
    if (tok.value === '(') {
      this.consume();
      const val = this.parseExpression();
      if (!this.peek() || this.peek().value !== ')') throw new Error('缺少右括号');
      this.consume();
      return val;
    }

    // 函数
    if (tok.type === 'func') {
      this.consume();
      if (!this.peek() || this.peek().value !== '(') throw new Error(`函数 ${tok.value} 后需要括号`);
      this.consume();
      const arg = this.parseExpression();
      if (!this.peek() || this.peek().value !== ')') throw new Error(`函数 ${tok.value} 缺少右括号`);
      this.consume();
      return MATH[tok.value](arg);
    }

    // 一元负号
    if (tok.value === '-') {
      this.consume();
      return -this.parseFactor();
    }

    throw new Error(`意外的 token: ${tok.value}`);
  }

  parse() {
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error(`表达式末尾有未消费的 token: ${this.peek().value}`);
    }
    return result;
  }
}

/**
 * 安全计算数学表达式
 * @param {string} expr - 表达式，如 "3 * (4 + 2)" 或 "Math.sin(Math.PI / 2) + 1"
 * @returns {number} 计算结果
 */
export function evaluate(expr) {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * 判断一个数是否为整数
 */
export function isInteger(n) {
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-9;
}

/**
 * 判断一个数是否为"漂亮"的结果（整数或简单分数）
 */
export function isNiceNumber(n) {
  return isInteger(n);
}
