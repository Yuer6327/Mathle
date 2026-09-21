import React from 'react';
import { SYMBOL_DISPLAY } from '../lib/constants.js';
import Icon from './Icons.jsx';

// Jev 概率提示面板：给出某个空槽的符号概率分布与置信度（不直接给答案）
const BANDS = [
  { min: 0.8, label: '高', cls: 'text-green-400 border-green-400/40 bg-green-400/10' },
  { min: 0.5, label: '中', cls: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10' },
  { min: 0, label: '低', cls: 'text-neutral-400 border-neutral-600 bg-neutral-800' }
];

const DISPLAY_TOP = 4; // 展示前 N 名，其余合并为「其他」

function confidenceBand(value) {
  return BANDS.find((b) => value >= b.min) || BANDS[BANDS.length - 1];
}

function displaySymbol(symbol) {
  return SYMBOL_DISPLAY[symbol] || symbol;
}

export default function HintPanel({ result, onClose }) {
  if (!result) return null;

  const list = Array.isArray(result.probabilities) ? result.probabilities : [];
  const head = list.slice(0, DISPLAY_TOP);
  const tail = list.slice(DISPLAY_TOP);
  const restSum = tail.reduce((acc, item) => acc + item.probability, 0);

  const band = confidenceBand(result.confidence ?? 0);
  const maxP = head.length ? head[0].probability : 1;

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 space-y-2.5 animate-pop">
      <div className="flex items-center gap-2">
        <Icon name="bulb" className="w-4 h-4 text-yellow-400" />
        <span className="text-sm text-neutral-200 font-medium">
          Jev 判断 · 第 {result.slot_number} 个空槽
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-neutral-500 hover:text-neutral-200 transition"
          aria-label="关闭提示"
        >
          <Icon name="close" className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        {head.map((item, idx) => (
          <ProbRow
            key={item.symbol}
            symbol={item.symbol}
            probability={item.probability}
            ratio={maxP > 0 ? item.probability / maxP : 0}
            highlight={idx === 0}
          />
        ))}
        {tail.length > 0 && (
          <ProbRow symbol="其他" probability={restSum} ratio={maxP > 0 ? restSum / maxP : 0} muted />
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className={`px-1.5 py-0.5 rounded border ${band.cls}`}>
          信心 {band.label} {(result.confidence ?? 0).toFixed(2)}
        </span>
        <span className="text-neutral-500">候选 {list.length} 个符号</span>
        {result.model && <span className="text-neutral-600">{result.model}</span>}
      </div>

      <p className="text-xs text-neutral-500 leading-relaxed">
        这是概率性判断，不是答案。概率最高的符号也可能是错的，请结合棋盘自己判断。
      </p>
    </div>
  );
}

function ProbRow({ symbol, probability, ratio, highlight = false, muted = false }) {
  const pct = Math.round(probability * 100);
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-10 shrink-0 text-right font-bold ${highlight ? 'text-neutral-100' : muted ? 'text-neutral-500' : 'text-neutral-300'}`}
        style={{ fontFamily: 'ui-monospace, "SF Mono", monospace' }}
      >
        {symbol === '其他' ? '其他' : displaySymbol(symbol)}
      </span>
      <span className="flex-1 h-2 rounded-full bg-neutral-800 overflow-hidden">
        <span
          className={`block h-full rounded-full transition-all duration-300 ${highlight ? 'bg-neutral-100' : 'bg-neutral-500'}`}
          style={{ width: `${Math.max(2, Math.round(ratio * 100))}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-xs text-neutral-400 tabular-nums">{pct}%</span>
    </div>
  );
}
