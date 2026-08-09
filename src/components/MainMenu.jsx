import React, { useState } from 'react';
import { DIFFICULTY_LABELS, DIFFICULTY_ACTIVE } from '../lib/constants.js';
import { useAuth } from '../hooks/useAuth.jsx';
import Icon from './Icons.jsx';

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
    <div className="max-w-md mx-auto px-4 py-6 space-y-8">
      {/* 标题 */}
      <div className="text-center pt-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-100">
          MathWordle
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">数学版 Wordle</p>
      </div>

      {/* 用户区域 */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        {loading ? (
          <div className="text-center text-sm text-neutral-500">加载中...</div>
        ) : user ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-neutral-500">已登录</span>
              <div className="font-bold text-neutral-100">{user.nickname}</div>
            </div>
            <button
              onClick={logout}
              className="text-sm text-neutral-500 hover:text-neutral-200 transition"
            >
              退出
            </button>
          </div>
        ) : authMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-100">
                {authMode === 'login' ? '登录' : '注册'}
              </span>
              <button onClick={() => setAuthMode(null)} className="text-neutral-500 hover:text-neutral-200">
                取消
              </button>
            </div>
            <input
              type="text"
              placeholder="昵称"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
            />
            <input
              type="password"
              placeholder="密码"
              value={formPass}
              onChange={e => setFormPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
            />
            {authError && <div className="text-sm text-red-400">{authError}</div>}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-neutral-100 text-neutral-950 font-bold hover:bg-neutral-200 transition disabled:opacity-40"
            >
              {submitting ? '处理中...' : (authMode === 'login' ? '登录' : '注册')}
            </button>
            {authMode === 'login' ? (
              <button onClick={() => setAuthMode('register')} className="text-sm text-neutral-400 hover:text-neutral-200 underline">
                没有账号？去注册
              </button>
            ) : (
              <button onClick={() => setAuthMode('login')} className="text-sm text-neutral-400 hover:text-neutral-200 underline">
                已有账号？去登录
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setAuthMode('login')}
              className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-100 font-medium hover:bg-neutral-700 transition text-sm"
            >
              登录
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-neutral-100 font-medium hover:bg-neutral-700 transition text-sm"
            >
              注册
            </button>
          </div>
        )}
      </div>

      {/* 模式选择 */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-neutral-500 text-center">选择模式</h2>
        <DifficultyPicker value={gameDiff} onChange={setGameDiff} />
        <div className="grid grid-cols-2 gap-3">
          <ModeCard icon="target" title="单人挑战" sub="选难度开始" onClick={() => onStart(gameDiff, 'solo')} />
          <ModeCard icon="cpu" title="人机对战" sub="挑战 AI" onClick={() => onStart(gameDiff, 'bot')} />
          <ModeCard icon="chart" title="统计数据" sub="查看记录" onClick={onShowStats} />
          <ModeCard icon="trophy" title="排行榜" sub="高手榜" onClick={onShowLeaderboard} />
        </div>
      </section>

      {/* 联机对战 */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-neutral-500 text-center">联机对战</h2>
        <DifficultyPicker value={onlineDiff} onChange={setOnlineDiff} />
        <div className="grid grid-cols-2 gap-3">
          <ModeCard icon="shield" title="1v1 对抗" sub="随机匹配" onClick={() => startOnline('pvp')} />
          <ModeCard icon="users" title="合作模式" sub="随机匹配" onClick={() => startOnline('coop')} />
        </div>

        {/* 好友房间 */}
        <div className="border-t border-neutral-800 pt-4 space-y-3">
          <h3 className="text-xs font-semibold tracking-widest text-neutral-500 text-center">好友房间</h3>
          <ModeCard icon="home" title="创建房间" sub="生成房号邀请好友" onClick={() => onRoomStart(onlineDiff, 'create')} wide />
          <div className="flex gap-2">
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              placeholder="输入房号"
              maxLength={6}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-500 text-center font-mono tracking-widest uppercase focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!roomCode.trim()}
              className="px-4 py-2.5 rounded-lg bg-neutral-100 text-neutral-950 text-sm font-semibold hover:bg-neutral-200 transition disabled:opacity-40"
            >
              加入
            </button>
          </div>
        </div>
      </section>

      <div className="text-center text-xs text-neutral-600 pt-2">
        Original by{' '}
        <a
          href="https://yuer6327.top"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 hover:text-neutral-100 hover:underline"
        >
          Yuer6327
        </a>
      </div>
    </div>
  );
}

// 模式卡片（线性图标 + 标题 + 副标题）
function ModeCard({ icon, title, sub, onClick, wide = false }) {
  return (
    <button
      onClick={onClick}
      className={`${wide
        ? 'col-span-2 flex items-center gap-3 px-4 text-left'
        : 'px-3 text-center'} py-3.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800/60 transition active:scale-[0.98]`}
    >
      <span className={`${wide ? '' : 'mx-auto mb-1.5'} text-neutral-400`}>
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-neutral-100">{title}</span>
        <span className="block text-xs text-neutral-500 mt-0.5">{sub}</span>
      </span>
    </button>
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
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
            value === key
              ? DIFFICULTY_ACTIVE[key]
              : 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
