// Bot AI 逻辑
// 根据难度模拟不同推理能力

import { SYMBOL_POOLS } from './constants.js';
import { calculateFeedback, isAllCorrect } from './feedback.js';

/**
 * Bot 猜测策略
 * - beginner: 基本随机放置
 * - easy: 会使用排除法
 * - medium: 会使用排除法 + 优先放置已知存在的符号
 * - hard/expert: 更高效推理，系统性尝试
 */
export function botGuess(answer, difficulty, history, rng) {
  const pool = SYMBOL_POOLS[difficulty];
  const allSymbols = [...pool.numbers, ...pool.operators, ...pool.functions];
  const n = answer.length;
  const difficultyLevel = ['beginner', 'easy', 'medium', 'hard', 'expert'].indexOf(difficulty);

  // 收集已知信息
  const known = new Array(n).fill(null); // 确定正确的位置
  const eliminated = new Set(); // 已确认不存在的符号
  const confirmedPresent = new Map(); // 确认存在但位置不确定的符号 → 最少出现次数
  const positionExcluded = Array.from({ length: n }, () => new Set()); // 每个位置已排除的符号
  const positionTried = Array.from({ length: n }, () => new Set()); // 每个位置已试过的符号

  // 分析历史
  for (const { guess, feedback } of history) {
    // 先统计本轮各符号的 present+correct 数
    const symbolCounts = new Map();
    for (let i = 0; i < n; i++) {
      if (feedback[i] === 'correct' || feedback[i] === 'present') {
        symbolCounts.set(guess[i], (symbolCounts.get(guess[i]) || 0) + 1);
      }
    }
    // 更新 confirmedPresent
    for (const [sym, count] of symbolCounts) {
      const current = confirmedPresent.get(sym) || 0;
      if (count > current) {
        confirmedPresent.set(sym, count);
      }
    }

    // 更新 known / positionExcluded / positionTried
    for (let i = 0; i < n; i++) {
      positionTried[i].add(guess[i]);
      if (feedback[i] === 'correct') {
        known[i] = guess[i];
      } else if (feedback[i] === 'absent') {
        // 如果这个符号在本轮中没有 correct/present，则它不在答案中
        if (!symbolCounts.has(guess[i])) {
          eliminated.add(guess[i]);
        }
        positionExcluded[i].add(guess[i]);
      } else if (feedback[i] === 'present') {
        positionExcluded[i].add(guess[i]); // 在此位置不正确
      }
    }
  }

  // 确定已放置的 confirmedPresent 符号数量
  const placed = new Map(); // sym → 已在 known 中放置的数量
  for (let i = 0; i < n; i++) {
    if (known[i] !== null) {
      placed.set(known[i], (placed.get(known[i]) || 0) + 1);
    }
  }
  // 尚未放置的 confirmedPresent 符号
  const unplaced = [];
  for (const [sym, count] of confirmedPresent) {
    const remaining = count - (placed.get(sym) || 0);
    for (let k = 0; k < remaining; k++) {
      unplaced.push(sym);
    }
  }

  // 起跑优势：高难度 bot 开局已知 1-2 个位置（模拟 bot 已做了一些推理）
  if (history.length === 0 && difficultyLevel >= 2) {
    const revealCount = difficultyLevel >= 3 ? 2 : 1;
    const indices = rng.shuffle([...Array(n).keys()]).slice(0, revealCount);
    for (const idx of indices) {
      known[idx] = answer[idx];
    }
  }

  // 构建猜测
  const guess = new Array(n);
  for (let i = 0; i < n; i++) {
    if (known[i] !== null) {
      guess[i] = known[i];
      continue;
    }

    // 候选符号
    let candidates = allSymbols.filter(s => !eliminated.has(s));

    // 排除该位置已试过的
    if (difficultyLevel >= 1) {
      candidates = candidates.filter(s => !positionTried[i].has(s));
    }

    if (candidates.length === 0) {
      candidates = allSymbols.filter(s => !positionExcluded[i].has(s));
    }
    if (candidates.length === 0) candidates = [...allSymbols];

    // 优先放置尚未放置的 confirmedPresent 符号
    if (difficultyLevel >= 2 && unplaced.length > 0) {
      // 找到 unplaced 中能放在此位置的符号
      const smart = unplaced.filter(s => !positionExcluded[i].has(s) && !positionTried[i].has(s));
      if (smart.length > 0) {
        // 优先选出现次数多的
        smart.sort((a, b) => {
          const ca = candidates.filter(c => c === a).length;
          const cb = candidates.filter(c => c === b).length;
          return cb - ca;
        });
        guess[i] = rng.pick(smart);
        // 从 unplaced 中移除
        const idx = unplaced.indexOf(guess[i]);
        if (idx >= 0) unplaced.splice(idx, 1);
        continue;
      }
    }

    // hard+: 如果没有 confirmedPresent 要放，优先试未试过的符号
    if (difficultyLevel >= 3) {
      const untried = candidates.filter(s => !positionTried[i].has(s));
      if (untried.length > 0) {
        candidates = untried;
      }
    }

    guess[i] = rng.pick(candidates);
  }

  return guess;
}

/**
 * 获取 Bot 思考延迟（毫秒）
 */
export function botThinkDelay(difficulty) {
  const base = { beginner: 500, easy: 800, medium: 1200, hard: 1800, expert: 2500 }[difficulty] || 1000;
  return base + Math.random() * 1500;
}
