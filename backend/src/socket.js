const axios = require('axios');
const jwt = require('jsonwebtoken');
const { RoomContext, MAX_ACTIVE_SPEAKERS } = require('./patterns/StageState');
const { generateRtcToken } = require('./agoraToken');

const users = {};       // socketId → user info
const activeRooms = {};  // roomId  → RoomContext
const jwtSecret = process.env.JWT_SECRET;

function setupSockets(io) {

  // ─── Auth Middleware ─────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Missing token'));

    try {
      if (jwtSecret && !token.startsWith('dummy.')) {
        // Real JWT verification
        const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
        socket.userRole = decoded.role || 'LUCY';
        socket.userName = decoded.name || `User_${Math.floor(Math.random() * 10000)}`;
        socket.userId   = decoded.uid  || null;
      } else {
        // Fallback: parse dummy token (e.g. dummy.token.role.name.userId)
        const parts = token.split('.');
        if (parts.length >= 6) {
          socket.userRole = parts[3] || 'LUCY';
          socket.userName = decodeURIComponent(parts[4] || `User_${Math.floor(Math.random() * 10000)}`).replace(/_/g, ' ');
          socket.userId   = parts[5] || null;
        } else {
          socket.userRole = parts[2] || 'LUCY';
          socket.userName = decodeURIComponent(parts[3] || `User_${Math.floor(Math.random() * 10000)}`).replace(/_/g, ' ');
          socket.userId   = parts[4] || null;
        }
      }
      next();
    } catch (err) {
      console.error('[Socket Auth] Token verification failed:', err.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('[Socket] Connected:', socket.id, socket.userName, socket.userRole);

    users[socket.id] = {
      id: socket.id,
      name: socket.userName,
      role: socket.userRole,
      userId: socket.userId,
      isMuted: true,
      isHandRaised: false,
      isSpeaker: false,
    };

    // ─── GĐ1 · Pre-flight Check (Lobby) ──────────────────────────────────
    socket.on('preflight_check', ({ roomId: reqRoomId } = {}) => {
      const roomId = reqRoomId || socket.handshake.query.roomId || socket.roomId;
      if (!roomId) {
        return socket.emit('preflight_result', { ok: false, error: 'Thiếu roomId.' });
      }

      let room = activeRooms[roomId];
      if (!room) {
        room = new RoomContext(roomId);
        activeRooms[roomId] = room;
        registerRoomObservers(io, room, roomId);
      }

      const check = room.preflightCheck();
      socket.emit('preflight_result', { ok: true, ...check });
    });

    // ─── GĐ1 · Ping đo độ trễ ───────────────────────────────────────────
    socket.on('ping', (clientTime) => {
      socket.emit('pong', clientTime);
    });

    // ─── GĐ2 · Vào phòng ─────────────────────────────────────────────────
    socket.on('join_room', ({ roomId, uid }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.uid   = uid;

      // Tạo phòng mới nếu chưa có
      let room = activeRooms[roomId];
      if (!room) {
        room = new RoomContext(roomId);
        activeRooms[roomId] = room;
        registerRoomObservers(io, room, roomId);
      }

      const isHost = socket.userRole === 'LUCY Pro' || socket.userRole === 'LUCY Super';

      // ── Sinh Agora Token theo role ──────────────────────────────────────
      // Host: PUBLISHER (mic luôn mở)
      // User: SUBSCRIBER (mic bị khóa mặc định)
      const agoraRole = isHost ? 'publisher' : 'subscriber';
      let agoraToken;
      try {
        agoraToken = generateRtcToken(roomId, uid || 0, agoraRole);
      } catch {
        agoraToken = null;
      }

      room.addParticipant(socket.id, socket.userName, socket.userRole, uid);

      users[socket.id].roomId = roomId;
      users[socket.id].uid   = uid;
      users[socket.id].isMuted   = !isHost;
      users[socket.id].isSpeaker  = isHost;

      socket.emit('room_joined', {
        roomId,
        agoraToken,
        role: agoraRole,
        isHost,
        user: users[socket.id],
        queue: room.handRaiseQueue.map(sid => users[sid]).filter(Boolean),
      });

      broadcastRoomUsers(io, roomId);
      socket.emit('your_info', users[socket.id]);

      // Gửi trạng thái stage hiện tại
      if (room.currentState) {
        socket.emit('stage_changed', {
          stage: room.currentStageIndex,
          timeLeft: room.timeLeft,
          topic: room.currentState.topic || 'Loading...',
        });
      }

      if (room.pinnedDocument) {
        socket.emit('document_pinned', room.pinnedDocument);
      }
      socket.emit('materials_updated', room.materials || []);
    });

    // ─── GĐ3 · Giơ tay phát biểu ─────────────────────────────────────────
    socket.on('raise_hand', () => {
      const user = users[socket.id];
      if (!user) return;

      user.isHandRaised = !user.isHandRaised;
      const room = activeRooms[user.roomId];
      if (!room) return;

      if (user.isHandRaised) {
        room.raiseHand(socket.id);
      } else {
        room.lowerHand(socket.id);
      }
      io.to(user.roomId).emit('user_updated', user);
    });

    // ─── GĐ3 · Mentor duyệt phát biểu ───────────────────────────────────
    socket.on('approve_speaker', ({ targetSocketId }) => {
      const host = users[socket.id];
      if (!host || (host.role !== 'LUCY Pro' && host.role !== 'LUCY Super')) return;

      const target = users[targetSocketId];
      if (!target || target.roomId !== host.roomId) return;

      const room = activeRooms[host.roomId];
      if (!room) return;

      const result = room.approveSpeaker(targetSocketId);
      if (!result.success) {
        return socket.emit('speaker_error', { message: result.reason });
      }

      // Chuyển target thành speaker
      target.isSpeaker = true;
      target.isHandRaised = false;
      target.isMuted = false;
      room.lowerHand(targetSocketId);

      // Gửi token PUBLISHER + lệnh mở mic riêng cho target
      io.to(targetSocketId).emit('speaker_approved', {
        personaId: targetSocketId,
        agoraToken: result.token,
        uid: target.uid,
      });

      // Cập nhật trạng thái toàn phòng
      io.to(host.roomId).emit('user_updated', target);

      console.log(`[Room ${host.roomId}] ${target.name} approved to speak`);
    });

    // ─── GĐ3 · Mentor thu hồi mic ─────────────────────────────────────────
    socket.on('revoke_speaker', ({ targetSocketId }) => {
      const host = users[socket.id];
      if (!host || (host.role !== 'LUCY Pro' && host.role !== 'LUCY Super')) return;

      const target = users[targetSocketId];
      if (!target || target.roomId !== host.roomId) return;

      const room = activeRooms[host.roomId];
      if (room) room.revokeSpeaker(targetSocketId);

      target.isSpeaker = false;
      target.isMuted    = true;

      io.to(targetSocketId).emit('speaker_revoked', {
        personaId: targetSocketId,
      });

      io.to(host.roomId).emit('user_updated', target);
      console.log(`[Room ${host.roomId}] ${target.name} mic revoked`);
    });

    // ─── Mentor: Mute cả phòng ───────────────────────────────────────────
    socket.on('mute_all', () => {
      const host = users[socket.id];
      if (!host || (host.role !== 'LUCY Pro' && host.role !== 'LUCY Super')) return;

      const room = activeRooms[host.roomId];
      Object.values(users).forEach(u => {
        if (u.roomId === host.roomId && u.role === 'LUCY') {
          u.isMuted = true;
          u.isSpeaker = false;
          if (room) room.revokeSpeaker(u.id);
          io.to(u.id).emit('speaker_revoked', { personaId: u.id });
          io.to(host.roomId).emit('user_updated', u);
        }
      });
    });

    // ─── User tự khóa/mở mic (chỉ khi đã được duyệt làm speaker) ───────────
    socket.on('toggle_mute', () => {
      const user = users[socket.id];
      if (!user) return;

      // User thường chỉ được tắt mic khi đã là speaker, không được bật lại
      if (user.role === 'LUCY' && user.isSpeaker) {
        user.isMuted = !user.isMuted;
        io.to(user.roomId).emit('user_updated', user);
      }
    });

    // ─── Ghim tài liệu ───────────────────────────────────────────────────
    socket.on('pin_document', (docUrl) => {
      const user = users[socket.id];
      if (!user || (user.role !== 'LUCY Pro' && user.role !== 'LUCY Super')) return;
      const room = activeRooms[user.roomId];
      if (room) room.pinDocument(docUrl);
    });

    // ─── Gửi quà tặng ────────────────────────────────────────────────────
    socket.on('send_gift', async ({ giftName, coins }) => {
      const user = users[socket.id];
      if (!user) return;
      const room = activeRooms[user.roomId];
      if (!room) return;

      try {
        let identityUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:5064';
        if (identityUrl.startsWith('http://') && identityUrl.includes('.onrender.com')) {
          identityUrl = identityUrl.replace('http://', 'https://');
        }
        const response = await axios.post(`${identityUrl}/api/wallet/transfer`, {
          fromUsername: user.name,
          toUsername: 'Host Mentor',
          giftName,
          coins,
        });

        if (response.data && response.data.success) {
          room.sendGift(user, giftName, coins);
          socket.emit('gift_transfer_success', {
            balance: response.data.senderBalance,
            message: response.data.message,
          });
        } else {
          socket.emit('gift_transfer_error', {
            message: response.data.error || 'Failed to complete gift transaction.',
          });
        }
      } catch (error) {
        const errMsg = error.response?.data?.error || 'Connection error to wallet service.';
        socket.emit('gift_transfer_error', { message: errMsg });
      }
    });

    // ─── Chat ─────────────────────────────────────────────────────────────
    socket.on('send_message', (messageText) => {
      const user = users[socket.id];
      if (!user || !messageText?.trim()) return;
      const msg = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        sender: user.name,
        role: user.role,
        text: messageText.trim(),
        timestamp: new Date(),
      };
      io.to(user.roomId).emit('new_message', msg);
    });

    // ─── Thoát phòng ──────────────────────────────────────────────────────
    socket.on('leave_room', () => {
      handleLeave(socket, io);
    });

    // ─── Disconnect ───────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected:', socket.id);
      handleLeave(socket, io);
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function registerRoomObservers(io, room, roomId) {
  room.on('stage-changed', (data) => io.to(roomId).emit('stage_changed', data));
  room.on('timer-update',   (data) => io.to(roomId).emit('timer_update', data));
  room.on('room-finished',  (data) => { io.to(roomId).emit('room_finished', data); delete activeRooms[roomId]; });
  room.on('hand-raise-updated', (queue) => {
    const details = queue.map(sid => users[sid]).filter(Boolean);
    io.to(roomId).emit('hand_raise_updated', details);
  });
  room.on('document-pinned', (docUrl) => io.to(roomId).emit('document_pinned', docUrl));
  room.on('materials-updated', (materials) => io.to(roomId).emit('materials_updated', materials));
  room.on('gift-sent', (data) => io.to(roomId).emit('gift_sent', data));
}

function handleLeave(socket, io) {
  const user = users[socket.id];
  if (!user) return;

  const room = activeRooms[user.roomId];
  if (room) {
    room.removeParticipant(socket.id);
  }
  delete users[socket.id];

  if (user.roomId) {
    broadcastRoomUsers(io, user.roomId);
  }
}

function broadcastRoomUsers(io, roomId) {
  const roomUsers = Object.values(users).filter(u => u.roomId === roomId);
  io.to(roomId).emit('room_users', roomUsers);
}

module.exports = { setupSockets, activeRooms };
