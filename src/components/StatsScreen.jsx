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
        <div key={diff} className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4">
          <div className={`font-bold ${DIFFICULTY_COLORS[diff]}`}>{DIFFICULTY_LABELS[diff]}</div>
          <div className="text-center py-2 text-sm text-neutral-400">暂无记录</div>
        </div>
      );
    }
    const s = stats[diff];
    const winRate = s.total > 0 ? ((s.wins / s.total) * 100).toFixed(1) : '0';
    const avgSteps = s.total > 0 ? (s.totalSteps / s.total).toFixed(1) : '-';
    const avgTime = s.total > 0 ? Math.floor(s.totalTime / s.total) : 0;

    return (
      <div key={`${diff}-${source}`} className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className={`font-bold ${DIFFICULTY_COLORS[diff]}`}>{DIFFICULTY_LABELS[diff]}</div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
            {source === 'cloud' ? '云端' : '本地'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-neutral-100">{s.wins || 0}/{s.total || 0}</div>
            <div className="text-xs text-neutral-400">胜/总</div>
          </div>
          <div>
            <div className="text-lg font-bold text-neutral-100">{winRate}%</div>
            <div className="text-xs text-neutral-400">胜率</div>
          </div>
          <div>
            <div className="text-lg font-bold text-neutral-100">
              {s.currentStreak || 0}/{s.bestStreak || 0}
            </div>
            <div className="text-xs text-neutral-400">连胜/最佳</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="text-neutral-400">
            最佳: <span className="font-semibold text-neutral-200">
              {s.bestSteps ? `${s.bestSteps}步` : '-'}
            </span>
          </div>
          <div className="text-neutral-400">
            平均: <span className="font-semibold text-neutral-200">{avgSteps}步</span>
          </div>
        </div>
        {avgTime > 0 && (
          <div className="text-center text-xs text-neutral-400">
            平均用时 {Math.floor(avgTime / 60)}分{avgTime % 60}秒
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <button onClick={onBack} className="text-neutral-400 hover:text-neutral-200 transition">
          ← 返回
        </button>
        <h1 className="font-bold text-neutral-100">统计数据</h1>
        <div className="w-12" />
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* 玩家信息 */}
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-neutral-100">
            {user ? user.nickname : getNickname() || '匿名玩家'}
          </div>
          <div className="text-sm text-neutral-400">
            {user ? '已登录' : '游客模式（仅本地记录）'}
          </div>
        </div>

        {/* 云端统计 */}
        {user && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-400 px-1">云端统计</h2>
            {cloudLoading ? (
              <div className="text-center py-4 text-neutral-400">加载中...</div>
            ) : cloudStats ? (
              DIFFICULTIES.map(d => renderStatCard(d, cloudStats, 'cloud'))
            ) : (
              <div className="text-center py-4 text-neutral-400">暂无云端数据</div>
            )}
          </div>
        )}

        {/* 本地统计 */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-400 px-1">本地统计</h2>
          {DIFFICULTIES.map(d => renderStatCard(d, localStats, 'local'))}
        </div>
      </div>
    </div>
  );
}
