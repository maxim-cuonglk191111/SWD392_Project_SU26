import { Router, Request, Response } from 'express';
import prisma from '../models/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { language, stage } = req.query;
  const levels = await prisma.level.findMany({
    where: { ...(language && { language: language as string }), ...(stage && { stage: stage as string }) },
    orderBy: [{ language: 'asc' }, { levelNumber: 'asc' }],
    select: { id: true, language: true, stage: true, levelNumber: true, title: true, titleZh: true, titleJp: true, description: true, duration: true },
  });
  res.json({ levels });
});

router.get('/curriculum/all', async (req: Request, res: Response) => {
  const levels = await prisma.level.findMany({ orderBy: [{ language: 'asc' }, { stage: 'asc' }, { levelNumber: 'asc' }] });
  const curriculum: Record<string, Record<string, any[]>> = { EN: {}, ZH: {}, JP: {} };
  for (const lang of ['EN', 'ZH', 'JP']) {
    for (const stage of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) {
      curriculum[lang][stage] = levels.filter(l => l.language === lang && l.stage === stage).map(l => ({
        id: l.id, levelNumber: l.levelNumber, title: l.title, titleZh: l.titleZh, titleJp: l.titleJp, description: l.description, duration: l.duration,
      }));
    }
  }
  res.json({ curriculum });
});

router.get('/:id', async (req: Request, res: Response) => {
  const level = await prisma.level.findUnique({ where: { id: req.params.id }, include: { _count: { select: { rooms: true } } } });
  if (!level) return res.status(404).json({ error: 'Level not found' });
  res.json({ level });
});

router.get('/:id/sublevels', async (req: Request, res: Response) => {
  const level = await prisma.level.findUnique({ where: { id: req.params.id }, select: { subLevels: true, id: true } });
  if (!level) return res.status(404).json({ error: 'Level not found' });
  let subLevels: any[] = [];
  try { subLevels = JSON.parse(level.subLevels); } catch { /* ignore */ }
  res.json({ levelId: level.id, subLevels });
});

export default router;
