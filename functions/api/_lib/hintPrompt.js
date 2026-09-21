// Jev（TypeSafe System One）提示请求构建
//
// 职责边界（重要）：本模块只做「状态准备」，不做任何概率计算。
//   ① 确定性结算：根据已提交猜测的反馈，推出每个槽位「尚未被排除」的符号集合
//      （Wordle 标准约束：绿=锁定该槽；黄/灰=该槽不是这个符号；某符号若在某次猜测中
//        出现灰，则等式内该符号总数等于该次猜测中标绿+标黄的数量）
//   ② 渲染棋盘与历史，让模型一眼看懂
//   ③ 为每个仍未确定、且候选 ≥2 的槽位生成一个 Choice 问题（至多 MAX_QUESTIONS 个）
// 概率与置信度全部由 Jev 返回，本模块不臆造任何数值。
//
// 说明：送给模型的文案用英文（Jev 是英文语料训练的决策模型，中文能力未经验证），
//   面向用户的 UI 仍为中文。

import { SYMBOL_POOLS, SYMBOL_DISPLAY, DIFFICULTIES } from '../../../src/lib/constants.js';

/** 单次请求最多问几个槽位（每个槽位一个问题，控制 token 成本；需覆盖极难档的 45 槽） */
export const MAX_QUESTIONS = 48;
/** 最多接受多少条猜测历史 */
export const MAX_HISTORY = 20;
/** 单个棋盘最多多少槽位 */
export const MAX_SLOTS = 64;

/** 每个内部符号的人类可读含义（作为 Choice 的 criteria 描述） */
const SYMBOL_MEANING = {
  '0': 'digit 0', '1': 'digit 1', '2': 'digit 2', '3': 'digit 3', '4': 'digit 4',
  '5': 'digit 5', '6': 'digit 6', '7': 'digit 7', '8': 'digit 8', '9': 'digit 9',
  pi: 'the constant pi, about 3.14159',
  e: 'the constant e, about 2.71828',
  '+': 'addition operator',
  '-': 'subtraction operator',
  '×': 'multiplication operator',
  '÷': 'division operator',
  '^': 'exponent operator, a^b means a to the power of b',
  sqrt: 'square root function',
  sin: 'sine function',
  cos: 'cosine function',
  tan: 'tangent function',
  log: 'base-10 logarithm',
  ln: 'natural logarithm',
  abs: 'absolute value'
};

export function displayOf(symbol) {
  return SYMBOL_DISPLAY[symbol] || symbol;
}

/** 难度对应符号池的有序列表（内部符号） */
export function symbolPool(difficulty) {
  const pool = SYMBOL_POOLS[difficulty];
  if (!pool) return [];
  return [...pool.numbers, ...pool.operators, ...pool.functions];
}

/** 显示形式 → 内部符号（Jev 只会看到显示形式，需要映射回来） */
export function buildDisplayToInternal(difficulty) {
  const map = new Map();
  for (const sym of symbolPool(difficulty)) map.set(displayOf(sym), sym);
  return map;
}

export function countSlots(tokens) {
  let n = 0;
  for (const t of tokens) if (t.hidden) n++;
  return n;
}

/**
 * 线上棋盘格式 → tokens
 * 客户端只发 [ '(' , '_' , '+' , ... ]：'_' 表示隐藏槽位，其余为可见符号。
 * 生成器只会把括号与等号暴露成可见 token（见 equationGenerator 的 VISIBLE_TYPES），
 * 所以这里严格只放行 '_' '(' ')' '='，避免客户端把任意文本注入送给模型的 state。
 */
export function boardToTokens(board) {
  if (!Array.isArray(board) || board.length === 0 || board.length > 256) return null;
  const tokens = [];
  let slotIndex = 0;
  for (const cell of board) {
    if (cell === '_') {
      tokens.push({ type: 'number', symbol: null, hidden: true, slotIndex: slotIndex++ });
    } else if (cell === '=') {
      tokens.push({ type: 'equal', symbol: '=', hidden: false, slotIndex: null });
    } else if (cell === '(' || cell === ')') {
      tokens.push({ type: 'lparen', symbol: cell, hidden: false, slotIndex: null });
    } else {
      return null; // 出现任何其它字符都视为非法棋盘
    }
  }
  return tokens;
}

/** 把一行槽位值渲染成棋盘字符串，空槽显示为 '_' */
export function renderBoard(tokens, values) {
  return tokens
    .map((t) => {
      if (!t.hidden) return t.symbol;
      const v = values ? values[t.slotIndex] : null;
      return v == null ? '_' : displayOf(v);
    })
    .join(' ');
}

const FEEDBACK_CODE = { correct: 'G', present: 'Y', absent: 'B' };

/**
 * 确定性结算：每个槽位仍可能的符号集合，以及其它可由反馈推出的场况
 * @returns {{ candidates: string[][], openSlots: number[], locked: (string|null)[],
 *             countMin: object, countMax: object }}
 *   candidates[i] 为槽位 i（0 基）仍可能的内部符号数组；
 *   openSlots 为候选数 ≥2 的槽位（即"还没被逻辑锁定"的槽位）；
 *   locked[i] 为绿色反馈锁定住的符号（否则 null）；
 *   countMin/countMax 为该符号在等式中出现次数的下界/上界（上界 null 表示未知）。
 */
export function computeCandidates(tokens, difficulty, history) {
  const pool = symbolPool(difficulty);
  const slotCount = countSlots(tokens);
  const poolSet = new Set(pool);
  const candidates = Array.from({ length: slotCount }, () => new Set(pool));
  /** 被绿色反馈锁定的槽位（该槽答案已知） */
  const locked = new Array(slotCount).fill(null);
  /** 某符号在等式中的最小出现次数（minCount(s)）与最大出现次数（maxCount(s)） */
  const minCount = new Map();
  const maxCount = new Map();

  for (const entry of history) {
    const guess = entry?.guess;
    const feedback = entry?.feedback;
    if (!Array.isArray(guess) || !Array.isArray(feedback)) continue;
    if (guess.length !== slotCount || feedback.length !== slotCount) continue;

    // 本次猜测里每个符号的「标绿+标黄」数量，以及是否出现过标灰
    const colored = new Map();
    const sawAbsent = new Set();

    for (let i = 0; i < slotCount; i++) {
      const g = guess[i];
      const f = feedback[i];
      if (typeof g !== 'string' || !poolSet.has(g)) continue;
      if (f === 'correct') {
        colored.set(g, (colored.get(g) || 0) + 1);
        candidates[i] = new Set([g]); // 绿：该槽锁定
        locked[i] = g;
      } else {
        // 黄或灰：该槽位不是这个符号
        candidates[i].delete(g);
        if (f === 'present') colored.set(g, (colored.get(g) || 0) + 1);
        if (f === 'absent') sawAbsent.add(g);
      }
    }

    for (const [s, c] of colored) {
      minCount.set(s, Math.max(minCount.get(s) || 0, c));
    }
    // 某符号出现过灰 → 等式内该符号总数 == 本次猜测中标绿+标黄的数量
    for (const s of sawAbsent) {
      const upper = colored.get(s) || 0;
      maxCount.set(s, Math.min(maxCount.get(s) ?? Infinity, upper));
    }
  }

  // 出现次数上限为 0 的符号：等式里根本没有它 → 从所有槽位剔除
  for (const s of pool) {
    if ((maxCount.get(s) ?? Infinity) === 0) {
      for (const set of candidates) set.delete(s);
    }
  }

  // 兜底：理论上不会出现空集合（真值永不被排除）；若出现说明输入矛盾，退回全池
  const result = candidates.map((set, i) => {
    if (set.size > 0) return [...set];
    if (locked[i]) return [locked[i]]; // 绿格锁定的槽位不允许被清空
    return [...pool];
  });
  const openSlots = [];
  for (let i = 0; i < slotCount; i++) if (result[i].length >= 2) openSlots.push(i);

  // 可由反馈推出的「每个符号在等式中出现几次」的上下界，一并交给模型
  const countMin = {};
  const countMax = {};
  for (const s of pool) {
    const lo = minCount.get(s) || 0;
    const hi = maxCount.get(s) ?? null;
    if (lo > 0 || hi !== null) countMin[displayOf(s)] = lo;
    if (lo > 0 || hi !== null) countMax[displayOf(s)] = hi;
  }

  return { candidates: result, openSlots, locked, countMin, countMax };
}

/**
 * 构建 Jev 请求体
 * @returns {{ body: object, slotIds: number[], slotCount: number } | { error: string }}
 *   slotIds[k] 与 questions['slot_' + n] 对应；n 为 1 基槽位号
 */
export function buildJevRequest({ difficulty, tokens, history, excludeSlots = [], currentGuess = null }) {
  if (!DIFFICULTIES.includes(difficulty)) return { error: '难度无效' };
  if (!Array.isArray(tokens) || tokens.length === 0) return { error: '棋盘缺失' };
  const slotCount = countSlots(tokens);
  if (slotCount === 0 || slotCount > MAX_SLOTS) return { error: '槽位数量异常' };

  const pool = symbolPool(difficulty);
  const safeHistory = (Array.isArray(history) ? history : []).slice(-MAX_HISTORY);
  const { candidates, openSlots, locked, countMin, countMax } = computeCandidates(tokens, difficulty, safeHistory);

  // 本局已经提示过的槽位优先跳过（避免重复给同一格），全被排除时退回完整列表
  const exclude = new Set((Array.isArray(excludeSlots) ? excludeSlots : []).filter((i) => Number.isInteger(i)));
  let usable = openSlots.filter((i) => !exclude.has(i));
  if (usable.length === 0) usable = openSlots;

  // 优先询问候选最少的槽位（信息量最大），并保持至多 MAX_QUESTIONS 个
  const ranked = [...usable].sort((a, b) => candidates[a].length - candidates[b].length || a - b);
  const asked = ranked.slice(0, MAX_QUESTIONS);
  if (asked.length === 0) return { error: '没有可提示的槽位' };

  const alphabet = pool.map((s) => ({ symbol: displayOf(s), meaning: SYMBOL_MEANING[s] || 'symbol' }));

  // 已由绿色反馈锁定的槽位（玩家一定已经知道）
  const lockedSlots = {};
  locked.forEach((sym, i) => { if (sym) lockedSlots[i + 1] = displayOf(sym); });

  // 玩家当前正在填、还没提交的那一行
  const pending = Array.isArray(currentGuess) && currentGuess.some((s) => s != null)
    ? currentGuess.map((s) => (s == null ? null : displayOf(s)))
    : null;

  const state = {
    game: 'MathWordle — a Wordle-style puzzle. Every symbol of a math equation is hidden and the player guesses them slot by slot. The completed equation must be mathematically TRUE.',
    how_to_read: {
      board: "Only parentheses and '=' are shown. Each '_' is a hidden slot the player must fill. Slots are numbered by the order the '_' marks appear, starting at 1.",
      multi_digit: "Each '_' holds exactly ONE symbol. A multi-digit number is split one digit per slot, so two adjacent slots '3' then '6' at the end mean the number 36.",
      feedback_legend: 'G = correct symbol in the correct slot. Y = the symbol IS in the equation but this is the wrong slot for it. B = the equation contains no more unmatched copies of this symbol.',
      display_forms: 'sqrt is displayed as √, log (base 10) as lg, multiplication as ×, division as ÷, subtraction as −.'
    },
    difficulty,
    symbol_alphabet: alphabet,
    slot_count: slotCount,
    board: renderBoard(tokens, null),
    slots_already_known: lockedSlots,
    guesses_so_far: safeHistory.map((entry) => ({
      slots: entry.guess.map((s) => displayOf(s)),
      feedback: entry.feedback.map((f) => FEEDBACK_CODE[f] || '?')
    })),
    player_current_unsubmitted_guess: pending,
    symbol_occurrence_bounds: {
      note: 'How many times each symbol must occur in the whole equation, as far as the feedback proves. min = at least this many, max = at most this many (null = no upper bound known).',
      min: countMin,
      max: countMax
    },
    slots_still_open: Object.fromEntries(
      asked.map((i) => [
        String(i + 1),
        {
          slot: i + 1,
          candidates_not_ruled_out: candidates[i].map(displayOf)
        }
      ])
    ),
    task: 'For every slot listed in slots_still_open, rank its candidates_not_ruled_out by how likely each one is to fill that slot.'
  };

  const questions = {};
  for (const i of asked) {
    const options = candidates[i];
    questions[`slot_${i + 1}`] = {
      type: 'choice',
      instructions: {
        question: `Hidden slot ${i + 1}: which single symbol most likely belongs in this slot?`,
        slot: i + 1,
        candidates_not_ruled_out: options.map(displayOf),
        note: 'The candidates listed are the only symbols not yet ruled out for this slot by the guess history. Judge among them using the board structure, the occurrence bounds, and the feedback of every entry in guesses_so_far. The probabilities you return are shown to the player as a ranked list from most to least likely, so spread them over the candidates you consider genuinely plausible.'
      },
      criteria: Object.fromEntries(options.map((s) => [displayOf(s), SYMBOL_MEANING[s] || 'symbol']))
    };
  }

  return {
    body: { state, model: 'jev-latest', questions },
    slotIds: asked,
    slotCount
  };
}
