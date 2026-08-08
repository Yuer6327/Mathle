// Auth 状态管理 hook
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (nickname, password) => {
    const data = await api.auth.login(nickname, password);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (nickname, password) => {
    const data = await api.auth.register(nickname, password);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      // 网络失败也照样清除本地登录态（HttpOnly cookie 仍在，刷新后可能回弹）
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
