# Architecture — AI Enterprise Automation Platform

> Version 1.0.0 | Last Updated: 2026-08-18

---

## System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        FE["React 18 Frontend\nVite · TailwindCSS · @xyflow/react\nZustand · React Router"]
    end

    subgraph "API Layer"
        BE["Express 5 Backend\nTypeScript · Prisma ORM\nHelmet · CORS · Pino"]
    end

    subgraph "AI Layer"
        OAI["OpenAI\nGPT-4o"]
        GEM["Google Gemini\n2.0 Flash"]
        OLL["Ollama\nLocal LLMs"]
    end

    subgraph "Infrastructure"
        PG["PostgreSQL 16\nPort 5433"]
        RD["Redis 7\nPort 6379"]
        N8N["n8n\nPort 5680"]
        MIO["MinIO S3\nPort 9000/9001"]
        NGX["Nginx\nPort 8080"]
    end

    FE -- "REST + SSE (HTTPS)" --> BE
    BE -- "Prisma ORM" --> PG
    BE -- "Cache" --> RD
    BE -- "Workflow API" --> N8N
    BE -- "AWS SDK (S3)" --> MIO
    BE -- "API Calls" --> OAI & GEM & OLL
    NGX --> BE & FE
```

---

## Component Architecture

```mermaid
graph LR
    subgraph "Frontend (apps/frontend)"
        APP["App.tsx\nRoute Guards"]
        LAYOUT["DashboardLayout\nSidebar + Navbar"]
        PAGES["Pages\n8 sections"]
        STORE["Zustand\nauthStore"]
        APILIB["axios api.ts\nInterceptors"]
    end

    subgraph "Backend (apps/backend)"
        ROUTES["Routes\n11 routers"]
        CTRL["Controllers\n12 controllers"]
        SVC["Services\n10 services"]
        MW["Middleware\nauth + rbac"]
        PRISMA["Prisma Client\n15 DB models"]
    end

    APP --> LAYOUT --> PAGES
    PAGES --> STORE & APILIB
    APILIB -- "JWT + OrgID Headers" --> ROUTES
    ROUTES --> MW --> CTRL --> SVC --> PRISMA
```

---

## Database Schema

```mermaid
erDiagram
    User {
        String id PK
        String email UK
        String passwordHash
        String firstName
        String lastName
        Boolean isEmailVerified
        String systemRoleId FK
        String activeOrganizationId
    }

    Organization {
        String id PK
        String name
    }

    OrganizationMember {
        String id PK
        String userId FK
        String organizationId FK
        String roleId FK
    }

    OrganizationRole {
        String id PK
        String name UK
        Json permissions
    }

    Workflow {
        String id PK
        String organizationId FK
        String name
        String engine
        Json nodes
        Json edges
        Boolean isActive
        Boolean aiGenerated
    }

    WorkflowRun {
        String id PK
        String workflowId FK
        String status
        Int durationMs
        Json inputData
        Json outputData
    }

    Conversation {
        String id PK
        String organizationId FK
        String userId
        String title
        String provider
    }

    Message {
        String id PK
        String conversationId FK
        String role
        String content
        Int tokens
        Float costUsd
        Int latencyMs
    }

    OrganizationApiKey {
        String id PK
        String organizationId FK
        String provider
        String label
        String encryptedKey
        String keyHint
        Boolean isDefault
    }

    Document {
        String id PK
        String organizationId FK
        String fileName
        String fileUrl
    }

    BackgroundJob {
        String id PK
        String organizationId FK
        String type
        String status
        Int attempts
    }

    AuditLog {
        String id PK
        String organizationId FK
        String userId FK
        String resource
        String action
        Json oldData
        Json newData
    }

    User ||--o{ OrganizationMember : "belongs to"
    Organization ||--o{ OrganizationMember : "has"
    OrganizationRole ||--o{ OrganizationMember : "assigned to"
    Organization ||--o{ Workflow : "owns"
    Workflow ||--o{ WorkflowRun : "has"
    Organization ||--o{ Conversation : "has"
    Conversation ||--o{ Message : "contains"
    Organization ||--o{ OrganizationApiKey : "manages"
    Organization ||--o{ Document : "stores"
    Organization ||--o{ BackgroundJob : "queues"
    Organization ||--o{ AuditLog : "logs"
```

---

## Request Flow: Auth

```mermaid
sequenceDiagram
    participant C as Frontend
    participant B as Backend
    participant DB as PostgreSQL

    C->>B: POST /api/v1/auth/register { email, password }
    B->>B: Zod validation
    B->>DB: Check email uniqueness
    B->>DB: Create User + SystemRole + Organization + OrganizationMember (transaction)
    B->>C: 201 { user, accessToken, refreshToken }

    C->>B: POST /api/v1/auth/login { email, password }
    B->>DB: findUnique User
    B->>B: bcrypt.compare password
    B->>B: jwt.sign (15min access + 7d refresh)
    B->>C: 200 { user, accessToken, refreshToken }
```

---

## Request Flow: AI Streaming Chat

```mermaid
sequenceDiagram
    participant C as Frontend (AssistantDashboard)
    participant B as Backend (ai.controller)
    participant DB as PostgreSQL
    participant AI as AI Provider

    C->>B: POST /api/v1/ai/chat/stream<br/>{ prompt, provider, conversationId }
    B->>B: requireAuth (JWT)
    B->>DB: Get/create Conversation
    B->>DB: Load last 20 messages (context)
    B->>DB: Save user message
    B->>B: resolveOrgKey() [org key or .env fallback]
    B->>C: Set SSE headers (text/event-stream)
    B->>AI: streamChat(messages, onToken callback)

    loop Stream tokens
        AI-->>B: chunk (token text)
        B-->>C: data: {"token":"..."}\n\n
    end

    B->>DB: Save assistant message (full text)
    B-->>C: data: {"done":true,...}\n\n
```

---

## Security Architecture

```mermaid
graph TB
    subgraph "Request Lifecycle"
        REQ["Incoming Request"]
        HELMET["Helmet.js\nSecurity Headers"]
        CORS["Dynamic CORS\nOrigin Validation"]
        PARSE["Body Parser\n10MB Limit"]
        AUTH["requireAuth\nJWT Verification"]
        RBAC["requireOrgRole\nRole Check"]
        CTRL["Controller"]
    end

    REQ --> HELMET --> CORS --> PARSE --> AUTH --> RBAC --> CTRL

    subgraph "Secrets Protection"
        AES["AES-256-GCM\nEncrypt API Keys"]
        HASH["bcrypt(10)\nPassword Hashing"]
        JWT["JWT HS256\nSigned Tokens"]
    end
```

---

## Service Port Map

| Service | External Port | Internal Port | Container Name |
|---------|--------------|---------------|----------------|
| Frontend (dev) | 5174 | — | — |
| Backend API | 4000 | — | — |
| PostgreSQL | 5433 | 5432 | automation-postgres |
| pgAdmin | 5050 | 80 | automation-pgadmin |
| Redis | 6379 | 6379 | automation-redis |
| n8n | 5680 | 5678 | automation-n8n |
| MinIO API | 9000 | 9000 | automation-minio |
| MinIO Console | 9001 | 9001 | automation-minio |
| Nginx | 8080 | 80 | automation-nginx |
| Ollama (local) | 11434 | — | — |

---

## Deployment Architecture (Production)

```
Browser → Vercel Edge CDN
            ↓ (HTTPS)
         React App (Vercel)
            ↓ (HTTPS API calls)
         Render.com (Backend)
            ↓ (DATABASE_URL via Prisma connection pooler)
         Supabase PostgreSQL (Render Postgres)
            ↓
         External services: OpenAI · Gemini · n8n (optional)
```

- Frontend: **Vercel** (`ai-enterprise-automation-platform-f.vercel.app`)
- Backend: **Render** (`ai-enterprise-automation-platform.onrender.com`)
- Database: **Render PostgreSQL** (external via `DIRECT_URL`)

---

## Backend File Structure

```
apps/backend/src/
├── index.ts                    # Express app entry point, middleware, routes
├── middleware/
│   ├── auth.middleware.ts       # JWT verification → req.user
│   └── rbac.middleware.ts       # Org role check + audit log decorator
├── routes/                     # 11 Express routers
│   ├── auth.routes.ts          # /api/v1/auth/*
│   ├── org.routes.ts           # /api/v1/orgs/*
│   ├── workflow.routes.ts      # /api/v1/workflows/*
│   ├── ai.routes.ts            # /api/v1/ai/*
│   ├── analytics.routes.ts     # /api/v1/analytics/*
│   ├── audit.routes.ts         # /api/v1/audit-logs/*
│   ├── org-api-keys.routes.ts  # /api/v1/org-api-keys/*
│   ├── notification.routes.ts  # /api/v1/notifications/*
│   ├── documents.routes.ts     # /api/v1/documents/*
│   ├── webhook.routes.ts       # /api/v1/webhooks/:token
│   └── jobs.routes.ts          # /api/v1/jobs/*
├── controllers/               # 12 route handler files
├── services/
│   ├── ai.service.ts          # OpenAI, Gemini, Ollama providers + factory
│   ├── ai-workflow-generator.service.ts  # Prompt → workflow JSON
│   ├── analytics.service.ts   # Metrics aggregation queries
│   ├── email.service.ts       # Nodemailer (Welcome, OTP, Password Reset)
│   ├── encryption.service.ts  # AES-256-GCM encrypt/decrypt
│   ├── n8n.service.ts         # n8n REST API client
│   ├── notification.service.ts # Create DB notifications
│   ├── org-api-keys.service.ts # Org API key CRUD + validation
│   ├── storage.service.ts     # MinIO S3 upload/download
│   ├── workflow-engine.service.ts  # BFS native node executor
│   └── jobs/
│       ├── job-queue.interface.ts   # IJobQueue interface
│       ├── job-queue.service.ts     # Service singleton
│       └── postgres-queue.provider.ts  # PostgreSQL-backed queue
├── schemas/
│   ├── auth.schema.ts          # Register, Login Zod schemas
│   ├── org.schema.ts           # Org CRUD, invite Zod schemas
│   └── org-api-keys.schema.ts  # Org API key Zod schemas
└── utils/
    ├── prisma.ts               # PrismaClient singleton
    └── requestHelpers.ts       # getHeader, requireOrgHeader, getParam
```

---

## Frontend File Structure

```
apps/frontend/src/
├── App.tsx                     # BrowserRouter, Routes, ProtectedRoute guard
├── lib/
│   ├── api.ts                  # Axios instance + JWT/OrgID interceptors
│   └── utils.ts                # cn() TailwindCSS class merger
├── store/
│   └── authStore.ts            # Zustand persisted auth state
├── components/
│   └── NotificationBell.tsx    # Polling notification dropdown
├── layouts/
│   └── DashboardLayout.tsx     # Sidebar, nav, org switcher, header
└── pages/
    ├── Dashboard.tsx           # Overview metrics + recent workflows
    ├── ai/
    │   └── AssistantDashboard.tsx  # Multi-provider SSE chat UI
    ├── analytics/
    │   └── AnalyticsDashboard.tsx  # Charts, metrics, health checks
    ├── audit/
    │   └── AuditComplianceDashboard.tsx  # Filterable audit log table
    ├── auth/
    │   ├── Login.tsx           # Sign in + forgot password
    │   ├── Register.tsx        # Registration form
    │   ├── ResetPassword.tsx   # Legacy token reset
    │   ├── OtpVerification.tsx # 6-digit OTP input
    │   └── NewPassword.tsx     # New password form
    ├── documents/
    │   └── DocumentManager.tsx # File upload/list/download
    ├── settings/
    │   ├── SettingsPage.tsx    # Settings with 6 tabs
    │   └── components/
    │       ├── ApiKeyManager.tsx    # Org-level AI key management UI
    │       └── JobQueueManager.tsx  # Background job monitoring UI
    ├── team/
    │   └── TeamManagement.tsx  # Member list + role + invite
    └── workflows/
        ├── WorkflowDashboard.tsx   # Workflow list + run/delete
        ├── WorkflowBuilder.tsx     # React Flow canvas builder
        └── components/
            └── AiWorkflowWizard.tsx  # Natural language → workflow
```
