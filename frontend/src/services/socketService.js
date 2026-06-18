import { io } from 'socket.io-client';

// Connect to the backend server (ensure this URL matches the backend when deploying)
const SOCKET_URL = 'http://localhost:5000'; 

class SocketService {
  constructor() {
    this.socket = io(SOCKET_URL, { autoConnect: false });
    this.pingInterval = null;
    this.latencyCallback = null;

    this.socket.on('connect', () => {
      console.log('Connected to socket server');
      this.startPing();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
      this.stopPing();
    });

    this.socket.on('pong', (clientTime) => {
      const latency = Date.now() - clientTime;
      if (this.latencyCallback) {
        this.latencyCallback(latency);
      }
    });
  }

  connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  startPing() {
    this.pingInterval = setInterval(() => {
      this.socket.emit('ping', Date.now());
    }, 2000);
  }

  stopPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  setLatencyCallback(callback) {
    this.latencyCallback = callback;
  }

  joinRoom(roomId) {
    this.socket.emit('join-room', roomId);
  }

  toggleMute() {
    this.socket.emit('toggle-mute');
  }

  toggleHand() {
    this.socket.emit('toggle-hand');
  }

  on(event, callback) {
    this.socket.on(event, callback);
  }

  off(event) {
    this.socket.off(event);
  }
}

export default new SocketService();
