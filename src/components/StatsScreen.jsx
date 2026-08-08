import React, { useState, useEffect } from 'react';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, DIFFICULTIES } from '../lib/constants.js';
import { getStats as getLocalStats, getNickname } from '../lib/storage.js';
import { api } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

export default function StatsScreen({ onBack }) {
  const { user } = useAuth();
  const localStats = getLocalStats();
  const [cloudStats, setCloudStats] = useState(null);
  const [cloudLoading, setCloudLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setCloudLoading(true);
      api.stats.get()
        .then(data => setCloudStats(data.stats || {}))
        .catch(() => setCloudStats(null))
        .finally(() => setCloudLoading(false));
    }
  }, [user]);

  const renderStatCard = (diff, stats, source) => {
    if (!stats || !stats[diff]) {
      return (
        <div key={diff} className="bg-white dark:bg-gray-800 rounded-2xl p-4">
          <div className={`font-bold ${DIFFICULTY_COLORS[diff]}`}>{DIFFICULTY_LABELS[diff]}</div>
          <div className="text-center py-2 text-sm text-gray-400">暂无记录</div>
        </div>
      );
    }
    const s = stats[diff];
    const winRate = s.total > 0 ? ((s.wins / s.total) * 100).toFixed(1) : '0';
    const avgSteps = s.total > 0 ? (s.totalSteps / s.total).toFixed(1) : '-';
    const avgTime = s.total > 0 ? Math.floor(s.totalTime / s.total) : 0;

    return (
      <div key={`${diff}-${source}`} className="bg-white dark:bg-gray-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className={`font-bold ${DIFFICULTY_COLORS[diff]}`}>{DIFFICULTY_LABELS[diff]}</div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">
            {source === 'cloud' ? '☁️ 云端' : '📱 本地'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{s.wins || 0}/{s.total || 0}</div>
            <div className="text-xs text-gray-400">胜/总</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">{winRate}%</div>
            <div className="text-xs text-gray-400">胜率</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-500 dark:text-orange-400">
              {s.currentStreak || 0}/{s.bestStreak || 0}
            </div>
            <div className="text-xs text-gray-400">连胜/最佳</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="text-gray-500 dark:text-gray-400">
            最佳: <span className="font-semibold text-gray-700 dark:text-gray-300">
              {s.bestSteps ? `${s.bestSteps}步` : '-'}
            </span>
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            平均: <span className="font-semibold text-gray-700 dark:text-gray-300">{avgSteps}步</span>
          </div>
        </div>
        {avgTime > 0 && (
          <div className="text-center text-xs text-gray-400">
            平均用时 {Math.floor(avgTime / 60)}分{avgTime % 60}秒
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
          ← 返回
        </button>
        <h1 className="font-bold text-gray-800 dark:text-gray-200">📊 统计数据</h1>
        <div className="w-12" />
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* 玩家信息 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            {user ? user.nickname : getNickname() || '匿名玩家'}
          </div>
          <div className="text-sm text-gray-400">
            {user ? '☁️ 已登录' : '📱 游客模式（仅本地记录）'}
          </div>
        </div>

        {/* 云端统计 */}
        {user && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">☁️ 云端统计</h2>
            {cloudLoading ? (
              <div className="text-center py-4 text-gray-400">加载中...</div>
            ) : cloudStats ? (
              DIFFICULTIES.map(d => renderStatCard(d, cloudStats, 'cloud'))
            ) : (
              <div className="text-center py-4 text-gray-400">暂无云端数据</div>
            )}
          </div>
        )}

        {/* 本地统计 */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">📱 本地统计</h2>
          {DIFFICULTIES.map(d => renderStatCard(d, localStats, 'local'))}
        </div>
      </div>
    </div>
  );
}
