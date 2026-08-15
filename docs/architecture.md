# AI Enterprise Automation Platform — Architecture Documentation

> **Version:** 1.0.0 | **Status:** Production-Ready | **Last Updated:** August 2026

---

## Overview

The AI Enterprise Automation Platform is a fully self-hosted, enterprise-grade monorepo that integrates a **dual workflow engine** (native React Flow + n8n), **multi-provider AI services** (OpenAI, Google Gemini, Ollama), and complete **multi-tenant organization management** in a single cohesive platform.

---

## Monorepo Structure

```
AI-Enterprise-Automatiom-Platform/
+-- apps/
¦   +-- backend/               # Node.js + Express API (Port 4000)
¦   ¦   +-- prisma/            # DB schema, migrations, seed
¦   ¦   +-- src/
¦   ¦       +-- controllers/   # Request handlers (12 controllers)
¦   ¦       +-- middleware/    # Auth, RBAC, validation
¦   ¦       +-- routes/        # Express router (11 route files)
¦   ¦       +-- services/      # Business logic layer
¦   ¦       +-- utils/         # Shared helpers (Prisma, encryption, etc)
¦   +-- frontend/              # React 19 + Vite SPA (Port 5174)
¦       +-- src/
¦           +-- components/    # Reusable UI components
¦           +-- layouts/       # DashboardLayout, AuthLayout
¦           +-- lib/           # Axios API client (with interceptors)
¦           +-- pages/         # Feature pages (8 sections)
¦           +-- store/         # Zustand global state (auth)
+-- docker/                    # Docker Compose infra definitions
+-- packages/shared/           # Shared TypeScript types
+-- docs/                      # Architecture documentation
```

---

## Tech Stack

### Frontend
| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.x | UI Framework |
| Vite | 8.x | Build tool & Dev server |
| Tailwind CSS | 3.x | Utility-first CSS |
| Framer Motion | 12.x | Animations & micro-interactions |
| Zustand | 5.x | Global auth state |
| @tanstack/react-query | 5.x | Async data fetching & caching |
| @xyflow/react | 12.x | Visual workflow builder |
| Recharts | 3.x | Analytics charts |

### Backend
| Library | Version | Purpose |
|---------|---------|---------|
| Node.js | 20+ | Runtime |
| Express.js | 4.x | HTTP framework |
| Prisma ORM | 5.x | Database access layer |
| PostgreSQL | 16 | Primary database |
| Redis | 7 | Session caching |
| Node.js crypto (AES-256-GCM) | - | API key encryption |
| multer + @aws-sdk/client-s3 | - | File upload & MinIO |

### Infrastructure (Docker)
| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 5433 | Primary database |
| Redis 7 | 6379 | Caching |
| n8n | 5680 | External workflow automation |
| MinIO | 9000 / 9001 | Object/document storage |

---

## Security Model

### 1. Authentication Flow
```
POST /api/v1/auth/login
  ? Validate credentials ? bcrypt.compare
  ? Sign JWT (accessToken, 15min)
  ? Return user + token
```

### 2. Multi-Tenant Request Flow
Every authenticated request carries two headers:
- `Authorization: Bearer <jwt_token>` — verifies identity
- `X-Organization-ID: <org_uuid>` — scopes all queries to the active tenant

### 3. API Key Encryption
Organization AI provider keys are encrypted using **AES-256-GCM**:
```
User inputs API key ? Backend encrypts (ENCRYPTION_KEY) ? Stores ciphertext in DB
AI request arrives ? Decrypt ? Use for external call (never exposed to client)
```

### 4. Role-Based Access Control (RBAC)
```
System Roles: SUPER_ADMIN, USER
Organization Roles: OWNER, ADMIN, MEMBER, VIEWER
```

---

## AI Provider Resolution

```
Incoming AI request (provider: "openai")
  ? resolveOrgKey(orgId, "openai")
  ? Found org-level key? Decrypt ? Use
  ? Not found ? Check process.env.OPENAI_API_KEY
  ? Neither found ? Return 400 "No API key configured"

Providers: openai (GPT-4o) | gemini (Gemini 2.0 Flash) | ollama (Local)
```

---

## API Reference Summary

| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/auth/login` | POST | Login, returns JWT |
| `/api/v1/auth/register` | POST | Create account |
| `/api/v1/auth/forgot-password` | POST | Send OTP email |
| `/api/v1/auth/verify-otp` | POST | Verify OTP |
| `/api/v1/auth/reset-password` | POST | Reset with OTP |
| `/api/v1/ai/chat/stream` | POST | SSE AI chat stream |
| `/api/v1/workflows` | GET/POST | Workflow CRUD |
| `/api/v1/analytics/health` | GET | Platform health check |
| `/api/v1/documents` | GET/POST/DELETE | Document management |
| `/api/v1/audit` | GET | Audit log entries |

Full interactive docs: `http://localhost:4000/api-docs`

---

## Frontend Page Map

| Route | Description |
|-------|-------------|
| `/` | Dashboard with live health status |
| `/assistant` | Multi-provider AI chat |
| `/workflows` | Visual automation builder |
| `/analytics` | Usage & cost charts |
| `/documents` | MinIO file management |
| `/team` | Members & roles |
| `/audit` | Compliance event log |
| `/settings` | API keys & profile |

---

## Running the Platform

```bash
# 1. Start Docker infrastructure
cd docker && docker compose up -d

# 2. Install dependencies
npm install

# 3. Run database migrations
cd apps/backend && npx prisma migrate dev

# 4. Start both servers
npm run dev
```

Visit: **http://localhost:5174**  
API Docs: **http://localhost:4000/api-docs**
