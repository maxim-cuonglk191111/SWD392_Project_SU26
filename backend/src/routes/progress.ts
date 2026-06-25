import { Router, Request, Response } from 'express';
import prisma from '../models/client';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const progress = await prisma.userProgress.findMany({
    where: { userId: req.user!.userId },
    include: { level: { select: { id: true, language: true, stage: true, levelNumber: true, title: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ progress });
});

router.put('/:levelId', authenticate, async (req: Request, res: Response) => {
  const { status, score } = req.body;
  const existing = await prisma.userProgress.findUnique({ where: { userId_levelId: { userId: req.user!.userId, levelId: req.params.levelId } } });

  let progress;
  if (existing) {
    progress = await prisma.userProgress.update({
      where: { id: existing.id },
      data: { ...(status && { status }), ...(score !== undefined && { score }), ...(status === 'COMPLETED' && { completedAt: new Date() }) },
    });
  } else {
    progress = await prisma.userProgress.create({
      data: { userId: req.user!.userId, levelId: req.params.levelId, status: status || 'UNLOCKED', score: score || 0, ...(status === 'COMPLETED' && { completedAt: new Date() }) },
    });
  }
  res.json({ progress });
});

export default router;
