import React from 'react';
import { SYMBOL_DISPLAY } from '../lib/constants.js';
import Icon from './Icons.jsx';

// 提示面板：调 Jev 拿到某个空槽的符号概率分布，按概率从大到小、自上而下排成一列。
// 仅作参考，不代替玩家判断。
const BANDS = [
  { min: 0.8, label: '高', cls: 'text-green-400 border-green-400/40 bg-green-400/10' },
  { min: 0.5, label: '中', cls: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10' },
  { min: 0, label: '低', cls: 'text-neutral-400 border-neutral-600 bg-neutral-800' }
];

function confidenceBand(value) {
  return BANDS.find((b) => value >= b.min) || BANDS[BANDS.length - 1];
}

function displaySymbol(symbol) {
  return SYMBOL_DISPLAY[symbol] || symbol;
}

export default function HintPanel({ result, onClose }) {
  if (!result) return null;

  const list = (Array.isArray(result.probabilities) ? result.probabilities : [])
    .slice()
    .sort((a, b) => b.probability - a.probability);
  if (list.length === 0) return null;

  const band = confidenceBand(result.confidence ?? 0);
  const maxP = list[0].probability || 1;
  const manual = !!result.focus_applied;
  // 玩家指定了槽位，但那一格已被反馈逻辑锁定 → 本次退回自动推荐
  const focusIgnored = result.requested_slot != null && !result.focus_applied;

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 space-y-2.5 animate-pop">
      <div className="flex items-center gap-2">
        <Icon name="bulb" className="w-4 h-4 text-yellow-400" />
        <span className="text-sm text-neutral-200 font-medium">
          提示 · 第 {result.slot_number} 个空槽
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded border ${
          manual
            ? 'text-blue-300 border-blue-400/40 bg-blue-400/10'
            : 'text-neutral-500 border-neutral-700'
        }`}>
          {manual ? '你指定的' : '自动推荐'}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-neutral-500 hover:text-neutral-200 transition"
          aria-label="关闭"
        >
          <Icon name="close" className="w-4 h-4" />
        </button>
      </div>

      {focusIgnored && (
        <p className="text-xs text-neutral-400">
          你指定的第 {result.requested_slot + 1} 槽已被反馈逻辑锁定（只剩唯一可能），
          所以这次改为推荐其他槽位。
        </p>
      )}

      {/* 按概率从大到小自上而下排列 */}
      <ol className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
        {list.map((item, idx) => (
          <ProbRow
            key={item.symbol}
            rank={idx + 1}
            symbol={item.symbol}
            probability={item.probability}
            ratio={maxP > 0 ? item.probability / maxP : 0}
            highlight={idx === 0}
          />
        ))}
      </ol>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className={`px-1.5 py-0.5 rounded border ${band.cls}`}>
          信心 {band.label} {(result.confidence ?? 0).toFixed(2)}
        </span>
        <span className="text-neutral-500">候选 {list.length} 个符号</span>
        {result.model && <span className="text-neutral-600">{result.model}</span>}
      </div>

      <p className="text-xs text-neutral-500 leading-relaxed">
        概率性排序，不是答案。Jev 排第一的也可能是错的，请结合棋盘自己判断。
      </p>
    </div>
  );
}

function ProbRow({ rank, symbol, probability, ratio, highlight = false }) {
  const pct = (probability * 100).toFixed(probability < 0.01 ? 1 : 0);
  return (
    <li className="flex items-center gap-2">
      <span className="w-3 shrink-0 text-right text-xs text-neutral-600 tabular-nums">{rank}</span>
      <span
        className={`w-10 shrink-0 text-right font-bold ${highlight ? 'text-neutral-100' : 'text-neutral-300'}`}
        style={{ fontFamily: 'ui-monospace, "SF Mono", monospace' }}
      >
        {displaySymbol(symbol)}
      </span>
      <span className="flex-1 h-2 rounded-full bg-neutral-800 overflow-hidden">
        <span
          className={`block h-full rounded-full transition-all duration-300 ${highlight ? 'bg-neutral-100' : 'bg-neutral-500'}`}
          style={{ width: `${Math.max(2, Math.round(ratio * 100))}%` }}
        />
      </span>
      <span className="w-11 shrink-0 text-xs text-neutral-400 tabular-nums text-right">{pct}%</span>
    </li>
  );
}
