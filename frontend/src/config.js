/**
 * config.js — Cấu hình URL động cho Local và Deploy
 *
 * Local:  http://localhost  → gọi trực tiếp backend tại port 5000
 * Deploy: https://xxx.onrender.com → /api/* → nginx proxy → backend :5000
 *
 * VITE_BACKEND_URL / VITE_IDENTITY_URL bỏ trống = dùng same-origin proxy
 */

const isLocalhost = () => {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
};

// ─── Backend REST API + Socket URL ────────────────────────────
// Deploy: VITE_BACKEND_URL trống → relative URL → nginx proxy /api/*
// Local:  gọi trực tiếp port 5000
export const BACKEND_URL = isLocalhost()
  ? (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000')
  : '';

// ─── Identity Service URL ─────────────────────────────────────
// Deploy: dùng same-origin /identity/* proxy → nginx → .NET :5064
// Local:  gọi trực tiếp .NET service
export const IDENTITY_URL = isLocalhost()
  ? (import.meta.env.VITE_IDENTITY_URL || 'http://localhost:5064')
  : '';

// ─── Socket.IO URL ────────────────────────────────────────────
// Deploy: dùng cùng origin → nginx proxy /socket.io/*
// Local:  localhost:5000
export const SOCKET_URL = isLocalhost()
  ? (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000')
  : window.location.origin;
