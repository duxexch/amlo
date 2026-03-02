<div align="center">

# 🌐 Aplo — عالم أبلو

### منصة دردشة فيديو وصوت عشوائية + بث مباشر + محفظة رقمية

[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<br/>

[العربية](#-نظرة-عامة) • [English](#-overview) • [Setup](#-quick-start) • [API](#-api-endpoints)

</div>

---

## 📖 نظرة عامة

**Aplo** (أبلو) هو تطبيق دردشة فيديو وصوت عشوائي مع بث مباشر ومحفظة رقمية (كوينز). التطبيق مصمم بالعربية أولاً (RTL) مع دعم كامل للتعددية اللغوية، ويتميز بتصميم Dark Theme مع تأثيرات Neon/Glass Morphism.

### ✨ المميزات الرئيسية

- 🎥 **دردشة فيديو/صوت عشوائية** — مطابقة فورية مع مستخدمين عشوائيين
- 📺 **بث مباشر** — غرف بث مباشر مع تفاعل حي
- 💰 **محفظة رقمية** — نظام كوينز مع عمليات شحن وتحويل
- 👥 **نظام أصدقاء** — إضافة أصدقاء مع تحكم في رؤية البروفايل
- 🔐 **نظام PIN ثنائي** — بروفايلين لكل مستخدم مع رمز PIN منفصل
- 🌍 **تعددية لغوية** — عربي، إنجليزي، فرنسي، إسباني، ألماني، تركي، أوردو
- 🛡️ **لوحة إدارة** — تحكم كامل في المستخدمين والتقارير
- 🤝 **نظام وكلاء** — لوحة تحكم للوكلاء مع عمليات الشحن

---

## 📖 Overview

**Aplo** is a random video/audio chat application with live streaming and a digital wallet (coins) system. Designed Arabic-first (RTL) with full i18n support, featuring a Dark Theme with Neon/Glass Morphism aesthetics.

### ✨ Key Features

- 🎥 **Random Video/Audio Chat** — Instant matching with random users
- 📺 **Live Streaming** — Live broadcast rooms with real-time interaction
- 💰 **Digital Wallet** — Coins system with recharge and transfer
- 👥 **Friends System** — Add friends with profile visibility control
- 🔐 **Dual PIN System** — Two profiles per user with separate PINs
- 🌍 **Multi-language** — Arabic, English, French, Spanish, German, Turkish, Urdu
- 🛡️ **Admin Panel** — Full user management and reporting
- 🤝 **Agent System** — Agent dashboard with recharge operations

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19.2, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui |
| **Backend** | Express 5, Node.js 22, Socket.io |
| **Database** | PostgreSQL 16, Drizzle ORM |
| **Cache** | Redis 7 (with graceful fallback) |
| **Auth** | Express Sessions, bcryptjs, PIN system |
| **Security** | Zod validation, rate limiting, encryption |
| **Logging** | Pino structured logging |
| **Deploy** | Docker Compose |

---

## 📁 Project Structure

```
aplo/
├── client/                  # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/      # UI components (shadcn/ui)
│   │   ├── pages/           # Route pages
│   │   ├── hooks/           # Custom React hooks
│   │   ├── i18n/            # Internationalization (7 languages)
│   │   ├── lib/             # API clients & utilities
│   │   └── assets/          # Static assets
│   └── public/              # Public files
├── server/                  # Backend (Express)
│   ├── routes/              # API route handlers
│   │   ├── admin.ts         # Admin endpoints
│   │   ├── adminChat.ts     # Admin chat management
│   │   ├── agent.ts         # Agent endpoints
│   │   ├── social.ts        # Social features
│   │   └── userAuth.ts      # Auth + PIN + profiles
│   ├── middleware/           # Auth middleware
│   ├── utils/               # Crypto utilities
│   ├── db.ts                # Database connection
│   ├── redis.ts             # Redis with graceful degradation
│   ├── routes.ts            # Route registration
│   └── index.ts             # Server entry point
├── shared/
│   └── schema.ts            # Database schema + Zod validators
├── docker-compose.yml       # Docker orchestration
├── drizzle.config.ts        # Drizzle ORM config
├── vite.config.ts           # Vite configuration
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 22
- **PostgreSQL** 16+
- **Redis** 7+ (optional — app works without it)

### Installation

```bash
# Clone the repo
git clone https://github.com/duxexch/amlo.git
cd amlo

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database and Redis URLs
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/aplo
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your-session-secret
NODE_ENV=development
```

### Development

```bash
# Push database schema
npm run db:push

# Start dev server (backend + frontend)
npm run dev
```

The app will be available at `http://localhost:5000`

### Production (Docker)

```bash
# Start all services
docker compose up -d

# The app runs on port 5000
```

---

## 🔌 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/register` | Register new user |
| `POST` | `/login` | Login |
| `POST` | `/logout` | Logout |
| `GET` | `/me` | Get current user |
| `POST` | `/forgot-password` | Request password reset |
| `POST` | `/reset-password` | Reset password with token |

### PIN & Profiles (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/pin/setup` | Setup PIN for a profile |
| `POST` | `/pin/verify` | Verify PIN and switch profile |
| `GET` | `/profiles` | Get user profiles |
| `PUT` | `/profiles/:index` | Update profile |

### Social (`/api/social`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/friends` | Get friends list |
| `POST` | `/friends/request` | Send friend request |
| `POST` | `/friends/accept` | Accept friend request |
| `GET` | `/rooms` | Get live rooms |
| `POST` | `/rooms` | Create a room |

### Admin (`/api/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Admin login |
| `GET` | `/users` | List users |
| `GET` | `/stats` | Dashboard stats |
| `PUT` | `/users/:id/ban` | Ban/unban user |

### Agent (`/api/agent`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Agent login |
| `GET` | `/recharges` | Recharge history |
| `POST` | `/recharge` | Process recharge |

---

## 🐳 Docker Services

| Service | Image | Port |
|---------|-------|------|
| **app** | Node.js 22 | 5000 |
| **postgres** | PostgreSQL 16 Alpine | 5432 |
| **redis** | Redis 7 Alpine | 6379 |

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**Built with ❤️ for the Arabic-speaking community**

</div>
