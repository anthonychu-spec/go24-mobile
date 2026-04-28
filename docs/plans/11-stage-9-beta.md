# Stage 9 — Beta

**估時**：3 週
**前置**：Stage 8 merged
**目標**：內部 dogfood + bug triage

## Tasks

- [ ] 9.1 Sentry + Crashlytics 上線
- [ ] 9.2 OneSignal / Mixpanel analytics（關鍵 event funnel）
- [ ] 9.3 App Store / Play Store 帳戶 + bundle ID + provisioning
- [ ] 9.4 TestFlight (iOS) + Play Internal Testing (Android) 上架
- [ ] 9.5 Privacy policy + Terms of use **finalize**（face data section 早於 Stage 0.20 已 draft；此 stage 律師 review final）
- [ ] 9.10 🟡 **Cohort rollout via feature flag** — 用 GrowthBook，0% → 5% → 25% → 100% per stage
- [ ] 9.11 🟡 **Status page** setup（statuspage.io free 或自寫 simple HTML）
- [ ] 9.12 🟡 **Postgres backup drill** — restore 一次去 staging 驗證 backup 真係 work
- [ ] 9.13 🟡 **Force upgrade test**：mock `/config` 返 `min_supported_version` 高過 client → 確認 modal block 正常
- [ ] 9.6 10 會員 + 5 教練 dogfood 2 週
- [ ] 9.7 每週 triage bug 會議
- [ ] 9.8 Performance：cold start < 2s、list scroll 60fps、memory < 200MB
- [ ] 9.9 A11y：VoiceOver + TalkBack pass 主要 flow

## 驗收

Beta 2 週內無 P0 / P1 bug 未處理。

## Notes / Decisions
## Blockers
