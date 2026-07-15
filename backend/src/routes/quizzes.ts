import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const router = express.Router();

const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all quizzes for user
router.get('/', authMiddleware, async (req: any, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { authorId: req.user.id },
      include: { questions: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quizzes);
  } catch (error) {
    console.error('Fetch quizzes error:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Create quiz
router.post('/', authMiddleware, async (req: any, res) => {
  try {
    const { title, description, questions } = req.body;
    
    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        authorId: req.user.id,
        questions: {
          create: questions.map((q: any, index: number) => ({
            type: q.type || 'TEXT',
            selectionType: q.selectionType || 'SINGLE',
            text: q.text,
            imageUrl: q.imageUrl || null,
            options: JSON.stringify(q.options),
            correctAnswer: JSON.stringify(q.correctAnswer),
            timeLimit: q.timeLimit || 30,
            points: q.points || 10,
            order: index,
          })),
        },
      },
      include: { questions: true },
    });
    
    res.json(quiz);
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// Get quiz by id
router.get('/:id', authMiddleware, async (req: any, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (error) {
    console.error('Fetch quiz error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// Create game session for quiz
router.post('/session', authMiddleware, async (req: any, res) => {
  try {
    const { quizId } = req.body;
    
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to host this quiz' });
    }

    if (quiz.questions.length === 0) {
      return res.status(400).json({ error: 'Quiz has no questions' });
    }

    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let code = generateCode();
    let exists = await prisma.gameSession.findUnique({ where: { code } });
    while (exists) {
      code = generateCode();
      exists = await prisma.gameSession.findUnique({ where: { code } });
    }

    const session = await prisma.gameSession.create({
      data: {
        quizId,
        code,
        status: 'WAITING',
        currentQuestionIndex: 0,
      },
    });

    res.json({
      sessionId: session.id,
      code: session.code,
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

export default router;