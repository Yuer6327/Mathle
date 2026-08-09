import React, { useEffect, useState } from 'react';
import { useRoomGame } from '../hooks/useRoomGame.js';
import { getAvailableSymbols } from '../lib/equationGenerator.js';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '../lib/constants.js';
import { recordGame } from '../lib/storage.js';
import EquationBoard from './EquationBoard.jsx';
import SymbolPicker from './SymbolPicker.jsx';
import AttemptList from './AttemptList.jsx';
import Timer from './Timer.jsx';
import ShareDialog from './ShareDialog.jsx';
import Icon from './Icons.jsx';

// 好友房间：房主创建 → 分享房号/链接 → 好友加入 → 房主开始 → N 人轮流破解共享等式
export default function RoomScreen({ difficulty, create = false, code = '', onExit }) {
  const game = useRoomGame({ difficulty, create, code });
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // 对局结束 → 本地记录（游客/登录数据都只存浏览器本地）
  useEffect(() => {
    if (game.status === 'won' || game.status === 'lost') {
      const elapsed = game.startTime ? Math.floor((Date.now() - game.startTime) / 1000) : 0;
      const steps = game.history.length;
      recordGame(difficulty, 'coop', game.status === 'won' ? 'win' : 'loss', steps, elapsed);
      const id = setTimeout(() => setShowShare(true), 600);
      return () => clearTimeout(id);
    }
  }, [game.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = () => {
    game.leave();
    onExit();
  };

  const inviteUrl = () => {
    const base = location.href.split('#')[0];
    return `${base}#/room/${difficulty}?code=${game.roomCode}`;
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const symbols = getAvailableSymbols(difficulty);
  const canPlay = game.status === 'playing' && game.myTurn;
  const allFilled = game.currentGuess.length > 0 && game.currentGuess.every((s) => s !== null);
  const currentPlayerName = game.players[game.turnIndex]?.nickname || '';

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

  // ── 连接中 / 错误 ──
  if (game.conn === 'connecting' || game.conn === 'closed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-neutral-950">
        <button onClick={handleExit} className="absolute top-4 left-4 text-neutral-500 hover:text-neutral-200 transition">
          ← 返回
        </button>
        {game.conn === 'connecting' && !game.connError && (
          <div className="text-neutral-500 animate-pulse">连接联机服务器中...</div>
        )}
        {(game.conn === 'closed' || game.connError) && (
          <div className="text-center space-y-3">
            <div className="text-red-400 text-sm">{game.connError || '连接已断开'}</div>
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

  // ── 大厅 ──
  if (game.conn === 'lobby') {
    return (
      <div className="min-h-screen flex flex-col bg-neutral-950">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <button onClick={handleExit} className="text-neutral-500 hover:text-neutral-200 transition">
            ← 返回
          </button>
          <div className="flex items-center gap-3">
            <span className={`font-bold text-sm ${DIFFICULTY_COLORS[difficulty]}`}>
              {DIFFICULTY_LABELS[difficulty]} 合作
            </span>
          </div>
          <div className="w-12" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-md mx-auto w-full">
          <div className="text-center">
            <div className="text-sm text-neutral-500">房间号</div>
            <div className="text-5xl font-extrabold tracking-[0.3em] text-neutral-100 my-3 font-mono">
              {game.roomCode}
            </div>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => copyText(game.roomCode)}
                className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-950 text-sm font-semibold hover:bg-neutral-200 transition"
              >
                {copied ? '已复制' : '复制房号'}
              </button>
              <button
                onClick={() => copyText(inviteUrl())}
                className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-200 text-sm font-semibold hover:bg-neutral-700 transition"
              >
                {copied ? '已复制' : '复制邀请链接'}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">好友输入房号即可加入，最多 8 人</p>
          </div>

          {game.connError && (
            <div className="text-center text-sm text-red-400">{game.connError}</div>
          )}

          {/* 玩家列表 */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
            <div className="text-sm font-semibold text-neutral-500 mb-2">
              玩家（{game.players.length}）
            </div>
            <div className="space-y-2">
              {game.players.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Icon name="person" className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span className="font-medium text-neutral-100">{p.nickname}</span>
                  {p.id === game.myId && <span className="text-xs text-neutral-500">（我）</span>}
                  {p.id === game.hostId && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">房主</span>
                  )}
                </div>
              ))}
            </div>
            {game.players.length < 2 && (
              <div className="text-center text-sm text-neutral-500 mt-3 animate-pulse">
                等待好友加入...
              </div>
            )}
          </div>

          {game.isHost ? (
            <button
              onClick={game.start}
              disabled={game.players.length < 2}
              className={`w-full py-3 rounded-xl font-bold transition ${
                game.players.length >= 2
                  ? 'bg-neutral-100 text-neutral-950 hover:bg-neutral-200 active:scale-[0.98]'
                  : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
              }`}
            >
              {game.players.length >= 2 ? '开始游戏' : `还需 ${2 - game.players.length} 人`}
            </button>
          ) : (
            <div className="text-center text-sm text-neutral-500 animate-pulse">
              等待房主开始游戏...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 对局进行中 / 结算 ──
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <button onClick={handleExit} className="text-neutral-500 hover:text-neutral-200 transition">
          ← 返回
        </button>
        <div className="flex items-center gap-3">
          <span className={`font-bold text-sm ${DIFFICULTY_COLORS[difficulty]}`}>
            {DIFFICULTY_LABELS[difficulty]} 合作
          </span>
          <span className="text-xs text-neutral-500 font-mono">房 {game.roomCode}</span>
        </div>
        <Timer startTime={game.startTime} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3 max-w-md mx-auto w-full">
        {/* 玩家 / 回合 */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 flex-wrap">
          {game.players.map((p, i) => (
            <span key={p.id} className={`text-xs px-2 py-1 rounded-full ${
              i === game.turnIndex && game.status === 'playing'
                ? 'bg-neutral-100 text-neutral-950 font-semibold'
                : 'bg-neutral-800 text-neutral-500'
            }`}>
              {p.nickname}{i === game.turnIndex && game.status === 'playing' ? ' · 猜' : ''}
            </span>
          ))}
        </div>

        {game.notice && (
          <div className="text-center text-sm text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-lg py-1.5">
            {game.notice}
          </div>
        )}

        {/* 等式板 */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <EquationBoard
            equation={game.equation}
            currentGuess={game.currentGuess}
            onSlotClick={handleSlotClick}
            selectedSlot={game.selectedSlot}
            hintPosition={null}
          />
        </div>

        {/* 共同猜测 */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
          <AttemptList
            history={game.history}
            maxSlots={slotCountFor(game)}
            title="共同猜测"
          />
        </div>

        {/* 结算提示 */}
        {game.status !== 'playing' && game.gameOver && (
          <div className="text-center text-lg font-bold text-neutral-100">
            {game.status === 'won' && '合作成功！'}
            {game.status === 'lost' && '挑战失败'}
            {game.status === 'draw' && '平局'}
            {game.status === 'aborted' && '对局取消'}
            <div className="text-sm font-normal text-neutral-500 mt-1">{game.gameOver.reason}</div>
          </div>
        )}
      </div>

      {/* 底部输入区 */}
      <div className={`border-t border-neutral-800 px-3 py-3 bg-neutral-900 space-y-2 max-w-md mx-auto w-full ${
        !game.myTurn ? 'opacity-60' : ''
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
                : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
            }`}
          >
            {!game.myTurn ? `等待 ${currentPlayerName}...` : '提交猜测'}
          </button>
        </div>
      </div>

      {game.answer && (
        <ShareDialog
          open={showShare}
          onClose={() => setShowShare(false)}
          history={game.history}
          answer={game.answer}
          difficulty={difficulty}
          startTime={game.startTime}
          mode="coop"
          won={game.status === 'won'}
          equation={game.equation}
        />
      )}
    </div>
  );
}

function slotCountFor(game) {
  if (game.slotCount) return game.slotCount;
  return game.equation?.answerLength || 0;
}
