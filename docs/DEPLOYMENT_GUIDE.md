# Deployment Guide

This guide explains how the AI Enterprise Automation Platform is deployed in production.

## 1. Cloud Architecture

The current production architecture separates the frontend, backend API, and database into distinct managed services:

1. **Frontend:** Vercel (Edge CDN)
2. **Backend API:** Render.com (Web Service)
3. **Database:** Render PostgreSQL

## 2. Environment Variables Required

For the production backend (Render), the following environment variables must be securely injected as Environment Secrets:

- `DATABASE_URL`: Connection string for PostgreSQL.
- `DIRECT_URL`: Required by Prisma for migrations if `DATABASE_URL` uses a connection pooler (like Supabase/Render).
- `JWT_SECRET` & `JWT_REFRESH_SECRET`: Secure, random strings (e.g., generated via `openssl rand -hex 32`).
- `ENCRYPTION_KEY`: A 64-character hex string (32 bytes) used for AES-256-GCM encryption of Organization API keys.
- `FRONTEND_URL` & `APP_URL`: The production Vercel URL (for CORS and email links).
- `SMTP_USER` & `SMTP_PASS`: For outgoing emails.

## 3. Frontend Deployment (Vercel)

The frontend is deployed to Vercel via Git integration.
- **Framework Preset:** Vite
- **Build Command:** `npm run build --workspace=apps/frontend`
- **Output Directory:** `apps/frontend/dist`
- **Environment Variables:**
  - `VITE_API_URL`: Points to the Render backend URL (e.g., `https://my-backend.onrender.com`).

*Note:* A Husky git hook runs on `prepare`. To prevent Vercel builds from failing, `is-ci || husky install` is used in the root `package.json`.

## 4. Backend Deployment (Render)

The backend is deployed as a Node.js Web Service on Render.
- **Build Command:** `npm install && npm run build --workspace=apps/backend && npx prisma generate`
- **Start Command:** `npm start --workspace=apps/backend`

Render automatically detects the `apps/backend/package.json` if configured, or you can run commands from the repository root.

## 5. Self-Hosting via Docker (Alternative)

For complete self-hosting on a single VPS (e.g., DigitalOcean Droplet, AWS EC2), you can adapt the `docker/docker-compose.yml` file.

1. Install Docker and Docker Compose on the server.
2. Clone the repository.
3. Update `.env` with production secrets and your server's public IP/Domain.
4. Add a `Dockerfile` for the backend and frontend.
5. Create a `docker-compose.prod.yml` that includes Nginx as a reverse proxy with Let's Encrypt SSL certificates.
6. Run `docker compose -f docker-compose.prod.yml up -d`.

*Warning:* The current `docker-compose.yml` is optimized for local development. A production self-hosted deployment requires setting up TLS/SSL and removing port bindings (`ports: - "5433:5432"`) for internal services to prevent exposing databases directly to the public internet.
