/**
 * config.js — Cấu hình URL động cho Local và Deploy (Render.com)
 *
 * Local:  http://localhost  → gọi trực tiếp backend tại port 5000
 * Render: https://xxx.onrender.com → API calls qua nginx proxy (cùng origin)
 */

const isLocalhost = () => {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
};

// ─── Backend REST API + Socket URL ──────────────────────────────────────────────
// VITE_BACKEND_URL chỉ dùng cho local dev (localhost:5000)
// Production: để trống → dùng relative URL → cùng origin với nginx proxy
export const BACKEND_URL = (() => {
  const configured = import.meta.env.VITE_BACKEND_URL;
  if (configured) return configured;
  return isLocalhost() ? 'http://localhost:5000' : '';
})();

// ─── Identity Service URL ───────────────────────────────────────────────────────
// Production: localhost:5000 → config.js replace thành onrender.com:5000
// Port 5000 không public → phải qua nginx proxy /api/auth/ → backend → identity-service
// Local: http://localhost:5064 (gọi trực tiếp .NET service)
export const IDENTITY_URL = (() => {
  const configured = import.meta.env.VITE_IDENTITY_URL;
  if (configured) {
    if (!isLocalhost()) {
      return configured.replace('localhost', window.location.hostname).replace('127.0.0.1', window.location.hostname);
    }
    return configured;
  }
  return isLocalhost() ? 'http://localhost:5064' : BACKEND_URL;
})();

// ─── Socket.IO URL ──────────────────────────────────────────────────────────────
// Production: dùng cùng origin (nginx proxy /socket.io/ → backend)
// Local: localhost:5000
export const SOCKET_URL = isLocalhost()
  ? (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000')
  : (BACKEND_URL || window.location.origin);
