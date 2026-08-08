// Wordle 风格反馈计算
// 严格遵循 Wordle 规则处理重复符号

import { FEEDBACK } from './constants.js';

/**
 * 计算猜测反馈
 * @param {string[]} guess - 玩家猜测的符号数组
 * @param {string[]} answer - 正确答案的符号数组
 * @returns {string[]} 反馈数组，每个元素为 'correct'/'present'/'absent'
 */
export function calculateFeedback(guess, answer) {
  const n = answer.length;
  const feedback = new Array(n).fill(FEEDBACK.ABSENT);
  const answerUsed = new Array(n).fill(false);

  // 第一步：标记所有完全正确的位置为绿色
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      feedback[i] = FEEDBACK.CORRECT;
      answerUsed[i] = true;
    }
  }

  // 第二步：从左到右，对于非绿色的猜测，在答案中找未匹配的同符号
  for (let i = 0; i < n; i++) {
    if (feedback[i] === FEEDBACK.CORRECT) continue;
    for (let j = 0; j < n; j++) {
      if (!answerUsed[j] && guess[i] === answer[j]) {
        feedback[i] = FEEDBACK.PRESENT;
        answerUsed[j] = true;
        break;
      }
    }
  }

  return feedback;
}

/**
 * 判断是否全部猜对
 */
export function isAllCorrect(feedback) {
  return feedback.every(f => f === FEEDBACK.CORRECT);
}

/**
 * 统计反馈信息（用于提示系统）
 */
export function getFeedbackStats(feedback, answer) {
  const correct = feedback.filter(f => f === FEEDBACK.CORRECT).length;
  const present = feedback.filter(f => f === FEEDBACK.PRESENT).length;
  const absent = feedback.filter(f => f === FEEDBACK.ABSENT).length;
  return { correct, present, absent, total: answer.length };
}
