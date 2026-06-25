import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'lucy-super-secret-key-2026-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  bcryptSaltRounds: 12,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};

export const USER_ROLES = { LUCY: 'LUCY', PRO: 'PRO', SUPER: 'SUPER' } as const;
export const LANGUAGES = { EN: 'EN', ZH: 'ZH', JP: 'JP' } as const;
export const STAGES = { BEGINNER: 'BEGINNER', INTERMEDIATE: 'INTERMEDIATE', ADVANCED: 'ADVANCED' } as const;
export const ROOM_STATUS = { WAITING: 'WAITING', ACTIVE: 'ACTIVE', ENDED: 'ENDED' } as const;
export const PARTICIPANT_ROLES = { LISTENER: 'LISTENER', SPEAKER: 'SPEAKER', MODERATOR: 'MODERATOR', HOST: 'HOST' } as const;
export const AVATAR_COUNT = 50;
