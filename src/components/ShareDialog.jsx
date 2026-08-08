import React, { useRef, useEffect } from 'react';
import { SYMBOL_DISPLAY, DIFFICULTY_LABELS } from '../lib/constants.js';

// 分享成绩对话框
export default function ShareDialog({ open, onClose, history, answer, difficulty, startTime, mode, won = true, equation }) {
  const canvasRef = useRef(null);

  const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const steps = history.length;

  const generateShareText = () => {
    const emojis = { correct: '🟩', present: '🟨', absent: '⬜' };
    const grid = history.map(entry =>
      entry.feedback.map(f => emojis[f] || '⬜').join('')
    ).join('\n');
    const status = won ? '🎉' : '💀';
    return `MathWordle ${DIFFICULTY_LABELS[difficulty]} ${status} ${steps}步 ${elapsed}秒\n\n${grid}\n\n来挑战 → wordle.yuer6327.top`;
  };

  const copyToClipboard = () => {
    const text = generateShareText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('已复制到剪贴板！');
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
    alert('已复制到剪贴板！');
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !history.length) return;
    const ctx = canvas.getContext('2d');
    const cellSize = 44;
    const gap = 4;
    const padding = 24;
    const headerH = 80;
    const footerH = 60;

    // 有等式则按 token 排布（隐藏槽=色块格子，可见符=纯文本）；无等式则退化为纯格子
    const tokens = equation?.tokens?.length
      ? equation.tokens
      : (answer || []).map((_, i) => ({ hidden: true, slotIndex: i, symbol: null, type: 'number' }));

    // 统一格子宽度：每个 token 各占一格（=、括号仅显示符号，不加背景色）
    const gridW = tokens.length * (cellSize + gap) + padding * 2 - gap;
    const gridH = history.length * (cellSize + gap) - gap + headerH + footerH + padding;

    canvas.width = gridW;
    canvas.height = gridH;

    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MathWordle', canvas.width / 2, 32);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(`${DIFFICULTY_LABELS[difficulty]} · ${steps}步 · ${elapsed}秒`, canvas.width / 2, 56);

    const colors = { correct: '#6aaa64', present: '#c9b458', absent: '#787c7e' };
    history.forEach((entry, row) => {
      const y = headerH + row * (cellSize + gap);
      tokens.forEach((t, col) => {
        const x = padding + col * (cellSize + gap);
        if (t.hidden) {
          const idx = t.slotIndex;
          const sym = entry.guess?.[idx];
          const f = entry.feedback?.[idx];
          ctx.fillStyle = colors[f] || '#ccc';
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(SYMBOL_DISPLAY[sym] || sym || '', x + cellSize / 2, y + cellSize / 2);
        } else {
          // =、括号：只画符号，不加背景色
          ctx.fillStyle = '#666';
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(t.symbol, x + cellSize / 2, y + cellSize / 2);
        }
      });
    });

    ctx.fillStyle = '#999';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('wordle.yuer6327.top', canvas.width / 2, gridH - 20);
  };

  useEffect(() => {
    if (open && history.length) {
      const id = setTimeout(drawCanvas, 50);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, history.length, equation]);

  if (!open || !history.length) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100">
          {won ? '🎉 恭喜通关！' : '💀 再接再厉！'}
        </h2>
        <div className="flex justify-center overflow-x-auto">
          <canvas ref={canvasRef} className="max-w-full rounded-lg" />
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="flex-1 bg-wgreen text-white py-3 rounded-lg font-semibold hover:bg-wgreenDark transition"
          >
            📋 复制成绩
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
