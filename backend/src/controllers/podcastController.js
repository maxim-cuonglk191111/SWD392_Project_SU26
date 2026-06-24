/**
 * podcastController.js
 *
 * Recording & Podcast management — LUCY Super only.
 *
 * In-memory store — prototype only.
 * Production: store audio blobs in S3/GCS, metadata in DB.
 *
 * Flow:
 *   POST /api/podcast/start   → starts recording session (returns sessionId)
 *   POST /api/podcast/stop    → stops recording, saves podcast metadata
 *   GET  /api/podcast/        → list all podcasts
 *   GET  /api/podcast/:id     → get podcast detail
 *   GET  /api/podcast/user/:userId → get podcasts by user
 *   POST /api/podcast/:id/purchase → purchase premium content (deducts coins)
 */

const { v4: uuidv4 } = require('uuid');

// ─── In-memory store ─────────────────────────────────────────────────────────
const recordings = new Map(); // sessionId → RecordingSession
const podcasts = [];           // Array<Podcast>

// ─── Recording state machine ──────────────────────────────────────────────────
const recordingState = new Map(); // userId → { sessionId, startedAt, roomId }

// ─── POST /api/podcast/start ─────────────────────────────────────────────────
async function startRecording(req, res) {
  if (req.user.role !== 'LUCY Super') {
    return res.status(403).json({ error: 'Only LUCY Super accounts can create podcasts' });
  }

  const { roomId, language, level, title } = req.body;
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });

  const userId = req.user.uid;
  if (recordingState.has(userId)) {
    return res.status(409).json({ error: 'Recording already in progress', sessionId: recordingState.get(userId).sessionId });
  }

  const sessionId = uuidv4();
  recordings.set(sessionId, {
    sessionId,
    userId,
    username: req.user.name,
    roomId,
    language,
    level,
    title: title || `Podcast ${new Date().toISOString().slice(0, 10)}`,
    startedAt: new Date().toISOString(),
    chunks: 0,
    status: 'recording',
  });

  recordingState.set(userId, { sessionId, startedAt: new Date() });

  console.log(`[Podcast] Recording started: ${sessionId} by ${userId} in room ${roomId}`);

  return res.status(201).json({ sessionId, message: 'Recording started', status: 'recording' });
}

// ─── POST /api/podcast/stop ──────────────────────────────────────────────────
async function stopRecording(req, res) {
  if (req.user.role !== 'LUCY Super') {
    return res.status(403).json({ error: 'Only LUCY Super accounts can create podcasts' });
  }

  const userId = req.user.uid;
  const state = recordingState.get(userId);

  if (!state) {
    return res.status(400).json({ error: 'No recording in progress' });
  }

  const session = recordings.get(state.sessionId);
  if (!session) return res.status(404).json({ error: 'Recording session not found' });

  const durationMs = Date.now() - new Date(state.startedAt).getTime();
  const durationMin = Math.max(1, Math.round(durationMs / 60000));

  const podcast = {
    id: uuidv4(),
    sessionId: state.sessionId,
    userId,
    username: req.user.name,
    roomId: session.roomId,
    language: session.language,
    level: session.level,
    title: session.title,
    durationMin,
    audioUrl: `/uploads/podcasts/${state.sessionId}.webm`, // placeholder path
    isPremium: req.body.isPremium !== false,
    price: req.body.price || 0,
    views: 0,
    likes: 0,
    createdAt: new Date().toISOString(),
    tags: [session.language, `level-${session.level}`].filter(Boolean),
  };

  podcasts.push(podcast);
  recordings.delete(state.sessionId);
  recordingState.delete(userId);

  console.log(`[Podcast] Recording stopped: ${podcast.id} (${durationMin} min) by ${userId}`);

  return res.json({ podcast, message: 'Recording saved as podcast' });
}

// ─── GET /api/podcast/ ───────────────────────────────────────────────────────
async function listPodcasts(req, res) {
  const { language, level, limit = 20, offset = 0 } = req.query;

  let list = [...podcasts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (language) list = list.filter(p => p.language === language);
  if (level)    list = list.filter(p => p.level === parseInt(level));

  return res.json({
    total: list.length,
    podcasts: list.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
  });
}

// ─── GET /api/podcast/user/:userId ───────────────────────────────────────────
async function getUserPodcasts(req, res) {
  const { userId } = req.params;
  const userPods = podcasts.filter(p => p.userId === userId);
  return res.json({ userId, total: userPods.length, podcasts: userPods });
}

// ─── GET /api/podcast/:id ────────────────────────────────────────────────────
async function getPodcast(req, res) {
  const pod = podcasts.find(p => p.id === req.params.id);
  if (!pod) return res.status(404).json({ error: 'Podcast not found' });

  pod.views++;
  return res.json(pod);
}

// ─── POST /api/podcast/:id/like ─────────────────────────────────────────────
async function likePodcast(req, res) {
  const pod = podcasts.find(p => p.id === req.params.id);
  if (!pod) return res.status(404).json({ error: 'Podcast not found' });
  pod.likes++;
  return res.json({ id: pod.id, likes: pod.likes });
}

// ─── POST /api/podcast/:id/purchase ──────────────────────────────────────────
async function purchasePodcast(req, res) {
  const { deductCoins } = require('./walletController');
  const { recordSession } = require('./leaderboardController');

  const pod = podcasts.find(p => p.id === req.params.id);
  if (!pod) return res.status(404).json({ error: 'Podcast not found' });

  const buyerId = req.user.uid;

  // Free podcasts: no purchase needed
  if (pod.price === 0) {
    return res.json({ message: 'Free content — no purchase needed', podcast: pod });
  }

  // Already purchased
  if (pod.purchasedBy?.includes(buyerId)) {
    return res.json({ message: 'Already purchased', podcast: pod });
  }

  const success = deductCoins(buyerId, pod.price);
  if (!success) {
    return res.status(400).json({ error: 'Insufficient balance', required: pod.price });
  }

  // Credit creator
  const { addCoins } = require('./walletController');
  addCoins(pod.userId, pod.price);

  pod.purchasedBy = pod.purchasedBy || [];
  pod.purchasedBy.push(buyerId);

    return res.json({
    message: `Purchased for ${pod.price} coins`,
    podcast: pod,
  });
}

// ─── GET /api/podcast/search ─────────────────────────────────────────────────
async function searchPodcasts(req, res) {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  const query = q.toLowerCase();
  const results = podcasts.filter(p =>
    p.title.toLowerCase().includes(query) ||
    (p.tags || []).some(t => t.toLowerCase().includes(query))
  );

  return res.json({ query: q, total: results.length, results });
}

module.exports = { startRecording, stopRecording, listPodcasts, getUserPodcasts, getPodcast, likePodcast, purchasePodcast, searchPodcasts };
