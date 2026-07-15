import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// In-memory session state
const activeSessions = new Map<string, {
  sessionId: string;
  quizId: string;
  currentQuestionIndex: number;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  participants: Map<string, { id: string; name: string; score: number; socketId: string }>;
  questionStartTime?: number;
  answers: Map<string, { questionId: string; selectedOptions: string[]; timeMs: number }>;
  questionTimer?: NodeJS.Timeout;
}>();

export function setupSocketHandlers(io: Server, prisma: PrismaClient) {
  io.on('connection', (socket: Socket) => {
    console.log(`🟢 User connected: ${socket.id}`);

    // Join a quiz room
    socket.on('join-room', async (data: { code: string; name: string; userId?: string }) => {
      const { code, name, userId } = data;
      
      try {
        const session = await prisma.gameSession.findUnique({
          where: { code },
          include: { quiz: { include: { questions: true } } },
        });

        if (!session) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (session.status === 'FINISHED') {
          socket.emit('error', { message: 'Quiz already finished' });
          return;
        }

        // Join socket room
        socket.join(`session-${session.id}`);
        
        // Create or get participant
        let participant = await prisma.participant.findFirst({
          where: {
            sessionId: session.id,
            OR: userId ? [{ userId }] : [{ guestName: name }],
          },
        });

        if (!participant) {
          participant = await prisma.participant.create({
            data: {
              sessionId: session.id,
              userId: userId || null,
              guestName: userId ? undefined : name,
            },
          });
        }

        // Update in-memory state
        if (!activeSessions.has(session.id)) {
          const sessionState = {
            sessionId: session.id,
            quizId: session.quizId,
            currentQuestionIndex: session.currentQuestionIndex,
            status: session.status as 'WAITING' | 'ACTIVE' | 'FINISHED',
            participants: new Map(),
            answers: new Map(),
          };
          activeSessions.set(session.id, sessionState);
        }

        const sessionState = activeSessions.get(session.id)!;
        sessionState.participants.set(participant.id, {
          id: participant.id,
          name: name,
          score: participant.score,
          socketId: socket.id,
        });

        // Store participant data on socket
        socket.data.participantId = participant.id;
        socket.data.sessionId = session.id;

        // Send current state to participant
        socket.emit('joined', {
          participantId: participant.id,
          session: {
            id: session.id,
            code: session.code,
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
          },
        });

        // Update participant list for host
        io.to(`session-${session.id}`).emit('participants-update', {
          participants: Array.from(sessionState.participants.values()),
        });

        // If quiz is active, send current question
        if (session.status === 'ACTIVE') {
          const questions = session.quiz.questions;
          const question = questions[session.currentQuestionIndex];
          if (question) {
            socket.emit('question', {
              question: {
                ...question,
                options: JSON.parse(question.options),
              },
              questionIndex: session.currentQuestionIndex,
              totalQuestions: questions.length,
              timeLimit: question.timeLimit,
              startTime: sessionState.questionStartTime,
            });
          }
        }

        console.log(`📥 ${name} joined room ${code}`);
      } catch (error) {
        console.error(error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Start quiz
    socket.on('start-quiz', async (data: { sessionId: string }) => {
      const { sessionId } = data;
      const sessionState = activeSessions.get(sessionId);
      
      if (!sessionState) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      try {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: 'ACTIVE', startedAt: new Date() },
        });

        sessionState.status = 'ACTIVE';
        
        const session = await prisma.gameSession.findUnique({
          where: { id: sessionId },
          include: { quiz: { include: { questions: true } } },
        });

        if (!session) return;

        io.to(`session-${sessionId}`).emit('quiz-started', {
          totalQuestions: session.quiz.questions.length,
        });

        // Send first question
        sendQuestion(io, prisma, sessionId);
      } catch (error) {
        console.error(error);
        socket.emit('error', { message: 'Failed to start quiz' });
      }
    });

    // Submit answer
    socket.on('submit-answer', async (data: {
      sessionId: string;
      questionId: string;
      selectedOptions: string[];
      timeMs: number;
    }) => {
      const { sessionId, questionId, selectedOptions, timeMs } = data;
      const sessionState = activeSessions.get(sessionId);
      const participantId = socket.data.participantId;

      if (!sessionState || !participantId) return;

      // Check if already answered
      if (sessionState.answers.has(`${participantId}-${questionId}`)) {
        return;
      }

      try {
        const question = await prisma.question.findUnique({
          where: { id: questionId },
        });

        if (!question) return;

        const correctAnswer = JSON.parse(question.correctAnswer);
        const isCorrect = JSON.stringify(selectedOptions) === JSON.stringify(correctAnswer);
        const pointsEarned = isCorrect ? question.points : 0;

        // Save answer
        await prisma.answer.create({
          data: {
            participantId,
            questionId,
            selectedOptions: JSON.stringify(selectedOptions),
            isCorrect,
            pointsEarned,
            timeMs,
          },
        });

        // Update participant score
        await prisma.participant.update({
          where: { id: participantId },
          data: { score: { increment: pointsEarned } },
        });

        // Update in-memory
        sessionState.answers.set(`${participantId}-${questionId}`, {
          questionId,
          selectedOptions,
          timeMs,
        });

        const participant = sessionState.participants.get(participantId);
        if (participant) {
          participant.score += pointsEarned;
        }

        // Update leaderboard
        updateLeaderboard(io, sessionId);

        socket.emit('answer-submitted', {
          isCorrect,
          pointsEarned,
          correctAnswer: isCorrect ? undefined : correctAnswer,
        });
      } catch (error) {
        console.error(error);
        socket.emit('error', { message: 'Failed to submit answer' });
      }
    });

    // Next question
    socket.on('next-question', async (data: { sessionId: string }) => {
      const { sessionId } = data;
      sendQuestion(io, prisma, sessionId);
    });

    // End quiz
    socket.on('end-quiz', async (data: { sessionId: string }) => {
      const { sessionId } = data;
      const sessionState = activeSessions.get(sessionId);

      if (sessionState) {
        if (sessionState.questionTimer) {
          clearTimeout(sessionState.questionTimer);
        }
        sessionState.status = 'FINISHED';
      }

      try {
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: 'FINISHED', finishedAt: new Date() },
        });

        // Final leaderboard
        await updateLeaderboard(io, sessionId);
        
        io.to(`session-${sessionId}`).emit('quiz-ended', {
          message: 'Quiz has ended!',
        });
      } catch (error) {
        console.error(error);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      const participantId = socket.data.participantId;
      const sessionId = socket.data.sessionId;

      if (participantId && sessionId) {
        const sessionState = activeSessions.get(sessionId);
        if (sessionState) {
          sessionState.participants.delete(participantId);
          io.to(`session-${sessionId}`).emit('participants-update', {
            participants: Array.from(sessionState.participants.values()),
          });
        }
      }

      console.log(`🔴 User disconnected: ${socket.id}`);
    });
  });
}

async function sendQuestion(io: Server, prisma: PrismaClient, sessionId: string) {
  const sessionState = activeSessions.get(sessionId);
  if (!sessionState) return;

  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { quiz: { include: { questions: true } } },
    });

    if (!session || !session.quiz) return;

    const questions = session.quiz.questions;
    const currentIndex = sessionState.currentQuestionIndex;

    if (currentIndex >= questions.length) {
      io.to(`session-${sessionId}`).emit('quiz-ended', {
        message: 'All questions completed!',
      });
      return;
    }

    const question = questions[currentIndex];
    
    // Clear old timer
    if (sessionState.questionTimer) {
      clearTimeout(sessionState.questionTimer);
    }

    // Clear answers for this question
    sessionState.answers = new Map();
    sessionState.questionStartTime = Date.now();

    // Send question to all participants
    io.to(`session-${sessionId}`).emit('question', {
      question: {
        ...question,
        options: JSON.parse(question.options),
      },
      questionIndex: currentIndex,
      totalQuestions: questions.length,
      timeLimit: question.timeLimit,
      startTime: sessionState.questionStartTime,
    });

    // Set timer for question
    const timeLimitMs = question.timeLimit * 1000;
    sessionState.questionTimer = setTimeout(async () => {
      // Auto-advance to next question
      sessionState.currentQuestionIndex++;
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { currentQuestionIndex: sessionState.currentQuestionIndex },
      });

      // Show correct answers
      const questionData = await prisma.question.findUnique({
        where: { id: question.id },
      });
      if (questionData) {
        const correctAnswer = JSON.parse(questionData.correctAnswer);
        io.to(`session-${sessionId}`).emit('question-timeout', {
          correctAnswer,
        });
      }

      // Wait a bit then send next question
      setTimeout(() => {
        sendQuestion(io, prisma, sessionId);
      }, 3000);
    }, timeLimitMs);

  } catch (error) {
    console.error(error);
  }
}

async function updateLeaderboard(io: Server, sessionId: string) {
  const sessionState = activeSessions.get(sessionId);
  if (!sessionState) return;

  try {
    const participants = await prisma.participant.findMany({
      where: { sessionId },
      include: { user: true },
      orderBy: { score: 'desc' },
    });

    const leaderboard = participants.map(p => ({
      id: p.id,
      name: p.user?.name || p.guestName || 'Anonymous',
      score: p.score,
    }));

    io.to(`session-${sessionId}`).emit('leaderboard', {
      leaderboard,
    });
  } catch (error) {
    console.error(error);
  }
}