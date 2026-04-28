# Stage 2 — PGM Adapter Hardening

**估時**：3 週
**前置**：Stage 1 merged
**目標**：PGM adapter production-grade，畀之後所有 feature 用

## Tasks

- [ ] 2.1 `packages/pgm-adapter` skeleton + `PgmClient` class
- [ ] 2.2 Config：base URL / API KEY / SECRET 從 env 讀
- [ ] 2.3 `axios-retry`：2x exponential，只 retry 5xx + timeout
- [ ] 2.4 `opossum` circuit breaker：window 30 req、threshold 50%、open 30s
- [ ] 2.5 Timeout 3000ms
- [ ] 2.6 `IBookingRepo` interface + `BOOKING_REPO` Symbol DI token
- [ ] 2.7 `PgmBookingAdapter` 實現：`listClasses` / `getClass` / `listMyBookings`
- [ ] 2.8 `error-normalize.ts` + fixture test（每條 PGM error 一條 test case）
- [ ] 2.9 Prometheus metrics：latency histogram、error rate per endpoint
- [ ] 2.10 `GET /classes?date=&club=` — 經 adapter 拎返 class list
- [ ] 2.11 `GET /bookings` — 我嘅 booking list（read only）
- [ ] 2.12 Member app Classes tab → 真實 PGM data
- [ ] 2.13 Chaos test：kill PGM network 30s，app 要 return `UPSTREAM_DOWN` 唔可以 5xx
- [ ] 2.14 Shadow read framework（spec only，Stage 3 用）

## 驗收

- Classes tab 見到真實 class list
- 殺 PGM server，mobile app 顯示友善錯誤，唔會 hang
- Chaos test：kill PGM network 30s 期間 return `UPSTREAM_DOWN`
- Error normalize：餵 20 條已知 PGM error 全部 map 正確
- Shadow read：mock PGM ghost → trigger `pgm_ghost_booking` alert

## 參考

- `00-architecture.md` § Production Hardening §2
- `00-architecture.md` § Execution Blueprint（Interface first + Error normalize code）

## Notes / Decisions
## Blockers
