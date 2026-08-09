import React, { useState, useEffect, useRef } from 'react';
import { DIFFICULTY_LABELS, DIFFICULTY_ACTIVE } from '../lib/constants.js';
import { useAuth } from '../hooks/useAuth.jsx';
import Icon from './Icons.jsx';

// 主菜单：一屏排版，登录/注册在右上角（弹窗表单）
export default function MainMenu({ onStart, onRoomStart, onShowStats, onShowLeaderboard }) {
  const { user, loading, login, register, logout } = useAuth();
  const [authMode, setAuthMode] = useState(null);
  const [formName, setFormName] = useState('');
  const [formPass, setFormPass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const mainRef = useRef(null);
  const [fits, setFits] = useState(true); // 主内容能否一页放下

  // 一页放下则禁用滚动，否则主区内部滚动
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const measure = () => setFits(el.scrollHeight <= el.clientHeight + 1);
    measure();
    const id = setTimeout(measure, 120); // 字体就绪后复测
    let cancelled = false;
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => { if (!cancelled) measure(); });
    }
    window.addEventListener('resize', measure);
    return () => {
      cancelled = true;
      clearTimeout(id);
      window.removeEventListener('resize', measure);
    };
  }, [user]);

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

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthError('');
    setFormName('');
    setFormPass('');
  };

  const switchAuth = (mode) => {
    setAuthMode(mode);
    setAuthError('');
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
    <div className="h-dvh flex flex-col overflow-hidden bg-neutral-950">
      {/* 顶栏：右上角登录/注册 */}
      <header className="w-full max-w-md mx-auto px-4 pt-4 flex items-center justify-end">
        {loading ? (
          <span className="text-sm text-neutral-400 animate-pulse">加载中</span>
        ) : user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-200">{user.nickname}</span>
            <button onClick={logout} className="text-xs text-neutral-400 hover:text-neutral-200 transition">退出</button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => openAuth('login')}
              className="px-3 py-1.5 rounded-lg text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition"
            >
              登录
            </button>
            <button
              onClick={() => openAuth('register')}
              className="px-3 py-1.5 rounded-lg text-sm bg-neutral-100 text-neutral-950 font-semibold hover:bg-neutral-200 transition"
            >
              注册
            </button>
          </div>
        )}
      </header>

      {/* 主内容：能一页放下则不滚动 */}
      <main ref={mainRef} className={`w-full max-w-md mx-auto px-4 flex-1 min-h-0 ${fits ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <div className={`flex flex-col py-4 ${fits ? 'h-full justify-center' : ''}`}>
          {/* 标题：大字居中，M/W 保留强调色 */}
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-100 text-center mb-6">
            <span className="text-green-400">M</span>ath
            <span className="text-yellow-400">W</span>ordle
          </h1>
          <div className="space-y-6">
            {/* 模式选择 */}
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold tracking-widest text-neutral-400 text-center">选择模式</h2>
              <DifficultyPicker value={gameDiff} onChange={setGameDiff} />
              <div className="grid grid-cols-2 gap-3">
                <ModeCard icon="target" title="单人挑战" sub="选难度开始" onClick={() => onStart(gameDiff, 'solo')} />
                <ModeCard icon="cpu" title="人机对战" sub="挑战 AI" onClick={() => onStart(gameDiff, 'bot')} />
                <ModeCard icon="chart" title="统计数据" sub="查看记录" onClick={onShowStats} />
                <ModeCard icon="trophy" title="排行榜" sub="高手榜" onClick={onShowLeaderboard} />
              </div>
            </section>

            {/* 联机对战 */}
            <section className="space-y-2.5">
              <h2 className="text-xs font-semibold tracking-widest text-neutral-400 text-center">联机对战</h2>
              <DifficultyPicker value={onlineDiff} onChange={setOnlineDiff} />
              <div className="grid grid-cols-2 gap-3">
                <ModeCard icon="shield" title="1v1 对抗" sub="随机匹配" onClick={() => startOnline('pvp')} />
                <ModeCard icon="users" title="合作模式" sub="随机匹配" onClick={() => startOnline('coop')} />
                <ModeCard icon="home" title="创建房间" sub="生成房号邀请好友" onClick={() => onRoomStart(onlineDiff, 'create')} />
                {/* 加入房间 */}
                <div className="px-3 py-3 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-600 transition flex flex-col justify-center">
                  <div className="text-sm font-semibold text-neutral-100 text-center mb-2">加入房间</div>
                  <div className="flex gap-1.5">
                    <input
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                      placeholder="房号"
                      maxLength={6}
                      className="min-w-0 flex-1 px-2 py-2 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-400 text-center font-mono tracking-widest uppercase text-sm focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      onClick={handleJoinRoom}
                      disabled={!roomCode.trim()}
                      className="px-3 py-2 rounded-lg bg-neutral-100 text-neutral-950 text-sm font-semibold hover:bg-neutral-200 transition disabled:opacity-40"
                    >
                      加入
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-md mx-auto px-4 pb-4 text-center text-xs text-neutral-400">
        Original by{' '}
        <a
          href="https://yuer6327.top"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-400 hover:text-neutral-100 hover:underline"
        >
          Yuer6327
        </a>
      </footer>

      {/* 登录 / 注册弹窗 */}
      {authMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAuthMode(null)}>
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-100">{authMode === 'login' ? '登录' : '注册'}</h2>
              <button onClick={() => setAuthMode(null)} className="text-neutral-400 hover:text-neutral-200 transition">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="昵称"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
            />
            <input
              type="password"
              placeholder="密码"
              value={formPass}
              onChange={e => setFormPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
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
              <button onClick={() => switchAuth('register')} className="text-sm text-neutral-400 hover:text-neutral-200 underline">
                没有账号？去注册
              </button>
            ) : (
              <button onClick={() => switchAuth('login')} className="text-sm text-neutral-400 hover:text-neutral-200 underline">
                已有账号？去登录
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 模式卡片（线性图标 + 标题 + 副标题）
function ModeCard({ icon, title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-3.5 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800/60 transition active:scale-[0.98] text-center"
    >
      <span className="mx-auto mb-1.5 flex justify-center text-neutral-400">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <span className="block text-sm font-semibold text-neutral-100">{title}</span>
      <span className="block text-xs text-neutral-400 mt-0.5">{sub}</span>
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
              : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-neutral-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
