import { Router, Request, Response } from 'express';
import prisma from '../models/client';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const gifts = await prisma.gift.findMany({ orderBy: { coinCost: 'asc' } });
  res.json({ gifts });
});

router.post('/send', authenticate, async (req: Request, res: Response) => {
  const { giftId, receiverId, roomId } = req.body;
  if (!giftId || !receiverId) return res.status(400).json({ error: 'giftId and receiverId are required' });
  if (req.user!.userId === receiverId) return res.status(400).json({ error: 'Cannot send gift to yourself' });

  const gift = await prisma.gift.findUnique({ where: { id: giftId } });
  if (!gift) return res.status(404).json({ error: 'Gift not found' });

  const sender = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!sender || sender.coin < gift.coinCost) return res.status(400).json({ error: 'Insufficient coins' });

  const [userGift] = await prisma.$transaction([
    prisma.userGift.create({ data: { senderId: req.user!.userId, receiverId, giftId, roomId } }),
    prisma.user.update({ where: { id: req.user!.userId }, data: { coin: { decrement: gift.coinCost } } }),
    prisma.user.update({ where: { id: receiverId }, data: { coin: { increment: gift.coinCost }, xp: { increment: Math.floor(gift.coinCost / 2) } } }),
  ]);

  res.status(201).json({ gift: userGift, giftDetails: gift });
});

router.get('/leaderboard', async (req: Request, res: Response) => {
  const topGifters = await prisma.userGift.groupBy({ by: ['senderId'], _count: true, orderBy: { _count: { senderId: 'desc' } }, take: 20 });
  const enriched = await Promise.all(topGifters.map(async (g) => {
    const user = await prisma.user.findUnique({ where: { id: g.senderId }, select: { username: true, displayName: true, avatarId: true, role: true } });
    return { ...g, user };
  }));
  res.json({ leaderboard: enriched });
});

export default router;
