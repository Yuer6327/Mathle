import React from 'react';
import { SYMBOL_DISPLAY, getSymbolType } from '../lib/constants.js';

// 底部符号选择器（卡西欧科学计算器风格）
export default function SymbolPicker({ symbols, onPick, disabled }) {
  const { numbers, operators, functions: funcs } = symbols;

  return (
    <div className={`w-full space-y-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* 函数按钮 */}
      {funcs.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {funcs.map(fn => (
            <PickerButton
              key={fn}
              symbol={fn}
              display={SYMBOL_DISPLAY[fn] || fn}
              type="function"
              onClick={() => onPick(fn)}
            />
          ))}
        </div>
      )}

      {/* 运算符按钮 */}
      {operators.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {operators.map(op => (
            <PickerButton
              key={op}
              symbol={op}
              display={SYMBOL_DISPLAY[op] || op}
              type="operator"
              onClick={() => onPick(op)}
            />
          ))}
        </div>
      )}

      {/* 数字按钮 */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {numbers.map(num => (
          <PickerButton
            key={num}
            symbol={num}
            display={SYMBOL_DISPLAY[num] || num}
            type="number"
            onClick={() => onPick(num)}
          />
        ))}
      </div>
    </div>
  );
}

function PickerButton({ display, type, onClick }) {
  let cls = 'flex items-center justify-center font-semibold rounded-lg transition-all active:scale-90 min-h-[44px] min-w-[44px] text-base ';

  if (type === 'function') {
    cls += 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 px-3 ';
    if (display.length >= 3) cls += 'px-3 text-sm ';
  } else if (type === 'operator') {
    cls += 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800 text-xl ';
  } else {
    // number
    if (display.length > 1) {
      // pi, e
      cls += 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-200 dark:hover:bg-cyan-800 italic font-serif ';
    } else {
      cls += 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 ';
    }
  }

  return (
    <button className={cls} onClick={onClick}>
      {display}
    </button>
  );
}
