import React, { useState, useEffect } from 'react';

// 计时器：不传 maxSeconds 时正计时；传 maxSeconds 时倒计时（显示剩余时间）
// active=false 时停止计时（冻结在当前值），用于对局结束/成功后
export default function Timer({ startTime, onTimeout, maxSeconds = null, active = true }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime || !active) return;
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(sec);
      if (maxSeconds && sec >= maxSeconds) {
        onTimeout && onTimeout();
        clearInterval(id);
      }
    }, 200);
    return () => clearInterval(id);
  }, [startTime, maxSeconds, onTimeout, active]);

  const remaining = maxSeconds ? Math.max(0, maxSeconds - elapsed) : null;
  const display = remaining !== null ? remaining : elapsed;
  const mins = Math.floor(display / 60);
  const secs = display % 60;
  const isUrgent = remaining !== null && remaining <= maxSeconds * 0.2;

  return (
    <div className={`font-mono text-lg tabular-nums ${isUrgent ? 'text-red-400 animate-pulse' : 'text-neutral-400'}`}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}
