// Auth 状态管理 hook
// 登录/注册/退出统一跳转 auth.yuer6327.top（同根域共享会话），本站只保留会话读取
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api } from '../lib/api.js';

const AUTH_URL = 'https://auth.yuer6327.top';

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

  // 登录/注册都走统一认证的 OAuth 授权页：未登录会被平台引到登录/注册，完成后原路返回
  const login = useCallback(() => { window.location.href = '/api/auth/oauth-start'; }, []);
  const register = useCallback(() => { window.location.href = '/api/auth/oauth-start'; }, []);
  const logout = useCallback(() => {
    window.location.href = `${AUTH_URL}/logout?next=%2F`;
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
