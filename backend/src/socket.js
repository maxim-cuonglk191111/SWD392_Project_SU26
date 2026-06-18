const { v4: uuidv4 } = require('uuid');
const { RoomContext } = require('./patterns/StageState');

const users = {}; // Map of socketId to user info
const activeRooms = {}; // Map of roomId to RoomContext

function setupSockets(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Provide an anonymous identity upon connection
    const anonymousName = `User ${Math.floor(Math.random() * 10000)}`;
    users[socket.id] = {
      id: socket.id,
      name: anonymousName,
      isMuted: true,
      isHandRaised: false
    };

    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      users[socket.id].roomId = roomId;
      
      // Initialize room logic if it doesn't exist
      if (!activeRooms[roomId]) {
        const room = new RoomContext(roomId);
        activeRooms[roomId] = room;

        // Observer Pattern: Lắng nghe sự kiện từ RoomContext và phát sóng qua Socket
        room.on('stage-changed', (data) => {
          io.to(roomId).emit('stage-changed', data);
        });

        room.on('timer-update', (data) => {
          io.to(roomId).emit('timer-update', data);
        });

        room.on('room-finished', (data) => {
          io.to(roomId).emit('room-finished', data);
          delete activeRooms[roomId];
        });
      }
      
      // Send the current user their identity
      socket.emit('your-info', users[socket.id]);

      // Gửi trạng thái stage hiện tại cho user mới join
      const currentRoom = activeRooms[roomId];
      socket.emit('stage-changed', {
        stage: currentRoom.currentStageIndex,
        timeLeft: currentRoom.timeLeft,
        topic: currentRoom.currentState.getTopic()
      });

      // Broadcast updated user list to the room
      const roomUsers = Object.values(users).filter(u => u.roomId === roomId);
      io.to(roomId).emit('room-users', roomUsers);
    });

    socket.on('toggle-mute', () => {
      const user = users[socket.id];
      if (user) {
        user.isMuted = !user.isMuted;
        io.to(user.roomId).emit('user-updated', user);
      }
    });

    socket.on('toggle-hand', () => {
      const user = users[socket.id];
      if (user) {
        user.isHandRaised = !user.isHandRaised;
        io.to(user.roomId).emit('user-updated', user);
      }
    });

    // Ping-pong for latency measurement
    socket.on('ping', (clientTime) => {
      socket.emit('pong', clientTime);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const user = users[socket.id];
      if (user && user.roomId) {
        delete users[socket.id];
        const roomUsers = Object.values(users).filter(u => u.roomId === user.roomId);
        io.to(user.roomId).emit('room-users', roomUsers);
      }
    });
  });
}

module.exports = { setupSockets };
