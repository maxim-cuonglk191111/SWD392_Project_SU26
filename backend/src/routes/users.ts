import { Router, Request, Response } from 'express';
import prisma from '../models/client';
import { authenticate } from '../middleware/auth';
import { AVATAR_COUNT } from '../config';

const router = Router();

router.get('/profile', authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, username: true, displayName: true, avatarId: true, role: true, bio: true, xp: true, coin: true, isAnonymous: true, createdAt: true },
  });
  res.json({ user });
});

router.put('/profile', authenticate, async (req: Request, res: Response) => {
  const { displayName, bio, avatarId } = req.body;
  const updateData: any = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (bio !== undefined) updateData.bio = bio;
  if (avatarId !== undefined) {
    if (avatarId < 1 || avatarId > AVATAR_COUNT) return res.status(400).json({ error: `Avatar ID must be 1-${AVATAR_COUNT}` });
    updateData.avatarId = avatarId;
  }
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: updateData,
    select: { id: true, username: true, displayName: true, avatarId: true, role: true, bio: true, xp: true, coin: true },
  });
  res.json({ user });
});

router.get('/users/:username', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: { id: true, username: true, displayName: true, avatarId: true, role: true, bio: true, xp: true, isAnonymous: true, createdAt: true, _count: { select: { receivedGifts: true, hostedRooms: true } } },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.get('/leaderboard', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const users = await prisma.user.findMany({
    where: { isBanned: false },
    orderBy: { xp: 'desc' },
    take: limit,
    select: { id: true, username: true, displayName: true, avatarId: true, role: true, xp: true, isAnonymous: true, _count: { select: { receivedGifts: true } } },
  });
  res.json({ leaderboard: users });
});

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  const [user, roomCount, giftSent, giftReceived] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user!.userId } }),
    prisma.roomParticipant.count({ where: { userId: req.user!.userId } }),
    prisma.userGift.count({ where: { senderId: req.user!.userId } }),
    prisma.userGift.count({ where: { receiverId: req.user!.userId } }),
  ]);
  res.json({ stats: { totalRoomsJoined: roomCount, giftsSent: giftSent, giftsReceived: giftReceived, currentXP: user?.xp || 0, currentCoins: user?.coin || 0 } });
});

router.get('/avatars', (req: Request, res: Response) => {
  const avatars = Array.from({ length: AVATAR_COUNT }, (_, i) => ({ id: i + 1, name: `Avatar ${i + 1}`, imageUrl: `/avatars/${i + 1}.png` }));
  res.json({ avatars });
});

export default router;
