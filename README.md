# TenderFish

German construction project management application.

## Prerequisites

- Node.js 20+
- Docker Desktop
- PowerShell 5.1+

## Getting Started

1. Copy `.env.example` to `.env` and fill in the required values.

2. Install dependencies:

   ```
   npm install
   ```

3. Start the dev environment (Docker, DB schema push, API + Web):

   ```
   npm run dev:start
   ```

   Or run the script directly:

   ```
   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1
   ```

This will:
- Start Postgres and Redis via Docker Compose
- Wait for Postgres to be healthy
- Push any pending DB schema changes via `drizzle-kit push`
- Kill stale processes on ports 3001/3002
- Start the API (http://localhost:3001) and Web (http://localhost:3002) servers via `turbo dev`

## Production Deployment (IONOS)

Infrastructure: IONOS VPS + Managed PostgreSQL + S3 Object Storage

1. Provision an IONOS VPS (Cloud Server M or larger, Ubuntu 22.04)
2. Run the setup script on the VPS:
   ```
   bash infra/setup-ionos.sh
   ```
3. Copy `docker-compose.production.yml` and `infra/Caddyfile` to `/opt/tenderfish/`
4. Create `.env` with production values (see `infra/setup-ionos.sh` output)
5. Update `infra/Caddyfile` — replace `YOUR_DOMAIN` with your actual domain
6. Start the stack:
   ```
   docker compose -f docker-compose.production.yml up -d
   ```

CI/CD is handled via GitHub Actions (`.github/workflows/deploy.yml`). Pushing to `main` builds images and deploys automatically.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `IONOS_HOST` | VPS public IP address |
| `IONOS_USER` | SSH user (e.g. `tenderfish`) |
| `IONOS_SSH_KEY` | Private SSH key for the VPS |

### Required GitHub Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | e.g. `https://yourdomain.com/api` |
| `NEXT_PUBLIC_APP_URL` | e.g. `https://yourdomain.com` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
