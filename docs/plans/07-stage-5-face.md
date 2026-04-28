# Stage 5 — Face Check-in 🌟

**估時**：4 週
**前置**：Stage 4 merged + **Stage 0 pre-flight 0.18 face engine 已 lock** + **0.20 PDPO privacy policy draft 已 ready**
**目標**：旗艦 feature — 會員拎起手機 3 秒入到閘
**🚨 Critical pre-req**：iOS App Store 對 face data 嚴審 — privacy policy + opt-in flow 必須喺 Stage 5 開始前 ready，唔係 Stage 9 Beta 才搞

## Tasks

- [ ] 5.1 DB：`face_embeddings` table（用 pgvector extension）
- [ ] 5.2 `POST /face/enroll/:memberId` — Trainer app 影 3-5 張 → upload
- [ ] 5.3 n8n workflow：receive image → call face engine（先試 AWS Rekognition） → 抽 embedding → store pgvector
- [ ] 5.4 `DELETE /face/enroll/:memberId` — PDPO 刪除
- [ ] 5.5 `POST /checkin/face` — receive image → enqueue → sync wait result（timeout 3s）
- [ ] 5.6 n8n match workflow：新圖抽 embedding → cosine similarity search → threshold 0.85
- [ ] 5.7 `checkins` table + 每次 log similarity score
- [ ] 5.8 Member app Face Check-in screen（full camera + face outline + auto capture）
- [ ] 5.9 成功 UX：全屏綠 ✅ + 歡迎名 + 會籍 / PT summary + haptic
- [ ] 5.10 失敗 UX：紅 + 再試 / fallback QR
- [ ] 5.11 Trainer app Face Enrollment flow
- [ ] 5.12 閘機對接（如有 API）— success event push 開閘 signal
- [ ] 5.13 Privacy：enrollment opt-in consent + data deletion UI（PDPO compliance — policy draft 喺 Stage 0.20）
- [ ] 5.16 🟢 **離線 fallback queue** — 網絡差時先 cache image 本地 → 連上 server 再 retry submit；UI 顯示「將會 retry」
- [ ] 5.17 🟢 **Server side spoof detection**（防 print photo 攻擊）— n8n 加 liveness check（眨眼 / 角度 prompt）
- [ ] 5.14 Test：20 staff × 光線 / 眼鏡 / 口罩；準確率 ≥ 98%、誤認 ≤ 0.1%、速度 ≤ 3s
- [ ] 5.15 Load test：1 分鐘 50 人同時 check-in

## 驗收

- 拎起手機 → 3 秒內見「歡迎 Trudy」+ PT 餘 8 堂
- 離線 / 失敗時自動 fallback QR
- 準確率 ≥ 98%，誤認率 ≤ 0.1%

## Open Decision

Face engine 選擇（M0 時未定）：
- AWS Rekognition（~$100/月 @ 5000 會員 × 20 次/月）
- Azure Face API
- Self-host face-api.js / DeepFace（~$50/月 GPU VPS）

M4 benchmark 三個揀一個。

## Notes / Decisions
## Blockers
