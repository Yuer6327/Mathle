import React, { useState, useEffect } from 'react';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, DIFFICULTY_ACTIVE, DIFFICULTIES } from '../lib/constants.js';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

const RANK_BADGES = [
  'bg-neutral-100 text-neutral-950', // 第 1 名
  'bg-neutral-300 text-neutral-800', // 第 2 名
  'bg-neutral-600 text-neutral-100', // 第 3 名
  'bg-neutral-800 text-neutral-400'  // 其余
];

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
    <div className="min-h-screen bg-neutral-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <button onClick={onBack} className="text-neutral-400 hover:text-neutral-200 transition">
          ← 返回
        </button>
        <h1 className="font-bold text-neutral-100">排行榜</h1>
        <div className="w-12" />
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* 难度切换 */}
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {DIFFICULTIES.map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition border ${
                difficulty === d
                  ? DIFFICULTY_ACTIVE[d]
                  : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-300'
              }`}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>

        {/* 排行榜列表 */}
        {loading ? (
          <div className="text-center py-8 text-neutral-400">加载中...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-neutral-400">
            暂无数据，快来成为第一名！
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isMe = user && entry.nickname === user.nickname;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isMe
                      ? 'bg-neutral-800/60 border-neutral-700'
                      : 'bg-neutral-900 border-neutral-700'
                  }`}
                >
                  {/* 排名 */}
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${RANK_BADGES[Math.min(i, 3)]}`}>
                    {i + 1}
                  </div>

                  {/* 昵称 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-neutral-100 truncate">
                      {entry.nickname}
                      {isMe && <span className="ml-1 text-xs text-neutral-400">(你)</span>}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {entry.totalWins}胜 / {entry.totalGames}局 · 胜率 {entry.winRate}
                    </div>
                  </div>

                  {/* 成绩 */}
                  <div className="text-right">
                    <div className="font-bold text-neutral-100">
                      {entry.bestSteps ? `${entry.bestSteps}步` : '-'}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {entry.bestTime ? `${Math.floor(entry.bestTime / 60)}:${String(entry.bestTime % 60).padStart(2, '0')}` : '-'}
                    </div>
                  </div>

                  {/* 连胜 */}
                  {entry.bestStreak > 0 && (
                    <div className="text-xs text-neutral-400 whitespace-nowrap">
                      连胜 {entry.bestStreak}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!user && (
          <div className="text-center text-sm text-neutral-400 pt-4">
            登录后可上榜
          </div>
        )}
      </div>
    </div>
  );
}
