# AI Enterprise Automation Platform

A full-stack, multi-tenant enterprise automation platform combining AI assistance, visual workflow automation, document storage, analytics, audit compliance, and background job processing — all in a single self-hosted deployment.

---

## 1. Project Overview

The AI Enterprise Automation Platform is a production-grade, multi-tenant SaaS application that enables organizations to:

- Chat with AI assistants (OpenAI, Ollama, Gemini) with real-time SSE streaming
- Build visual automation workflows using a drag-and-drop canvas (React Flow)
- Integrate with n8n for advanced external workflow automation
- Generate workflows from natural language using AI
- Store and manage documents with MinIO (S3-compatible) object storage
- Monitor platform health, AI usage, and costs via an analytics dashboard
- Maintain a full compliance audit trail with CSV export
- Run background jobs using a PostgreSQL-backed job queue
- Manage team members with fine-grained RBAC (OWNER, ADMIN, MANAGER, MEMBER)

---

## 2. Core Features

| Category | Feature |
|---|---|
| **Authentication** | Registration, Login, JWT access/refresh tokens, OTP password reset |
| **Multi-tenancy** | Organization isolation on every resource, X-Organization-ID enforcement |
| **RBAC** | OWNER / ADMIN / MANAGER / MEMBER roles with permission checks |
| **AI Assistant** | OpenAI (gpt-4o), Ollama (local), Gemini support with SSE streaming |
| **Workflow Builder** | Native visual builder with React Flow, nodes, edges, canvas persistence |
| **n8n Integration** | Create and open n8n workflows, proxy via REST API |
| **AI Workflow Generation** | Natural language → React Flow JSON, preview, approve, build |
| **Webhook Triggers** | Native webhook workflows with secure token-based triggers |
| **Analytics** | KPI cards, AI usage, token/cost tracking, provider breakdown, health checks |
| **Audit & Compliance** | Tamper-evident audit logs, CSV export, JSON diff, OWNER/ADMIN only |
| **Document Storage** | MinIO upload/download/delete, org-scoped paths, presigned URLs |
| **Notifications** | Bell notifications, unread counts, per-user/org targeting |
| **Background Jobs** | PostgreSQL-backed job queue with PENDING→RUNNING→COMPLETED lifecycle |
| **API Key Management** | Per-org AI provider keys, AES-256-GCM encryption, key hints |
| **Organization Settings** | Team management, member invitations, settings panel |
| **Security** | Helmet.js, CORS, bcrypt, JWT, encrypted API keys, private MinIO |

---

## 3. Architecture

```mermaid
graph TB
    User["👤 User (Browser)"]
    FE["Frontend\nReact 19 + Vite\nPort 5174"]
    BE["Backend API\nExpress 5 + TypeScript\nPort 4000"]
    PG["PostgreSQL 16\nPort 5433"]
    MINIO["MinIO\nPort 9000/9001"]
    N8N["n8n\nPort 5680"]
    REDIS["Redis 7\nPort 6379"]
    OPENAI["OpenAI API"]
    OLLAMA["Ollama\nPort 11434"]
    GEMINI["Gemini API"]

    User --> FE
    FE --> BE
    BE --> PG
    BE --> MINIO
    BE --> N8N
    BE --> REDIS
    BE --> OPENAI
    BE --> OLLAMA
    BE --> GEMINI
```

---

## 4. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React | 19 |
| Frontend Build | Vite | 8 |
| Frontend Language | TypeScript | 6 |
| Styling | TailwindCSS | 3 |
| Workflow Canvas | @xyflow/react (React Flow) | 12 |
| State Management | Zustand | 5 |
| Server State | @tanstack/react-query | 5 |
| Charts | Recharts | 3 |
| Animations | Framer Motion | 12 |
| UI Components | Radix UI | various |
| Routing | React Router Dom | 7 |
| HTTP Client | Axios | 1.19 |
| Forms | React Hook Form + Zod | 7/3 |
| Backend Runtime | Node.js | 20+ |
| Backend Framework | Express | 5 |
| Backend Language | TypeScript | 7 |
| ORM | Prisma | 5.14 |
| Database | PostgreSQL | 16 |
| Object Storage | MinIO (S3-compatible) | latest |
| Authentication | jsonwebtoken + bcrypt | 9/6 |
| Email | Nodemailer (Gmail SMTP) | 9 |
| OpenAI | openai SDK | 7 |
| Gemini | @google/generative-ai | 0.24 |
| Logging | Pino | 10 |
| API Docs | Swagger UI Express | 5 |
| Containerization | Docker + Docker Compose | latest |
| Workflow Automation | n8n | latest |
| Caching | Redis | 7 |
| Local LLM | Ollama | latest |

---

## 5. Project Structure

```
AI-Enterprise-Automation-Platform/
├── apps/
│   ├── backend/              # Express API server
│   │   ├── src/
│   │   │   ├── controllers/  # Route handlers
│   │   │   ├── middleware/   # Auth, RBAC middleware
│   │   │   ├── routes/       # Express routers
│   │   │   ├── schemas/      # Zod validation schemas
│   │   │   ├── services/     # Business logic (AI, email, storage, jobs)
│   │   │   │   └── jobs/     # PostgreSQL job queue
│   │   │   └── utils/        # Shared utilities (Prisma client)
│   │   └── prisma/
│   │       └── schema.prisma # Database schema
│   └── frontend/             # React SPA
│       └── src/
│           ├── layouts/      # Dashboard shell
│           ├── pages/        # Route-level pages
│           │   ├── ai/       # AI Assistant
│           │   ├── analytics/
│           │   ├── audit/
│           │   ├── auth/     # Login, Register, OTP reset
│           │   ├── documents/
│           │   ├── settings/
│           │   ├── team/
│           │   └── workflows/
│           └── lib/          # API client
├── docker/
│   └── docker-compose.yml    # All infrastructure services
├── docs/
│   ├── WINDOWS_SETUP.md
│   └── project-proposal/     # Comprehensive project documentation
├── packages/
│   └── shared/               # Shared types (TypeScript)
├── scratch/                  # Test/verification scripts
├── scripts/                  # Utility scripts
├── .env.example              # Environment variable template
└── start.ps1                 # Windows startup script
```

---

## 6. Prerequisites

- **Windows 10/11** (or Linux/macOS)
- **Node.js 20+** — https://nodejs.org
- **npm 10+** (bundled with Node.js)
- **Docker Desktop** — https://www.docker.com/products/docker-desktop
- **Git** — https://git-scm.com
- **Ollama** (optional, for local LLM) — https://ollama.ai

---

## 7. Installation

```powershell
# Clone the repository
git clone <repository-url>
cd AI-Enterprise-Automatiom-Platform

# Install all dependencies
npm install
```

---

## 8. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```powershell
Copy-Item .env.example .env
```

### Database
```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=automation_platform
DATABASE_URL=postgresql://admin:your_secure_password@localhost:5433/automation_platform?schema=public
```

### pgAdmin
```env
PGADMIN_EMAIL=admin@admin.com
PGADMIN_PASSWORD=your_pgadmin_password
```

### Redis
```env
REDIS_URL=redis://localhost:6379
```

### n8n
```env
N8N_URL=http://localhost:5680
N8N_API_KEY=your_n8n_api_key_here
N8N_USER=admin
N8N_PASSWORD=your_n8n_password
N8N_PORT=5678
```

### MinIO
```env
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your_minio_password
MINIO_ENDPOINT=localhost
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=your_minio_password
MINIO_BUCKET=documents
```

### Backend
```env
PORT=4000
NODE_ENV=development
```

### Authentication
```env
JWT_SECRET=change_this_to_a_long_random_secret_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change_this_refresh_secret_in_production
REFRESH_TOKEN_SECRET=change_this_refresh_secret_in_production
REFRESH_TOKEN_EXPIRES_IN=7d
ENCRYPTION_KEY=32_character_hex_key_for_aes256
```

### AI Providers
```env
OPENAI_API_KEY=sk-your_openai_key_here
OLLAMA_BASE_URL=http://localhost:11434
GEMINI_API_KEY=your_gemini_api_key_here
DEFAULT_AI_PROVIDER=openai
```

### Email (Gmail SMTP)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM=AI Platform <your_gmail@gmail.com>
```

### Frontend
```env
FRONTEND_URL=http://localhost:5174
APP_URL=http://localhost:5174
CORS_ORIGINS=http://localhost:5174
```

### Testing
```env
# Only set to true during automated testing — skips sending to @example.com and @test.com
TEST_MODE=false
```

> ⚠️ **NEVER commit your `.env` file to git. It is listed in `.gitignore`.**

---

## 9. Running Docker Services

```powershell
# Start all infrastructure services
cd docker
docker compose up -d

# Verify all containers are running
docker ps

# To view logs
docker compose logs -f
```

This starts: PostgreSQL, pgAdmin, Redis, n8n, MinIO, and Nginx.

---

## 10. Running Frontend and Backend

Open **two terminal windows**:

```powershell
# Terminal 1 — Backend
cd apps/backend
npm run dev
```

```powershell
# Terminal 2 — Frontend
cd apps/frontend
npm run dev
```

Or use the provided PowerShell script from the root:
```powershell
.\start.ps1
```

---

## 11. Service URLs

| Service | URL |
|---|---|
| **Frontend App** | http://localhost:5174 |
| **Backend API** | http://localhost:4000 |
| **API Documentation (Swagger)** | http://localhost:4000/api-docs |
| **Health Check** | http://localhost:4000/api/v1/health |
| **pgAdmin** | http://localhost:5050 |
| **MinIO Console** | http://localhost:9001 |
| **MinIO API** | http://localhost:9000 |
| **n8n Dashboard** | http://localhost:5680 |
| **PostgreSQL** | localhost:5433 |
| **Redis** | localhost:6379 |
| **Ollama API** | http://localhost:11434 |

---

## 12. Database Setup

```powershell
cd apps/backend

# Generate Prisma client
npx prisma generate

# Run migrations (safe — does NOT delete data)
npx prisma migrate dev --name init

# Validate schema
npx prisma validate
```

> ⚠️ **Do NOT run `npx prisma migrate reset` in production — it wipes all data.**

---

## 13. n8n Setup

1. Open http://localhost:5680 and create an admin account
2. Go to **Settings → API** → generate an API key
3. Copy the key and set it in your `.env`:
   ```env
   N8N_API_KEY=your_generated_api_key
   ```
4. Restart the backend: the platform will now proxy workflow creation to n8n
5. "Open in n8n" links in the UI direct to `N8N_URL/workflow/{n8nWorkflowId}`

---

## 14. MinIO Setup

1. Open http://localhost:9001
2. Login with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`
3. Create a bucket named `documents` (or match your `MINIO_BUCKET` env var)
4. The platform uses org-scoped object paths: `org/{organizationId}/{uuid}_{filename}`
5. Download URLs are presigned (time-limited) for security

---

## 15. AI Provider Setup

### OpenAI
```env
OPENAI_API_KEY=sk-your_key_here
```
Uses `gpt-4o` by default.

### Ollama (Local LLM)
```powershell
# Install Ollama
winget install Ollama.Ollama

# Pull a model
ollama pull llama3

# Verify it's running
ollama list
```
```env
OLLAMA_BASE_URL=http://localhost:11434
```

### Gemini
```env
GEMINI_API_KEY=your_google_ai_key_here
```
Uses `gemini-2.0-flash` by default.

---

## 16. Background Jobs

The platform uses a **PostgreSQL-backed job queue** (not Redis/BullMQ).

- Jobs are stored in the `BackgroundJob` table
- The worker polls every **10 seconds**
- States: `PENDING → RUNNING → COMPLETED` (or `FAILED`)
- Up to **3 retry attempts** per job
- Queue starts automatically when the backend starts

---

## 17. Security

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt (cost 10–12) |
| JWT access tokens | 15-minute expiry, HS256 |
| JWT refresh tokens | 7-day expiry |
| OTP password reset | 6-digit, bcrypt-hashed, 10-min expiry, rate-limited |
| Organization isolation | `organizationId` on every DB record, enforced via `X-Organization-ID` header |
| RBAC | OWNER / ADMIN / MANAGER / MEMBER permission hierarchy |
| API key storage | AES-256-GCM encryption, only last 4 chars stored plaintext |
| Document access | Private MinIO bucket, presigned URLs |
| Webhook security | 16-byte random hex token per workflow, `isActive` check |
| SMTP credentials | Never logged, `TEST_MODE` bypass only when explicitly enabled |
| HTTP security | Helmet.js headers, CORS origin whitelist |
| Audit trail | Every sensitive action logged with user, org, before/after data |

---

## 18. Testing

```powershell
# Backend TypeScript check
cd apps/backend
npx tsc --noEmit

# Backend production build
npm run build

# Frontend TypeScript check
cd apps/frontend
npx tsc -b

# Frontend production build
npm run build

# Prisma schema validation
cd apps/backend
npx prisma validate

# Lint (frontend)
npm run lint  # from root

# API smoke test
node scratch/smoketest.js

# Advanced API verification
$env:TEST_MODE="true"; node scratch/smoketest-advanced.js
```

---

## 19. Troubleshooting

| Problem | Solution |
|---|---|
| Port already in use | `netstat -aon \| findstr :4000` then kill the PID |
| Docker containers not starting | Ensure Docker Desktop is running; check `docker compose logs` |
| PostgreSQL connection refused | Check `.env` DATABASE_URL uses port **5433** (not 5432) |
| Prisma migration failed | Ensure PostgreSQL container is healthy: `docker ps` |
| n8n API key error | Generate key at http://localhost:5680/settings/api, set `N8N_API_KEY` |
| Ollama not found | Install Ollama, run `ollama pull llama3`, verify `OLLAMA_BASE_URL` |
| Email bounce from @example.com | Normal in dev — set `TEST_MODE=true` in `.env` |
| Frontend can't reach backend | Ensure backend is on port 4000, check `VITE_API_URL` / proxy config |
| MinIO upload fails | Ensure bucket `documents` exists at http://localhost:9001 |

---

## 20. Production Considerations

Before deploying to production:

- [ ] Replace all default secrets (`JWT_SECRET`, `ENCRYPTION_KEY`, passwords)
- [ ] Use HTTPS (reverse proxy: Nginx, Caddy, or Traefik with TLS)
- [ ] Set `NODE_ENV=production`
- [ ] Set `TEST_MODE=false`
- [ ] Configure real SMTP (or transactional email service)
- [ ] Set `CORS_ORIGINS` to your actual domain
- [ ] Use a managed PostgreSQL or enable SSL on self-hosted
- [ ] Enable MinIO TLS or migrate to AWS S3
- [ ] Run `npx prisma migrate deploy` (not `migrate dev`)
- [ ] Set up monitoring and alerting (Pino log aggregation)
- [ ] Configure log rotation
- [ ] Schedule regular database backups (`pg_dump`)

---

## 21. Current Verification Status

| Feature | Result | Evidence |
|---|---|---|
| OTP Password Reset | NOT TESTED | Backend fully implemented; live email interception requires mock inbox |
| AI Assistant | PARTIAL | Backend SSE + chat PASS; browser streaming UI NOT TESTED |
| Native Workflow Builder | PARTIAL | Backend create/save/execute PASS; React Flow drag/drop NOT TESTED |
| Webhooks | PARTIAL | Token generated, endpoint verified; `isActive` required by design |
| AI Workflow Generation | PARTIAL | Backend returns valid nodes/edges JSON, AI_WORKFLOW_GENERATED audit confirmed; Preview UI NOT TESTED |
| n8n | PASS | API proxied, n8nWorkflowId returned, n8n dashboard accessible |
| Analytics | PARTIAL | Overview + health APIs PASS; Recharts visual rendering NOT TESTED |
| Audit & Compliance | PARTIAL | OWNER/ADMIN enforced, CSV export API PASS; UI table NOT TESTED |
| Document Storage | PASS | Upload → MinIO → PostgreSQL → AuditLog → Delete cycle verified |
| Notifications | PASS | API verified, unread count correct |
| Background Jobs | PASS | PostgresQueueProvider confirmed, PENDING→RUNNING→COMPLETED verified |
| RBAC | PASS | Organization header enforcement, OWNER auto-assigned, endpoint checks verified |
