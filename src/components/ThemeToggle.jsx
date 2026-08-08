import React from 'react';
import { getTheme, toggleTheme } from '../lib/storage.js';

export default function ThemeToggle() {
  const [theme, setTheme] = React.useState(getTheme());

  const handleToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  return (
    <button
      onClick={handleToggle}
      className="fixed top-3 right-3 z-40 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-md hover:scale-110 transition-transform"
      aria-label="切换主题"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
