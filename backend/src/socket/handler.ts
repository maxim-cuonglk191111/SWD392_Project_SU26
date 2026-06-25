import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import prisma from '../models/client';
import { PARTICIPANT_ROLES } from '../config';
import { generateAnonymousIdentity } from '../services/anonymousService';

interface AuthSocket extends Socket {
  userId?: string;
  username?: string;
  displayName?: string;
  avatarId?: number;
  role?: string;
  // Anonymous session identity
  anonymousName?: string;
  anonymousAvatarSeed?: number;
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
    // Generate anonymous identity using userId as stable seed (same user = same identity per room)
    const identity = generateAnonymousIdentity(socket.userId!);
    socket.anonymousName = identity.anonymousName;
    socket.anonymousAvatarSeed = identity.anonymousAvatarSeed;

    console.log(`[Socket] ${socket.anonymousName} connected`);

    socket.on('join_room', async ({ roomId }: { roomId: string }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

        // Re-generate identity for THIS room (fresh each room)
        const roomIdentity = generateAnonymousIdentity(`${socket.userId}:${roomId}`);
        socket.anonymousName = roomIdentity.anonymousName;
        socket.anonymousAvatarSeed = roomIdentity.anonymousAvatarSeed;

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

        // Broadcast ANONYMOUS identity — strip username, email, real displayName
        io.to(roomId).emit('room_update', {
          roomId, currentCount: activeCount,
          participants: participants.map(p => ({
            // Keep stable userId only for backend logic, never expose real names
            id: p.userId,
            // Never send: username, email, displayName, avatarId — all replaced with anonymous
            anonymousName: generateAnonymousIdentity(`${p.userId}:${roomId}`).anonymousName,
            anonymousAvatarSeed: generateAnonymousIdentity(`${p.userId}:${roomId}`).anonymousAvatarSeed,
            role: p.role,
            handRaised: p.handRaised,
            isMuted: p.isMuted,
            isSpeaker: p.isSpeaker,
          })),
        });

        // Host also gets anonymous — no special info
        const hostIdentity = generateAnonymousIdentity(`${room.hostId}:${roomId}`);
        socket.emit('joined_room', {
          roomId,
          role: existing?.role || 'LISTENER',
          myAnonymousName: roomIdentity.anonymousName,
          myAnonymousAvatarSeed: roomIdentity.anonymousAvatarSeed,
        });

        // Notify room
        io.to(roomId).emit('notification', {
          message: `👋 ${roomIdentity.anonymousName} đã tham gia phòng`,
        });
      } catch (err) { console.error('[Socket] join_room:', err); socket.emit('error', { message: 'Failed to join room' }); }
    });

    socket.on('leave_room', async ({ roomId }: { roomId: string }) => {
      try {
        socket.leave(roomId);
        await prisma.roomParticipant.updateMany({ where: { roomId, userId: socket.userId! }, data: { leftAt: new Date() } });
        const activeCount = await prisma.roomParticipant.count({ where: { roomId, leftAt: null } });
        await prisma.room.update({ where: { id: roomId }, data: { currentCount: activeCount } });

        // Notify room (anonymous)
        io.to(roomId).emit('notification', {
          message: `👋 ${socket.anonymousName} đã rời phòng`,
        });

        const participants = await prisma.roomParticipant.findMany({
          where: { roomId, leftAt: null },
          include: { user: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } } },
        });
        io.to(roomId).emit('room_update', { roomId, currentCount: activeCount, participants: participants.map(p => ({
          id: p.userId,
          anonymousName: generateAnonymousIdentity(`${p.userId}:${roomId}`).anonymousName,
          anonymousAvatarSeed: generateAnonymousIdentity(`${p.userId}:${roomId}`).anonymousAvatarSeed,
          role: p.role, handRaised: p.handRaised, isMuted: p.isMuted, isSpeaker: p.isSpeaker,
        })) });

        // Emit leaved event so frontend can redirect
        socket.emit('leaved_room', { roomId });
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
          userId: socket.userId,
          anonymousName: socket.anonymousName,
          anonymousAvatarSeed: socket.anonymousAvatarSeed,
          handRaised: updated.handRaised,
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

    // ─── Audio Streaming ────────────────────────────────────────────
    // Nhận chunk âm thanh từ speaker, relay đến tất cả người trong phòng
    socket.on('audio_chunk', async ({ roomId, chunk }: { roomId: string; chunk: ArrayBuffer; mimeType: string }) => {
      try {
        const participant = await prisma.roomParticipant.findUnique({
          where: { roomId_userId: { roomId, userId: socket.userId! } },
        });
        // Chỉ speaker đang bật mic mới được gửi
        if (!participant || !participant.isSpeaker || participant.isMuted) return;

        // Relay đến tất cả người khác trong phòng (KHÔNG gửi lại cho người gửi) — dùng anonymous
        socket.to(roomId).emit('audio_chunk', {
          userId: socket.userId,
          anonymousName: socket.anonymousName,
          anonymousAvatarSeed: socket.anonymousAvatarSeed,
          chunk: Buffer.from(chunk).toString('base64'),
          mimeType: 'audio/webm',
        });
      } catch (err) { console.error('[Socket] audio_chunk:', err); }
    });

    socket.on('send_message', async ({ roomId, content, type = 'TEXT' }: { roomId: string; content: string; type?: string }) => {
      try {
        if (!content.trim()) return;
        const message = await prisma.message.create({
          data: { roomId, userId: socket.userId!, content, type },
          include: { user: { select: { id: true, username: true, displayName: true, avatarId: true, role: true } } },
        });
        // Broadcast anonymous — no real name, no avatar, no username
        io.to(roomId).emit('message_received', {
          id: message.id, roomId, content: message.content, type: message.type, createdAt: message.createdAt,
          user: {
            id: message.user!.id,
            anonymousName: socket.anonymousName,
            anonymousAvatarSeed: socket.anonymousAvatarSeed,
            role: message.user!.role,
          },
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

        // ANONYMOUS: generate anonymous names for sender and receiver
        const senderIdentity = generateAnonymousIdentity(`${socket.userId}:${roomId}`);
        const receiverIdentity = generateAnonymousIdentity(`${receiverId}:${roomId}`);
        io.to(roomId).emit('gift_received', {
          giftId, giftName: gift.name, emoji: gift.emoji,
          senderId: socket.userId,
          senderAnonymousName: senderIdentity.anonymousName,
          senderAnonymousAvatarSeed: senderIdentity.anonymousAvatarSeed,
          receiverId,
          receiverAnonymousName: receiverIdentity.anonymousName,
          receiverAnonymousAvatarSeed: receiverIdentity.anonymousAvatarSeed,
          coinCost: gift.coinCost,
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

        const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { displayName: true } });
        await prisma.roomParticipant.updateMany({ where: { roomId, userId: targetUserId }, data: { leftAt: new Date() } });
        const activeCount = await prisma.roomParticipant.count({ where: { roomId, leftAt: null } });
        await prisma.room.update({ where: { id: roomId }, data: { currentCount: activeCount } });

        // Notify the kicked user directly (anonymous notification)
        io.to(roomId).emit('participant_kicked', { userId: targetUserId });
        // Notify everyone else (anonymous)
        io.to(roomId).emit('notification', {
          message: `⚠️ ${generateAnonymousIdentity(`${targetUserId}:${roomId}`).anonymousName} đã bị chủ phòng kick khỏi phòng`,
        });
      } catch (err) { console.error('[Socket] kick_participant:', err); }
    });

    // Host ends the room
    socket.on('end_room', async ({ roomId }: { roomId: string }) => {
      try {
        const room = await prisma.room.findUnique({ where: { id: roomId } });
        if (!room || room.hostId !== socket.userId) return;

        await prisma.room.update({ where: { id: roomId }, data: { status: 'ENDED', endedAt: new Date() } });

        io.to(roomId).emit('room_ended', { roomId });
      } catch (err) { console.error('[Socket] end_room:', err); }
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
