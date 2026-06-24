import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

class SocketService {
  constructor() {
    this.socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      query: {},
      // Timeout chờ kết nối — tránh treo vĩnh viễn
      socketio: {
        connectTimeout: 5000,
      },
    });
    this.pingInterval = null;
    this.latencyCallback = null;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', SOCKET_URL);
      this._startPing();
    });
    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connect error:', err.message);
    });
    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      this._stopPing();
    });
    this.socket.on('pong', (clientTime) => {
      const latency = Date.now() - clientTime;
      if (this.latencyCallback) this.latencyCallback(latency);
    });
  }

  connect() {
    if (!this.socket.connected) this.socket.connect();
  }

  disconnect() {
    this.socket.disconnect();
  }

  _startPing() {
    this._stopPing();
    this.pingInterval = setInterval(() => {
      this.socket.emit('ping', Date.now());
    }, 2000);
  }

  _stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  setLatencyCallback(cb) {
    this.latencyCallback = cb;
  }

  // ─── Pre-flight ──────────────────────────────────────────────────────────
  // Trả về Promise, resolve với data hoặc reject sau 5s timeout
  preflightCheck(roomId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.off('preflight_result', handler);
        // Trả về kết quả mặc định (phòng trống, cho vào) khi timeout
        resolve({ ok: true, available: true, participants: 0, maxParticipants: 50 });
      }, 5000);

      const handler = (data) => {
        clearTimeout(timer);
        this.socket.off('preflight_result', handler);
        resolve(data);
      };

      this.socket.on('preflight_result', handler);
      this.connect();
      // Gửi roomId trong payload (query params chỉ set lúc handshake, không update được)
      this.socket.emit('preflight_check', { roomId });
    });
  }

  // ─── Room ───────────────────────────────────────────────────────────────
  joinRoom(roomId, uid) {
    this.socket.emit('join_room', { roomId, uid });
  }

  leaveRoom() {
    this.socket.emit('leave_room');
  }

  // ─── Speaking ──────────────────────────────────────────────────────────
  raiseHand() {
    this.socket.emit('raise_hand');
  }

  lowerHand() {
    this.socket.emit('raise_hand'); // toggle — server xử lý
  }

  approveSpeaker(targetSocketId) {
    this.socket.emit('approve_speaker', { targetSocketId });
  }

  revokeSpeaker(targetSocketId) {
    this.socket.emit('revoke_speaker', { targetSocketId });
  }

  muteAll() {
    this.socket.emit('mute_all');
  }

  toggleMute() {
    this.socket.emit('toggle_mute');
  }

  // ─── Room controls ─────────────────────────────────────────────────────
  pinDocument(docUrl) {
    this.socket.emit('pin_document', docUrl);
  }

  sendGift(giftName, coins) {
    this.socket.emit('send_gift', { giftName, coins });
  }

  sendMessage(text) {
    this.socket.emit('send_message', text);
  }

  // ─── Generic on/off ────────────────────────────────────────────────────
  on(event, callback) { this.socket.on(event, callback); }
  off(event, callback) {
    if (callback) this.socket.off(event, callback);
    else this.socket.off(event);
  }
}

export default new SocketService();
