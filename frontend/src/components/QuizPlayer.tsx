import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

interface QuestionData {
  id: string;
  type: 'TEXT' | 'IMAGE';
  selectionType: 'SINGLE' | 'MULTIPLE';
  text: string;
  imageUrl?: string;
  options: string[];
  correctAnswer: number[];
  timeLimit: number;
  points: number;
}

interface Props {
  sessionId: string;
  participantId: string;
  onQuizEnd: () => void;
}

export function QuizPlayer({ sessionId, participantId, onQuizEnd }: Props) {
  const socket = useSocket();
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isQuizActive, setIsQuizActive] = useState(true);
  const [correctAnswer, setCorrectAnswer] = useState<number[] | null>(null);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket) {
      console.warn('Socket not connected');
      return;
    }

    console.log('QuizPlayer mounted, setting up socket listeners');

    const handleQuestion = (data: any) => {
      console.log('📝 Received question:', data);
      
      const q = data.question;
      // Парсим options если они в виде строки
      let options = q.options;
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch (e) {
          console.error('Failed to parse options:', e);
          options = [];
        }
      }

      // Парсим correctAnswer если нужно
      let correctAnswer = q.correctAnswer;
      if (typeof correctAnswer === 'string') {
        try {
          correctAnswer = JSON.parse(correctAnswer);
        } catch (e) {
          console.error('Failed to parse correctAnswer:', e);
          correctAnswer = [];
        }
      }

      setCurrentQuestion({
        ...q,
        options: Array.isArray(options) ? options : [],
        correctAnswer: Array.isArray(correctAnswer) ? correctAnswer : [],
      });
      setQuestionIndex(data.questionIndex || 0);
      setTotalQuestions(data.totalQuestions || 0);
      setSelectedOptions([]);
      setIsAnswered(false);
      setIsCorrect(null);
      setPointsEarned(0);
      setCorrectAnswer(null);
      setShowTimeoutMessage(false);
      setTimeLeft(data.timeLimit || 30);
      startTimeRef.current = Date.now();

      // Очищаем старый таймер
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Запускаем новый таймер
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            // Если не ответили - автоматически отправляем пустой ответ
            if (!isAnswered) {
              handleAutoSubmit();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const handleQuestionTimeout = (data: any) => {
      console.log('⏰ Question timeout:', data);
      setShowTimeoutMessage(true);
      if (data.correctAnswer) {
        setCorrectAnswer(data.correctAnswer);
      }
      if (!isAnswered) {
        setIsAnswered(true);
        setIsCorrect(false);
        setPointsEarned(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    const handleAnswerSubmitted = (data: any) => {
      console.log('✅ Answer submitted response:', data);
      setIsAnswered(true);
      setIsCorrect(data.isCorrect);
      setPointsEarned(data.pointsEarned || 0);
      if (data.correctAnswer && !data.isCorrect) {
        setCorrectAnswer(data.correctAnswer);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleLeaderboard = (data: any) => {
      console.log('🏆 Leaderboard update:', data);
      setLeaderboard(data.leaderboard || []);
    };

    const handleQuizEnded = (data: any) => {
      console.log('🏁 Quiz ended:', data);
      setIsQuizActive(false);
      setShowLeaderboard(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleError = (data: any) => {
      console.error('❌ Socket error:', data);
      alert(data.message || 'An error occurred');
    };

    // Регистрируем обработчики
    socket.on('question', handleQuestion);
    socket.on('question-timeout', handleQuestionTimeout);
    socket.on('answer-submitted', handleAnswerSubmitted);
    socket.on('leaderboard', handleLeaderboard);
    socket.on('quiz-ended', handleQuizEnded);
    socket.on('error', handleError);

    return () => {
      console.log('QuizPlayer unmounting, cleaning up listeners');
      socket.off('question', handleQuestion);
      socket.off('question-timeout', handleQuestionTimeout);
      socket.off('answer-submitted', handleAnswerSubmitted);
      socket.off('leaderboard', handleLeaderboard);
      socket.off('quiz-ended', handleQuizEnded);
      socket.off('error', handleError);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [socket, isAnswered]);

  // Функция для автоматической отправки ответа при таймауте
  const handleAutoSubmit = () => {
    if (isAnswered || !currentQuestion) return;

    console.log('⏰ Auto-submitting empty answer due to timeout');
    const timeMs = Date.now() - startTimeRef.current;
    
    socket?.emit('submit-answer', {
      sessionId,
      questionId: currentQuestion.id,
      selectedOptions: [],
      timeMs,
    });
  };

  // Обработка выбора опции
  const handleSelectOption = (optionIndex: number) => {
    if (isAnswered || !currentQuestion) return;

    const isMultiple = currentQuestion.selectionType === 'MULTIPLE';
    
    if (isMultiple) {
      setSelectedOptions((prev) => {
        if (prev.includes(optionIndex)) {
          return prev.filter((i) => i !== optionIndex);
        }
        return [...prev, optionIndex];
      });
    } else {
      setSelectedOptions([optionIndex]);
    }
  };

  // Отправка ответа
  const handleSubmit = () => {
    if (isAnswered || !currentQuestion || selectedOptions.length === 0) return;

    const timeMs = Date.now() - startTimeRef.current;
    
    console.log('📤 Submitting answer:', {
      sessionId,
      questionId: currentQuestion.id,
      selectedOptions,
      timeMs,
    });

    socket?.emit('submit-answer', {
      sessionId,
      questionId: currentQuestion.id,
      selectedOptions,
      timeMs,
    });

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Отображение финального лидерборда
  if (showLeaderboard) {
    return (
      <div className="card max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6">🏆 Final Leaderboard</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {leaderboard.length === 0 ? (
            <p className="text-center text-gray-500">No participants</p>
          ) : (
            leaderboard.map((p, index) => (
              <div 
                key={p.id} 
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  p.id === participantId 
                    ? 'bg-indigo-50 border-2 border-indigo-300' 
                    : 'bg-gray-50'
                }`}
              >
                <span className="text-2xl font-bold text-indigo-600 w-8 text-center">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </span>
                <span className="flex-1 font-medium">
                  {p.name}
                  {p.id === participantId && (
                    <span className="ml-2 text-xs text-indigo-600 font-semibold">(You)</span>
                  )}
                </span>
                <span className="font-bold text-indigo-600">{p.score} pts</span>
              </div>
            ))
          )}
        </div>
        <button 
          onClick={onQuizEnd} 
          className="btn-primary w-full mt-4"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Ожидание начала квиза
  if (!currentQuestion || !isQuizActive) {
    return (
      <div className="card max-w-2xl mx-auto text-center">
        <div className="py-12">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl text-gray-600">Waiting for the quiz to start...</p>
          <p className="text-sm text-gray-400 mt-2">The host will start the quiz shortly</p>
        </div>
      </div>
    );
  }

  // Основной интерфейс вопроса
  return (
    <div className="card max-w-2xl mx-auto">
      {/* Header с прогрессом и таймером */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Question {questionIndex + 1} / {totalQuestions}
          </span>
          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${((questionIndex) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">⏱</span>
          <span className={`font-mono font-bold text-lg ${
            timeLeft < 5 ? 'text-red-500 animate-pulse' : 'text-gray-700'
          }`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Вопрос */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">{currentQuestion.text}</h2>
        {currentQuestion.imageUrl && (
          <div className="mt-3 mb-3">
            <img 
              src={currentQuestion.imageUrl} 
              alt="Question" 
              className="max-h-64 rounded-lg object-cover mx-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-2">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {currentQuestion.selectionType === 'SINGLE' ? 'Single choice' : 'Multiple choice'}
          </span>
          <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">
            {currentQuestion.points} pts
          </span>
        </div>
      </div>

      {/* Таймаут сообщение */}
      {showTimeoutMessage && !isAnswered && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 rounded-lg mb-4 text-center">
          ⏰ Time is up!
        </div>
      )}

      {/* Опции */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, index) => {
          const isSelected = selectedOptions.includes(index);
          
          let optionClass = 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50';
          let icon = null;
          
          if (isAnswered) {
            const isCorrectAnswer = currentQuestion.correctAnswer.includes(index);
            const isSelectedWrong = isSelected && !currentQuestion.correctAnswer.includes(index);
            
            if (isCorrectAnswer) {
              optionClass = 'border-green-500 bg-green-50';
              icon = <span className="ml-2 text-green-600">✓</span>;
            } else if (isSelectedWrong) {
              optionClass = 'border-red-500 bg-red-50';
              icon = <span className="ml-2 text-red-600">✗</span>;
            } else {
              optionClass = 'border-gray-200 bg-gray-50 opacity-60';
            }
          } else if (isSelected) {
            optionClass = 'border-indigo-500 bg-indigo-50';
          }

          return (
            <button
              key={index}
              onClick={() => handleSelectOption(index)}
              disabled={isAnswered}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                isAnswered ? 'cursor-default' : 'cursor-pointer'
              } ${optionClass}`}
            >
              <span className="font-medium text-gray-700">
                {String.fromCharCode(65 + index)}.
              </span>
              <span className="ml-2">{option}</span>
              {icon}
            </button>
          );
        })}
      </div>

      {/* Результат или кнопка отправки */}
      {!isAnswered ? (
        <button
          onClick={handleSubmit}
          disabled={selectedOptions.length === 0 || timeLeft === 0}
          className={`btn-primary w-full transition-all ${
            selectedOptions.length === 0 || timeLeft === 0 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:scale-[1.02]'
          }`}
        >
          {selectedOptions.length === 0 
            ? 'Select an option to submit' 
            : timeLeft === 0 
            ? 'Time is up!' 
            : `🚀 Submit Answer (${selectedOptions.length} selected)`}
        </button>
      ) : (
        <div className="text-center p-4 rounded-lg border-2 border-gray-200">
          {isCorrect ? (
            <div>
              <p className="text-green-600 font-bold text-lg">✅ Correct!</p>
              <p className="text-indigo-600 font-semibold">+{pointsEarned} points</p>
            </div>
          ) : (
            <div>
              <p className="text-red-600 font-bold text-lg">❌ Incorrect</p>
              {correctAnswer && correctAnswer.length > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  Correct answer: {correctAnswer.map(i => 
                    String.fromCharCode(65 + i)
                  ).join(', ')}
                </p>
              )}
              <p className="text-gray-500 text-sm">+0 points</p>
            </div>
          )}
          {questionIndex < totalQuestions - 1 && (
            <p className="text-sm text-gray-400 mt-2">Waiting for next question...</p>
          )}
        </div>
      )}

      {/* Индикатор статуса соединения */}
      {!socket?.connected && (
        <div className="mt-3 text-center text-sm text-red-500">
          ⚠️ Disconnected from server. Reconnecting...
        </div>
      )}
    </div>
  );
}