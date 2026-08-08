import React from 'react';
import { SYMBOL_DISPLAY, FEEDBACK_COLORS } from '../lib/constants.js';

// 历史猜测列表
export default function AttemptList({ history, maxSlots, title = '历史猜测' }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-2">
        {title}：暂无记录
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {history.map((entry, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-6 text-right">#{rowIdx + 1}</span>
          <div className="flex flex-wrap gap-1 items-center">
            {entry.guess.map((sym, i) => (
              <div
                key={i}
                className={`flex items-center justify-center font-bold rounded h-9 min-w-[2.25rem] text-sm ${
                  FEEDBACK_COLORS[entry.feedback[i]] || 'bg-gray-200 dark:bg-gray-700'
                } ${sym && sym.length >= 3 ? 'px-1.5' : ''}`}
                style={{
                  animation: `flip 0.5s ease ${(i * 80)}ms forwards`
                }}
              >
                {SYMBOL_DISPLAY[sym] || sym}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
