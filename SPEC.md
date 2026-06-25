# LUCY (Language Unity & Collaborative Youth) — Project Specification

## 1. Project Overview

**Name**: LUCY (Language Unity & Collaborative Youth)
**Type**: Social Audio + EdTech Platform (Web App)
**Stack**: Node.js/TypeScript (Backend) + React/Vite/TypeScript (Frontend)
**Architecture**: Monolithic REST API + Socket.io Gateway
**Target**: Gen Z language learners, mentors, content creators

## 2. Technology Stack

### Backend — `backend/`
- **Runtime**: Node.js 20 LTS + TypeScript 5
- **Framework**: Express.js
- **ORM**: Prisma + SQLite
- **Auth**: JWT + bcryptjs
- **Real-time**: Socket.io
- **File Parsing**: mammoth (Word), pdf-parse (PDF)
- **File Upload**: Multer
- **Validation**: Zod
- **Port**: 3000

### Frontend — `frontend/`
- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context + hooks
- **HTTP**: Axios
- **WebSocket**: socket.io-client
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Port**: 5173 (dev)

## 3. Database Schema (Prisma/SQLite)

### User
`id, email, password, username, displayName, avatarId (1-50), role (LUCY|PRO|SUPER), bio, xp, coin, isAnonymous, isBanned, createdAt, updatedAt`

### Level
`id, language, stage (BEGINNER|INTERMEDIATE|ADVANCED), levelNumber, title, titleZh, titleJp, description, duration, subLevels (JSON), createdAt`

### Room
`id, title, description, levelId, hostId, language, maxParticipants, currentCount, status (WAITING|ACTIVE|ENDED), stage, currentSubLevel, isLocked, isRecording, createdAt, endedAt`

### RoomParticipant
`id, roomId, userId, joinedAt, leftAt, handRaised, isMuted, isSpeaker, role (LISTENER|SPEAKER|MODERATOR|HOST)`

### Message
`id, roomId, userId, content, type (TEXT|AUDIO|GIFT|SYSTEM), createdAt`

### Gift
`id, name, emoji, coinCost, imageUrl, createdAt`

### UserGift
`id, senderId, receiverId, giftId, roomId, createdAt`

### Podcast
`id, roomId, hostId, title, description, audioUrl, duration, viewCount, isPremium, price, status (RECORDING|PUBLISHED|ARCHIVED), createdAt`

### UserProgress
`id, userId, levelId, status (LOCKED|UNLOCKED|COMPLETED), score, completedAt`

### UploadedDocument
`id, originalName, filePath, fileType (docx|pdf), language, parsedLevels (JSON), uploadedBy, status (PENDING|PARSED|FAILED), createdAt`

## 4. User Tiers

### LUCY (Free)
- Anonymous avatar-based participation
- Join rooms by Level
- Raise hand to speak, toggle mic
- Send virtual gifts to Mentors
- Earn XP from participation

### PRO ($9.99/month simulation)
- All LUCY features
- Create rooms based on curriculum
- Pin documents to room
- Manage learner roadmap
- Dashboard to manage participants

### SUPER ($19.99/month simulation)
- All PRO features
- Record live sessions into Podcasts
- Create premium content series
- Revenue from premium subscriptions

## 5. Document Upload & Parsing (Core Feature)

### Supported Formats
- `.docx` — parsed via `mammoth`
- `.pdf` — parsed via `pdf-parse`

### Parsing Logic
1. PRO/SUPER uploads document via `/api/documents/upload`
2. Server saves file to `uploads/` directory
3. Parser extracts text content
4. AI-style rules identify level titles, descriptions, sub-sections
5. Content stored in `UploadedDocument` table as structured JSON
6. Content available for use in live rooms

### Level Structure (from documents)
- Stage 1 (BEGINNER): Levels 1-30 (60 min rooms)
- Stage 2 (INTERMEDIATE): Levels 31-60 (90 min rooms)
- Stage 3 (ADVANCED): Levels 61-100 (120 min rooms)
- Each level: title, description, sub-levels (10-20 min segments)

## 6. API Endpoints

### Auth — `/api/auth`
- `POST /register` — Create account (LUCY/PRO/SUPER role)
- `POST /login` — Login, returns JWT
- `GET /me` — Current user profile

### Users — `/api/users`
- `GET /profile` — Current user profile
- `PUT /profile` — Update profile
- `GET /users/:username` — Public profile
- `GET /leaderboard` — XP leaderboard

### Levels — `/api/levels`
- `GET /` — List all levels (filter: language, stage)
- `GET /curriculum/all` — All levels grouped by language+stage
- `GET /:id` — Level detail
- `GET /:id/sublevels` — Sub-levels for a level

### Rooms — `/api/rooms`
- `GET /` — List active rooms
- `POST /` — Create room (PRO/SUPER)
- `GET /:id` — Room detail with participants
- `POST /:id/join` — Join room
- `POST /:id/leave` — Leave room
- `POST /:id/hand` — Raise/lower hand
- `POST /:id/mute` — Toggle mic
- `POST /:id/end` — End room (host)
- `GET /host/my-rooms` — My hosted rooms

### Documents — `/api/documents` (PRO/SUPER only)
- `POST /upload` — Upload Word/PDF document
- `GET /` — List uploaded documents
- `GET /:id` — Document detail + parsed levels
- `GET /:id/parse` — Re-parse document
- `DELETE /:id` — Delete document

### Gifts — `/api/gifts`
- `GET /` — List all gifts
- `POST /send` — Send gift (deducts coins)

### Wallet — `/api/wallet`
- `GET /` — Balance + transactions
- `POST /topup` — Simulate coin top-up

### Podcasts — `/api/podcasts`
- `GET /` — List podcasts
- `GET /:id` — Podcast detail
- `POST /` — Create podcast (SUPER)
- `PUT /:id` — Update podcast

### Progress — `/api/progress`
- `GET /` — My learning progress
- `PUT /:levelId` — Update progress

## 7. Socket.io Events

### Client → Server
- `join_room`, `leave_room`
- `raise_hand`, `lower_hand`
- `toggle_mic`
- `send_message`
- `send_gift`
- `promote_to_speaker`, `mute_participant`, `kick_participant` (host)
- `advance_stage` (host)
- `start_recording`, `stop_recording` (host)

### Server → Client
- `room_update` — participant list + count
- `hand_update` — hand raised/lowered
- `participant_update` — mic/speaker role changed
- `message_received` — new chat message
- `gift_received` — gift animation event
- `notification` — system notification
- `stage_changed` — sub-level advanced
- `recording_started`, `recording_stopped`
- `error`

## 8. UI/UX Design

### Color Palette
- Primary: Deep Purple `#6C5CE7`
- Secondary: Teal `#00CEC9`
- Accent: Pink `#FD79A8`
- Background: Dark Navy `#0D0D1A`
- Surface: Dark Blue `#1A1A2E`
- Text Primary: White `#FFFFFF`
- Text Secondary: Gray `#A0A0B0`
- Success: Green `#00B894`
- Error: Red `#FF6B6B`
- Warning: Yellow `#FDCB6E`

### Layout
- Bottom navigation (mobile): Home, Explore, Create, Profile
- Sidebar navigation (desktop): same items
- Card-based room listing
- Avatar-driven anonymous identity
- Floating mic control button
- Modal sheets for actions

## 9. Project Structure

```
backend/
├── prisma/schema.prisma
├── src/
│   ├── config/index.ts
│   ├── models/client.ts
│   ├── middleware/{auth,error}.ts
│   ├── routes/{auth,users,levels,rooms,gifts,wallet,podcasts,progress,documents}.ts
│   ├── services/{documentParser,levelParser}.ts
│   ├── socket/handler.ts
│   └── index.ts
├── uploads/
└── package.json

frontend/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── context/
│   └── types/
├── index.html
└── package.json
```
