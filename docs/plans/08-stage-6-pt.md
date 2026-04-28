# Stage 6 — PT Session 模組

**估時**：2 週
**前置**：Stage 5 merged
**目標**：會員睇到 PT 餘堂、歷史；教練輸入 log
**重要性**：現有 PGM app 完全冇 PT UI — 新 app 嘅主要 differentiator 之一

## Tasks

- [ ] 6.1 DB：`pt_logs` table + `pt_log_templates`
- [ ] 6.2 PGM adapter：`IPtRepo` interface + `getAgreements` / `getSessions` / `bookSession`
- [ ] 6.3 `GET /pt/agreements` + `GET /pt/sessions`
- [ ] 6.4 `POST /pt/sessions` — book PT（idempotency 同 booking 一樣）
- [ ] 6.5 `POST /trainer/pt/:sessionId/log` — 記錄動作 / 重量 / 備註 / 相
- [ ] 6.6 Member app Dashboard：PT 餘堂 stat + 下次 countdown
- [ ] 6.7 Member app PT 詳情頁：agreement 進度 bar + 歷史 log
- [ ] 6.8 Trainer app PT Log input：動作 list + template 複用
- [ ] 6.9 Media upload（相 / 影片）→ S3 / Cloudflare R2
- [ ] 6.10 Test：reconcile PT count with `pgm-pt-discrepancy-checker` skill，差異 = 0

## 驗收

教練完成一堂 → 填 log → 會員 app 即刻睇到今堂做咩動作、幾 kg。

## Notes / Decisions
## Blockers
