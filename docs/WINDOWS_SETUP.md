# Windows Setup Guide — AI Enterprise Automation Platform

> Step-by-step guide to set up the project locally on Windows 10/11.

---

## Prerequisites

Before starting, ensure you have these installed:

| Tool | Version | Download |
|------|---------|---------|
| Node.js | 20.x or later | https://nodejs.org |
| npm | 10.x or later (comes with Node.js) | — |
| Git | Latest | https://git-scm.com |
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |
| VS Code | Latest (recommended) | https://code.visualstudio.com |

**Verify installations in PowerShell:**
```powershell
node --version   # Should be v20.x.x
npm --version    # Should be 10.x.x
git --version
docker --version
```

---

## Step 1: Clone the Repository

Open PowerShell and run:
```powershell
git clone https://github.com/ubaidullah0/AI-Enterprise-Automation-Platform.git
cd AI-Enterprise-Automation-Platform
```

---

## Step 2: Install Dependencies

From the project root (where `package.json` lives):
```powershell
npm install
```

This installs all workspace packages for `apps/backend`, `apps/frontend`, and `packages/shared`.

---

## Step 3: Start Docker Services

**Important:** Make sure Docker Desktop is running before this step.

```powershell
cd docker
docker compose up -d
```

This starts 6 services:
| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5433 | Main database |
| pgAdmin | 5050 | Database admin UI |
| Redis | 6379 | Cache |
| n8n | 5680 | Workflow automation |
| MinIO | 9000/9001 | Object storage |
| Nginx | 8080 | Reverse proxy |

Verify all services are running:
```powershell
docker compose ps
```

Go back to the project root:
```powershell
cd ..
```

---

## Step 4: Configure Environment Variables

```powershell
# Copy the backend env template
Copy-Item apps/backend/.env.example apps/backend/.env
```

Now open `apps/backend/.env` in VS Code and fill in all values:
```powershell
code apps/backend/.env
```

**Minimum required values to change:**
```env
# Database — use port 5433 (Docker maps to internal 5432)
DATABASE_URL=postgresql://your_postgres_user:your_postgres_password@127.0.0.1:5433/your_database_name?schema=public

# Security — generate these with: node -e "require('crypto').randomBytes(64).toString('hex') |& Write-Host"
JWT_SECRET=YOUR_GENERATED_64_CHAR_HEX_STRING
JWT_REFRESH_SECRET=YOUR_GENERATED_64_CHAR_HEX_STRING
ENCRYPTION_KEY=YOUR_GENERATED_64_CHAR_HEX_STRING

# AI Providers (at least one required for AI features)
OPENAI_API_KEY=sk-your-key
GEMINI_API_KEY=your-gemini-key

# n8n
N8N_URL=http://localhost:5680
N8N_API_KEY=your-n8n-api-key

# MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=your_minio_user
MINIO_ROOT_PASSWORD=your_minio_password
MINIO_BUCKET_NAME=automation-platform-docs

# Email (optional — without it, email features are skipped gracefully)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_char_app_password

# Frontend URL
FRONTEND_URL=http://localhost:5174
```

**Generate secure random secrets in PowerShell:**
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Configure frontend env:**
```powershell
Copy-Item apps/frontend/.env.example apps/frontend/.env
code apps/frontend/.env
```
```env
VITE_API_URL=http://localhost:4000/api/v1
```

---

## Step 5: Initialize the Database

```powershell
cd apps/backend

# Generate Prisma client code
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate dev --name init

# Go back to project root
cd ../..
```

**If you see errors about DIRECT_URL:**
Add this line to `apps/backend/.env`:
```env
DIRECT_URL=postgresql://your_postgres_user:your_postgres_password@127.0.0.1:5433/your_database_name?schema=public
```
(Same as DATABASE_URL for local development)

---

## Step 6: Run the Backend

Open a **new PowerShell window** and run:
```powershell
cd C:\path\to\AI-Enterprise-Automatiom-Platform
npm run dev --workspace=apps/backend
```

You should see:
```
Backend server is running on http://localhost:4000
Swagger docs available at http://localhost:4000/api-docs
```

Verify: Open http://localhost:4000 in your browser. You should see the API welcome page.

---

## Step 7: Run the Frontend

Open another **new PowerShell window** and run:
```powershell
cd C:\path\to\AI-Enterprise-Automatiom-Platform
npm run dev --workspace=apps/frontend
```

You should see:
```
  VITE v5.x.x  ready in X ms
  ➜  Local:   http://localhost:5174/
```

Open http://localhost:5174 in your browser.

---

## Step 8: Register Your First Account

1. Click **"Create account"** on the login page
2. Enter your email, password (min 8 chars), first name
3. A workspace organization is automatically created for you
4. You are logged in as **OWNER** of your workspace

---

## Service URLs Reference

| Service | URL |
|---------|-----|
| Frontend App | http://localhost:5174 |
| Backend API | http://localhost:4000 |
| API Swagger Docs | http://localhost:4000/api-docs |
| Health Check | http://localhost:4000/api/v1/health |
| pgAdmin (DB Admin) | http://localhost:5050 |
| n8n Automation | http://localhost:5680 |
| MinIO Console | http://localhost:9001 |

---

## Common Issues & Fixes

### Cannot connect to PostgreSQL
- Check Docker is running: `docker ps`
- Verify port 5433 is not in use: `netstat -aon | findstr :5433`
- Check DATABASE_URL uses port `5433` (not 5432)

### Prisma migration fails with DIRECT_URL error
Add to `apps/backend/.env`:
```env
DIRECT_URL=postgresql://USER:PASS@127.0.0.1:5433/DBNAME?schema=public
```

### Port 5174 already in use
```powershell
netstat -aon | findstr :5174
taskkill /PID [the-pid-number] /F
```

### n8n API key not working
1. Open http://localhost:5680
2. Go to Settings → API
3. Create a new API key
4. Copy it into `N8N_API_KEY` in your `.env`

### AI chat returns empty or error
Ensure your `OPENAI_API_KEY` or `GEMINI_API_KEY` is valid and has credits.

### Docker Compose up fails
```powershell
docker compose down -v   # Remove all containers + volumes
docker compose up -d     # Start fresh
```

---

## Development Workflow

```powershell
# Terminal 1: Backend
npm run dev --workspace=apps/backend

# Terminal 2: Frontend
npm run dev --workspace=apps/frontend

# Terminal 3: Docker monitoring (optional)
docker stats
```

---

## Stopping the Project

```powershell
# Stop dev servers: Press Ctrl+C in each terminal

# Stop Docker services
cd docker
docker compose down
```

---

## Building for Production

```powershell
# Build backend
npm run build --workspace=apps/backend

# Build frontend
npm run build --workspace=apps/frontend
# Output: apps/frontend/dist/
```
