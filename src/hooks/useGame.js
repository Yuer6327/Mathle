// 游戏状态管理 hook
import { useState, useCallback, useEffect, useRef } from 'react';
import { generateEquation, getAnswer } from '../lib/equationGenerator.js';
import { calculateFeedback, isAllCorrect } from '../lib/feedback.js';
import { botGuess, botThinkDelay } from '../lib/bot.js';
import { makeRNGHelpers, createRNG, generateSeed } from '../lib/seededRandom.js';
import { recordGame } from '../lib/storage.js';

export function useGame(difficulty, mode = 'solo') {
  const [equation, setEquation] = useState(null);
  const [answer, setAnswer] = useState([]);
  const [currentGuess, setCurrentGuess] = useState([]);
  const [history, setHistory] = useState([]); // [{guess, feedback}]
  const [status, setStatus] = useState('playing'); // 'playing' | 'won' | 'lost'
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [botHistory, setBotHistory] = useState([]);
  const [botThinking, setBotThinking] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [flippingSlots, setFlippingSlots] = useState(null); // 正在翻转的行索引
  const timerRef = useRef(null);

  // 初始化新游戏
  const newGame = useCallback((seed) => {
    const actualSeed = seed || generateSeed();
    const eq = generateEquation(difficulty, actualSeed);
    const ans = getAnswer(eq);
    setEquation(eq);
    setAnswer(ans);
    setCurrentGuess(new Array(ans.length).fill(null));
    setHistory([]);
    setBotHistory([]);
    setStatus('playing');
    setSelectedSlot(null);
    setHintUsed(false);
    setStartTime(Date.now());
    return { seed: actualSeed, equation: eq, answer: ans };
  }, [difficulty]);

  // 放置符号到槽位
  const placeSymbol = useCallback((symbol) => {
    if (status !== 'playing') return;
    // 找到第一个空槽位放入
    setCurrentGuess(prev => {
      const next = [...prev];
      // 如果有选中的槽位，放入选中位置
      if (selectedSlot !== null && next[selectedSlot] === null) {
        next[selectedSlot] = symbol;
      } else {
        // 否则放入第一个空位
        const emptyIdx = next.findIndex(s => s === null);
        if (emptyIdx === -1) return prev;
        next[emptyIdx] = symbol;
      }
      return next;
    });
    setSelectedSlot(null);
  }, [status, selectedSlot]);

  // 清除槽位
  const clearSlot = useCallback((index) => {
    setCurrentGuess(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }, []);

  // 清除所有
  const clearAll = useCallback(() => {
    setCurrentGuess(new Array(answer.length).fill(null));
  }, [answer.length]);

  // 提交猜测
  const submitGuess = useCallback(() => {
    if (status !== 'playing') return null;
    if (currentGuess.some(s => s === null)) return null;

    const feedback = calculateFeedback(currentGuess, answer);
    const newEntry = { guess: [...currentGuess], feedback };
    setHistory(prev => [...prev, newEntry]);

    // 触发翻转动画
    setFlippingSlots(history.length);
    setTimeout(() => setFlippingSlots(null), 700);

    const won = isAllCorrect(feedback);
    if (won) {
      setStatus('won');
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      recordGame(difficulty, mode, 'win', history.length + 1, elapsed);
      setCurrentGuess(new Array(answer.length).fill(null));
      return { won: true, feedback };
    }

    // 清空当前猜测，准备下一轮
    setCurrentGuess(new Array(answer.length).fill(null));

    // Bot 回合（人机模式）
    if (mode === 'bot' && !won) {
      setBotThinking(true);
      const delay = botThinkDelay(difficulty);
      setTimeout(() => {
        const botRng = makeRNGHelpers(createRNG(answer.join('') + history.length));
        const botG = botGuess(answer, difficulty, botHistory, botRng);
        const botFb = calculateFeedback(botG, answer);
        setBotHistory(prev => [...prev, { guess: botG, feedback: botFb }]);
        setBotThinking(false);

        if (isAllCorrect(botFb)) {
          setStatus('lost');
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          recordGame(difficulty, 'bot', 'lose', history.length + 1, elapsed);
        }
      }, delay);
    }

    return { won: false, feedback };
  }, [status, currentGuess, answer, history, difficulty, mode, startTime, botHistory]);

  // 使用提示
  const useHint = useCallback(() => {
    if (hintUsed || status !== 'playing') return null;
    // 找一个尚未在历史中被标为绿色的位置
    const knownPositions = new Set();
    for (const { guess, feedback } of history) {
      feedback.forEach((f, i) => {
        if (f === 'correct') knownPositions.add(i);
      });
    }
    const candidates = answer
      .map((sym, i) => ({ sym, i }))
      .filter(({ i }) => !knownPositions.has(i));
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setHintUsed(true);
    return pick;
  }, [hintUsed, status, answer, history]);

  // 倒计时超时 → 判负
  const timeout = useCallback(() => {
    if (status !== 'playing') return;
    setStatus('lost');
  }, [status]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    equation,
    answer,
    currentGuess,
    history,
    botHistory,
    botThinking,
    status,
    selectedSlot,
    hintUsed,
    flippingSlots,
    startTime,
    newGame,
    placeSymbol,
    clearSlot,
    clearAll,
    submitGuess,
    useHint,
    timeout,
    setSelectedSlot
  };
}
