import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { initSocket } from './socket/handler';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import levelRoutes from './routes/levels';
import roomRoutes from './routes/rooms';
import giftRoutes from './routes/gifts';
import walletRoutes from './routes/wallet';
import podcastRoutes from './routes/podcasts';
import progressRoutes from './routes/progress';
import documentRoutes from './routes/documents';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'LUCY API' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/levels', levelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/gifts', giftRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/podcasts', podcastRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/documents', documentRoutes);

// Avatar static files
app.use('/avatars', express.static('public/avatars'));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.io
initSocket(httpServer);

// Start server
httpServer.listen(config.port, () => {
  console.log(`\n🎙️  LUCY API Server — Language Unity & Collaborative Youth`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  HTTP:      http://localhost:${config.port}`);
  console.log(`  WebSocket: ws://localhost:${config.port}`);
  console.log(`  Health:    http://localhost:${config.port}/health`);
  console.log(`  Mode:      ${config.nodeEnv}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});

export { app, httpServer };
