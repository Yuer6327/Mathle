// 猜词校验：服务端权威验证，复用前端同一套 evaluator/feedback/constants 逻辑
import { SYMBOL_POOLS } from '../src/lib/constants.js';
import { calculateFeedback, isAllCorrect } from '../src/lib/feedback.js';

const poolCache = new Map();

function poolFor(difficulty) {
  if (!poolCache.has(difficulty)) {
    const p = SYMBOL_POOLS[difficulty] || {};
    poolCache.set(
      difficulty,
      new Set([...(p.numbers || []), ...(p.operators || []), ...(p.functions || [])])
    );
  }
  return poolCache.get(difficulty);
}

/**
 * 校验一次猜测
 * @param {{symbols:string[], difficulty:string, answer:string[]}} args
 * @returns {{ok:boolean, reason?:string, feedback?:string[], correct?:boolean}}
 */
export function validateGuess({ symbols, difficulty, answer }) {
  if (!Array.isArray(symbols)) return { ok: false, reason: '猜测格式错误' };
  if (symbols.length !== answer.length) return { ok: false, reason: '槽位数量不匹配' };

  const pool = poolFor(difficulty);
  for (const s of symbols) {
    if (typeof s !== 'string' || !pool.has(s)) {
      return { ok: false, reason: `包含非法符号` };
    }
  }

  const feedback = calculateFeedback(symbols, answer);
  return { ok: true, feedback, correct: isAllCorrect(feedback) };
}
