/**
 * authController.js
 *
 * In-memory user store — prototype only.
 * Production: replace with .NET Identity Service at IDENTITY_SERVICE_URL.
 *
 * User roles:
 *   LUCY       — anonymous learner (auto-created on first anonymous login)
 *   LUCY Pro   — mentor, must register with email
 *   LUCY Super — content creator, must register with email + payment info
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');

// ─── In-memory user store (prototype) ─────────────────────────────────────────
const users = new Map();   // userId → { userId, email, username, role, passwordHash, createdAt }
const sessions = new Map(); // token → userId

const ROLE_LEVELS = { LUCY: 1, 'LUCY Pro': 2, 'LUCY Super': 3 };

function hashPassword(pw) {
  // Simple hash for prototype — use bcrypt in production (.NET service)
  return Buffer.from(pw).toString('base64');
}

function verifyPassword(pw, hash) {
  return hashPassword(pw) === hash;
}

// ─── Register (LUCY Pro / LUCY Super only) ───────────────────────────────────
async function register(req, res) {
  const { email, username, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!['LUCY Pro', 'LUCY Super'].includes(role)) {
    return res.status(400).json({ error: 'role must be "LUCY Pro" or "LUCY Super"' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Check duplicate email
  for (const u of users.values()) {
    if (u.email === email) {
      return res.status(409).json({ error: 'Email already registered' });
    }
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const passwordHash = hashPassword(password);

  const user = { userId, email, username: username || email.split('@')[0], role, passwordHash, createdAt: new Date().toISOString() };
  users.set(userId, user);

  const token = jwt.sign({ uid: userId, role, name: user.username, email }, JWT_SECRET, { expiresIn: '7d' });
  sessions.set(token, userId);

  console.log(`[Auth] Registered: ${role} ${email} (${userId})`);

  return res.status(201).json({
    token,
    userId,
    role,
    username: user.username,
    message: `Welcome ${role}! Your account is ready.`,
  });
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(req, res) {
  const { email, password, role: loginRole } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Find user by email
  let user = null;
  for (const u of users.values()) {
    if (u.email === email) { user = u; break; }
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ uid: user.userId, role: user.role, name: user.username, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  sessions.set(token, user.userId);

  console.log(`[Auth] Login: ${user.role} ${email}`);

  return res.json({
    token,
    userId: user.userId,
    role: user.role,
    username: user.username,
  });
}

// ─── Anonymous login (LUCY — auto-create guest) ───────────────────────────────
async function anonymousLogin(req, res) {
  const { deviceId, username } = req.body;

  // Find existing guest by deviceId, or create new
  let user = null;
  let userId = null;
  for (const [id, u] of users.entries()) {
    if (u.deviceId === deviceId && u.role === 'LUCY') {
      user = u; userId = id; break;
    }
  }

  if (!user) {
    userId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    user = { userId, deviceId, username: username || `Guest_${userId.slice(-5)}`, role: 'LUCY', createdAt: new Date().toISOString() };
    users.set(userId, user);
  }

  const token = jwt.sign({ uid: userId, role: 'LUCY', name: user.username }, JWT_SECRET, { expiresIn: '24h' });
  sessions.set(token, userId);

  return res.json({
    token,
    userId,
    role: 'LUCY',
    username: user.username,
  });
}

// ─── Get current user profile ─────────────────────────────────────────────────
async function getProfile(req, res) {
  const userId = req.user.uid;
  const user = users.get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    userId: user.userId,
    username: user.username,
    email: user.email || null,
    role: user.role,
    createdAt: user.createdAt,
  });
}

// ─── Update profile ───────────────────────────────────────────────────────────
async function updateProfile(req, res) {
  const userId = req.user.uid;
  const user = users.get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { username, avatarUrl } = req.body;
  if (username) user.username = username;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  return res.json({ userId: user.userId, username: user.username, avatarUrl: user.avatarUrl, role: user.role });
}

// ─── Logout ───────────────────────────────────────────────────────────────────
async function logout(req, res) {
  const token = req.headers['authorization']?.slice(7);
  if (token) sessions.delete(token);
  return res.json({ message: 'Logged out' });
}

module.exports = { register, login, anonymousLogin, getProfile, updateProfile, logout };
