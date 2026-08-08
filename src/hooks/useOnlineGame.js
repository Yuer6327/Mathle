// 联机对局状态 hook（pvp / coop）
// 服务端权威：等式、猜词校验、反馈都由 VPS WS 服务生成，本 hook 只收发消息并维护 UI 状态
import { useCallback, useEffect, useRef, useState } from 'react';
import { connectMatch } from '../lib/ws.js';
import { calculateFeedback } from '../lib/feedback.js';

const ONLINE_MODES = new Set(['pvp', 'coop']);

export function useOnlineGame(difficulty, mode) {
  const isOnline = ONLINE_MODES.has(mode);

  const [conn, setConn] = useState('idle'); // idle|connecting|queue|matched|closed
  const [connError, setConnError] = useState('');
  const [equation, setEquation] = useState(null);
  const [slotCount, setSlotCount] = useState(0);
  const [answer, setAnswer] = useState(null); // 对局结束服务端才下发
  const [currentGuess, setCurrentGuess] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [history, setHistory] = useState([]); // pvp: 本人历史；coop: 共享历史
  const [opponent, setOpponent] = useState({ nickname: '对手', steps: 0, thinking: false });
  const [myIndex, setMyIndex] = useState(0);
  const [myTurn, setMyTurn] = useState(true);
  const [status, setStatus] = useState('playing'); // playing|won|lost|draw|aborted
  const [gameOver, setGameOver] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0); // 重连计数
  const wsRef = useRef(null);

  const clearInput = useCallback(() => {
    setCurrentGuess(new Array(slotCount).fill(null));
  }, [slotCount]);

  // 对局结束：用答案补齐没有反馈的历史行
  const applyAnswer = useCallback((ans) => {
    setAnswer(ans);
    setHistory((prev) =>
      prev.map((e) => (e.feedback ? e : { ...e, feedback: calculateFeedback(e.guess, ans) }))
    );
  }, []);

  const handleMessage = useCallback(
    (msg) => {
      switch (msg.type) {
        case 'connected':
          break;
        case 'queued':
          setConn('queue');
          setConnError('');
          break;
        case 'match_found': {
          setConn('matched');
          setEquation(msg.equation);
          setSlotCount(msg.equation.answerLength);
          setMyIndex(msg.yourIndex);
          // 服务端 coop 先手恒为 turnIndex=0（即 yourIndex=0），开局先对齐回合指示
          setMyTurn(mode !== 'coop' || msg.yourIndex === 0);
          setOpponent({ nickname: msg.opponent.nickname, steps: 0, thinking: false });
          setStartTime(msg.startAt || Date.now());
          setHistory([]);
          setStatus('playing');
          setGameOver(null);
          setAnswer(null);
          setNotice('');
          setCurrentGuess(new Array(msg.equation.answerLength).fill(null));
          break;
        }
        case 'guess_result': {
          // pvp：本人一次猜测的反馈
          setHistory((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && !last.feedback) next[next.length - 1] = { ...last, feedback: msg.feedback };
            return next;
          });
          setCurrentGuess(new Array(slotCount).fill(null));
          if (msg.correct) setStatus('won');
          break;
        }
        case 'room_state': {
          // coop：共享历史 + 回合
          setHistory(msg.history || []);
          setMyTurn(msg.turnIndex === myIndex);
          if (msg.timeoutNotice) {
            setNotice(msg.turnIndex === myIndex ? '对方超时，轮到你了' : '你超时了，回合已切换');
            setTimeout(() => setNotice(''), 3000);
          }
          break;
        }
        case 'opponent_update':
          setOpponent((prev) => ({ ...prev, steps: msg.steps }));
          break;
        case 'game_over':
          setGameOver(msg);
          setStatus(msg.outcome === 'win' ? 'won' : msg.outcome === 'lose' ? 'lost' : msg.outcome);
          setOpponent((prev) => ({ ...prev, steps: msg.opponentSteps ?? prev.steps }));
          setMyTurn(false);
          if (msg.answer) {
            applyAnswer(msg.answer);
            setCurrentGuess([...msg.answer]); // 结算后在棋盘上揭示答案
          }
          break;
        case 'error':
          setConnError(msg.message);
          break;
        default:
          break;
      }
    },
    [slotCount, myIndex, applyAnswer]
  );

  // 避免闭包过期：总是调用最新 handler
  const handleRef = useRef(handleMessage);
  useEffect(() => { handleRef.current = handleMessage; }, [handleMessage]);

  // 连接 + 进入匹配队列
  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    setConn('connecting');
    setConnError('');
    setStatus('playing');

    connectMatch({
      onMessage: (m) => handleRef.current(m),
      onClose: () => { if (!cancelled) { setConn('closed'); setConnError('连接已断开'); } },
      onError: (e) => { if (!cancelled) setConnError(e.message || '连接失败'); }
    })
      .then((client) => {
        if (cancelled) { client.close(); return; }
        wsRef.current = client;
        client.send({ type: 'find', mode, difficulty });
      })
      .catch((e) => {
        if (!cancelled) setConnError(e.message || '连接失败');
      });

    return () => {
      cancelled = true;
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, [isOnline, mode, difficulty, attempt]);

  const cancelFind = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send({ type: 'cancel_find' });
      wsRef.current.close();
    }
    wsRef.current = null;
    setConn('idle');
    setConnError('');
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const leave = useCallback(() => {
    if (wsRef.current) {
      if (conn === 'matched' && status === 'playing') wsRef.current.send({ type: 'leave' });
      wsRef.current.close();
    }
    wsRef.current = null;
  }, [conn, status]);

  const placeSymbol = useCallback(
    (symbol) => {
      if (status !== 'playing' || (mode === 'coop' && !myTurn)) return;
      setCurrentGuess((prev) => {
        const next = [...prev];
        if (selectedSlot !== null && next[selectedSlot] === null) {
          next[selectedSlot] = symbol;
        } else {
          const emptyIdx = next.findIndex((s) => s === null);
          if (emptyIdx === -1) return prev;
          next[emptyIdx] = symbol;
        }
        return next;
      });
      setSelectedSlot(null);
    },
    [status, selectedSlot, mode, myTurn]
  );

  const clearSlot = useCallback((index) => {
    setCurrentGuess((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setCurrentGuess(new Array(slotCount).fill(null));
  }, [slotCount]);

  const submitGuess = useCallback(() => {
    if (status !== 'playing' || !wsRef.current) return null;
    if (mode === 'coop' && !myTurn) return null;
    if (currentGuess.length === 0 || currentGuess.some((s) => s === null)) return null;

    const guess = [...currentGuess];
    // 先本地占位，等服务器反馈（若被驳回则移除）
    setHistory((prev) => [...prev, { guess, feedback: null }]);
    setCurrentGuess(new Array(slotCount).fill(null));
    wsRef.current.send({ type: 'guess', symbols: guess });
    return { guess };
  }, [status, mode, myTurn, currentGuess, slotCount]);

  return {
    isOnline,
    conn,
    connError,
    equation,
    answer,
    currentGuess,
    selectedSlot,
    history,
    opponent,
    myIndex,
    myTurn,
    status,
    gameOver,
    startTime,
    notice,
    slotCount,
    placeSymbol,
    clearSlot,
    clearAll,
    submitGuess,
    setSelectedSlot,
    cancelFind,
    retry,
    leave
  };
}
