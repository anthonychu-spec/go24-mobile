# GO24 Member App — MVP 計劃

更新日期：2026-10-23

## 目標

俾現有會員內部試用嘅第一版：**登入 → 班表預約 → 設施預約 → 會籍 → 通知**。

唔包：新會員 signup、付款（存卡／找欠款／日票）、Face ID 登記、QR check-in、PT 簽名、Trainer App。

## 現況

- 130 個 commit，最後一次 2026-05-15；功能同 UI 已經大致做完（見 HANDOFF.md）。
- **冇 backend 行緊。**Staging droplet 已刪；最後資料（2026-09-30）已救落本機 `Documents\Claude\go24-backup\rescue-2026-10-23\`（真 schema、`gym_data` DB、`.env` 密鑰），DigitalOcean 亦有 snapshot `247670432`。
- App 寫死連 `api-staging.go24fitness.com`（`apps/member-app/src/api/client.ts`），個 domain 已經無效。
- Facility Booking 喺 repo 完全未有 code；PGM v2.2 API 已確認有 `GetFacilityBookingOptions` / `BookFacility` / `Cancel` 同相關 OData 表。
- 詳細風險對照見 Codex 研究包：`Documents\Claude\PGM\go24-app-research\go24-research-pack\`（`research-closure-ledger.csv`、`facility-booking-deep-dive.md`）。

## 階段

### 第 1 步 — 探 PGM tenant（10 分鐘）

用救返嘅 `PGM_CLIENT_ID/SECRET` call：`odata/ClubZones`、`ClubZoneTypes`、`FacilityBookingRules`、`FacilityBookingRulePricingScheduleItems`。

結果決定第 4 步：
- 有 zone 有 rule，免費 → 直接做
- 有 zone 有 rule，要收費 → 要加付款流程，同 PGM 確認暫留（pre-reservation）契約
- 冇 zone → GO24 要先喺 PGM 後台設定，否則 App 冇嘢可以約

### 第 2 步 — Backend 返生（約 3 日）

1. 開新 droplet（SGP1，s-2vcpu-4gb），跑 `infra/droplet/setup.sh`，還原 `.env`。建議直接當 production，唔再分 staging。
2. 由 `go24-schema.sql` 補 migration：repo 欠 `charges`、`face_enrollments`、`member_milestones`、`membership_requests`、`user_favourites`、`user_settings` 六張表，同 `bookings.class_date/class_name/club_name/start_time` 欄位同 `idx_one_booking_per_day`。
3. 修必須修嘅洞：
   - `POST /notifications/webhook/checkin-failed` 加 secret
   - `PgmWebhookController` 未設 secret 時拒絕；`PGM_WEBHOOK_SECRET`、`STAFF_NOTIFICATION_WEBHOOK_URL` 加入 `docker-compose.prod.yml`
   - 刪走舊路由 `POST/DELETE /booking/classes/:id/book`（繞過 1 日 1 堂、168 小時、idempotency）
   - 加 `@nestjs/throttler`（login、request-otp、refresh）
   - `ReconcileJob` 對 `pending_verify` 先查 PGM `listMyBookings` 再決定 failed；PGM client 對 POST 唔重試
   - `refresh` 重查 user status
4. `client.ts` 改用 env 設定 API base。
5. 設定 Adyen webhook 指向新 domain（舊 domain 累積 10 萬次失敗重試）。

### 第 3 步 — Facility Booking（1 至 2 星期）

| 部分 | 內容 |
|---|---|
| Backend adapter | 包 Options / Book / Cancel；zone、zone type、rule 用 1 小時 cache |
| Backend 規則 | `memberId` 只由 JWT 取；唔傳任何管理 override 欄位；Options 每次 ≤ 4 小時；逾時／未知結果用 request ledger 記低再對帳 |
| App UI | 選分店 → 選設施 → 選日期 → 選時段／時長 → 規則／費用 → 確認 → 我的預約（可取消，取消原因由 `FacilityBookingCancelReasons` 提供） |
| 價錢 | 只顯示 server 由 PGM 取嘅價；App 唔自己計總價 |
| 付款（如要） | 待第 1 步結果；book 成功 ≠ 已付款，兩個狀態分開顯示 |

設計原則（來自 Codex 研究）：Options 回傳係短期 snapshot，UI 唔好將 capacity 顯示成「剩餘位置」；rule ID 同 zone ID 只用 server 回傳嘅組合，唔自己配對。

### 第 4 步 — Build 同內部試用（1 日）

- 加 `eas.json`，出 TestFlight / Android internal build。
- 試用名單：內部同事 + 幾位熟客。

**合共約 3 至 4 星期。**

## MVP 可以暫時唔理（出正式版前要補）

- Push token 登出唔清；broadcast 一次過送晒所有 token
- Adyen webhook 簽名驗證方式要用真實通知核對；`ADYEN_ENVIRONMENT` compose 預設 `LIVE`
- `payOutstanding` 冇建立 `Charge` 記錄、冇鎖
- `public/signup/complete` 冇驗證 Adyen 付款（DTO 現時冇 decorator，一律 400，修 DTO 前要先加驗證）
- 候補：`waitlistPosition` 永遠 null；候補提醒文案錯；promotion push 未接 outbox dispatcher
- `CANCEL_TOO_LATE` 未 mapping
- 冇刪除帳戶功能（Apple 上架要求）
- `/api-docs`、`/metrics` 公開；`cors: true`

## 要 GO24 決定嘅事

1. 設施預約收唔收費？邊啲分店、邊啲設施？
2. 新機直接做 production？
3. 內部試用名單。
