# Stage 3.5 — Data Sync Tier 1

**估時**：1 週
**前置**：Stage 3 merged
**目標**：本地 DB 同 PGM near-realtime 一致

## Tasks

- [ ] 3.5.1 加 `last_synced_at` / `source` / `version` column 到 `bookings`, `classes`
- [ ] 3.5.2 `POST /webhooks/pgm` endpoint + signature verify（如 PGM 支援 webhook）
- [ ] 3.5.3 Polling fallback：BullMQ cron 每 60s pull recently_modified
- [ ] 3.5.4 Conflict resolver algorithm + unit test
- [ ] 3.5.5 Admin dashboard `/admin/conflicts`（簡單 Next.js page）
- [ ] 3.5.6 Sentry alert on conflict

## 驗收

- 人手喺 PGM web 改一張 booking → 60 秒內 local DB 更新
- 同時改 local + PGM → conflict log 出現

## 參考

- `00-architecture.md` § Production Hardening §3（Conflict Resolver）

## Notes / Decisions
## Blockers
