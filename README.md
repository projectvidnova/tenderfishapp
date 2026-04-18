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
