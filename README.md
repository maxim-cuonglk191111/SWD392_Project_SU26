# LUCY — Language Unity & Collaborative Youth

A social audio + EdTech platform for multilingual (EN/ZH/JP) real-time learning with anonymous participation, structured LMS curriculum, and creator monetization.

## Architecture

```
lucy-project/
├── backend/          # Node.js + TypeScript + Express + Prisma + Socket.io
│   └── prisma/       # SQLite database schema
├── frontend/         # React + Vite + TypeScript + Tailwind CSS
├── Document/         # Source documents (Word/PDF curriculum files)
└── SPEC.md          # Project specification
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend Runtime | Node.js 20 + TypeScript 5 |
| API Framework | Express.js |
| Database | SQLite + Prisma ORM |
| Real-time | Socket.io |
| Document Parsing | mammoth (DOCX) + pdf-parse (PDF) |
| Auth | JWT + bcryptjs |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| State | React Context + hooks |

## Quick Start

### 1. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Backend runs on **http://localhost:3000**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

## Features

### User Tiers
- **LUCY (Free)**: Anonymous avatar participation, join rooms, raise hand, send gifts
- **PRO**: Create rooms, pin documents, manage learners, dashboard
- **SUPER**: All PRO + record podcasts + premium content

### Core Features
- Real-time audio room simulation (Socket.io)
- Document upload & auto-parsing (Word/PDF → Levels)
- Virtual gift economy with coins
- XP + Leaderboard system
- Wallet with coin top-up simulation
- Podcast recording (SUPER)
- Learning progress tracking
- Curriculum browser (3 languages × 3 stages × 100 levels)

### API Endpoints
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- Users: `/api/users/profile`, `/api/users/leaderboard`
- Levels: `/api/levels`, `/api/levels/curriculum/all`
- Rooms: `/api/rooms`, `/api/rooms/:id/join`, `/api/rooms/:id/hand`
- Documents: `/api/documents/upload` (PRO/SUPER)
- Gifts: `/api/gifts/send`
- Wallet: `/api/wallet/topup`
- Podcasts: `/api/podcasts`
- Progress: `/api/progress`

### Socket.io Events
- `join_room`, `leave_room`, `raise_hand`, `toggle_mic`
- `send_message`, `send_gift`
- `promote_to_speaker`, `mute_participant`, `kick_participant`
- `start_recording`, `stop_recording`, `advance_stage`

## Project Structure

```
backend/src/
├── config/         # Environment config
├── models/         # Prisma client
├── middleware/     # Auth, error handling
├── routes/         # Express route handlers
├── services/      # Document parsing service
├── socket/        # Socket.io event handlers
└── index.ts       # Entry point

frontend/src/
├── context/        # Auth context
├── components/     # Avatar, Layout
├── pages/          # Login, Register, Home, Explore, Create, Profile, Room
├── services/       # API client, Socket.io service
└── types/          # TypeScript interfaces
```
