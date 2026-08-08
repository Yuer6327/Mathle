import React from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import MainMenu from './components/MainMenu.jsx';
import GameScreen from './components/GameScreen.jsx';
import RoomScreen from './components/RoomScreen.jsx';
import StatsScreen from './components/StatsScreen.jsx';
import LeaderboardScreen from './components/LeaderboardScreen.jsx';
import { getStats } from './lib/storage.js';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MenuWrapper />} />
          <Route path="/game/:difficulty/:mode" element={<GameWrapper />} />
          <Route path="/room/:difficulty" element={<RoomWrapper />} />
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
        onRoomStart={(difficulty, createOrCode) =>
          navigate(
            createOrCode === 'create'
              ? `/room/${difficulty}?create=1`
              : `/room/${difficulty}?code=${encodeURIComponent(createOrCode)}`
          )
        }
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

function RoomWrapper() {
  const navigate = useNavigate();
  const { difficulty = 'medium' } = useParams();
  const [searchParams] = useSearchParams();
  const create = searchParams.get('create') === '1';
  const code = searchParams.get('code') || '';
  return (
    <RoomScreen
      difficulty={difficulty}
      create={create}
      code={code}
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
