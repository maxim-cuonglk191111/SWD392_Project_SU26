import AgoraRTC from 'agora-rtc-sdk-ng';

const APP_ID = import.meta.env.VITE_AGORA_APP_ID || "YOUR_AGORA_APP_ID"; 

class AgoraService {
  constructor() {
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    this.localAudioTrack = null;
    this.remoteUsers = {};
  }

  async join(channelName, token, uid) {
    try {
      this.client.on('user-published', this.handleUserPublished.bind(this));
      this.client.on('user-unpublished', this.handleUserUnpublished.bind(this));

      await this.client.join(APP_ID, channelName, token, uid);
      
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await this.client.publish([this.localAudioTrack]);
      
      // Initially mute
      this.localAudioTrack.setMuted(true);
      
      console.log('Joined Agora channel successfully');
    } catch (error) {
      console.error('Agora Join Error:', error);
    }
  }

  async handleUserPublished(user, mediaType) {
    await this.client.subscribe(user, mediaType);
    if (mediaType === 'audio') {
      const remoteAudioTrack = user.audioTrack;
      remoteAudioTrack.play();
      this.remoteUsers[user.uid] = user;
    }
  }

  handleUserUnpublished(user) {
    if (this.remoteUsers[user.uid]) {
      delete this.remoteUsers[user.uid];
    }
  }

  setMute(isMuted) {
    if (this.localAudioTrack) {
      this.localAudioTrack.setMuted(isMuted);
    }
  }

  async leave() {
    this.localAudioTrack && this.localAudioTrack.close();
    await this.client.leave();
    this.localAudioTrack = null;
    this.remoteUsers = {};
  }
}

export default new AgoraService();
