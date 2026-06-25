import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import prisma from '../models/client';
import { PARTICIPANT_ROLES } from '../config';

interface AuthSocket extends Socket {
  userId?: string;
  username?: string;
  displayName?: string;
  avatarId?: number;
  role?: string;
}

export function initSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

  io.use(async (socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, username: true, displayName: true, avatarId: true, role: true },
      });
      if (!user) return next(new Error('User not found'));
      socket.userId = user.id;
      socket.username = user.username;
      socket.displayName = user.displayName;
      socket.avatarId = user.avatarId;
      socket.role = user.role;
      next();
    } catch { next(new Error('Invalid token')); }
  });

  io.on('connection', (socket: AuthSocket) => {
    console.log(`[Socket] ${socket.username} connected`);

    socket.on('join_room', async ({ roomId }: { roomId: string }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

        const existing = await prisma.roomParticipant.findUnique({
          where: { roomId_userId: { roomId, userId: socket.userId! } },
        });
        if (existing?.leftAt) {
          await prisma.roomParticipant.update({ where: { id: existing.id }, data: { leftAt: null, handRaised: false } });
        } else if (!existing) {
          await prisma.roomParticipant.create({ data: { roomId, userId: socket.userId!, role: PARTICIPANT_ROLES.LISTENER } });
        }

        const activeCount = await prisma.roomParticipant.count({ where: { roomId, leftAt: null } });
        await prisma.room.update({ where: { id: roomId }, data: { currentCount: activeCount } });

        socket.join(roomId);

        const participants = await prisma.roomParticipant.findMany({
          where: { roomId, leftAt: null },
          include: { user: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        });

        io.to(roomId).emit('room_update', {
          roomId, currentCount: activeCount,
          participants: participants.map(p => ({
            id: p.userId, username: p.user.username, displayName: p.user.displayName,
            avatarId: p.user.avatarId, role: p.role, handRaised: p.handRaised, isMuted: p.isMuted, isSpeaker: p.isSpeaker,
          })),
        });

        socket.emit('joined_room', { roomId, role: existing?.role || 'LISTENER' });
      } catch (err) { console.error('[Socket] join_room:', err); socket.emit('error', { message: 'Failed to join room' }); }
    });

    socket.on('leave_room', async ({ roomId }: { roomId: string }) => {
      try {
        socket.leave(roomId);
        await prisma.roomParticipant.updateMany({ where: { roomId, userId: socket.userId! }, data: { leftAt: new Date() } });
        const activeCount = await prisma.roomParticipant.count({ where: { roomId, leftAt: null } });
        await prisma.room.update({ where: { id: roomId }, data: { currentCount: activeCount } });
        const participants = await prisma.roomParticipant.findMany({
          where: { roomId, leftAt: null },
          include: { user: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } } },
        });
        io.to(roomId).emit('room_update', { roomId, currentCount: activeCount, participants: participants.map(p => ({
          id: p.userId, username: p.user.username, displayName: p.user.displayName, avatarId: p.user.avatarId,
          role: p.role, handRaised: p.handRaised, isMuted: p.isMuted, isSpeaker: p.isSpeaker,
        })) });
      } catch (err) { console.error('[Socket] leave_room:', err); }
    });

    socket.on('raise_hand', async ({ roomId }: { roomId: string }) => {
      try {
        const participant = await prisma.roomParticipant.findUnique({
          where: { roomId_userId: { roomId, userId: socket.userId! } },
        });
        if (!participant) return;
        const updated = await prisma.roomParticipant.update({ where: { id: participant.id }, data: { handRaised: !participant.handRaised } });
        io.to(roomId).emit('hand_update', {
          userId: socket.userId, username: socket.username, displayName: socket.displayName,
          avatarId: socket.avatarId, handRaised: updated.handRaised,
        });
      } catch (err) { console.error('[Socket] raise_hand:', err); }
    });

    socket.on('toggle_mic', async ({ roomId }: { roomId: string }) => {
      try {
        const participant = await prisma.roomParticipant.findUnique({
          where: { roomId_userId: { roomId, userId: socket.userId! } },
        });
        if (!participant || !participant.isSpeaker) return;
        const updated = await prisma.roomParticipant.update({ where: { id: participant.id }, data: { isMuted: !participant.isMuted } });
        io.to(roomId).emit('participant_update', { userId: socket.userId, isMuted: updated.isMuted });
      } catch (err) { console.error('[Socket] toggle_mic:', err); }
    });

    socket.on('send_message', async ({ roomId, content, type = 'TEXT' }: { roomId: string; content: string; type?: string }) => {
      try {
        if (!content.trim()) return;
        const message = await prisma.message.create({
          data: { roomId, userId: socket.userId!, content, type },
          include: { user: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } } },
        });
        io.to(roomId).emit('message_received', {
          id: message.id, roomId, content: message.content, type: message.type, createdAt: message.createdAt,
          user: { id: message.user!.id, username: message.user!.username, displayName: message.user!.displayName, avatarId: message.user!.avatarId, role: message.user!.role },
        });
      } catch (err) { console.error('[Socket] send_message:', err); }
    });

    socket.on('send_gift', async ({ roomId, giftId, receiverId }: { roomId: string; giftId: string; receiverId: string }) => {
      try {
        const gift = await prisma.gift.findUnique({ where: { id: giftId } });
        if (!gift) return;
        const sender = await prisma.user.findUnique({ where: { id: socket.userId! } });
        if (!sender || sender.coin < gift.coinCost) { socket.emit('error', { message: 'Insufficient coins' }); return; }

        await prisma.$transaction([
          prisma.userGift.create({ data: { senderId: socket.userId!, receiverId, giftId, roomId } }),
          prisma.user.update({ where: { id: socket.userId! }, data: { coin: { decrement: gift.coinCost } } }),
          prisma.user.update({ where: { id: receiverId }, data: { coin: { increment: gift.coinCost } } }),
        ]);

        const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { displayName: true, avatarId: true } });
        io.to(roomId).emit('gift_received', {
          giftId, giftName: gift.name, emoji: gift.emoji,
          senderId: socket.userId, senderName: socket.displayName, senderAvatar: socket.avatarId,
          receiverId, receiverName: receiver?.displayName, receiverAvatar: receiver?.avatarId, coinCost: gift.coinCost,
        });
      } catch (err) { console.error('[Socket] send_gift:', err); }
    });

    socket.on('promote_to_speaker', async ({ roomId, targetUserId }: { roomId: string; targetUserId: string }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room || room.hostId !== socket.userId) { socket.emit('error', { message: 'Only host can promote' }); return; }
        const participant = await prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId, userId: targetUserId } } });
        if (!participant) return;
        await prisma.roomParticipant.update({ where: { id: participant.id }, data: { isSpeaker: true, role: PARTICIPANT_ROLES.SPEAKER, handRaised: false } });
        io.to(roomId).emit('participant_update', { userId: targetUserId, isSpeaker: true, role: PARTICIPANT_ROLES.SPEAKER });
      } catch (err) { console.error('[Socket] promote_to_speaker:', err); }
    });

    socket.on('mute_participant', async ({ roomId, targetUserId }: { roomId: string; targetUserId: string }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room || room.hostId !== socket.userId) return;
        const participant = await prisma.roomParticipant.findUnique({ where: { roomId_userId: { roomId, userId: targetUserId } } });
        if (!participant) return;
        await prisma.roomParticipant.update({ where: { id: participant.id }, data: { isMuted: true } });
        io.to(roomId).emit('participant_update', { userId: targetUserId, isMuted: true });
      } catch (err) { console.error('[Socket] mute_participant:', err); }
    });

    socket.on('kick_participant', async ({ roomId, targetUserId }: { roomId: string; targetUserId: string }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room || room.hostId !== socket.userId) return;
        await prisma.roomParticipant.updateMany({ where: { roomId, userId: targetUserId }, data: { leftAt: new Date() } });
        io.to(roomId).emit('participant_kicked', { userId: targetUserId });
      } catch (err) { console.error('[Socket] kick_participant:', err); }
    });

    socket.on('advance_stage', async ({ roomId, subLevel }: { roomId: string; subLevel: number }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room || room.hostId !== socket.userId) return;
        await prisma.room.update({ where: { id: roomId }, data: { currentSubLevel: subLevel } });
        io.to(roomId).emit('stage_changed', { subLevel });
      } catch (err) { console.error('[Socket] advance_stage:', err); }
    });

    socket.on('start_recording', async ({ roomId }: { roomId: string }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room || room.hostId !== socket.userId) return;
        await prisma.room.update({ where: { id: roomId }, data: { isRecording: true } });
        io.to(roomId).emit('recording_started', { roomId });
      } catch (err) { console.error('[Socket] start_recording:', err); }
    });

    socket.on('stop_recording', async ({ roomId }: { roomId: string }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room || room.hostId !== socket.userId) return;
        await prisma.room.update({ where: { id: roomId }, data: { isRecording: false } });
        io.to(roomId).emit('recording_stopped', { roomId });
      } catch (err) { console.error('[Socket] stop_recording:', err); }
    });

    socket.on('disconnect', async () => {
      console.log(`[Socket] ${socket.username} disconnected`);
      await prisma.roomParticipant.updateMany({ where: { userId: socket.userId, leftAt: null }, data: { leftAt: new Date() } });
    });
  });

  return io;
}
