// Jev 概率提示：配额状态 + 请求 + 结果
import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api.js';

/** equation.tokens → 线上棋盘格式：'_' 为隐藏槽位，其余为可见符号 */
export function boardToWire(tokens) {
  return tokens.map((t) => (t.hidden ? '_' : t.symbol));
}

export function useHint({ difficulty, tokens, history, currentGuess, focusSlot = null }) {
  const [quota, setQuota] = useState(null);
  // 本局所有提示结果，最新的在最前（可折叠、可回查）
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hintedSlots, setHintedSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');

  // 页面加载时拉一次今日剩余次数（不消耗）
  useEffect(() => {
    let cancelled = false;
    api.hint.status()
      .then((data) => { if (!cancelled && data?.quota) setQuota(data.quota); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // 换题（equation 变化）时清空本局的提示历史
  useEffect(() => {
    setResults([]);
    setActiveIndex(0);
    setHintedSlots([]);
    setMessage('');
  }, [tokens]);

  const requestHint = useCallback(async () => {
    if (loading || !tokens) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await api.hint.claim({
        difficulty,
        board: boardToWire(tokens),
        history,
        current_guess: Array.isArray(currentGuess) ? currentGuess : null,
        // 玩家在棋盘上选中了某个槽位 → 指定只提示这一格；否则由服务端自动推荐
        focus_slot: Number.isInteger(focusSlot) ? focusSlot : null,
        exclude_slots: hintedSlots
      });
      if (data?.quota) setQuota(data.quota);
      setResults((prev) => [data, ...prev]);
      setActiveIndex(0);
      if (typeof data?.slot_index === 'number') {
        setHintedSlots((prev) => (prev.includes(data.slot_index) ? prev : [...prev, data.slot_index]));
      }
    } catch (e) {
      const errData = e?.data || {};
      if (e?.status === 429) {
        // 配额耗尽 → 弹出提醒（不在提示按钮旁写文案）
        if (errData.quota) setQuota(errData.quota);
        setLimitMessage(errData.error || '今日提示次数已用完');
        setLimitOpen(true);
      } else if (e?.status === 503 && errData.reason === 'not_configured') {
        setMessage('提示服务尚未配置');
      } else {
        setMessage(errData.error || e?.message || '提示获取失败，请稍后再试');
      }
    } finally {
      setLoading(false);
    }
  }, [loading, tokens, difficulty, history, hintedSlots, currentGuess, focusSlot]);

  const dismissAll = useCallback(() => {
    setResults([]);
    setActiveIndex(0);
  }, []);

  const safeIndex = Math.min(activeIndex, Math.max(0, results.length - 1));
  const result = results[safeIndex] || null;

  return {
    quota,
    results,
    result,
    activeIndex: safeIndex,
    selectResult: setActiveIndex,
    loading,
    message,
    limitOpen,
    limitMessage,
    setLimitOpen,
    requestHint,
    dismissAll,
    setMessage
  };
}
