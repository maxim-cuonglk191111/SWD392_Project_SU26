const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const { setupSockets } = require('./src/socket');
const { generateRtcToken } = require('./src/agoraToken');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get('/api/token', (req, res) => {
  const channelName = req.query.channelName || 'test-room';
  const uid = req.query.uid || 0;
  try {
    const token = generateRtcToken(channelName, uid);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

setupSockets(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
