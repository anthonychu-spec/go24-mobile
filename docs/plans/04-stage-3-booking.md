# Stage 3 — Booking Write + State Machine

**估時**：3 週
**前置**：Stage 2 merged
**目標**：會員可以 book / cancel / 入 waitlist，production-grade

## Tasks

- [ ] 3.1 DB migration：`bookings`, `booking_events`, `idempotency_keys`, `outbox_events`
- [ ] 3.2 CHECK constraint `confirmed_has_external`
- [ ] 3.3 `IdempotencyRepository.tryClaim()` — atomic `INSERT ON CONFLICT`
- [ ] 3.4 `BookingService.book()` — 按 blueprint 完整實作
- [ ] 3.5 State machine validator（invalid transition reject）
- [ ] 3.6 `booking_events` audit write on every transition
- [ ] 3.7 `POST /bookings` controller + `Idempotency-Key` middleware
- [ ] 3.8 `DELETE /bookings/:id` + idempotency
- [ ] 3.9 Waitlist API `acceptWaitlist` flag（唔自動 fallback）
- [ ] 3.10 Transactional Outbox：dispatcher BullMQ worker
- [ ] 3.11 Shadow read BullMQ job（2s delay，3 attempts）
- [ ] 3.12 Reconcile job：掃 `pending` > 60s 同 `pending_verify` 每 5 min
- [ ] 3.13 Member app：class detail → book → success modal（calendar / reminder）
- [ ] 3.14 Member app：my bookings list + cancel flow
- [ ] 3.15 Test：k6 50 concurrent 搶最後 1 位；idempotency 100x same key；chaos PGM timeout

## 驗收

- 100 人同時 book 最後 1 個位，只 1 個 success、其餘正確入 waitlist 或 fail
- 重複 call 同一 key 唔會 double book
- 每條 state transition 覆蓋，invalid transition reject
- PGM timeout 落 `pending_verify`，reconcile 5 min 後 resolve

## 參考

- `00-architecture.md` § Execution Blueprint（完整 service code）
- `00-architecture.md` § Production Hardening §1

## Notes / Decisions
## Blockers
