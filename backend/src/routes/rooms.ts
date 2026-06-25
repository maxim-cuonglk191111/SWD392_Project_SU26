import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../models/client';
import { authenticate, requireRole } from '../middleware/auth';
import { USER_ROLES, ROOM_STATUS } from '../config';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { language, status, stage } = req.query;
  const rooms = await prisma.room.findMany({
    where: { ...(status && { status: status as string }), ...(language && { language: language as string }), ...(stage && { stage: stage as string }) },
    include: { host: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } }, level: { select: { id: true, language: true, stage: true, levelNumber: true, title: true } }, _count: { select: { participants: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ rooms: rooms.map(r => ({ ...r, currentCount: r._count.participants, _count: undefined })) });
});

router.get('/:id', async (req: Request, res: Response) => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: {
      host: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } },
      level: { select: { id: true, language: true, stage: true, levelNumber: true, title: true, subLevels: true } },
      participants: { where: { leftAt: null }, include: { user: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } } }, orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }] },
    },
  });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ room });
});

router.post('/', authenticate, requireRole(USER_ROLES.PRO, USER_ROLES.SUPER), async (req: Request, res: Response) => {
  try {
    const data = z.object({ title: z.string().min(1).max(100), description: z.string().max(500).optional(), levelId: z.string().uuid().optional(), language: z.enum(['EN', 'ZH', 'JP']).optional(), maxParticipants: z.number().int().min(2).max(200).optional() }).parse(req.body);

    const room = await prisma.room.create({
      data: { title: data.title, description: data.description, levelId: data.levelId, hostId: req.user!.userId, language: data.language || 'EN', maxParticipants: data.maxParticipants || 50, status: ROOM_STATUS.WAITING },
      include: { host: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } }, level: { select: { id: true, language: true, stage: true, levelNumber: true, title: true } } },
    });

    await prisma.roomParticipant.create({ data: { roomId: room.id, userId: req.user!.userId, role: 'HOST', isSpeaker: true, isMuted: false } });
    res.status(201).json({ room });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors.map((e: any) => e.message).join(', ') });
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.put('/:id', authenticate, async (req: Request, res: Response) => {
  const room = await prisma.room.findUnique({ where: { id: req.params.id } });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.hostId !== req.user!.userId) return res.status(403).json({ error: 'Only the host can update the room' });

  const { title, description, isLocked, status } = req.body;
  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (isLocked !== undefined) updateData.isLocked = isLocked;
  if (status !== undefined) updateData.status = status;

  res.json({ room: await prisma.room.update({ where: { id: req.params.id }, data: updateData }) });
});

router.post('/:id/join', authenticate, async (req: Request, res: Response) => {
  const room = await prisma.room.findUnique({ where: { id: req.params.id }, include: { _count: { select: { participants: { where: { leftAt: null } } } } } });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room._count.participants >= room.maxParticipants) return res.status(400).json({ error: 'Room is full' });
  if (room.isLocked) return res.status(403).json({ error: 'Room is locked' });

  const existing = await prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: req.params.id, userId: req.user!.userId } } });
  let participant;
  if (existing) {
    participant = await prisma.roomParticipant.update({ where: { id: existing.id }, data: { leftAt: null, handRaised: false } });
  } else {
    participant = await prisma.roomParticipant.create({ data: { roomId: req.params.id, userId: req.user!.userId, role: 'LISTENER' } });
  }

  const activeCount = await prisma.roomParticipant.count({ where: { roomId: req.params.id, leftAt: null } });
  const newStatus = room.status === ROOM_STATUS.WAITING && activeCount >= 2 ? ROOM_STATUS.ACTIVE : room.status;
  await prisma.room.update({ where: { id: req.params.id }, data: { currentCount: activeCount, status: newStatus } });

  res.json({ participant });
});

router.post('/:id/leave', authenticate, async (req: Request, res: Response) => {
  const participant = await prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: req.params.id, userId: req.user!.userId } } });
  if (!participant) return res.status(404).json({ error: 'Not in this room' });

  await prisma.roomParticipant.update({ where: { id: participant.id }, data: { leftAt: new Date() } });
  const activeCount = await prisma.roomParticipant.count({ where: { roomId: req.params.id, leftAt: null } });
  await prisma.room.update({ where: { id: req.params.id }, data: { currentCount: activeCount } });

  res.json({ success: true });
});

router.post('/:id/hand', authenticate, async (req: Request, res: Response) => {
  const participant = await prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: req.params.id, userId: req.user!.userId } } });
  if (!participant) return res.status(404).json({ error: 'Not in this room' });

  const updated = await prisma.roomParticipant.update({ where: { id: participant.id }, data: { handRaised: !participant.handRaised } });
  res.json({ handRaised: updated.handRaised });
});

router.post('/:id/mute', authenticate, async (req: Request, res: Response) => {
  const participant = await prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId: req.params.id, userId: req.user!.userId } } });
  if (!participant) return res.status(404).json({ error: 'Not in this room' });

  const updated = await prisma.roomParticipant.update({ where: { id: participant.id }, data: { isMuted: !participant.isMuted } });
  res.json({ isMuted: updated.isMuted });
});

router.post('/:id/end', authenticate, async (req: Request, res: Response) => {
  const room = await prisma.room.findUnique({ where: { id: req.params.id } });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.hostId !== req.user!.userId) return res.status(403).json({ error: 'Only the host can end the room' });

  await prisma.room.update({ where: { id: req.params.id }, data: { status: ROOM_STATUS.ENDED, endedAt: new Date() } });

  const participants = await prisma.roomParticipant.findMany({ where: { roomId: req.params.id, leftAt: null }, include: { user: true } });
  for (const p of participants) {
    const xpGain = p.role === 'HOST' ? 50 : p.role === 'SPEAKER' ? 30 : p.role === 'MODERATOR' ? 40 : 10;
    await prisma.user.update({ where: { id: p.userId }, data: { xp: { increment: xpGain } } });
  }

  res.json({ success: true });
});

router.get('/host/my-rooms', authenticate, async (req: Request, res: Response) => {
  const rooms = await prisma.room.findMany({
    where: { hostId: req.user!.userId },
    include: { level: { select: { id: true, language: true, stage: true, levelNumber: true, title: true } }, _count: { select: { participants: { where: { leftAt: null } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ rooms });
});

export default router;
