import AgoraRTC from 'agora-rtc-sdk-ng';

const APP_ID = import.meta.env.VITE_AGORA_APP_ID;
if (!APP_ID) {
  console.error('[Agora] VITE_AGORA_APP_ID chưa được cấu hình!');
}

/**
 * Kiểm tra trình duyệt có hỗ trợ getUserMedia hay không.
 * Browser chỉ cấp quyền mic trên HTTPS hoặc localhost.
 */
export function checkMicEnvironment() {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'Không phải môi trường trình duyệt.' };
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      ok: false,
      reason: 'Trình duyệt không hỗ trợ microphone. Dùng Chrome hoặc Firefox.',
    };
  }
  const { hostname, protocol } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isLocalhost && protocol !== 'https:') {
    return {
      ok: false,
      reason: 'Microphone yêu cầu kết nối bảo mật (HTTPS). Liên hệ admin để bật SSL.',
    };
  }
  return { ok: true, reason: null };
}

function getMicErrorReason(error) {
  const msg = (error?.message || error?.code || '').toLowerCase();
  if (msg.includes('notallowederror') || msg.includes('permission denied')) {
    return 'Trình duyệt đã từ chối quyền microphone. Nhấn vào 🔒 trên thanh địa chỉ và cấp quyền.';
  }
  if (msg.includes('notfounderror') || msg.includes('device not found')) {
    return 'Không tìm thấy microphone. Kiểm tra thiết bị đã cắm chưa.';
  }
  if (msg.includes('notreadableerror') || msg.includes('could not start')) {
    return 'Microphone đang bị ứng dụng khác chiếm dụng.';
  }
  return `Lỗi microphone: ${error?.message || 'Không xác định'}`;
}

// Thời gian loopback test (ms) — 2 giây ghi âm rồi tự phát lại
const ECHO_TEST_INTERVAL_MS = 2;

class AgoraService {
  constructor() {
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    this.localAudioTrack = null;   // track chính dùng trong phòng
    this.echoTrack = null;          // track dùng cho loopback test
    this.remoteUsers = {};

    // Quyền hiện tại trong Agora channel
    // 'subscriber' = mic bị khóa hoàn toàn ở mức OS
    // 'publisher'  = mic được bật và gửi lên
    this.currentRole = null;
    this.isJoined = false;
    this.micGranted = false;

    // Đăng ký listener 1 lần duy nhất — không đăng ký lại khi rejoin
    this.client.on('user-published', this._onUserPublished.bind(this));
    this.client.on('user-unpublished', this._onUserUnpublished.bind(this));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  GIAI ĐOẠN 1 — PRE-FLIGHT (Lobby): Echo Test
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bắt đầu loopback test.
   * Ghi âm 2 giây rồi phát lại để user tự nghe giọng mình.
   * @throws {Error} nếu mic không khả dụng
   */
  async startEchoTest() {
    const env = checkMicEnvironment();
    if (!env.ok) throw new Error(env.reason);

    try {
      // Tạo track tạm, enable micro
      this.echoTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,   // Acoustic Echo Cancellation
        ANS: true,   // Automatic Noise Suppression
        AGC: true,   // Automatic Gain Control
      });

      // Phát lại cục bộ qua loa/máy để user nghe thấy
      this.echoTrack.play();
      return true;
    } catch (err) {
      this.stopEchoTest();
      throw new Error(getMicErrorReason(err));
    }
  }

  /**
   * Dừng loopback test và giải phóng track tạm.
   */
  stopEchoTest() {
    if (this.echoTrack) {
      this.echoTrack.close();
      this.echoTrack = null;
    }
  }

  /**
   * Lấy mức âm lượng từ echo track (dùng trong lobby test).
   */
  getEchoVolume() {
    if (!this.echoTrack) return 0;
    try {
      return this.echoTrack.getVolumeLevel();
    } catch {
      return 0;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  GIAI ĐOẠN 2 — VÀO PHÒNG: SUBSCRIBER mặc định (mic bị khóa)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tham gia kênh Agora với vai trò SUBSCRIBER.
   * Người dùng chỉ nghe được, mic bị khóa hoàn toàn ở mức OS.
   *
   * @param {string} channelName  - roomId
   * @param {string} token       - Agora token (đã sinh sẵn với role tương ứng)
   * @param {number} uid
   * @param {'subscriber'|'publisher'} role
   * @returns {Promise<{success: boolean, micGranted: boolean, error?: string}>}
   */
  async join(channelName, token, uid, role = 'subscriber') {
    this.currentRole = role;
    this.isJoined = false;
    this.micGranted = false;

    try {
      // Join channel — chưa cần mic ở bước này
      await this.client.join(APP_ID, channelName, token, uid);
      console.log('[Agora] Joined channel as', role, ':', channelName);
      this.isJoined = true;

      // Thử lấy quyền mic (nếu là publisher — Mentor/Host)
      if (role === 'publisher') {
        try {
          this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true, ANS: true, AGC: true,
          });
          await this.client.publish([this.localAudioTrack]);
          this.localAudioTrack.setMuted(true); // Host có thể tự mute
          this.micGranted = true;
          console.log('[Agora] Publisher mic track ready (muted by default)');
        } catch (micErr) {
          console.warn('[Agora] Publisher mic error:', micErr.message);
          this.micGranted = false;
        }
      }

      return { success: true, micGranted: this.micGranted };
    } catch (err) {
      console.error('[Agora] Join failed:', err);
      throw err;
    }
  }

  _onUserPublished(user, mediaType) {
    if (mediaType === 'audio') {
      this.client.subscribe(user, mediaType).then(() => {
        user.audioTrack?.play();
        this.remoteUsers[user.uid] = user;
      });
    }
  }

  _onUserUnpublished(user) {
    delete this.remoteUsers[user.uid];
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  GIAI ĐOẠN 3 — CHUYỂN ROLE: SUBSCRIBER ↔ PUBLISHER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Chuyển từ SUBSCRIBER → PUBLISHER.
   * Được gọi khi Mentor duyệt mở mic.
   *
   * @param {string} newToken - Agora token mới với role=PUBLISHER (từ server)
   * @returns {Promise<boolean>}
   */
  async switchToPublisher(newToken) {
    if (this.currentRole === 'publisher') return true;
    if (!this.isJoined) return false;

    try {
      // Set role trước (Agora SDK thay đổi privilege)
      await this.client.setClientRole('publisher');

      // Nếu chưa có track, tạo mới (SUBSCRIBER không có track)
      if (!this.localAudioTrack) {
        try {
          this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true, ANS: true, AGC: true,
          });
        } catch (micErr) {
          console.warn('[Agora] Could not create mic track:', micErr.message);
          return false;
        }
      }

      await this.client.publish([this.localAudioTrack]);
      this.localAudioTrack.setMuted(false);
      this.currentRole = 'publisher';
      this.micGranted = true;
      console.log('[Agora] Switched to PUBLISHER — mic OPEN');
      return true;
    } catch (err) {
      console.error('[Agora] Switch to publisher failed:', err);
      return false;
    }
  }

  /**
   * Chuyển từ PUBLISHER → SUBSCRIBER.
   * Được gọi khi Mentor thu hồi mic hoặc hết lượt phát biểu.
   */
  async switchToSubscriber() {
    if (this.currentRole === 'subscriber') return true;
    if (!this.isJoined) return false;

    try {
      // Tắt track trước khi hạ role
      if (this.localAudioTrack) {
        this.localAudioTrack.setMuted(true);
      }

      await this.client.setClientRole('audience');
      this.currentRole = 'subscriber';
      this.micGranted = false;
      console.log('[Agora] Switched to SUBSCRIBER — mic LOCKED');
      return true;
    } catch (err) {
      console.error('[Agora] Switch to subscriber failed:', err);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ĐIỀU KHIỂN MIC (chỉ hoạt động khi đang là publisher)
  // ─────────────────────────────────────────────────────────────────────────

  setMute(isMuted) {
    if (this.localAudioTrack && this.currentRole === 'publisher') {
      this.localAudioTrack.setMuted(isMuted);
    }
  }

  getVolumeLevel() {
    if (this.localAudioTrack) {
      try { return this.localAudioTrack.getVolumeLevel(); } catch { /* noop */ }
    }
    if (this.echoTrack) {
      try { return this.echoTrack.getVolumeLevel(); } catch { /* noop */ }
    }
    return 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  RỜI PHÒNG
  // ─────────────────────────────────────────────────────────────────────────

  async leave() {
    this.stopEchoTest();
    if (this.localAudioTrack) {
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }
    if (this.isJoined) {
      try { await this.client.leave(); } catch { /* noop */ }
    }
    this.remoteUsers = {};
    this.isJoined = false;
    this.currentRole = null;
    this.micGranted = false;
  }
}

export default new AgoraService();
