# STATE — GO24 Mobile App
## VERIFIED FACTS
- 2026-10-23: Staging droplet (178.128.208.52, `api-staging.go24fitness.com`) is **destroyed**. Last backup (~2026-09-30) kept as DigitalOcean snapshot `247670432`. Data rescued to `C:\Users\user\Documents\Claude\go24-backup\rescue-2026-10-23\` (go24 + gym_data dumps, real schema, `.env` secrets). DB held test data only (1 user).
- Server was on commit `78cc79f` (3 behind main). `/opt/go24-ops/backups` was empty — backup cron never ran.
- Caddy logs: 108k hits on `/v1/payments/webhook/adyen` (HMAC failing, Adyen retrying), ~4k `/.env` scans.
- `apps/member-app/src/api/client.ts:4` still targets the dead staging host; the app has no working backend.
- Other droplets `go24-chatwoot`, `ubuntu-s-1vcpu-2gb-sgp1` are unrelated services.
- 2026-10-24 (Anthony): Staff app is NOT moved into this repo. Two apps — member app here, Staff app native Expo rewrite in `hrms/apps/mobile` (board C5). `apps/trainer-app` is a 20-line scaffold, superseded by the Staff app; not deleted.
- 2026-10-26 (Anthony): Member apps = THE LAB, Foundry, GO24 from one white-label Expo codebase (`apps/member-app`). First store release = core features only; **THE LAB ships first**, then Foundry, then GO24 (Anthony designing the GO24 template). One group Apple/Google developer account for all three. Plan: `docs/member-apps-launch-plan.md`.
## RULES
- Never commit `go24-backup` into the repo. Rebuild migrations from `go24-schema.sql`; restore `.env` from `go24.env`.
- Treat PGM client secret as server-only; the app must never call PGM directly.
## OPEN FAILURES
- Repo migrations lack 6 tables + bookings columns/index (see docs/mvp-plan.md step 2).
- Security gaps listed in docs/mvp-plan.md (unauthenticated webhooks, legacy booking route, no rate limit, reconcile never checks PGM).
## LAST SESSION
- 2026-10-23 · Rescued data from snapshot via temp droplet (destroyed after). Wrote docs/mvp-plan.md (MVP incl. Facility Booking). Next: probe PGM tenant for ClubZones/FacilityBookingRules with rescued keys, then rebuild backend.
- 2026-10-26 · CLOSE · Planning only, no code. Wrote `docs/member-apps-launch-plan.md` (LAB core v1 → Foundry → GO24; ~8 weeks to LAB submission with 1 backend + 1 app dev). Next: OFFICE adds board item + brief, Anthony starts gates G1–G6 (D-U-N-S/Apple account first); code only after Anthony opens the board item.
- 2026-10-26 · CLOSE · Planning only. Wrote `docs/backend-plan.md` (LAB v1 backend: ~25 days / 5–6 weeks; decisions B1–B8). Found: no migration runner exists (SQL files never applied; init only creates 2 tables); `.github/workflows/deploy.yml` auto-deploys on push to `main` — must become manual-only before any backend push; Redis in compose is unused; rescued DB had 0 rows in every table (no data to migrate).
- 2026-10-26 · CLOSE · API decision: use PGM v2.2 management API from our server (current code); do NOT call the GO member API `goapi2.perfectgym.com` (no authorization; Codex research GATE-04) until PGM approves in writing. Anthony emailed PGM 2026-10-26 asking for their recommendation, goapi2 use, v2.2 booking-rule differences, per-court zones, rate limits, limited API client — tracked as gate G7, does not block work. Next unchanged: OFFICE board item + brief → Anthony opens it → backend week 1.
- 2026-10-26 · CLOSE · Anthony asked in session: packaged ChatGPT `GO24-Member-App-v1.2-Foundry.zip` as `apps/go24-prototype-web` (installable PWA, same setup as `lab-prototype-web`; app code unchanged; icons cut from the red mark in `assets/logo.png`; local preview port 4184, launch config `go24-prototype-web`). Verified locally: SW active, 42 files cached, page loads with server stopped. Committed locally on main (not pushed; zip left out), not deployed, no board item (OFFICE to log if wanted). BOFA courts/coaches/prices are Foundry sample data, not confirmed.
