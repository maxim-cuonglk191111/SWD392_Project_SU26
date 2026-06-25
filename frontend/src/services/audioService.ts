/**
 * AudioService — MediaRecorder capture + AudioContext playback
 * Cho phép nhiều người cùng nói và nghe real-time qua Socket.io
 */

export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private speakers: Map<string, { source: MediaStreamAudioSourceNode; gain: GainNode }> = new Map();
  private outputGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private chunks: Blob[] = [];
  private onChunkCallbacks: Array<(chunk: ArrayBuffer, mimeType: string) => void> = [];

  // Trạng thái
  private _isCapturing = false;
  private _isMuted = true;

  get isCapturing() { return this._isCapturing; }
  get isMuted() { return this._isMuted; }

  /**
   * Yêu cầu quyền micro và khởi tạo AudioContext
   */
  async init(): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      // AudioContext để xử lý playback
      this.audioContext = new AudioContext({ sampleRate: 48000 });

      // Gain node cho volume tổng
      this.outputGain = this.audioContext.createGain();
      this.outputGain.gain.value = 1;
      this.outputGain.connect(this.audioContext.destination);

      // Analyser để hiển thị waveform
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.outputGain);

      // Resume context nếu suspended (do browser policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return true;
    } catch (err) {
      console.error('[Audio] Init failed:', err);
      return false;
    }
  }

  /**
   * Bắt đầu capture âm thanh từ micro
   * Gửi chunk qua callback mỗi khi có dữ liệu
   */
  startCapture(onChunk: (chunk: ArrayBuffer, mimeType: string) => void) {
    if (!this.stream || this._isCapturing) return;

    this.onChunkCallbacks.push(onChunk);
    this._isMuted = false;

    // Tạo MediaRecorder với codec tốt nhất có thể
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg;codecs=opus';

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        e.data.arrayBuffer().then((buffer) => {
          this.onChunkCallbacks.forEach((cb) => cb(buffer, mimeType));
        });
      }
    };

    // Thu chunk mỗi 200ms để giảm độ trễ
    this.mediaRecorder.start(200);
    this._isCapturing = true;

    console.log(`[Audio] Capture started with ${mimeType}`);
  }

  /**
   * Dừng capture — giữ AudioContext để playback
   */
  stopCapture() {
    if (this.mediaRecorder && this._isCapturing) {
      this.mediaRecorder.stop();
      this._isCapturing = false;
      this._isMuted = true;
    }
  }

  /**
   * Toggle mute/unmute micro (không cần khởi tạo lại)
   */
  setMuted(muted: boolean) {
    if (!this.stream) return;
    this.stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this._isMuted = muted;

    if (muted) {
      this.stopCapture();
    } else {
      this.startCapture(this.onChunkCallbacks[0] || (() => {}));
    }
  }

  /**
   * Phát âm thanh từ một participant khác
   * Mỗi user có 1 source riêng để có thể quản lý volume riêng
   */
  playAudioChunk(userId: string, chunk: ArrayBuffer, mimeType: string) {
    if (!this.audioContext || !this.outputGain) return;

    // Nếu context bị suspended (do tab inactive), resume
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.audioContext.decodeAudioData(chunk.slice(0), (buffer) => {
      const source = this.audioContext!.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputGain!);
      source.start(0);
    }, (err) => {
      console.warn('[Audio] Decode error:', err);
    });
  }

  /**
   * Phát blob audio trực tiếp (cho trường hợp blob URL)
   */
  playBlob(blobUrl: string) {
    const audio = new Audio(blobUrl);
    audio.play().catch(console.warn);
  }

  /**
   * Lấy dữ liệu waveform cho visualizer
   */
  getAnalyserData(): Uint8Array | null {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  /**
   * Lấy tần số cho visualizer
   */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /**
   * Ghi âm toàn bộ session (cho podcast)
   */
  startSessionRecording(): void {
    this.chunks = [];
    if (this.stream) {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(this.stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      recorder.start(1000); // chunk mỗi giây
      (this as any)._sessionRecorder = recorder;
    }
  }

  /**
   * Kết thúc ghi âm, trả về Blob
   */
  async stopSessionRecording(): Promise<Blob | null> {
    const recorder = (this as any)._sessionRecorder as MediaRecorder | undefined;
    if (!recorder) return null;

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType });
        this.chunks = [];
        resolve(blob);
      };
      recorder.stop();
    });
  }

  /**
   * Dọn dẹp tất cả tài nguyên
   */
  destroy() {
    this.stopCapture();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close();
    this.speakers.clear();
    this.mediaRecorder = null;
    this.stream = null;
    this.audioContext = null;
    this.outputGain = null;
    this.analyser = null;
  }
}

export const audioService = new AudioService();
