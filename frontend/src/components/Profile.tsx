import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="card animate-slide-up">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center text-4xl text-white font-bold shadow-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold text-gray-800">{user.name}</h1>
            <p className="text-gray-500">{user.email}</p>
            <span className="inline-block mt-1 text-sm font-medium px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
              {user.role === 'ORGANIZER' ? '🎯 Organizer' : '👤 Participant'}
            </span>
          </div>
          <button onClick={logout} className="btn-danger w-full sm:w-auto">
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <div className="card animate-slide-up animation-delay-100">
          <h2 className="font-semibold text-gray-700 text-lg mb-3">📊 Statistics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl text-center">
              <p className="text-3xl font-extrabold gradient-text">{history.length}</p>
              <p className="text-sm text-gray-600">Quizzes Played</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl text-center">
              <p className="text-3xl font-extrabold gradient-text">0</p>
              <p className="text-sm text-gray-600">Average Score</p>
            </div>
          </div>
        </div>

        <div className="card animate-slide-up animation-delay-200">
          <h2 className="font-semibold text-gray-700 text-lg mb-3">📜 History</h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-2">🎯</p>
              <p className="text-gray-500">No quiz history yet.</p>
              <p className="text-sm text-gray-400">Join a quiz to get started!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((item, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-xl">
                  <p className="font-medium">{item.quizTitle}</p>
                  <p className="text-sm text-gray-500">Score: {item.score}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {user.role === 'ORGANIZER' && (
        <div className="mt-6">
          <button onClick={() => navigate('/create')} className="btn-primary w-full">
            📝 Create New Quiz
          </button>
        </div>
      )}
    </div>
  );
}