# AI Enterprise Automation Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org/)
[![n8n](https://img.shields.io/badge/n8n-E64D00?style=flat&logo=n8n&logoColor=white)](https://n8n.io/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com/)

> A full-stack enterprise automation platform combining multi-model AI assistance (OpenAI / Google Gemini / Ollama), a native visual workflow builder, n8n integration, secure multi-tenant organization management, and a comprehensive audit & analytics suite.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Features](#features)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [API Documentation](#api-documentation)
8. [Project Structure](#project-structure)
9. [Service Ports](#service-ports)
10. [Known Limitations](#known-limitations)
11. [Roadmap](#roadmap)

---

## Overview

The AI Enterprise Automation Platform is a self-hosted, multi-tenant automation suite that enables teams to:

- Build visual automation workflows with a drag-and-drop native canvas
- Connect to enterprise-grade automation via n8n integration
- Chat with multiple AI providers (GPT-4o, Gemini 2.0 Flash, Local Ollama LLMs) with SSE streaming
- Generate complete workflow definitions from natural-language prompts
- Store and manage documents with MinIO (S3-compatible)
- Track activity and compliance with full audit logs and CSV export
- Collaborate in role-based teams with isolated organizations

---

## Architecture

```
┌───────────────────────────────────────┐
│           Browser / Client            │
│  React 18 + Vite + TailwindCSS        │
│  @xyflow/react (Workflow Canvas)      │
│  Zustand (Auth State)                 │
└──────────────────┬────────────────────┘
                   │ HTTPS / REST / SSE
┌──────────────────▼────────────────────┐
│         Express Backend (Node.js)     │
│         TypeScript + Prisma ORM       │
│                                       │
│  ┌─────────┐ ┌────────┐ ┌─────────┐  │
│  │  Auth   │ │  RBAC  │ │  Jobs   │  │
│  └─────────┘ └────────┘ └─────────┘  │
│  ┌─────────────────────────────────┐  │
│  │    AI Service (Multi-Provider)  │  │
│  │  OpenAI · Gemini · Ollama       │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │    Workflow Engine (BFS)        │  │
│  │  Native + n8n webhook bridge    │  │
│  └─────────────────────────────────┘  │
└──────┬──────────┬────────┬────────────┘
       │          │        │
   ┌───▼──┐  ┌───▼──┐ ┌───▼──┐
   │ PgSQL│  │MinIO │ │ n8n  │
   │ :5433│  │ :9000│ │ :5680│
   └──────┘  └──────┘ └──────┘
       │
   ┌───▼──┐
   │Redis │
   │ :6379│
   └──────┘
```

---

## Tech Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18.3 + TypeScript 5 |
| Build Tool | Vite 5 |
| Styling | TailwindCSS 4 |
| Workflow Canvas | @xyflow/react 12 |
| State Management | Zustand 4 |
| HTTP Client | Axios 1 |
| Markdown | react-markdown + react-syntax-highlighter |
| Routing | React Router DOM 6 |

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express 5 + TypeScript 7 |
| ORM | Prisma 5.14 (PostgreSQL) |
| Authentication | JSON Web Tokens (jsonwebtoken) |
| Password Hashing | bcrypt |
| Validation | Zod v4 |
| Logging | Pino + pino-pretty |
| API Docs | Swagger UI Express |
| Email | Nodemailer (Gmail SMTP) |
| Encryption | AES-256-GCM (Node crypto) |
| Storage | AWS SDK v3 (@aws-sdk/client-s3) → MinIO |

### Infrastructure
| Service | Technology | Port |
|---------|-----------|------|
| Database | PostgreSQL 16 (Docker) | 5433 |
| Cache | Redis 7 (Docker) | 6379 |
| Workflow Engine | n8n (Docker) | 5680 |
| Object Storage | MinIO (Docker) | 9000/9001 |
| DB Admin | pgAdmin 4 (Docker) | 5050 |
| Reverse Proxy | Nginx (Docker) | 8080 |
| AI (Local) | Ollama | 11434 |

---

## Features

### ✅ Authentication & Security
- Email/password registration with bcrypt hashing
- JWT access tokens (15 min) + refresh tokens (7 days)
- 6-digit OTP password reset with email delivery
- Security headers via Helmet.js
- CORS with dynamic origin validation
- AES-256-GCM encryption for stored API keys

### ✅ Multi-Tenancy & RBAC
- Users belong to one or more Organizations
- Roles: OWNER · ADMIN · MANAGER · MEMBER
- All data (workflows, conversations, docs, notifications) is org-scoped
- Email-based team invitations with token validation
- Active organization switching without re-login

### ✅ AI Assistant
- Multi-provider chat: OpenAI GPT-4o, Google Gemini 2.0 Flash, Ollama (local)
- Server-Sent Events (SSE) streaming for real-time token output
- Persistent conversation history scoped to org + user
- Org-level API key management with AES-256-GCM encryption
- Daily/monthly AI usage tracking with cost estimation
- Rate limiting: 200 requests/day per organization

### ✅ Workflow Automation
- Native visual drag-and-drop canvas (React Flow / @xyflow)
- Node types: Trigger (Webhook, Manual), Action (HTTP, Email, AI), Logic (Condition)
- Native BFS execution engine with JSON payload chaining
- Workflow run history with duration, status, input/output data
- Webhook trigger support (token-authenticated public endpoints)
- n8n integration: create, trigger, and delete n8n workflows
- AI Workflow Generation: create workflows from natural-language prompts

### ✅ Document Storage (MinIO)
- S3-compatible file upload via Multer + AWS SDK
- Org-scoped document storage
- Presigned download URLs
- File metadata stored in PostgreSQL

### ✅ Analytics & Observability
- Platform overview: total workflows, executions, AI tokens, cost estimates
- AI usage timeseries (per-day charts, last N days)
- Provider breakdown (usage % by OpenAI / Gemini / Ollama)
- Top users by AI activity
- Workflow success/failure stats
- Platform health check (PostgreSQL, n8n, MinIO, Redis, OpenAI)
- Audit log CSV export

### ✅ Audit & Compliance
- Full audit log: resource, action, old data, new data, timestamp, user
- Paginated audit log viewer (OWNER/ADMIN only)
- CSV export endpoint for compliance reporting

### ✅ Notifications
- In-app notification bell with unread count badge
- Notification types: SUCCESS, ERROR, INFO, WARNING
- 30-second polling refresh
- Mark all read

### ✅ Background Jobs
- PostgreSQL-backed job queue (no Redis dependency for jobs)
- Job types: PENDING → RUNNING → COMPLETED / FAILED
- Retry support with configurable max attempts
- Cross-service notification triggering on job completion

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- Docker Desktop
- Git
- (Optional) Ollama for local AI

### Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/ubaidullah0/AI-Enterprise-Automation-Platform.git
cd AI-Enterprise-Automation-Platform

# 2. Copy and configure environment variables
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your credentials

# 3. Start Docker infrastructure
cd docker
docker compose up -d
cd ..

# 4. Install dependencies
npm install

# 5. Set up the database
cd apps/backend
npx prisma generate
npx prisma migrate dev --name init
cd ../..

# 6. Start backend (Terminal 1)
npm run dev --workspace=apps/backend

# 7. Start frontend (Terminal 2)
npm run dev --workspace=apps/frontend
```

Open http://localhost:5174 in your browser.

---

## Environment Variables

Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in all values.

```env
# Database (PostgreSQL on port 5433)
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@127.0.0.1:5433/automation_platform?schema=public

# JWT Security — use long random strings!
JWT_SECRET=your_64_char_random_secret_here
JWT_REFRESH_SECRET=your_64_char_random_refresh_secret_here

# AES-256-GCM Encryption for API Keys
ENCRYPTION_KEY=your_64_char_hex_string_here

# AI Providers
OPENAI_API_KEY=sk-your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
OLLAMA_URL=http://localhost:11434

# n8n
N8N_URL=http://localhost:5680
N8N_API_KEY=your_n8n_api_key_here

# MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=your_minio_user
MINIO_ROOT_PASSWORD=your_minio_password
MINIO_BUCKET_NAME=automation-platform-docs

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_char_app_password

# Frontend URL (for reset links)
FRONTEND_URL=http://localhost:5174
```

Frontend variable (in `apps/frontend/.env`):
```env
VITE_API_URL=http://localhost:4000/api/v1
```

---

## API Documentation

Swagger UI is available at: **http://localhost:4000/api-docs**

### API Endpoints Summary

| Module | Method | Path | Description |
|--------|--------|------|-------------|
| Auth | POST | /api/v1/auth/register | User registration |
| Auth | POST | /api/v1/auth/login | User login |
| Auth | POST | /api/v1/auth/refresh | Refresh access token |
| Auth | GET | /api/v1/auth/me | Get current user |
| Auth | POST | /api/v1/auth/forgot-password-otp | Send OTP reset code |
| Auth | POST | /api/v1/auth/verify-otp | Verify OTP code |
| Auth | POST | /api/v1/auth/reset-password-otp | Reset password with OTP |
| Orgs | POST | /api/v1/orgs | Create organization |
| Orgs | GET | /api/v1/orgs/:id | Get organization |
| Orgs | POST | /api/v1/orgs/:id/invite | Invite member |
| Workflows | GET | /api/v1/workflows | List workflows |
| Workflows | POST | /api/v1/workflows | Create workflow |
| Workflows | POST | /api/v1/workflows/generate | AI-generate workflow |
| Workflows | POST | /api/v1/workflows/:id/execute | Execute workflow |
| Workflows | PUT | /api/v1/workflows/:id/canvas | Save canvas |
| AI | GET | /api/v1/ai/providers | List available AI providers |
| AI | POST | /api/v1/ai/chat | Chat (non-streaming) |
| AI | POST | /api/v1/ai/chat/stream | Chat (SSE streaming) |
| AI | GET | /api/v1/ai/conversations | List conversations |
| Analytics | GET | /api/v1/analytics/overview | Platform overview metrics |
| Analytics | GET | /api/v1/analytics/health | Platform health check |
| Analytics | GET | /api/v1/analytics/ai-usage | AI usage timeseries |
| Audit | GET | /api/v1/audit-logs | Get audit logs |
| Audit | GET | /api/v1/audit-logs/export | Download audit CSV |
| Documents | POST | /api/v1/documents | Upload document |
| Documents | GET | /api/v1/documents | List documents |
| Webhooks | POST | /api/v1/webhooks/:token | Trigger workflow by webhook |

---

## Project Structure

```
AI-Enterprise-Automation-Platform/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   └── schema.prisma          # Database schema (15 models)
│   │   └── src/
│   │       ├── controllers/           # 12 route controllers
│   │       ├── middleware/            # auth.middleware.ts, rbac.middleware.ts
│   │       ├── routes/                # 11 Express routers
│   │       ├── schemas/               # Zod validation schemas
│   │       ├── services/              # Business logic + AI providers
│   │       │   ├── ai.service.ts      # OpenAI, Gemini, Ollama providers
│   │       │   ├── ai-workflow-generator.service.ts
│   │       │   ├── analytics.service.ts
│   │       │   ├── encryption.service.ts  # AES-256-GCM
│   │       │   ├── n8n.service.ts
│   │       │   ├── notification.service.ts
│   │       │   ├── storage.service.ts     # MinIO/S3
│   │       │   ├── workflow-engine.service.ts  # BFS executor
│   │       │   └── jobs/              # PostgreSQL background job queue
│   │       └── utils/
│   └── frontend/
│       └── src/
│           ├── App.tsx                # Route definitions + auth guards
│           ├── components/            # NotificationBell
│           ├── layouts/               # DashboardLayout (sidebar + nav)
│           ├── lib/                   # api.ts (axios + interceptors)
│           ├── pages/
│           │   ├── Dashboard.tsx      # Overview + metrics
│           │   ├── ai/                # AssistantDashboard.tsx
│           │   ├── analytics/         # AnalyticsDashboard.tsx
│           │   ├── audit/             # AuditComplianceDashboard.tsx
│           │   ├── auth/              # Login, Register, OTP pages
│           │   ├── documents/         # DocumentManager.tsx
│           │   ├── settings/          # SettingsPage.tsx
│           │   ├── team/              # TeamManagement.tsx
│           │   └── workflows/         # WorkflowDashboard + WorkflowBuilder
│           └── store/                 # Zustand auth store
├── packages/
│   └── shared/                        # Shared TypeScript types/constants
├── docker/
│   ├── docker-compose.yml             # PostgreSQL, Redis, n8n, MinIO, pgAdmin, Nginx
│   └── nginx/
│       └── default.conf
├── docs/                              # Documentation
├── .env.example                       # Root environment template
└── package.json                       # npm workspace root
```

---

## Service Ports

| Service | Local URL | Purpose |
|---------|-----------|---------|
| Frontend | http://localhost:5174 | React application |
| Backend API | http://localhost:4000 | Express REST API |
| Swagger Docs | http://localhost:4000/api-docs | Interactive API docs |
| PostgreSQL | localhost:5433 | Primary database |
| Redis | localhost:6379 | Cache layer |
| n8n | http://localhost:5680 | Workflow automation engine |
| MinIO API | http://localhost:9000 | Object storage API |
| MinIO Console | http://localhost:9001 | MinIO admin UI |
| pgAdmin | http://localhost:5050 | PostgreSQL admin UI |
| Nginx | http://localhost:8080 | Reverse proxy |
| Ollama | http://localhost:11434 | Local LLM service |

---

## Known Limitations

1. **No express-rate-limit**: API rate limiting is implemented at the AI layer only (200 req/day), but general HTTP rate limiting middleware is not yet applied.
2. **Swagger docs are empty**: The Swagger UI is mounted at `/api-docs` but the document has no path definitions yet.
3. **Platform health check is partially simulated**: Redis, MinIO, n8n health checks return simulated "Operational" status rather than live probes.
4. **DIRECT_URL not in .env.example**: Prisma `DIRECT_URL` is defined in schema.prisma but not in the example `.env`. Only needed for Supabase/Prisma Accelerate deployments.
5. **Light mode not functional**: Theme toggle button exists in the sidebar but only toggles a local state variable; the dark-to-light mode switch is not connected to the CSS.
6. **No automated tests**: Jest/Vitest test suites are not configured. Verification was done through TypeScript compilation and manual build checks.

---

## Roadmap

### Phase A — Testing & Polish
- Fix simulated health check probes (live Redis, MinIO, n8n pings)
- Complete Swagger API path documentation
- Add global HTTP rate limiting middleware (express-rate-limit)
- Connect light mode theme to TailwindCSS dark class

### Phase B — Security Hardening
- Add HTTP rate limiting on auth endpoints
- Implement account lockout after N failed login attempts
- Add CSRF protection for cookie-based sessions

### Phase C — Advanced AI / Agentic Capabilities
- Agentic AI: allow AI to execute n8n workflows on user command
- RAG (Retrieval-Augmented Generation) via uploaded documents

### Phase D — Advanced Workflow Automation
- Visual n8n workflow builder embedded in-platform
- Workflow scheduling (cron triggers)
- Workflow version history and rollback

### Phase E — Enterprise RBAC
- SuperAdmin panel for managing all organizations
- Permission-level granularity beyond roles
- SAML/SSO enterprise login

### Phase F — Advanced Analytics
- Real-time execution monitoring via WebSockets
- Cost budgeting and spending alerts

### Phase G — Production Deployment
- Docker Compose production config
- HTTPS/TLS configuration
- Kubernetes helm chart
