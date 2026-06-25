# =========================================================
# LUCY — Monolith Container (React Frontend + Express Backend)
# =========================================================

# ── Frontend Build Stage ──
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Backend Build Stage ──
FROM node:20-alpine AS backend-build
RUN apk add --no-cache openssl
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
RUN npx prisma generate
RUN npm run build
# Create and seed SQLite database
RUN npx prisma db push --accept-data-loss
RUN npx tsx prisma/seed.ts
RUN npx tsx prisma/seed_levels.ts
# Prune development dependencies to keep the image slim
RUN npm prune --production

# ── Final Monolith Stage ──
FROM node:20-alpine AS monolith

# Install Nginx, Supervisor, OpenSSL, and Bash (required for supervisor task management)
RUN apk add --no-cache nginx supervisor bash openssl && \
    mkdir -p /var/log/supervisor /var/run/nginx /var/log/nginx

# Copy React static files to Nginx public html directory
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copy Node.js backend files and production dependencies
COPY --from=backend-build /app/backend /app/backend

# Copy custom configuration files
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisord.conf

# Expose Nginx port
EXPOSE 8080

# Production environment settings
ENV PORT=3000
ENV NODE_ENV=production

# Health check endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

# Start Nginx and Express via Supervisor
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
