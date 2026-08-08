// 本地存储：用户数据与统计

const STORAGE_KEY = 'mw-user';
const STATS_KEY = 'mw-stats';
const THEME_KEY = 'mw-theme';

export function getUserId() {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function getNickname() {
  return localStorage.getItem('mw-nickname') || '';
}

export function setNickname(name) {
  localStorage.setItem('mw-nickname', name);
}

export function getStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function recordGame(difficulty, mode, result, steps, timeSeconds) {
  const stats = getStats();
  const key = difficulty;
  if (!stats[key]) {
    stats[key] = {
      total: 0,
      wins: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestSteps: null,
      totalTime: 0,
      totalSteps: 0
    };
  }
  const s = stats[key];
  s.total++;
  s.totalTime += timeSeconds;
  s.totalSteps += steps;

  if (result === 'win') {
    s.wins++;
    s.currentStreak++;
    s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
    if (s.bestSteps === null || steps < s.bestSteps) {
      s.bestSteps = steps;
    }
  } else {
    s.currentStreak = 0;
  }

  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return stats;
}

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
