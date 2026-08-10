import React, { useEffect, useRef, useState } from 'react';
import { useOnlineGame } from '../hooks/useOnlineGame.js';
import { getAvailableSymbols } from '../lib/equationGenerator.js';
import { FEEDBACK_COLORS, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '../lib/constants.js';
import { recordGame } from '../lib/storage.js';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import EquationBoard from './EquationBoard.jsx';
import SymbolPicker from './SymbolPicker.jsx';
import AttemptList from './AttemptList.jsx';
import Timer from './Timer.jsx';
import ShareDialog from './ShareDialog.jsx';
import Icon from './Icons.jsx';

const MODE_LABEL = { pvp: '1v1 对抗', coop: '合作' };

// 竞速进度列：一格一反馈颜色（绿/黄/灰），不含具体符号 —— 看得到对方进度、看不到对方猜了什么
function RaceProgress({ history, slotCount, emptyLabel }) {
  if (!history || history.length === 0) {
    return <div className="text-[10px] text-neutral-500 text-center py-1">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-1">
      {history.map((row, i) => {
        // 本人最后一猜反馈可能还没回（feedback 为 null），先用灰色占位
        const cells = row && row.length ? row : new Array(slotCount || 1).fill(null);
        return (
          <div key={i} className="flex flex-wrap gap-[3px]">
            {cells.map((f, j) => (
              <span
                key={j}
                className={`w-2.5 h-2.5 rounded-[2px] ${FEEDBACK_COLORS[f] || 'bg-neutral-700'}`}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// 联机对局界面（匹配 → 对局 → 结算）
export default function OnlineGameScreen({ difficulty, mode, onExit }) {
  const game = useOnlineGame(difficulty, mode);
  const { user } = useAuth();
  const [showShare, setShowShare] = useState(false);
  const initRef = useRef(false);

  // 对局结束 → 本地记录 + 云同步（平局/取消不记）
  useEffect(() => {
    if (game.status === 'won' || game.status === 'lost') {
      const elapsed = game.startTime ? Math.floor((Date.now() - game.startTime) / 1000) : 0;
      const steps = game.history.length;
      recordGame(difficulty, mode, game.status === 'won' ? 'win' : 'loss', steps, elapsed);
      if (user) {
        api.stats.submit({
          difficulty,
          mode,
          result: game.status === 'won' ? 'win' : 'loss',
          steps,
          time_seconds: elapsed,
          seed: game.gameOver?.seed
        }).catch(() => {});
      }
      const id = setTimeout(() => setShowShare(true), 600);
      return () => clearTimeout(id);
    }
  }, [game.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = () => {
    game.leave();
    onExit();
  };

  const handleSubmit = () => {
    if (game.currentGuess.some((s) => s === null)) return;
    game.submitGuess();
  };

  const handleSlotClick = (slotIdx) => {
    if (game.status !== 'playing') return;
    if (game.currentGuess[slotIdx] !== null) {
      game.clearSlot(slotIdx);
    } else {
      game.setSelectedSlot(slotIdx);
    }
  };

  const symbols = getAvailableSymbols(difficulty);
  const allFilled = game.currentGuess.length > 0 && game.currentGuess.every((s) => s !== null);
  const canPlay = game.status === 'playing' && (mode === 'pvp' || game.myTurn);
  const slotCount = game.slotCount || game.equation?.answerLength || 0;

  // ── 匹配 / 连接界面 ──
  if (game.conn !== 'matched') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-neutral-950">
        <button onClick={handleExit} className="absolute top-4 left-4 text-neutral-400 hover:text-neutral-200 transition">
          ← 返回
        </button>
        {game.conn === 'connecting' && (
          <div className="text-neutral-400 animate-pulse">连接联机服务器中...</div>
        )}
        {game.conn === 'queue' && (
          <>
            <div className="text-2xl font-bold text-neutral-100">
              正在匹配 {DIFFICULTY_LABELS[difficulty]} {MODE_LABEL[mode]}...
            </div>
            <div className="flex gap-3">
              <div className="w-3 h-3 rounded-full bg-neutral-100 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 rounded-full bg-neutral-700 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <button
              onClick={game.cancelFind}
              className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-200 text-sm hover:bg-neutral-700 transition"
            >
              取消匹配
            </button>
          </>
        )}
        {game.connError && (
          <div className="text-center space-y-3">
            <div className="text-red-400 text-sm">{game.connError}</div>
            <button
              onClick={game.retry}
              className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-950 text-sm font-semibold hover:bg-neutral-200 transition"
            >
              重试
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── 对局界面 ──
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <button onClick={handleExit} className="text-neutral-400 hover:text-neutral-200 transition">
          ← 返回
        </button>
        <div className="flex items-center gap-3">
          <span className={`font-bold text-sm ${DIFFICULTY_COLORS[difficulty]}`}>{DIFFICULTY_LABELS[difficulty]}</span>
          <span className="text-sm text-neutral-400">{MODE_LABEL[mode]}</span>
        </div>
        <Timer startTime={game.startTime} active={game.status === 'playing'} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3 max-w-md mx-auto w-full">
        {/* 竞速进度（pvp）：左右分栏 —— 我 | 对手，双方只看反馈颜色 */}
        {mode === 'pvp' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="text-xs font-semibold text-neutral-100">我</span>
                <span className="text-xs text-neutral-400 shrink-0">{game.history.length} 步</span>
              </div>
              <RaceProgress
                history={game.history.map((h) => h.feedback)}
                slotCount={slotCount}
                emptyLabel="尚无猜测"
              />
            </div>
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="text-xs font-semibold text-neutral-100 truncate">{game.opponent.nickname}</span>
                <span className="text-xs text-neutral-400 shrink-0">{game.opponent.steps} 步</span>
              </div>
              <RaceProgress
                history={game.opponent.feedback}
                slotCount={slotCount}
                emptyLabel="尚无猜测"
              />
            </div>
          </div>
        )}

        {/* 对手信息（coop） */}
        {mode === 'coop' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700">
            <Icon name="users" className="w-4 h-4 text-neutral-400" />
            <span className="text-sm font-medium text-neutral-100">
              {game.opponent.nickname}
            </span>
            <span className={`text-xs ml-auto ${game.myTurn ? 'text-neutral-100 font-semibold' : 'text-neutral-400'}`}>
              {game.myTurn ? '轮到你' : '等待对方...'}
            </span>
          </div>
        )}

        {/* 提示 */}
        {game.notice && (
          <div className="text-center text-sm text-neutral-300 bg-neutral-900 border border-neutral-700 rounded-lg py-1.5">
            {game.notice}
          </div>
        )}

        {/* 等式板 */}
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4">
          <EquationBoard
            equation={game.equation}
            currentGuess={game.currentGuess}
            onSlotClick={handleSlotClick}
            selectedSlot={game.selectedSlot}
            hintPosition={null}
          />
        </div>

        {/* 历史猜测（coop 共享 / pvp 本人） */}
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-3">
          <AttemptList
            history={game.history}
            maxSlots={slotCount}
            title={mode === 'coop' ? '共同猜测' : '你的猜测'}
          />
        </div>

        {/* 结算提示 */}
        {game.status !== 'playing' && game.gameOver && (
          <div className="text-center text-lg font-bold text-neutral-100">
            {game.status === 'won' && '你赢了！'}
            {game.status === 'lost' && '你输了'}
            {game.status === 'draw' && '平局'}
            {game.status === 'aborted' && '对局取消'}
            <div className="text-sm font-normal text-neutral-400 mt-1">{game.gameOver.reason}</div>
          </div>
        )}
      </div>

      {/* 底部输入区 */}
      <div className={`border-t border-neutral-700 px-3 py-3 bg-neutral-900 space-y-2 max-w-md mx-auto w-full ${
        mode === 'coop' && !game.myTurn ? 'opacity-60' : ''
      }`}>
        <SymbolPicker
          symbols={symbols}
          onPick={game.placeSymbol}
          disabled={!canPlay}
        />
        <div className="flex gap-2">
          <button
            onClick={game.clearAll}
            disabled={!canPlay}
            className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 font-medium hover:bg-neutral-700 transition text-sm disabled:opacity-40"
          >
            清空
          </button>
          <button
            onClick={handleSubmit}
            disabled={!allFilled || !canPlay}
            className={`flex-[2] py-2.5 rounded-lg font-bold transition ${
              allFilled && canPlay
                ? 'bg-neutral-100 text-neutral-950 hover:bg-neutral-200 active:scale-[0.98]'
                : 'bg-neutral-800 text-neutral-400 cursor-not-allowed'
            }`}
          >
            {mode === 'coop' && !game.myTurn ? '等待对方...' : '提交猜测'}
          </button>
        </div>
      </div>

      {/* 分享对话框 */}
      {game.answer && (
        <ShareDialog
          open={showShare}
          onClose={() => setShowShare(false)}
          history={game.history}
          answer={game.answer}
          difficulty={difficulty}
          startTime={game.startTime}
          mode={mode}
          won={game.status === 'won'}
          equation={game.equation}
        />
      )}
    </div>
  );
}
