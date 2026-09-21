// Jev 概率提示：配额状态 + 请求 + 结果
import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api.js';

/** equation.tokens → 线上棋盘格式：'_' 为隐藏槽位，其余为可见符号 */
export function boardToWire(tokens) {
  return tokens.map((t) => (t.hidden ? '_' : t.symbol));
}

export function useHint({ difficulty, tokens, history }) {
  const [quota, setQuota] = useState(null);
  const [result, setResult] = useState(null);
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

  // 换题（equation 变化）时清空本局的提示结果
  useEffect(() => {
    setResult(null);
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
        exclude_slots: hintedSlots
      });
      if (data?.quota) setQuota(data.quota);
      setResult(data);
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
  }, [loading, tokens, difficulty, history, hintedSlots]);

  const dismissResult = useCallback(() => setResult(null), []);

  return {
    quota,
    result,
    loading,
    message,
    limitOpen,
    limitMessage,
    setLimitOpen,
    requestHint,
    dismissResult,
    setMessage
  };
}
