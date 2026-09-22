import React, { useState, useEffect } from 'react';
import { SYMBOL_DISPLAY } from '../lib/constants.js';
import Icon from './Icons.jsx';

// 提示面板：某个空槽的符号概率排序（从大到小、自上而下）。
// 支持折叠/展开（平滑缩放）与历史回查——本局用过的提示都留着，随时能翻。
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

function topPick(result) {
  const list = result?.probabilities || [];
  return list.length ? list[0] : null;
}

export default function HintPanel({ result, results = [], activeIndex = 0, onSelect, onClose }) {
  const [open, setOpen] = useState(true);

  // 每次拿到新提示都自动展开，免得玩家以为没反应
  useEffect(() => {
    if (result) setOpen(true);
  }, [result?.slot_index, results.length]);

  if (!result) return null;

  const list = (Array.isArray(result.probabilities) ? result.probabilities : [])
    .slice()
    .sort((a, b) => b.probability - a.probability);
  if (list.length === 0) return null;

  const band = confidenceBand(result.confidence ?? 0);
  const maxP = list[0].probability || 1;
  const manual = !!result.focus_applied;
  const focusIgnored = result.requested_slot != null && !result.focus_applied;
  const best = topPick(result);

  return (
    <div
      className={`bg-neutral-900 border border-neutral-700 rounded-xl p-3 space-y-2.5 origin-top transition-transform duration-300 ease-out ${
        open ? 'scale-100' : 'scale-[0.985]'
      }`}
    >
      {/* 头部：折叠时常驻一行摘要，收起后依然能看 */}
      <div className="flex items-center gap-2">
        <Icon name="bulb" className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-sm text-neutral-200 font-medium whitespace-nowrap">
          提示 · 第 {result.slot_number} 个空槽
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${
          manual ? 'text-blue-300 border-blue-400/40 bg-blue-400/10' : 'text-neutral-500 border-neutral-700'
        }`}>
          {manual ? '你指定的' : '自动推荐'}
        </span>
        {!open && best && (
          <span className="text-xs text-neutral-400 truncate">
            首选 {displaySymbol(best.symbol)} {(best.probability * 100).toFixed(0)}%
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {results.length > 1 && (
            <span className="text-xs text-neutral-500 tabular-nums">历史 {results.length}</span>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-neutral-500 hover:text-neutral-200 transition p-0.5"
            aria-label={open ? '收起' : '展开'}
            title={open ? '收起' : '展开'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-200 transition p-0.5"
            aria-label="清空提示"
            title="清空提示历史"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 可折叠主体：grid-rows 过渡实现平滑缩放/收起 */}
      <div className={`grid transition-all duration-300 ease-out ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}>
        <div className="overflow-hidden space-y-2.5">
          {focusIgnored && (
            <p className="text-xs text-neutral-400">
              你指定的第 {result.requested_slot + 1} 槽已被反馈逻辑锁定（只剩唯一可能），
              所以这次改为推荐其他槽位。
            </p>
          )}

          {/* 历史记录：本局用过的提示，点一下就切回去看 */}
          {results.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {results.map((r, idx) => {
                const p = topPick(r);
                return (
                  <button
                    key={`${r.slot_index}-${idx}`}
                    onClick={() => onSelect && onSelect(idx)}
                    className={`shrink-0 text-xs px-2 py-1 rounded-lg border transition tabular-nums ${
                      idx === activeIndex
                        ? 'border-neutral-500 bg-neutral-800 text-neutral-100'
                        : 'border-neutral-700 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    第{r.slot_number}槽{p ? ` ${displaySymbol(p.symbol)} ${(p.probability * 100).toFixed(0)}%` : ''}
                  </button>
                );
              })}
            </div>
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
        </div>
      </div>
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
