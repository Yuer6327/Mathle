import React from 'react';
import { SYMBOL_DISPLAY } from '../lib/constants.js';

// 底部符号选择器（黑白灰单色，运算符略亮以区分）
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
  let cls = 'flex items-center justify-center rounded-lg transition-all active:scale-90 min-h-[44px] min-w-[44px] text-base ';

  if (type === 'function') {
    cls += 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 px-3 text-sm ';
  } else if (type === 'operator') {
    cls += 'bg-neutral-700 text-neutral-100 hover:bg-neutral-600 text-xl ';
  } else {
    // number
    if (display.length > 1) {
      // pi, e
      cls += 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 italic font-serif ';
    } else {
      cls += 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 ';
    }
  }

  return (
    <button className={cls} onClick={onClick}>
      {display}
    </button>
  );
}
