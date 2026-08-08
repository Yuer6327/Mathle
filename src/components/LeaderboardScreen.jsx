import React, { useState, useEffect } from 'react';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, DIFFICULTIES } from '../lib/constants.js';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

export default function LeaderboardScreen({ onBack }) {
  const { user } = useAuth();
  const [difficulty, setDifficulty] = useState('beginner');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.leaderboard.get(difficulty)
      .then(data => setEntries(data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [difficulty]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
          ← 返回
        </button>
        <h1 className="font-bold text-gray-800 dark:text-gray-200">🏆 排行榜</h1>
        <div className="w-12" />
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 难度切换 */}
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {DIFFICULTIES.map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                difficulty === d
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              } ${DIFFICULTY_COLORS[d]}`}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>

        {/* 排行榜列表 */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            暂无数据，快来成为第一名！
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isMe = user && entry.nickname === user.nickname;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    isMe
                      ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                      : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  {/* 排名 */}
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                    i === 0 ? 'bg-yellow-400 text-white' :
                    i === 1 ? 'bg-gray-300 text-white' :
                    i === 2 ? 'bg-orange-400 text-white' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-500'
                  }`}>
                    {i + 1}
                  </div>

                  {/* 昵称 */}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                      {entry.nickname}
                      {isMe && <span className="ml-1 text-xs text-blue-500">(你)</span>}
                    </div>
                    <div className="text-xs text-gray-400">
                      {entry.totalWins}胜 / {entry.totalGames}局 · 胜率 {entry.winRate}
                    </div>
                  </div>

                  {/* 成绩 */}
                  <div className="text-right">
                    <div className="font-bold text-gray-700 dark:text-gray-300">
                      {entry.bestSteps ? `${entry.bestSteps}步` : '-'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {entry.bestTime ? `${Math.floor(entry.bestTime / 60)}:${String(entry.bestTime % 60).padStart(2, '0')}` : '-'}
                    </div>
                  </div>

                  {/* 连胜 */}
                  {entry.bestStreak > 0 && (
                    <div className="text-xs text-orange-500 dark:text-orange-400">
                      🔥{entry.bestStreak}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!user && (
          <div className="text-center text-sm text-gray-400 pt-4">
            登录后可上榜
          </div>
        )}
      </div>
    </div>
  );
}
