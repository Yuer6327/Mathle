import React, { useState } from 'react';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, SLOT_RANGES, SYMBOL_POOLS } from '../lib/constants.js';
import { getNickname, setNickname, getStats } from '../lib/storage.js';
import { useAuth } from '../hooks/useAuth.jsx';

// 主菜单
export default function MainMenu({ onStart, onRoomStart, onShowStats, onShowLeaderboard }) {
  const { user, loading, login, register, logout } = useAuth();
  const [authMode, setAuthMode] = useState(null);
  const [formName, setFormName] = useState('');
  const [formPass, setFormPass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleSubmit = async () => {
    if (!formName.trim() || !formPass) {
      setAuthError('请填写昵称和密码');
      return;
    }
    setSubmitting(true);
    setAuthError('');
    try {
      if (authMode === 'login') {
        await login(formName.trim(), formPass);
      } else {
        await register(formName.trim(), formPass);
      }
      setAuthMode(null);
      setFormName('');
      setFormPass('');
    } catch (e) {
      setAuthError(e.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const totalGames = Object.values(getStats()).reduce((sum, s) => sum + (s.total || 0), 0);
  const [gameDiff, setGameDiff] = useState('medium'); // 单人 / 人机难度
  const [onlineDiff, setOnlineDiff] = useState('medium');

  const startOnline = (m) => {
    // 游客也可联机：数据只存浏览器本地，不上传云端
    onStart(onlineDiff, m);
  };

  const handleJoinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) return;
    onRoomStart(onlineDiff, code);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      {/* 标题 */}
      <div className="text-center pt-4">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-wgreen">M</span>ath
          <span className="text-wyellow">W</span>ordle
        </h1>
      </div>

      {/* 用户区域 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        {loading ? (
          <div className="text-center text-sm text-gray-400">加载中...</div>
        ) : user ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-400">已登录</span>
              <div className="font-bold text-gray-800 dark:text-gray-200">{user.nickname}</div>
            </div>
            <button
              onClick={logout}
              className="text-sm text-gray-400 hover:text-red-500 transition"
            >
              退出
            </button>
          </div>
        ) : authMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {authMode === 'login' ? '登录' : '注册'}
              </span>
              <button onClick={() => setAuthMode(null)} className="text-gray-400 hover:text-gray-600">
                取消
              </button>
            </div>
            <input
              type="text"
              placeholder="昵称"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              placeholder="密码"
              value={formPass}
              onChange={e => setFormPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-blue-500"
            />
            {authError && <div className="text-sm text-red-500">{authError}</div>}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-wgreen text-white font-bold hover:bg-wgreenDark transition disabled:opacity-50"
            >
              {submitting ? '处理中...' : (authMode === 'login' ? '登录' : '注册')}
            </button>
            {authMode === 'login' ? (
              <button onClick={() => setAuthMode('register')} className="text-sm text-blue-500 hover:underline">
                没有账号？去注册
              </button>
            ) : (
              <button onClick={() => setAuthMode('login')} className="text-sm text-blue-500 hover:underline">
                已有账号？去登录
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setAuthMode('login')}
              className="flex-1 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-100 transition text-sm"
            >
              登录
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className="flex-1 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium hover:bg-green-100 transition text-sm"
            >
              注册
            </button>
          </div>
        )}
      </div>

      {/* 模式选择 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">选择模式</h2>
        <DifficultyPicker value={gameDiff} onChange={setGameDiff} />
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onStart(gameDiff, 'solo')}
            className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 transition"
          >
            <div className="text-lg">🎯</div>
            <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">单人挑战</div>
            <div className="text-xs text-gray-400">选难度开始</div>
          </button>
          <button
            onClick={() => onStart(gameDiff, 'bot')}
            className="px-4 py-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 transition"
          >
            <div className="text-lg">🤖</div>
            <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">人机对战</div>
            <div className="text-xs text-gray-400">挑战 AI</div>
          </button>
          <button
            onClick={onShowStats}
            className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 transition"
          >
            <div className="text-lg">📊</div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">统计数据</div>
            <div className="text-xs text-gray-400">查看记录</div>
          </button>
          <button
            onClick={onShowLeaderboard}
            className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 transition"
          >
            <div className="text-lg">🏆</div>
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">排行榜</div>
            <div className="text-xs text-gray-400">高手榜</div>
          </button>
        </div>
      </div>

      {/* 联机对战 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">联机对战 · 实时同步</h2>
        <DifficultyPicker value={onlineDiff} onChange={setOnlineDiff} />
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => startOnline('pvp')}
            className="px-4 py-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 transition"
          >
            <div className="text-lg">⚔️</div>
            <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">1v1 对抗</div>
            <div className="text-xs text-gray-400">随机匹配</div>
          </button>
          <button
            onClick={() => startOnline('coop')}
            className="px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 hover:bg-green-100 transition"
          >
            <div className="text-lg">🤝</div>
            <div className="text-sm font-semibold text-green-700 dark:text-green-300">合作模式</div>
            <div className="text-xs text-gray-400">随机匹配</div>
          </button>
        </div>

        {/* 好友房间 */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 text-center">好友房间 · 邀请好友同局</h3>
          <button
            onClick={() => onRoomStart(onlineDiff, 'create')}
            className="w-full px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 transition"
          >
            <div className="text-lg">🏠</div>
            <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">创建房间</div>
            <div className="text-xs text-gray-400">生成房号邀请好友</div>
          </button>
          <div className="flex gap-2">
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              placeholder="输入房号"
              maxLength={6}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-center font-mono tracking-widest uppercase focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!roomCode.trim()}
              className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-40"
            >
              加入
            </button>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 pt-4">
        Original by{' '}
        <a
          href="https://yuer6327.top"
          target="_blank"
          rel="noopener noreferrer"
          className="text-wgreen hover:underline"
        >
          Yuer6327
        </a>
      </div>
    </div>
  );
}

// 难度选择器（单人/人机 与 联机共用）
function DifficultyPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            value === key
              ? 'bg-wgreen text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
