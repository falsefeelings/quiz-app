import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { QuizLobby } from './QuizLobby';

const API_URL = 'http://localhost:5000';

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: any[];
}

export function QuizHost() {
  const { token, user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isHosting, setIsHosting] = useState(false);
  const [hostName, setHostName] = useState('');

  useEffect(() => {
    fetchQuizzes();
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    const handleJoined = (data: any) => {
      console.log('Host joined session:', data);
      setSessionId(data.session.id);
      setRoomCode(data.session.code);
      setIsHosting(true);
    };

    const handleError = (data: any) => {
      console.error('Socket error:', data);
      alert(data.message || 'Something went wrong');
    };

    socket.on('joined', handleJoined);
    socket.on('error', handleError);

    return () => {
      socket.off('joined', handleJoined);
      socket.off('error', handleError);
    };
  }, [socket]);

  const fetchQuizzes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/quizzes`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setQuizzes(data);
      }
    } catch (error) {
      console.error('Failed to fetch quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHostQuiz = async () => {
    if (!selectedQuizId || !socket) return;

    try {
      const response = await fetch(`${API_URL}/api/quizzes/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quizId: selectedQuizId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create session');
      }

      const data = await response.json();
      
      const name = user?.name || 'Host';
      setHostName(name);
      
      socket.emit('join-room', {
        code: data.code,
        name: name,
        userId: user?.id,
      });

    } catch (error: any) {
      console.error('Failed to host quiz:', error);
      alert(error.message || 'Failed to create session');
    }
  };

  const handleQuizEnd = () => {
    setIsHosting(false);
    setRoomCode('');
    setSessionId('');
  };

  if (isHosting && roomCode && sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
        <QuizLobby
          sessionId={sessionId}
          code={roomCode}
          isHost={true}
          onStart={() => {}}
          onEnd={handleQuizEnd}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="card animate-slide-up">
        <h1 className="text-3xl font-extrabold gradient-text mb-2">🎮 Host a Quiz</h1>
        <p className="text-gray-500 text-sm mb-6">Select a quiz and start hosting — share the room code with players</p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-6xl mb-4">📝</p>
            <p className="text-gray-600 text-lg">You haven't created any quizzes yet.</p>
            <button onClick={() => navigate('/create')} className="btn-primary mt-4">
              Create Quiz
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Quiz</label>
              <select
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="input-field"
              >
                <option value="">Choose a quiz...</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.questions?.length || 0} questions)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleHostQuiz}
              disabled={!selectedQuizId || !socket?.connected}
              className={`btn-primary w-full flex items-center justify-center gap-2 ${
                !selectedQuizId || !socket?.connected ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {!socket?.connected ? (
                <>
                  <span className="animate-pulse">●</span> Connecting...
                </>
              ) : (
                '🚀 Host Quiz'
              )}
            </button>

            <div className="mt-4">
              <button onClick={() => navigate('/create')} className="btn-secondary w-full flex items-center justify-center gap-2">
                📝 Create New Quiz
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}