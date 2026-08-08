import React, { useState, useEffect } from 'react';

// 计时器：不传 maxSeconds 时正计时；传 maxSeconds 时倒计时（显示剩余时间）
export default function Timer({ startTime, onTimeout, maxSeconds = null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(sec);
      if (maxSeconds && sec >= maxSeconds) {
        onTimeout && onTimeout();
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [startTime, maxSeconds, onTimeout]);

  const remaining = maxSeconds ? Math.max(0, maxSeconds - elapsed) : null;
  const display = remaining !== null ? remaining : elapsed;
  const mins = Math.floor(display / 60);
  const secs = display % 60;
  const isUrgent = remaining !== null && remaining <= maxSeconds * 0.2;

  return (
    <div className={`font-mono text-lg ${isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-600 dark:text-gray-400'}`}>
      {remaining !== null && <span className="text-xs mr-0.5 opacity-70">⏳</span>}
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}
