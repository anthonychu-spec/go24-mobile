# STATE — GO24 Mobile App
## VERIFIED FACTS
- 2026-10-23: Staging droplet (178.128.208.52, `api-staging.go24fitness.com`) is **destroyed**. Last backup (~2026-09-30) kept as DigitalOcean snapshot `247670432`. Data rescued to `C:\Users\user\Documents\Claude\go24-backup\rescue-2026-10-23\` (go24 + gym_data dumps, real schema, `.env` secrets). DB held test data only (1 user).
- Server was on commit `78cc79f` (3 behind main). `/opt/go24-ops/backups` was empty — backup cron never ran.
- Caddy logs: 108k hits on `/v1/payments/webhook/adyen` (HMAC failing, Adyen retrying), ~4k `/.env` scans.
- `apps/member-app/src/api/client.ts:4` still targets the dead staging host; the app has no working backend.
- Other droplets `go24-chatwoot`, `ubuntu-s-1vcpu-2gb-sgp1` are unrelated services.
## RULES
- Never commit `go24-backup` into the repo. Rebuild migrations from `go24-schema.sql`; restore `.env` from `go24.env`.
- Treat PGM client secret as server-only; the app must never call PGM directly.
## OPEN FAILURES
- Repo migrations lack 6 tables + bookings columns/index (see docs/mvp-plan.md step 2).
- Security gaps listed in docs/mvp-plan.md (unauthenticated webhooks, legacy booking route, no rate limit, reconcile never checks PGM).
## LAST SESSION
- 2026-10-23 · Rescued data from snapshot via temp droplet (destroyed after). Wrote docs/mvp-plan.md (MVP incl. Facility Booking). Next: probe PGM tenant for ClubZones/FacilityBookingRules with rescued keys, then rebuild backend.
