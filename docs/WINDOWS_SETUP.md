# Windows Setup Guide — AI Enterprise Automation Platform

> Complete step-by-step guide for setting up the platform on Windows from scratch.

---

## 1. Requirements

Before starting, ensure you have or will install:

| Tool | Minimum Version | Purpose |
|---|---|---|
| Windows | 10 / 11 | Operating System |
| Node.js | 20.x LTS | Backend and frontend runtime |
| npm | 10.x | Package manager (bundled with Node.js) |
| Docker Desktop | 4.x | Runs PostgreSQL, Redis, MinIO, n8n |
| Git | 2.x | Source control |
| VS Code | latest | Recommended editor |
| Ollama | latest | Local LLM (optional) |

---

## 2. Install Node.js

**Option A — via winget (recommended):**
```powershell
winget install OpenJS.NodeJS.LTS
```

**Option B — manual download:**
Download from https://nodejs.org — choose the **LTS** installer.

Verify installation:
```powershell
node --version   # should print v20.x.x or higher
npm --version    # should print 10.x.x or higher
```

---

## 3. Install Git

```powershell
winget install Git.Git
```

Or download from https://git-scm.com/download/win

Verify:
```powershell
git --version
```

---

## 4. Install Docker Desktop

Download from: https://www.docker.com/products/docker-desktop

Run the installer and follow the prompts. Ensure **WSL 2** is enabled (the installer will prompt you).

After installation, **start Docker Desktop** from the Start menu and wait until the whale icon in the taskbar shows "Docker Desktop is running".

---

## 5. Verify Docker

```powershell
docker --version
docker compose version
docker ps
```

If `docker ps` returns without error, Docker is running correctly.

---

## 6. Clone the Repository

```powershell
# Navigate to where you want the project
cd C:\Projects

# Clone
git clone <repository-url> AI-Enterprise-Automatiom-Platform
cd AI-Enterprise-Automatiom-Platform
```

---

## 7. Install Dependencies

```powershell
# From the project root
npm install
```

This installs dependencies for all workspaces (frontend, backend, shared).

---

## 8. Create Environment File

```powershell
# Copy the example file
Copy-Item .env.example .env
```

Now open `.env` in VS Code and fill in your values:

```powershell
code .env
```

**Required fields to fill in:**

```env
# Database (leave defaults for local dev)
POSTGRES_USER=admin
POSTGRES_PASSWORD=password123
POSTGRES_DB=automation_platform
DATABASE_URL=postgresql://admin:password123@localhost:5433/automation_platform?schema=public

# JWT Secrets — CHANGE THESE
JWT_SECRET=replace_with_long_random_string_minimum_32_chars
JWT_REFRESH_SECRET=replace_with_different_long_random_string
REFRESH_TOKEN_SECRET=replace_with_different_long_random_string
ENCRYPTION_KEY=replace_with_32_char_hex_string_for_aes

# AI Providers (add what you have)
OPENAI_API_KEY=sk-your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
OLLAMA_BASE_URL=http://localhost:11434

# MinIO (leave defaults for local dev)
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=password123
MINIO_ENDPOINT=localhost
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password123
MINIO_BUCKET=documents

# n8n (fill in after first-time n8n setup below)
N8N_URL=http://localhost:5680
N8N_API_KEY=

# Email (Gmail SMTP — see AI Provider Setup section)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_char_app_password

# Frontend
FRONTEND_URL=http://localhost:5174
CORS_ORIGINS=http://localhost:5174
```

> ⚠️ **SECURITY WARNING:** Never share your `.env` file or commit it to git. The `.gitignore` already excludes it.

---

## 9. Start Docker Services

```powershell
# Navigate to the docker directory
cd docker

# Start all services in the background
docker compose up -d

# Verify all containers started
docker ps
```

You should see containers running for:
- `automation-postgres` (PostgreSQL)
- `automation-redis` (Redis)
- `automation-minio` (MinIO)
- `automation-n8n` (n8n)
- `automation-pgadmin` (pgAdmin)
- `automation-nginx` (Nginx)

If any container failed to start:
```powershell
docker compose logs <service-name>
# e.g.: docker compose logs postgres
```

---

## 10. Set Up the Database (Prisma)

```powershell
cd ..\apps\backend

# Generate the Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Validate the schema
npx prisma validate
```

> ⚠️ **DO NOT run `npx prisma migrate reset`** — this deletes all data in the database.

---

## 11. n8n First-Time Setup

1. Open http://localhost:5680 in your browser
2. Create an admin account (set username and password)
3. Go to **Settings** (bottom-left gear icon) → **n8n API**
4. Click **Create an API key**
5. Copy the full API key
6. Open your `.env` file and set:
   ```env
   N8N_API_KEY=eyJhbGc...your_full_key_here
   ```
7. The backend will pick this up automatically (tsx watch will restart the backend)

---

## 12. MinIO First-Time Setup

1. Open http://localhost:9001 in your browser
2. Login with your `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` from `.env`
3. Click **Buckets** → **Create Bucket**
4. Name it `documents` (must match `MINIO_BUCKET` in `.env`)
5. Click **Create Bucket**

The platform will now be able to upload and retrieve files.

---

## 13. Ollama Setup (Optional — Local LLM)

```powershell
# Install Ollama
winget install Ollama.Ollama

# After installation, pull a model
ollama pull llama3

# Verify Ollama is running
ollama list
```

Ensure your `.env` has:
```env
OLLAMA_BASE_URL=http://localhost:11434
```

Ollama runs automatically on Windows after installation.

---

## 14. Start the Backend

Open a **new PowerShell terminal**:

```powershell
cd apps\backend
npm run dev
```

You should see:
```
Backend server is running on http://localhost:4000
Swagger docs available at http://localhost:4000/api-docs
[PostgresQueue] Started polling for background jobs.
```

---

## 15. Start the Frontend

Open **another new PowerShell terminal**:

```powershell
cd apps\frontend
npm run dev
```

You should see:
```
  ➜  Local:   http://localhost:5174/
```

---

## 16. Access the Platform

Open your browser and navigate to:

| Service | URL |
|---|---|
| **Application** | http://localhost:5174 |
| **API** | http://localhost:4000 |
| **Swagger Docs** | http://localhost:4000/api-docs |
| **pgAdmin** | http://localhost:5050 |
| **MinIO Console** | http://localhost:9001 |
| **n8n** | http://localhost:5680 |

---

## 17. Gmail SMTP Setup (Optional — Email Features)

To enable OTP password reset emails and welcome emails:

1. Log in to your Gmail account
2. Go to **Google Account** → **Security** → **2-Step Verification** (enable if not already)
3. Go to **Security** → **App passwords**
4. Generate an App Password for "Mail" + "Windows Computer"
5. Copy the 16-character password
6. Set in `.env`:
   ```env
   SMTP_USER=your_gmail@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop
   EMAIL_FROM=AI Platform <your_gmail@gmail.com>
   ```

---

## 18. Common Errors

### Port already in use
```powershell
# Find what's using port 4000
netstat -aon | findstr :4000

# Kill the process (replace <PID> with the process ID)
taskkill /F /PID <PID>
```

Common port conflicts:
- `:4000` — Backend API
- `:5174` — Frontend
- `:5433` — PostgreSQL
- `:5680` — n8n
- `:9000` / `:9001` — MinIO
- `:6379` — Redis

### Docker not starting
- Open Docker Desktop and wait for the engine to fully start
- Check that WSL 2 is enabled in Docker Desktop Settings → General
- Restart Docker Desktop

### PostgreSQL connection refused
- Ensure the container is running: `docker ps | findstr postgres`
- Check the port: the container uses **5433** (not the default 5432)
- Verify `DATABASE_URL` in `.env` includes `@localhost:5433`

### Prisma migration failed
```powershell
# Check if postgres is healthy
docker ps
# Look for (healthy) next to automation-postgres

# Try again after postgres is healthy
cd apps\backend
npx prisma migrate dev --name init
```

### n8n API key missing or invalid
- Navigate to http://localhost:5680/settings/api
- Generate a new key
- Update `N8N_API_KEY` in `.env`
- The backend auto-reloads (tsx watch)

### Ollama not available
- Ensure Ollama is installed: `ollama --version`
- Ensure a model is pulled: `ollama list`
- Verify the service is running at http://localhost:11434

### Emails bounce or go to spam
- Ensure you're using a Gmail App Password (not your regular password)
- For automated testing only, set `TEST_MODE=true` in `.env` to skip sending to `@example.com` and `@test.com` addresses
- **Never leave `TEST_MODE=true` in production**

---

## 19. How to Stop All Services

```powershell
# Stop Docker services
cd docker
docker compose down

# Stop the backend and frontend
# Press Ctrl+C in each terminal window
```

---

## 20. How to Restart Services

```powershell
# Restart Docker services
cd docker
docker compose restart

# Or restart a specific service
docker compose restart postgres
docker compose restart n8n
```

---

## 21. ⚠️ DANGER — What NOT To Do

| ❌ Action | Why It's Dangerous |
|---|---|
| `docker compose down -v` | **Deletes all Docker volumes** — permanently destroys your database and MinIO data |
| `npx prisma migrate reset` | **Drops and recreates the database** — all data is lost |
| Deleting volumes in Docker Desktop | Same as above — permanent data loss |
| `DROP DATABASE` in pgAdmin | Destroys the entire database |
| Sharing your `.env` file | Exposes all your credentials |

---

## 22. Development vs Production Configuration

| Setting | Development | Production |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `JWT_SECRET` | Any string | Long, random, 64+ chars |
| `HTTPS` | Not required | **Required** |
| `CORS_ORIGINS` | `http://localhost:5174` | Your actual domain |
| `TEST_MODE` | `true` for testing | `false` |
| `SMTP` | Gmail App Password | Transactional email service |
| PostgreSQL | Docker local | Managed service or SSL-enabled |
| MinIO | Docker local | MinIO cluster or AWS S3 |
| `DATABASE_URL` | Port 5433 | Standard port 5432 or managed |

---

## 23. Backup Your Data

```powershell
# Backup PostgreSQL (run from host, not inside container)
docker exec automation-postgres pg_dump -U admin automation_platform > backup_$(Get-Date -Format 'yyyyMMdd').sql

# Restore from backup
Get-Content backup_20260815.sql | docker exec -i automation-postgres psql -U admin automation_platform
```

For MinIO: use the MinIO Console → **Buckets** → **Download** to export objects, or set up MinIO replication.
