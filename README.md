# AI Enterprise Automation Platform

An enterprise-grade, fully self-hosted automation platform powered by AI (OpenAI & Ollama), n8n, React, Node.js, and PostgreSQL.

## Architecture

This is a monorepo containing:
- **Frontend**: `apps/frontend` (React, Vite, Tailwind CSS v4, Zustand)
- **Backend**: `apps/backend` (Node.js, Express, Prisma, PostgreSQL)
- **Shared**: `packages/shared` (Types, interfaces, validation schemas)
- **Infrastructure**: `docker` (PostgreSQL, Redis, MinIO, n8n, Nginx)

## Phase 1 & 2 Complete Features

- **Monorepo Setup**: Configured with NPM Workspaces.
- **Docker Infrastructure**: Self-hosted Postgres (port `5433` to prevent local Windows conflict), Redis, MinIO, and n8n (`localhost:5678`).
- **Authentication**: Fully functional JWT-based authentication system with `bcrypt` password hashing.
  - Endpoints for Register, Login, Refresh, and User Info.
  - Zod strict schema validation.
  - RBAC (Role-Based Access Control) foundation via Postgres DB.
- **Frontend Dashboard**:
  - Secure state management with `Zustand` and persistent local storage.
  - React Router protected routes (`/login`, `/register`, `/`).
  - Beautiful, dynamic SaaS dashboard layout featuring glassmorphism and modern dark-mode UI.
- **n8n Webhook Integration**: Automated webhook trigger firing immediately upon new user registrations for downstream onboarding automation.

## Getting Started

1. **Start Infrastructure**:
   Navigate to `/docker` and run:
   ```bash
   docker compose up -d
   ```
2. **Start Backend Server**:
   Navigate to `/apps/backend` and run:
   ```bash
   npm run dev
   ```
   *(Swagger Docs available at http://localhost:4000/api-docs)*
3. **Start Frontend Server**:
   Navigate to `/apps/frontend` and run:
   ```bash
   npm run dev
   ```
   *(Frontend runs by default at http://localhost:5173)*

## Accounts

- **n8n Dashboard**: `admin` / `admin`
- **Application Test User**: `admin@admin.com` / `password123` (seeded by Prisma)
