// 统一 API 客户端
const API_BASE = '/api';

async function apiCall(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'same-origin'
  });

  const data = await res.json().catch(() => ({ error: 'Network error' }));

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    // 保留状态码与响应体：调用方需要区分 429（配额耗尽）等业务错误
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  auth: {
    register: (nickname, password) =>
      apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ nickname, password })
      }),
    login: (nickname, password) =>
      apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ nickname, password })
      }),
    logout: () =>
      apiCall('/auth/logout', { method: 'POST' }),
    me: () => apiCall('/auth/me')
  },
  wsTicket: (params) => {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString()
      : '';
    return apiCall(`/ws-ticket${qs}`);
  },
  stats: {
    get: () => apiCall('/stats'),
    submit: (data) =>
      apiCall('/stats', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },
  leaderboard: {
    get: (difficulty) => apiCall(`/leaderboard/${difficulty}`)
  },
  // Jev 概率提示：status 只查今日剩余次数，claim 消耗一次并返回概率分布
  hint: {
    status: () => apiCall('/hint'),
    claim: (payload) =>
      apiCall('/hint', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
  }
};
