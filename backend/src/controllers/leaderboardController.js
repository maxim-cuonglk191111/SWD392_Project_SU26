/**
 * leaderboardController.js
 *
 * In-memory leaderboard — prototype only.
 * Production: replace with .NET Analytics Service or use Redis.
 *
 * Tracks:
 *   - Total sessions attended (as LUCY)
 *   - Total sessions hosted (as LUCY Pro)
 *   - Total podcasts created (as LUCY Super)
 *   - Total coins earned (as LUCY Pro)
 *   - Total coins spent (as LUCY)
 *   - Total gifts received
 *   - Average AI score received
 *   - Days active
 */

const { v4: uuidv4 } = require('uuid');

// ─── In-memory stats store ────────────────────────────────────────────────────
// stats: Map<userId, LeaderboardEntry>
const stats = new Map();
const sessions = []; // completed room sessions

function getStats(userId) {
  if (!stats.has(userId)) {
    stats.set(userId, {
      userId,
      username: 'Anonymous',
      role: 'LUCY',
      sessionsAttended: 0,
      sessionsHosted: 0,
      podcastsCreated: 0,
      coinsEarned: 0,
      coinsSpent: 0,
      giftsReceived: 0,
      giftsSent: 0,
      avgAiScore: 0,
      aiScoresCount: 0,
      daysActive: new Set(),
      lastActiveAt: null,
    });
  }
  return stats.get(userId);
}

// ─── Record session attendance ─────────────────────────────────────────────────
function recordSession({ userId, username, role, roomId, language, level, isHost }) {
  sessions.push({ id: uuidv4(), userId, roomId, language, level, isHost, at: new Date().toISOString() });

  const s = getStats(userId);
  s.username = username || s.username;
  s.role = role || s.role;
  if (isHost) s.sessionsHosted++;
  else s.sessionsAttended++;
  s.lastActiveAt = new Date().toISOString();
  s.daysActive.add(new Date().toISOString().slice(0, 10));
}

// ─── Record gift received ─────────────────────────────────────────────────────
function recordGiftReceived(userId, amount) {
  const s = getStats(userId);
  s.giftsReceived++;
  s.coinsEarned += amount;
}

// ─── Record gift sent ─────────────────────────────────────────────────────────
function recordGiftSent(userId, amount) {
  const s = getStats(userId);
  s.giftsSent++;
  s.coinsSpent += amount;
}

// ─── Record AI score ──────────────────────────────────────────────────────────
function recordAiScore(userId, score) {
  const s = getStats(userId);
  s.aiScoresCount++;
  s.avgAiScore = ((s.avgAiScore * (s.aiScoresCount - 1)) + score) / s.aiScoresCount;
}

// ─── Record podcast creation ─────────────────────────────────────────────────
function recordPodcast(userId) {
  const s = getStats(userId);
  s.podcastsCreated++;
}

// ─── GET /api/leaderboard/ ───────────────────────────────────────────────────
async function getLeaderboard(req, res) {
  const { category = 'all', period = 'all', limit = 20, language } = req.query;

  let entries = Array.from(stats.values()).map(s => ({
    ...s,
    daysActive: s.daysActive.size,
    rank: 0,
  }));

  // Filter by language if provided (sessions only)
  if (language) {
    entries = entries.filter(e => sessions.some(s => s.userId === e.userId && s.language === language));
  }

  // Sort by category
  switch (category) {
    case 'sessions':     entries.sort((a, b) => (b.sessionsHosted + b.sessionsAttended) - (a.sessionsHosted + a.sessionsAttended)); break;
    case 'coins':        entries.sort((a, b) => (b.coinsEarned - b.coinsSpent) - (a.coinsEarned - a.coinsSpent)); break;
    case 'gifts':        entries.sort((a, b) => b.giftsReceived - a.giftsReceived); break;
    case 'ai_score':     entries.sort((a, b) => b.avgAiScore - a.avgAiScore); break;
    case 'podcasts':     entries.sort((a, b) => b.podcastsCreated - a.podcastsCreated); break;
    default:             entries.sort((a, b) => (b.coinsEarned + b.sessionsHosted * 10 + b.giftsReceived * 5) - (a.coinsEarned + a.sessionsHosted * 10 + a.giftsReceived * 5));
  }

  // Assign ranks
  entries.forEach((e, i) => { e.rank = i + 1; });

  return res.json({
    category,
    period,
    total: entries.length,
    leaderboard: entries.slice(0, Math.min(parseInt(limit), 100)),
  });
}

// ─── GET /api/leaderboard/me ──────────────────────────────────────────────────
async function getMyRank(req, res) {
  const userId = req.user.uid;
  const s = getStats(userId);

  const all = Array.from(stats.values());
  const sorted = all.sort((a, b) =>
    (b.coinsEarned + b.sessionsHosted * 10 + b.giftsReceived * 5) -
    (a.coinsEarned + a.sessionsHosted * 10 + a.giftsReceived * 5)
  );
  const rank = sorted.findIndex(e => e.userId === userId) + 1;

  return res.json({
    userId,
    username: s.username,
    role: s.role,
    rank,
    total: sorted.length,
    stats: { ...s, daysActive: s.daysActive.size },
  });
}

// ─── GET /api/leaderboard/history ────────────────────────────────────────────
async function getSessionHistory(req, res) {
  const userId = req.user.uid;
  const { limit = 20 } = req.query;
  const userSessions = sessions
    .filter(s => s.userId === userId)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, parseInt(limit));

  return res.json({ userId, total: userSessions.length, sessions: userSessions });
}

module.exports = { getLeaderboard, getMyRank, getSessionHistory, recordSession, recordGiftReceived, recordGiftSent, recordAiScore, recordPodcast };
