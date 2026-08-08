import React from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import MainMenu from './components/MainMenu.jsx';
import GameScreen from './components/GameScreen.jsx';
import StatsScreen from './components/StatsScreen.jsx';
import LeaderboardScreen from './components/LeaderboardScreen.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { getStats } from './lib/storage.js';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <ThemeToggle />
        <Routes>
          <Route path="/" element={<MenuWrapper />} />
          <Route path="/game/:difficulty/:mode" element={<GameWrapper />} />
          <Route path="/stats" element={<StatsWrapper />} />
          <Route path="/leaderboard" element={<LeaderboardWrapper />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

function MenuWrapper() {
  const navigate = useNavigate();
  const stats = getStats();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MainMenu
        stats={stats}
        onStart={(difficulty, mode) => navigate(`/game/${difficulty}/${mode}`)}
        onShowStats={() => navigate('/stats')}
        onShowLeaderboard={() => navigate('/leaderboard')}
      />
    </div>
  );
}

function GameWrapper() {
  const navigate = useNavigate();
  const { difficulty = 'beginner', mode = 'solo' } = useParams();
  return (
    <GameScreen
      difficulty={difficulty}
      mode={mode}
      onExit={() => navigate('/')}
    />
  );
}

function StatsWrapper() {
  const navigate = useNavigate();
  return <StatsScreen onBack={() => navigate('/')} />;
}

function LeaderboardWrapper() {
  const navigate = useNavigate();
  return <LeaderboardScreen onBack={() => navigate('/')} />;
}
