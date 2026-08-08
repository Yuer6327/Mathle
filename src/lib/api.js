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
    throw new Error(data.error || `HTTP ${res.status}`);
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
  }
};
