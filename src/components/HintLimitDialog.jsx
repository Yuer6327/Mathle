import React, { useEffect, useState } from 'react';
import Icon from './Icons.jsx';

// 提示次数用尽的弹窗提醒（按需求：到限额跳弹窗，而不是写在提示按钮旁）
function formatRemaining(resetAt) {
  if (!resetAt) return '';
  const seconds = Math.max(0, resetAt - Math.floor(Date.now() / 1000));
  if (seconds === 0) return '即将重置';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分钟后`;
  if (m > 0) return `${m} 分钟后`;
  return '1 分钟内';
}

export default function HintLimitDialog({ open, onClose, message, quota }) {
  const [remainingText, setRemainingText] = useState('');

  useEffect(() => {
    if (!open) return;
    const update = () => setRemainingText(formatRemaining(quota?.reset_at));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [open, quota?.reset_at]);

  if (!open) return null;

  const loggedIn = !!quota?.logged_in;
  const limit = quota?.limit ?? (loggedIn ? 100 : 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-sm w-full space-y-4 animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Icon name="bulb" className="w-5 h-5 text-neutral-400" />
          <h2 className="text-lg font-bold text-neutral-100">今日提示次数已用完</h2>
        </div>

        <p className="text-sm text-neutral-300 leading-relaxed">
          {message || '今日提示次数已用完。'}
        </p>

        <div className="bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">今日已用</span>
            <span className="text-neutral-200 font-medium tabular-nums">
              {quota?.used ?? limit} / {limit} 次
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">重置时间</span>
            <span className="text-neutral-200">{remainingText || 'UTC+8 每日 0 点'}</span>
          </div>
        </div>

        {!loggedIn && (
          <p className="text-sm text-neutral-400 leading-relaxed">
            未登录每天可提示 <span className="text-neutral-200 font-medium">1</span> 次；
            回到主菜单登录后，每天可提示 <span className="text-neutral-200 font-medium">100</span> 次。
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full bg-neutral-100 text-neutral-950 py-3 rounded-lg font-semibold hover:bg-neutral-200 transition"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
