# Stage 10 — Launch

**估時**：2 週
**前置**：Stage 9 merged
**目標**：App Store + Play Store 上架，分批 rollout

## Tasks

- [ ] 10.1 App Store 審核提交（iOS Face data 要寫清楚 usage）
- [ ] 10.2 Play Store 審核提交
- [ ] 10.3 生產 infra：Postgres primary + replica、Redis、Nginx、Cloudflare
- [ ] 10.4 Runbook：deploy / rollback / DB migration / incident response
- [ ] 10.5 Monitoring dashboard（Grafana）：P99 latency / error rate / booking success rate
- [ ] 10.6 漸進式 rollout：新會員強制用新 app，舊會員自願 opt-in
- [ ] 10.7 櫃台培訓（教練 + reception）
- [ ] 10.8 會員 announcement（email + WhatsApp + in-app notice）
- [ ] 10.9 前 2 週 on-call 24/7
- [ ] 10.10 1 個月後：decide Phase 2 kick-off（`NativeBookingAdapter` 取代 `PgmBookingAdapter`）

## 驗收

- App Store + Play Store 上架
- 第一週 active user > 50
- Crash-free rate > 99.5%

## Phase 2 Kick-off Decision (T+1 個月)

如 Phase 1 穩定：
- [ ] Swap `BOOKING_REPO` provider：`PgmBookingAdapter` → `NativeBookingAdapter`
- [ ] 業務 code 完全唔改
- [ ] PGM 降為 archive / payroll only
- [ ] 考慮完全停用 PGM subscription

## Notes / Decisions
## Blockers
