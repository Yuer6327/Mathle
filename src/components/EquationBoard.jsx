import React from 'react';
import { SYMBOL_DISPLAY, getSymbolType, FEEDBACK_COLORS } from '../lib/constants.js';

// 等式板：显示等式（当前猜测行）
export default function EquationBoard({ equation, currentGuess, onSlotClick, selectedSlot, hintPosition }) {
  if (!equation) return null;
  const { tokens } = equation;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 px-2 py-3">
      {tokens.map((token, i) => {
        if (!token.hidden) {
          return (
            <span
              key={i}
              className="text-2xl font-bold text-gray-700 dark:text-gray-300 select-none mx-0.5"
              style={{ fontFamily: 'ui-monospace, "SF Mono", monospace' }}
            >
              {token.symbol === '=' ? '=' : token.symbol}
            </span>
          );
        }

        const slotIdx = token.slotIndex;
        const guessVal = currentGuess[slotIdx];
        const displaySym = guessVal ? (SYMBOL_DISPLAY[guessVal] || guessVal) : '';
        // 联机模式服务端不返回隐藏槽位的答案符号，用下发好的 symbolType；本地模式回退到 getSymbolType
        const symbolType = token.symbolType || getSymbolType(token.symbol);
        const isHint = hintPosition === slotIdx;

        return (
          <Slot
            key={i}
            displaySym={displaySym}
            answerSymbol={token.symbol}
            symbolType={symbolType}
            onClick={() => onSlotClick && onSlotClick(slotIdx)}
            selected={selectedSlot === slotIdx}
            isHint={isHint}
          />
        );
      })}
    </div>
  );
}

function Slot({ displaySym, answerSymbol, symbolType, onClick, selected, isHint }) {
  const isFilled = displaySym.length > 0;
  // 根据显示内容决定宽度
  const len = displaySym.length || (answerSymbol.length);
  let widthCls;
  if (len >= 4) widthCls = 'min-w-[4rem]';
  else if (len === 3) widthCls = 'min-w-[3rem]';
  else widthCls = 'min-w-[2.5rem]';
  const heightCls = 'h-12';

  if (!isFilled) {
    // 空槽位
    if (symbolType === 'operator' || symbolType === 'function') {
      return (
        <button
          onClick={onClick}
          className={`flex items-center justify-center rounded-md transition-all duration-150 ${widthCls} ${heightCls} bg-gray-200 dark:bg-gray-700 border-2 ${
            selected ? 'border-blue-500 scale-105' : 'border-transparent'
          } ${isHint ? 'ring-2 ring-wgreen ring-offset-1' : ''}`}
        />
      );
    }
    // 数字：下划线
    return (
      <button
        onClick={onClick}
        className={`flex items-center justify-center rounded-md transition-all duration-150 ${widthCls} ${heightCls} border-b-4 ${
          selected ? 'border-blue-500 scale-105 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-400 dark:border-gray-600'
        } ${isHint ? 'ring-2 ring-wgreen ring-offset-1' : ''}`}
      />
    );
  }

  // 有值的槽位
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center font-bold rounded-md transition-all duration-150 ${widthCls} ${heightCls} ${
        selected ? 'ring-2 ring-blue-500 scale-105' : ''
      } bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700`}
    >
      {displaySym}
    </button>
  );
}
