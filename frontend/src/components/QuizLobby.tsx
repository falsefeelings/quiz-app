import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

interface Props {
  sessionId: string;
  code: string;
  isHost: boolean;
  onStart: () => void;
  onEnd: () => void;
}

export function QuizLobby({ sessionId, code, isHost, onStart, onEnd }: Props) {
  const socket = useSocket();
  const [participants, setParticipants] = useState<any[]>([]);
  const [status, setStatus] = useState<'WAITING' | 'ACTIVE' | 'FINISHED'>('WAITING');

  useEffect(() => {
    if (!socket) return;

    const handleParticipantsUpdate = (data: any) => {
      setParticipants(data.participants || []);
    };

    const handleQuizStarted = (data: any) => {
      setStatus('ACTIVE');
      onStart();
    };

    const handleQuizEnded = (data: any) => {
      setStatus('FINISHED');
      onEnd();
    };

    socket.on('participants-update', handleParticipantsUpdate);
    socket.on('quiz-started', handleQuizStarted);
    socket.on('quiz-ended', handleQuizEnded);

    return () => {
      socket.off('participants-update', handleParticipantsUpdate);
      socket.off('quiz-started', handleQuizStarted);
      socket.off('quiz-ended', handleQuizEnded);
    };
  }, [socket, onStart, onEnd]);

  const handleStartQuiz = () => {
    if (socket && status === 'WAITING') {
      socket.emit('start-quiz', { sessionId });
    }
  };

  const handleEndQuiz = () => {
    if (socket && status === 'ACTIVE') {
      socket.emit('end-quiz', { sessionId });
    }
  };

  return (
    <div className="card max-w-2xl mx-auto text-center">
      <div className="mb-6">
        <h1 className="text-4xl font-extrabold gradient-text">🎯 Quiz Lobby</h1>
        <div className="mt-2 p-4 bg-indigo-50 rounded-xl inline-block">
          <p className="text-sm text-gray-600">Room Code</p>
          <p className="text-3xl font-mono font-bold tracking-widest text-indigo-700">{code}</p>
        </div>
        <p className="text-sm text-gray-500 mt-2">Share this code with participants</p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-gray-700">Participants ({participants.length})</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === 'WAITING' ? 'bg-yellow-100 text-yellow-700' :
            status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {status === 'WAITING' ? '⏳ Waiting' : status === 'ACTIVE' ? '▶️ Active' : '✅ Finished'}
          </span>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {participants.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No participants yet... 😴</p>
          ) : (
            participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl hover:shadow-md transition-shadow">
                <span className="text-2xl">👤</span>
                <span className="font-medium">{p.name}</span>
                <span className="ml-auto text-sm text-gray-500 font-medium">Score: {p.score}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {isHost && status === 'WAITING' && (
        <button 
          onClick={handleStartQuiz} 
          className={`btn-primary w-full text-lg py-3 ${participants.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={participants.length === 0}
        >
          🚀 Start Quiz {participants.length === 0 && '(No participants)'}
        </button>
      )}

      {isHost && status === 'ACTIVE' && (
        <button onClick={handleEndQuiz} className="btn-danger w-full">
          ⏹ End Quiz
        </button>
      )}

      {status === 'FINISHED' && (
        <div className="space-y-4">
          <p className="text-3xl font-bold text-green-600">🎉 Quiz Finished!</p>
          <button onClick={onEnd} className="btn-secondary w-full">
            Back to Home
          </button>
        </div>
      )}

      {!isHost && status === 'WAITING' && (
        <div className="text-center text-gray-500">
          <p className="text-4xl mb-2">⏳</p>
          <p>Waiting for host to start the quiz...</p>
        </div>
      )}
    </div>
  );
}