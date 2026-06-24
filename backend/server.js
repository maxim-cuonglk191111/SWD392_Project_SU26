const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { setupSockets, activeRooms } = require('./src/socket');
const { generateRtcToken } = require('./src/agoraToken');

// ─── API Routes ─────────────────────────────────────────────────────────────────
const authRoutes         = require('./src/routes/authRoutes');
const walletRoutes       = require('./src/routes/walletRoutes');
const lmsRoutes          = require('./src/routes/lmsRoutes');
const leaderboardRoutes  = require('./src/routes/leaderboardRoutes');
const podcastRoutes      = require('./src/routes/podcastRoutes');
const roomRoutes         = require('./src/routes/roomRoutes');

// ─── Express setup ─────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'lucy_dev_secret_fallback_2026';

// Trust Nginx reverse proxy
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Register API routes ──────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/wallet',      walletRoutes);
app.use('/api/lms',         lmsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/podcast',     podcastRoutes);
app.use('/api/rooms',       roomRoutes);

// ─── Identity-service proxy (used in socket gift proxy) ─────────────────────────
let IDENTITY_BASE = process.env.IDENTITY_SERVICE_URL || 'http://localhost:5064';

// ─── Agora Token endpoint ─────────────────────────────────────────────────────────
app.get('/api/token', (req, res) => {
  const channelName = req.query.channelName || 'test-room';
  const uid = req.query.uid || 0;
  const role = req.query.role === 'publisher' ? 'publisher' : 'subscriber';
  try {
    const token = generateRtcToken(channelName, uid, role);
    res.json({ token, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Evaluation (stub — replace with OpenAI/Claude later) ──────────────────────
app.post('/api/ai/evaluate', async (req, res) => {
  const { language, level, stage, transcript } = req.body;
  if (!transcript) return res.status(400).json({ error: 'transcript is required' });

  const suggestions = getAiSuggestions(language, level, stage);
  const feedback   = generateFeedback(transcript, level);
  res.json({ feedback, suggestions, score: estimateScore(transcript, level) });
});

function getAiSuggestions(language, level, stage) {
  const topics = {
    english: [
      'What is your favorite hobby and why?',
      'Describe a memorable trip you have taken.',
      'What do you think about environmental protection?',
      'Share your opinion on social media impact.',
      'Discuss a book or movie that changed your perspective.',
      'Talk about your career goals for the next 5 years.',
    ],
    chinese: [
      '请介绍一下你自己',
      '你最喜欢的中国菜是什么？',
      '谈谈你的家庭',
      '你学中文的原因是什么？',
      '描述你理想中的工作',
      '你怎么看现在的科技发展？',
    ],
    japanese: [
      '自己紹介してください',
      'お気に入り食べ物は何ですか？',
      '日本の文化について話してください',
      '日本語を勉強する理由を教えてください',
      '将来の夢を話してください',
      '日本のアニメや漫画についてどう思いますか？',
    ],
  };
  const list = topics[language] || topics.english;
  return list[(stage - 1) % list.length];
}

function generateFeedback(transcript, level) {
  const words = transcript.trim().split(/\s+/).length;
  const hasOpinion = /\b(I think|I believe|In my opinion|私は|我觉得)\b/i.test(transcript);
  if (words < 10)  return 'Try to speak a bit more. Even short sentences help build your confidence!';
  if (words < 30)  return 'Good start! Try to elaborate more on your ideas with examples.';
  if (hasOpinion)  return 'Excellent! You expressed your opinion clearly with good detail. Keep it up!';
  return 'Good effort! Try to add more personal opinions and examples to make your response richer.';
}

function estimateScore(transcript, level) {
  let score = 60;
  const words = transcript.trim().split(/\s+/).length;
  if (words > 20)  score += 10;
  if (words > 50)  score += 10;
  if (/\b(maybe|perhaps|definitely|certainly|absolutely)\b/i.test(transcript)) score += 5;
  if (/\b(however|although|therefore|because|でも|しかし|因为)\b/i.test(transcript)) score += 10;
  return Math.min(100, score);
}

// ─── File uploads ─────────────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage() });

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadMaterial = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, Word, Excel, PowerPoint, Text or image files allowed!'));
  },
});

app.post('/api/syllabus/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const lines = req.file.buffer.toString('utf-8').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const customStages = {};

    lines.forEach(line => {
      const match = line.match(/Stage\s*(\d+)\s*:\s*(.*)/i);
      if (match) {
        customStages[parseInt(match[1])] = match[2].trim();
      }
    });

    const roomId = req.body.roomId || 'lisa-stage-1';
    const room = activeRooms[roomId];
    if (room) { room.updateSyllabus(customStages); return res.json({ success: true, parsedStages: customStages }); }
    return res.status(404).json({ error: 'Room not found or not active' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/materials/upload', (req, res, next) => {
  uploadMaterial.single('file')(req, res, err => {
    if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Upload error: ' + err.message });
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { roomId, uploadedBy } = req.body;
  if (!roomId) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'roomId is required' }); }

  try {
    const room = activeRooms[roomId];
    if (!room) { fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'Room not found or inactive' }); }

    const { v4: uuidv4 } = require('uuid');
    const material = {
      id: uuidv4(),
      name: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
      uploadedBy: uploadedBy || 'Anonymous',
      uploadedAt: new Date(),
    };
    room.addMaterial(material);
    res.json({ success: true, material });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/materials/:roomId/:id', (req, res) => {
  const room = activeRooms[req.params.roomId];
  if (!room) return res.status(404).json({ error: 'Room not found' });

  try {
    const material = room.removeMaterial(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const filePath = path.join(__dirname, 'uploads', material.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check (nginx healthcheck) ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 catch-all ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Socket.IO setup ───────────────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

setupSockets(io);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
