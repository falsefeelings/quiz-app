import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Auth } from './components/Auth';
import { CreateQuiz } from './components/CreateQuiz';
import { QuizHost } from './components/QuizHost';
import { QuizPlayer } from './components/QuizPlayer';
import { Profile } from './components/Profile';
import { useSocket } from './hooks/useSocket';

function Navigation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="container-custom py-3 flex justify-between items-center">
        <button
          onClick={() => navigate('/')}
          className="text-2xl font-bold text-indigo-600 hover:text-indigo-700 transition"
        >
          QuizApp
        </button>

        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">{user.name}</span>
            <button
              onClick={() => navigate('/profile')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Profile
            </button>
            {user.role === 'ORGANIZER' && (
              <button
                onClick={() => navigate('/host')}
                className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100"
              >
                Host
              </button>
            )}
            <button
              onClick={logout}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const [roomCode, setRoomCode] = React.useState('');
  const [playerName, setPlayerName] = React.useState('');
  const [isJoining, setIsJoining] = React.useState(false);
  const [sessionId, setSessionId] = React.useState('');
  const [participantId, setParticipantId] = React.useState('');
  const [isPlaying, setIsPlaying] = React.useState(false);

  React.useEffect(() => {
    if (!socket) return;
    socket.on('joined', (data) => {
      setSessionId(data.session.id);
      setParticipantId(data.participantId);
      setIsJoining(false);
      setIsPlaying(true);
    });
    socket.on('error', (data) => {
      alert(data.message);
      setIsJoining(false);
    });
    return () => {
      socket.off('joined');
      socket.off('error');
    };
  }, [socket]);

  const handleJoin = () => {
    if (!roomCode.trim() || !playerName.trim()) {
      alert('Fill all fields');
      return;
    }
    setIsJoining(true);
    socket?.emit('join-room', {
      code: roomCode.trim().toUpperCase(),
      name: playerName.trim(),
      userId: user?.id,
    });
  };

  if (isPlaying && sessionId && participantId) {
    return (
      <QuizPlayer
        sessionId={sessionId}
        participantId={participantId}
        onQuizEnd={() => {
          setIsPlaying(false);
          setSessionId('');
          setParticipantId('');
        }}
      />
    );
  }

  return (
    <div className="container-custom py-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
          Welcome to QuizApp
        </h1>
        <p className="text-gray-500 text-center mb-8">
          Play, create, and host quizzes in real time
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Join a Room</h2>
            <input
              type="text"
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="input-field mb-3"
              maxLength={6}
            />
            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="input-field mb-4"
            />
            <button
              onClick={handleJoin}
              disabled={isJoining || !roomCode || !playerName}
              className="btn-primary w-full disabled:opacity-50"
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Quick Actions</h2>
            {user?.role === 'ORGANIZER' ? (
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/host')}
                  className="btn-primary w-full"
                >
                  🎮 Host a Quiz
                </button>
                <button
                  onClick={() => navigate('/create')}
                  className="btn-secondary w-full"
                >
                  ✏️ Create Quiz
                </button>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                You are a participant. Ask the host for a room code.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navigation />
      <main className="flex-1">
        <Routes>
          <Route path="/auth" element={!isAuthenticated ? <Auth /> : <Navigate to="/" />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreateQuiz /></ProtectedRoute>} />
          <Route path="/host" element={<ProtectedRoute><QuizHost /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
