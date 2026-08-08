import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../hooks/useGame.js';
import { getAvailableSymbols } from '../lib/equationGenerator.js';
import { SYMBOL_DISPLAY, DIFFICULTY_LABELS, DIFFICULTY_COLORS, DIFFICULTY_TIME_LIMIT } from '../lib/constants.js';
import { recordGame } from '../lib/storage.js';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';
import EquationBoard from './EquationBoard.jsx';
import SymbolPicker from './SymbolPicker.jsx';
import AttemptList from './AttemptList.jsx';
import Timer from './Timer.jsx';
import ShareDialog from './ShareDialog.jsx';
import OnlineGameScreen from './OnlineGameScreen.jsx';

// 游戏界面
export default function GameScreen({ difficulty, mode = 'solo', onExit }) {
  // 联机模式（pvp/coop）交给独立的联机对局界面
  if (mode === 'pvp' || mode === 'coop') {
    return <OnlineGameScreen difficulty={difficulty} mode={mode} onExit={onExit} />;
  }
  return <SoloBotGame difficulty={difficulty} mode={mode} onExit={onExit} />;
}

function SoloBotGame({ difficulty, mode = 'solo', onExit }) {
  const game = useGame(difficulty, mode);
  const { user } = useAuth();
  const [hintPosition, setHintPosition] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [message, setMessage] = useState('');
  const initRef = useRef(false);

  // 自动初始化
  const { newGame } = game;
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      newGame();
    }
  }, [newGame]);

  // 提示信息
  useEffect(() => {
    if (message) {
      const id = setTimeout(() => setMessage(''), 2000);
      return () => clearTimeout(id);
    }
  }, [message]);

  // 游戏结束 → 本地记录 + 云同步
  useEffect(() => {
    if (game.status === 'won' || game.status === 'lost') {
      const elapsed = game.startTime ? Math.floor((Date.now() - game.startTime) / 1000) : 0;
      const steps = game.history.length;
      // 本地记录
      recordGame(difficulty, mode, game.status === 'won' ? 'win' : 'loss', steps, elapsed);
      // 云同步
      if (user) {
        api.stats.submit({
          difficulty,
          mode,
          result: game.status === 'won' ? 'win' : 'loss',
          steps,
          time_seconds: elapsed,
          seed: game.equation?.seed
        }).catch(() => {});
      }
      setTimeout(() => setShowShare(true), 600);
    }
  }, [game.status]);

  const symbols = getAvailableSymbols(difficulty);

  const handlePick = (symbol) => {
    game.placeSymbol(symbol);
  };

  const handleSubmit = () => {
    if (game.currentGuess.some(s => s === null)) {
      setMessage('请填满所有槽位');
      return;
    }
    game.submitGuess();
  };

  const handleHint = () => {
    const pos = game.useHint();
    if (pos) {
      setHintPosition(pos.i);
      setMessage(`提示：第 ${pos.i + 1} 个槽位是 ${SYMBOL_DISPLAY[pos.sym] || pos.sym}`);
    } else {
      setMessage('暂无可用提示');
    }
  };

  const handleTimeout = () => {
    game.timeout();
    setMessage('⏰ 时间到，本局失败');
  };

  const handleSlotClick = (slotIdx) => {
    // 点击有值的槽位清除
    if (game.currentGuess[slotIdx] !== null) {
      game.clearSlot(slotIdx);
    } else {
      game.setSelectedSlot(slotIdx);
    }
  };

  const allFilled = game.currentGuess.length > 0 && game.currentGuess.every(s => s !== null);

  if (!game.equation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400 animate-pulse">加载中...</div>
      </div>
    );
  }

  const showBotInfo = mode === 'bot';
  const { answer } = game.equation;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <button onClick={onExit} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          ← 返回
        </button>
        <div className="flex items-center gap-3">
          <span className={`font-bold text-sm ${DIFFICULTY_COLORS[difficulty]}`}>
            {DIFFICULTY_LABELS[difficulty]}
          </span>
          <span className="text-sm text-gray-400">
            {mode === 'bot' ? '人机' : mode === 'solo' ? '单人' : mode}
          </span>
        </div>
        <Timer
          startTime={game.startTime}
          maxSeconds={DIFFICULTY_TIME_LIMIT[difficulty]}
          onTimeout={handleTimeout}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3 max-w-md mx-auto w-full">
        {/* 提示行 */}
        {message && (
          <div className="text-center text-sm text-wgreen bg-green-50 dark:bg-green-900/30 rounded-lg py-1.5 animate-pop">
            {message}
          </div>
        )}

        {/* 等式板 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
          <EquationBoard
            equation={game.equation}
            currentGuess={game.currentGuess}
            onSlotClick={handleSlotClick}
            selectedSlot={game.selectedSlot}
            hintPosition={hintPosition}
          />
        </div>

        {/* 人机模式：显示 Bot 状态 */}
        {showBotInfo && (
          <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <span className="text-sm">
              {game.botThinking ? '🤖 思考中...' : '🤖 等你出招'}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              Bot 步数: {game.botHistory.length}
            </span>
          </div>
        )}

        {/* Bot 历史猜测 */}
        {showBotInfo && game.botHistory.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
            <div className="text-xs text-purple-600 dark:text-purple-400 mb-1.5">对手猜测：</div>
            <AttemptList history={game.botHistory} maxSlots={answer.length} title="" />
          </div>
        )}

        {/* 玩家历史猜测 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3">
          <AttemptList history={game.history} maxSlots={answer.length} title="你的猜测" />
        </div>

        {/* 提示按钮 */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleHint}
            disabled={game.hintUsed}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${
              game.hintUsed
                ? 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200'
            }`}
          >
            💡 提示 {game.hintUsed ? '(已用)' : '(1次)'}
          </button>
          <button
            onClick={() => game.newGame()}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1.5"
          >
            🔄 换题
          </button>
        </div>
      </div>

      {/* 底部输入区 */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-3 bg-white dark:bg-gray-800 space-y-2 max-w-md mx-auto w-full">
        <SymbolPicker
          symbols={symbols}
          onPick={handlePick}
          disabled={game.status !== 'playing'}
        />
        <div className="flex gap-2">
          <button
            onClick={game.clearAll}
            className="flex-1 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 transition text-sm"
          >
            清空
          </button>
          <button
            onClick={handleSubmit}
            disabled={!allFilled || game.status !== 'playing'}
            className={`flex-[2] py-2.5 rounded-lg font-bold text-white transition ${
              allFilled && game.status === 'playing'
                ? 'bg-wgreen hover:bg-wgreenDark active:scale-95'
                : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
            }`}
          >
            提交猜测
          </button>
        </div>
      </div>

      {/* 分享对话框 */}
      <ShareDialog
        open={showShare}
        onClose={() => setShowShare(false)}
        history={game.history}
        answer={answer}
        difficulty={difficulty}
        startTime={game.startTime}
        mode={mode}
        won={game.status === 'won'}
        equation={game.equation}
      />
    </div>
  );
}
