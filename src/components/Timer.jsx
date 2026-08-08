import React, { useState, useEffect } from 'react';

// 计时器
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

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isUrgent = maxSeconds && elapsed > maxSeconds * 0.8;

  return (
    <div className={`font-mono text-lg ${isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-600 dark:text-gray-400'}`}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}
