// 好友房间对局 hook
// 房主 create_room 拿房号 → 好友 join_room 加入 → 房主 start_room 开始
// 服务端权威：共享等式、轮流猜（coop 泛化到 N 人），破解则团队胜
import { useCallback, useEffect, useRef, useState } from 'react';
import { connectMatch } from '../lib/ws.js';
import { calculateFeedback } from '../lib/feedback.js';

export function useRoomGame({ difficulty, create = false, code = '' }) {
  const [conn, setConn] = useState('connecting'); // connecting|lobby|playing|closed
  const [connError, setConnError] = useState('');
  const [myId, setMyId] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState([]);       // [{id, nickname}]
  const [hostId, setHostId] = useState(null);
  const [myIndex, setMyIndex] = useState(0);
  const [myTurn, setMyTurn] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);
  const [equation, setEquation] = useState(null);
  const [slotCount, setSlotCount] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [currentGuess, setCurrentGuess] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState('playing'); // playing|won|lost|draw|aborted
  const [gameOver, setGameOver] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0); // 重连计数
  const wsRef = useRef(null);

  const isHost = hostId != null && hostId === myId;

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
          setMyId(msg.id);
          break;
        case 'room_created':
          setRoomCode(msg.code);
          setConn('lobby');
          setConnError('');
          break;
        case 'room_joined':
          setRoomCode(msg.code);
          setConn('lobby');
          setConnError('');
          break;
        case 'room_state': {
          if (msg.status === 'playing') {
            setHistory(msg.history || []);
            setTurnIndex(msg.turnIndex);
            setMyTurn(msg.turnIndex === myIndex);
            if (msg.timeoutNotice) {
              setNotice(msg.turnIndex === myIndex ? '上家超时，轮到你了' : '你超时了，回合已切换');
              setTimeout(() => setNotice(''), 3000);
            }
          } else {
            // 大厅
            setPlayers(msg.players || []);
            setHostId(msg.hostId);
            const idx = (msg.players || []).findIndex((p) => p.id === myId);
            if (idx >= 0) setMyIndex(idx);
            setConn('lobby');
            setConnError('');
          }
          break;
        }
        case 'room_started': {
          setConn('playing');
          setEquation(msg.equation);
          setSlotCount(msg.equation.answerLength);
          setPlayers(msg.players || []);
          setHostId((msg.players || [])[msg.hostIndex]?.id ?? null);
          setMyIndex(msg.yourIndex);
          setTurnIndex(msg.turnIndex);
          setMyTurn(msg.turnIndex === msg.yourIndex);
          setStartTime(msg.startAt || Date.now());
          setStatus('playing');
          setGameOver(null);
          setAnswer(null);
          setHistory([]);
          setNotice('');
          setCurrentGuess(new Array(msg.equation.answerLength).fill(null));
          break;
        }
        case 'game_over':
          setGameOver(msg);
          setStatus(msg.outcome === 'win' ? 'won' : msg.outcome === 'lose' ? 'lost' : msg.outcome);
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
    [myIndex, myId, applyAnswer]
  );

  // 避免闭包过期：总是调用最新 handler
  const handleRef = useRef(handleMessage);
  useEffect(() => { handleRef.current = handleMessage; }, [handleMessage]);

  // 连接 + 创建/加入房间
  useEffect(() => {
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
        if (create) {
          client.send({ type: 'create_room', mode: 'coop', difficulty });
        } else {
          client.send({ type: 'join_room', code: String(code || '').trim().toUpperCase() });
        }
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
  }, [create, difficulty, code, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const start = useCallback(() => {
    if (wsRef.current) wsRef.current.send({ type: 'start_room' });
  }, []);

  const leave = useCallback(() => {
    if (wsRef.current) {
      if (conn === 'lobby' || (conn === 'playing' && status === 'playing')) {
        wsRef.current.send({ type: 'leave' });
      }
      wsRef.current.close();
    }
    wsRef.current = null;
  }, [conn, status]);

  const placeSymbol = useCallback(
    (symbol) => {
      if (status !== 'playing' || !myTurn) return;
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
    [status, selectedSlot, myTurn]
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
    if (status !== 'playing' || !wsRef.current || !myTurn) return null;
    if (currentGuess.length === 0 || currentGuess.some((s) => s === null)) return null;

    const guess = [...currentGuess];
    // 先本地占位，等服务器反馈（若被驳回则移除）
    setHistory((prev) => [...prev, { guess, feedback: null }]);
    setCurrentGuess(new Array(slotCount).fill(null));
    wsRef.current.send({ type: 'guess', symbols: guess });
    return { guess };
  }, [status, myTurn, currentGuess, slotCount]);

  return {
    conn,
    connError,
    myId,
    roomCode,
    players,
    hostId,
    isHost,
    myIndex,
    myTurn,
    turnIndex,
    equation,
    answer,
    currentGuess,
    selectedSlot,
    history,
    status,
    gameOver,
    startTime,
    notice,
    slotCount,
    start,
    placeSymbol,
    clearSlot,
    clearAll,
    submitGuess,
    setSelectedSlot,
    retry,
    leave
  };
}
