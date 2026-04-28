# Stage 4 — Adyen Payment Link

**估時**：1 週
**前置**：Stage 3.5 merged
**目標**：會員撳「續會」→ 收 WhatsApp 付款 link → 付完自動 mark paid

## Tasks

- [ ] 4.1 Adyen account setup + API key env
- [ ] 4.2 `POST /memberships/renew` → call Adyen Pay-by-Link API → return URL
- [ ] 4.3 n8n workflow：payment link → WhatsApp template message
- [ ] 4.4 `POST /webhooks/adyen` + HMAC signature verify
- [ ] 4.5 Webhook handler：update invoice status + trigger PGM membership extend
- [ ] 4.6 Transaction history table + `GET /payments`
- [ ] 4.7 `GET /payments/:id/receipt` PDF generate
- [ ] 4.8 Member app：Memberships 頁 → Renew button → 顯示「已 send WhatsApp」
- [ ] 4.9 Test：Adyen sandbox 全流程、webhook 重試 idempotent

## 驗收

會員撳 Renew → 20 秒內 WhatsApp 收到 link → 付完 30 秒內 app 顯示 `已續會 · 剩 365 日`。

## Notes / Decisions
## Blockers
