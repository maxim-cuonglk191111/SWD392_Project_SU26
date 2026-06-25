import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(token: string) {
    if (this.socket?.connected) return;
    this.socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      upgrade: true,
    });

    this.socket.on('connect', () => console.log('[Socket] Connected'));
    this.socket.on('disconnect', () => console.log('[Socket] Disconnected'));
    this.socket.on('connect_error', (err) => console.error('[Socket] Connection error:', err.message));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  emit(event: string, data?: any) {
    this.socket?.emit(event, data);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    this.socket?.on(event, callback as any);
  }

  off(event: string, callback?: Function) {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback as any);
    } else {
      this.listeners.get(event)?.forEach(cb => this.socket?.off(event, cb as any));
      this.listeners.delete(event);
    }
  }

  // ─── Room ───────────────────────────────────────────────────────────
  joinRoom(roomId: string) { this.emit('join_room', { roomId }); }
  leaveRoom(roomId: string) { this.emit('leave_room', { roomId }); }

  // ─── Hand / Mic ────────────────────────────────────────────────────
  raiseHand(roomId: string) { this.emit('raise_hand', { roomId }); }
  toggleMic(roomId: string) { this.emit('toggle_mic', { roomId }); }

  // ─── Audio Streaming ────────────────────────────────────────────────
  // Gửi chunk âm thanh (blob) khi mic bật
  broadcastAudio(roomId: string, chunk: ArrayBuffer, mimeType: string) {
    this.emit('audio_chunk', { roomId, chunk, mimeType });
  }

  // ─── Chat / Gifts ──────────────────────────────────────────────────
  sendMessage(roomId: string, content: string) { this.emit('send_message', { roomId, content }); }
  sendGift(roomId: string, giftId: string, receiverId: string) { this.emit('send_gift', { roomId, giftId, receiverId }); }

  // ─── Host Controls ─────────────────────────────────────────────────
  promoteSpeaker(roomId: string, targetUserId: string) { this.emit('promote_to_speaker', { roomId, targetUserId }); }
  muteParticipant(roomId: string, targetUserId: string) { this.emit('mute_participant', { roomId, targetUserId }); }
  kickParticipant(roomId: string, targetUserId: string) { this.emit('kick_participant', { roomId, targetUserId }); }
  advanceStage(roomId: string, subLevel: number) { this.emit('advance_stage', { roomId, subLevel }); }

  // ─── Recording ─────────────────────────────────────────────────────
  startRecording(roomId: string) { this.emit('start_recording', { roomId }); }
  stopRecording(roomId: string) { this.emit('stop_recording', { roomId }); }
}

export const socketService = new SocketService();
