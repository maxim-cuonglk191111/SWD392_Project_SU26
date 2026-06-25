import { Router, Request, Response } from 'express';
import prisma from '../models/client';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { coin: true, xp: true } });
  const transactions = await prisma.walletTransaction.findMany({ where: { userId: req.user!.userId }, orderBy: { createdAt: 'desc' }, take: 20 });
  res.json({ balance: user?.coin || 0, xp: user?.xp || 0, transactions });
});

router.post('/topup', authenticate, async (req: Request, res: Response) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const amounts: Record<number, number> = { 100: 100, 500: 550, 1000: 1200, 5000: 7000, 10000: 15000 };
  const coinAmount = amounts[amount] || amount;

  const user = await prisma.user.update({ where: { id: req.user!.userId }, data: { coin: { increment: coinAmount } } });
  await prisma.walletTransaction.create({ data: { userId: req.user!.userId, type: 'TOPUP', amount: coinAmount, balance: user.coin, note: `Top up ${coinAmount} coins` } });

  res.json({ balance: user.coin, added: coinAmount });
});

export default router;
