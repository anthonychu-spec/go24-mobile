# GO24 Fitness — Mobile Apps

Monorepo for Member App + Trainer App + Backend API, replacing Perfect Gym Pro (PGM) front-end.

## Quick start

```bash
# Prereqs: Node 20+, pnpm 10+, Docker

# 1. Install dependencies
pnpm install

# 2. Copy env
cp .env.example .env.local

# 3. Start Postgres + Redis
cd infra/docker && docker compose up -d && cd ../..

# 4. Run everything (member-app + trainer-app + nest-api)
pnpm dev
```

Member app → scan Expo QR with Expo Go
Trainer app → scan Expo QR (different port)
API → http://localhost:3000

## Structure

```
apps/
  member-app/         React Native (Expo) — 會員 app
  trainer-app/        React Native (Expo) — 教練 app
packages/
  shared-ui/          共用 UI component + theme
  api-client/         auto-gen from OpenAPI
  shared-types/       共用 DTO types
  config/             ESLint / TS preset
backend/
  nest-api/           NestJS API gateway
infra/
  docker/             docker-compose + init SQL
  db/migrations/      node-pg-migrate files
pgm-import/           (legacy) n8n workflows + daily PGM import
```

## Documentation

Plan + architecture lives at `.claude/plans/for-for-refactored-tiger.md` (overview) + `for-for-refactored-tiger/` folder (details).

## Scripts

```bash
pnpm dev          # Start all in parallel
pnpm build        # Build all
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm test         # Jest
pnpm format       # Prettier write
```

## Tech stack

- React Native + Expo (EAS Build) — mobile
- NestJS — API gateway
- PostgreSQL 16 + pgvector + Redis
- pnpm workspace + Turborepo
- Adyen (payment) + n8n (WhatsApp / face matching) + Sentry (errors)
