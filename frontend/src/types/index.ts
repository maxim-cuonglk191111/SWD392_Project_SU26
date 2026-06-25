export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarId: number;
  role: 'LUCY' | 'PRO' | 'SUPER';
  bio?: string;
  xp: number;
  coin: number;
  isAnonymous: boolean;
  createdAt: string;
}

export interface Level {
  id: string;
  language: string;
  stage: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  levelNumber: number;
  title: string;
  titleZh?: string;
  titleJp?: string;
  description?: string;
  duration: number;
  subLevels?: SubLevel[];
}

export interface SubLevel {
  index: number;
  title: string;
  topics: string[];
  durationMinutes: number;
}

export interface Room {
  id: string;
  title: string;
  description?: string;
  levelId?: string;
  hostId: string;
  language: string;
  maxParticipants: number;
  currentCount: number;
  status: 'WAITING' | 'ACTIVE' | 'ENDED';
  stage: string;
  currentSubLevel: number;
  isLocked: boolean;
  isRecording: boolean;
  createdAt: string;
  host: Pick<User, 'id' | 'username' | 'displayName' | 'avatarId' | 'role'>;
  level?: Pick<Level, 'id' | 'language' | 'stage' | 'levelNumber' | 'title' | 'subLevels'>;
  participants?: Participant[];
}

export interface Participant {
  id: string;
  username: string;
  displayName: string;
  avatarId: number;
  role: 'LISTENER' | 'SPEAKER' | 'MODERATOR' | 'HOST';
  handRaised: boolean;
  isMuted: boolean;
  isSpeaker: boolean;
}

export interface Message {
  id: string;
  roomId: string;
  content: string;
  type: 'TEXT' | 'AUDIO' | 'GIFT' | 'SYSTEM';
  createdAt: string;
  user?: Pick<User, 'id' | 'username' | 'displayName' | 'avatarId' | 'role'>;
}

export interface Gift {
  id: string;
  name: string;
  emoji: string;
  coinCost: number;
  imageUrl?: string;
}

export interface Podcast {
  id: string;
  roomId: string;
  hostId: string;
  title: string;
  description?: string;
  audioUrl?: string;
  duration: number;
  viewCount: number;
  isPremium: boolean;
  price: number;
  status: 'RECORDING' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  host: Pick<User, 'id' | 'username' | 'displayName' | 'avatarId' | 'role'>;
  room?: { id: string; title: string; language: string };
}

export interface UserProgress {
  id: string;
  userId: string;
  levelId: string;
  status: 'LOCKED' | 'UNLOCKED' | 'COMPLETED';
  score: number;
  completedAt?: string;
  level: Pick<Level, 'id' | 'language' | 'stage' | 'levelNumber' | 'title'>;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balance: number;
  note?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  originalName: string;
  fileType: string;
  language?: string;
  status: 'PENDING' | 'PARSED' | 'FAILED';
  createdAt: string;
  parsedLevels?: Level[];
}
