# Deployment & Operations — AI Enterprise Automation Platform

---

## 1. Current Development Setup

In the local development environment:
- Infrastructure runs in Docker via `docker-compose.yml`
- Backend runs natively using `tsx watch` (hot-reloading)
- Frontend runs natively using Vite (HMR)
- Default credentials are used for simplicity
- Ports are mapped directly to `localhost`

---

## 2. Production Preparation Checklist

Before deploying this platform to a production environment, the following changes **MUST** be made.

### Security & Secrets
- [ ] Generate a secure 64+ character random string for `JWT_SECRET`
- [ ] Generate a secure 64+ character random string for `JWT_REFRESH_SECRET`
- [ ] Generate a secure 64+ character random string for `REFRESH_TOKEN_SECRET`
- [ ] Generate a secure 32-character hex string for `ENCRYPTION_KEY`
- [ ] Change `POSTGRES_PASSWORD` and `PGADMIN_PASSWORD`
- [ ] Change `MINIO_ROOT_PASSWORD`
- [ ] Generate a real, secure `N8N_API_KEY` in the n8n dashboard
- [ ] Set `TEST_MODE=false` (Do not skip email delivery)
- [ ] Use a real SMTP transactional email service (SendGrid, Mailgun, AWS SES), not a personal Gmail App Password

### Network & Routing
- [ ] Deploy behind a reverse proxy (Nginx, Traefik, Caddy, or AWS ALB)
- [ ] Enable HTTPS / TLS on the reverse proxy
- [ ] Set `NODE_ENV=production` on both frontend and backend
- [ ] Set `CORS_ORIGINS` to your exact production frontend domain (e.g., `https://app.yourdomain.com`)
- [ ] Set `FRONTEND_URL` and `APP_URL` to match

### Infrastructure
- [ ] Consider using a managed PostgreSQL service (AWS RDS, Google Cloud SQL) instead of Docker PostgreSQL for automated backups and HA.
- [ ] Consider migrating MinIO to AWS S3 or Google Cloud Storage for better durability.
- [ ] Do not expose ports like 5433 (PG) or 6379 (Redis) to the public internet. Keep them inside a private VPC or Docker network.

---

## 3. Building for Production

Do not run `npm run dev` in production. You must compile the TypeScript code.

### Backend Build
```powershell
cd apps/backend
npm install --production=false  # install dev dependencies for build
npm run build                   # runs tsc
npm prune --production          # remove dev dependencies

# Start server
NODE_ENV=production node dist/index.js
```

### Frontend Build
```powershell
cd apps/frontend
npm install
npm run build                   # runs Vite build

# Serve the static files
# Copy the contents of apps/frontend/dist to your web server (Nginx, S3, Vercel, Netlify)
```

---

## 4. Database Migrations in Production

When deploying updates that change the Prisma schema:

**DO NOT USE:** `npx prisma migrate dev` (this can reset data if it detects drift).
**DO NOT USE:** `npx prisma migrate reset` (this deletes all data).

**USE:**
```powershell
cd apps/backend
npx prisma migrate deploy
```
This safely applies pending migrations to the production database.

---

## 5. Environment Variable Management

- **Never** commit your `.env` file to version control.
- In production, inject environment variables using your orchestrator (Docker Swarm, Kubernetes Secrets, AWS Secrets Manager, or your PaaS dashboard).
- The `ENCRYPTION_KEY` is critical. If lost, all stored API keys in `OrganizationApiKey` will become unreadable.

---

## 6. Monitoring & Logging

- The backend uses **Pino** for structured JSON logging.
- In production, remove `pino-pretty` (it's slow) and pipe raw JSON logs to an aggregator (Datadog, ELK stack, CloudWatch).
- **Health Check:** Monitor `GET /api/v1/health`. It returns HTTP 200 if the API and database are connected, 503 otherwise.
- **Deep Health Check:** Monitor `GET /api/v1/analytics/health` (requires admin auth) for statuses on Redis, MinIO, n8n, OpenAI, and Ollama.

---

## 7. Backup Guidance

### PostgreSQL
If using the Docker PostgreSQL container, run daily dumps from the host:
```bash
docker exec automation-postgres pg_dump -U admin automation_platform > /backups/db_backup_$(date +%F).sql
```
(Better: use a managed DB service that handles this automatically.)

### MinIO
MinIO data is stored in the Docker volume `minio_data`. Back this up, or set up MinIO bucket replication.

### Docker Volumes
**NEVER** run `docker compose down -v` unless you intend to permanently destroy all data. Use `docker compose down` (without `-v`) to stop containers while preserving data.

---

## 8. Scaling Considerations

The platform is designed to scale:
- **Stateless Backend:** The Express API stores sessions in JWTs, not server memory. You can run multiple instances of the backend behind a load balancer.
- **Redis Cache:** Used by BullMQ (if enabled later) or session states.
- **Database Connection Pooling:** Ensure Prisma connection limits do not exhaust PostgreSQL if you run many backend instances.

---

## 9. Docker Production Notes

The current `docker/docker-compose.yml` is optimized for local development. For production:
- Build the Node.js backend into a lightweight Docker image (e.g., `node:20-alpine`).
- Serve the Vite frontend via an Nginx container.
- Use Docker Swarm or Kubernetes for orchestration.
