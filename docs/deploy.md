# Deploy

There is one deploy path: the manual GitHub Actions workflow **Deploy to Droplet**
(`.github/workflows/deploy.yml`). Nothing deploys on push, and there is no local
deploy script (the old `deploy.sh` pushed `main` and targeted the destroyed staging
host; removed 2026-10-26).

- **First server setup** (droplet, DNS, `/opt/go24/.env`, backups, monitoring):
  follow [`gates/M2-server-runbook.md`](gates/M2-server-runbook.md). Opening the
  server and the domain need Anthony's approval (gate M2).
- **Each deploy:** Anthony runs the workflow with the full commit SHA to ship. It
  refuses a SHA without a successful CI run, runs database migrations before the
  new container starts, fails if the health check never passes, and rolls back to
  the previous image.
- **On the server** every Compose command needs the env file, because Compose
  otherwise looks for `.env` next to the compose file:

```bash
docker compose --env-file /opt/go24/.env -f infra/droplet/docker-compose.prod.yml ps
```

```bash
docker compose --env-file /opt/go24/.env -f infra/droplet/docker-compose.prod.yml logs -f api
```

- Keep `BACKGROUND_JOBS_ENABLED=false` until Anthony approves live PGM writes
  (gate M9); with it off, no cron books, cancels or sends push on its own.
- `/api-docs` and `/v1/metrics` are not public: Swagger is off in production and
  Caddy answers 404 for both.
