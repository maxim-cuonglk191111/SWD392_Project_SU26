import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../models/client';
import { generateToken } from '../utils/jwt';
import { config, USER_ROLES, AVATAR_COUNT } from '../config';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      username: z.string().min(3).max(20),
      displayName: z.string().min(1).max(50),
      avatarId: z.number().int().min(1).max(AVATAR_COUNT).optional(),
      role: z.enum(['LUCY', 'PRO', 'SUPER']).optional(),
    }).parse(req.body);

    if (await prisma.user.findUnique({ where: { email: data.email } })) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (await prisma.user.findUnique({ where: { username: data.username } })) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(data.password, config.bcryptSaltRounds);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        username: data.username,
        displayName: data.displayName,
        avatarId: data.avatarId || Math.floor(Math.random() * AVATAR_COUNT) + 1,
        role: data.role || USER_ROLES.LUCY,
      },
      select: { id: true, email: true, username: true, displayName: true, avatarId: true, role: true, bio: true, xp: true, coin: true, isAnonymous: true, createdAt: true },
    });

    res.status(201).json({ user, token: generateToken({ userId: user.id, email: user.email, role: user.role }) });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors.map((e: any) => e.message).join(', ') });
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.isBanned) return res.status(403).json({ error: 'Account suspended' });

    res.json({
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarId: user.avatarId, role: user.role, bio: user.bio, xp: user.xp, coin: user.coin, isAnonymous: user.isAnonymous, createdAt: user.createdAt },
      token: generateToken({ userId: user.id, email: user.email, role: user.role }),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors.map((e: any) => e.message).join(', ') });
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  res.json({ user: req.user!.dbUser });
});

router.put('/anonymous', authenticate, async (req: Request, res: Response) => {
  const { isAnonymous } = req.body;
  res.json({ user: await prisma.user.update({ where: { id: req.user!.userId }, data: { isAnonymous }, select: { id: true, isAnonymous: true } }) });
});

export default router;
