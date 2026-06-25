import { Router, Request, Response } from 'express';
import prisma from '../models/client';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { language, status } = req.query;
  const podcasts = await prisma.podcast.findMany({
    where: { ...(language && { room: { language: language as string } }), ...(status && { status: status as string }) },
    include: { host: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } }, room: { select: { id: true, title: true, language: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ podcasts });
});

router.get('/:id', async (req: Request, res: Response) => {
  const podcast = await prisma.podcast.findUnique({
    where: { id: req.params.id },
    include: { host: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } }, room: { select: { id: true, title: true, language: true } } },
  });
  if (!podcast) return res.status(404).json({ error: 'Podcast not found' });
  res.json({ podcast });
});

router.post('/', authenticate, requireRole('SUPER'), async (req: Request, res: Response) => {
  const { roomId, title, description } = req.body;
  if (!roomId || !title) return res.status(400).json({ error: 'roomId and title are required' });
  if (await prisma.podcast.findUnique({ where: { roomId } })) return res.status(409).json({ error: 'Podcast already exists for this room' });

  const podcast = await prisma.podcast.create({
    data: { roomId, title, description, hostId: req.user!.userId },
    include: { host: { select: { id: true, username: true, displayName: true, avatarId: true } } },
  });
  res.status(201).json({ podcast });
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  const podcast = await prisma.podcast.findUnique({ where: { id: req.params.id } });
  if (!podcast) return res.status(404).json({ error: 'Podcast not found' });
  if (podcast.hostId !== req.user!.userId) return res.status(403).json({ error: 'Only the host can update this podcast' });

  const { title, description, isPremium, price, audioUrl, duration, status } = req.body;
  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (isPremium !== undefined) updateData.isPremium = isPremium;
  if (price !== undefined) updateData.price = price;
  if (audioUrl !== undefined) updateData.audioUrl = audioUrl;
  if (duration !== undefined) updateData.duration = duration;
  if (status !== undefined) updateData.status = status;

  res.json({ podcast: await prisma.podcast.update({ where: { id: req.params.id }, data: updateData }) });
});

router.post('/:id/view', async (req: Request, res: Response) => {
  const podcast = await prisma.podcast.update({ where: { id: req.params.id }, data: { viewCount: { increment: 1 } } });
  res.json({ viewCount: podcast.viewCount });
});

router.get('/me/my', authenticate, async (req: Request, res: Response) => {
  const podcasts = await prisma.podcast.findMany({ where: { hostId: req.user!.userId }, include: { room: { select: { id: true, title: true, language: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ podcasts });
});

export default router;
