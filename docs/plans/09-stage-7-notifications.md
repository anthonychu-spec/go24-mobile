# Stage 7 — Notifications

**估時**：1 週
**前置**：Stage 6 merged
**目標**：personal + announcements 分 tab，真 push 到手機
**重要性**：現有 app 零 personal notification — 重大 UX 痛點

## Tasks

- [ ] 7.1 DB：`notifications`, `notification_preferences`, `device_tokens` table
- [ ] 7.2 FCM (Android) + APNs (iOS) setup via Expo push
- [ ] 7.3 `POST /notifications/device` — register token
- [ ] 7.4 `GET /notifications?tab=personal|announcements`
- [ ] 7.5 Notification dispatcher（subscribe outbox events） — booking.created → personal notification
- [ ] 7.6 Event → push flow：booking 確認 / 候補升位 / 堂前 1h reminder / PT reminder / 會籍到期
- [ ] 7.7 Preferences API：per-category toggle（push / WhatsApp / email）
- [ ] 7.8 Member app Notifications 頁（2 tab）+ inline action button
- [ ] 7.9 Mark-as-read + unread badge
- [ ] 7.10 Test：10 種 event 每種收正確 push + WhatsApp

## 驗收

- book 成功 3 秒內手機彈 push
- 堂前 1h 自動提醒
- 會員可以 opt-out 公告但收 personal

## Notes / Decisions
## Blockers
