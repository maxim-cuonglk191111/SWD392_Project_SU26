/**
 * roomController.js
 *
 * REST wrappers around Socket.IO room events.
 * Allows polling-based room state queries (fallback when WebSocket unavailable).
 *
 * Also tracks in-memory room metadata for the REST API.
 */

const { v4: uuidv4 } = require('uuid');

// ─── In-memory room metadata store ────────────────────────────────────────────
// roomMeta: Map<roomId, { roomId, language, level, createdAt, hostId, hostName, participantCount }>
const roomMeta = new Map();

// ─── GET /api/rooms/ ─────────────────────────────────────────────────────────
async function listRooms(req, res) {
  const { language, stage } = req.query;
  let rooms = Array.from(roomMeta.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (language) rooms = rooms.filter(r => r.language === language);
  if (stage)   rooms = rooms.filter(r => r.stage === stage);

  return res.json({ total: rooms.length, rooms });
}

// ─── GET /api/rooms/:roomId ──────────────────────────────────────────────────
async function getRoom(req, res) {
  const meta = roomMeta.get(req.params.roomId);
  if (!meta) return res.status(404).json({ error: 'Room not found' });
  return res.json(meta);
}

// ─── POST /api/rooms/ ────────────────────────────────────────────────────────
async function createRoom(req, res) {
  const { roomId, language, level, stage, title } = req.body;
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });

  if (roomMeta.has(roomId)) {
    return res.status(409).json({ error: 'Room already exists' });
  }

  const meta = {
    roomId,
    language: language || 'english',
    level: parseInt(level) || 1,
    stage: stage || 'Sơ cấp',
    title: title || `Room ${roomId}`,
    hostId: req.user?.uid || 'unknown',
    hostName: req.user?.name || 'Anonymous',
    participantCount: 1,
    createdAt: new Date().toISOString(),
  };

  roomMeta.set(roomId, meta);

  return res.status(201).json({ room: meta, message: 'Room metadata registered' });
}

// ─── Internal: update participant count ─────────────────────────────────────────
function updateParticipantCount(roomId, delta) {
  const meta = roomMeta.get(roomId);
  if (meta) meta.participantCount = Math.max(0, (meta.participantCount || 0) + delta);
}

// ─── Internal: register host ───────────────────────────────────────────────────
function registerHost(roomId, hostId, hostName) {
  const meta = roomMeta.get(roomId) || {};
  meta.hostId = hostId;
  meta.hostName = hostName;
  roomMeta.set(roomId, meta);
}

module.exports = { listRooms, getRoom, createRoom, updateParticipantCount, registerHost };
