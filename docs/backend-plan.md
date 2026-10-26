# Backend 計劃 — 會員 App（THE LAB 核心版先上）

日期：2026-10-26 · 狀態：**計劃，未開工**
上層計劃：[`member-apps-launch-plan.md`](member-apps-launch-plan.md)（第 1 階段 + 第 3 階段 backend 部分）。Foundry 全套功能（錢包、Social Play 等）照舊見 [`mvp-plan.md`](mvp-plan.md) D、E 節，唔喺呢份。

## 而家有乜（2026-10-26 查）

- **技術**：NestJS 11 + TypeORM + Postgres 16，Docker Compose 一部 droplet（`infra/droplet/`：postgres、redis、api、caddy）。所有 route 前綴 `/v1`。
- **冇機行**：staging droplet 已毀。救返嘅 DB 全部表都係 0 行（`go24-backup/rescue-2026-10-23/row-counts.txt`），**唔使搬資料，開新 DB 就得**；要用嘅只係 `go24-schema.sql`（16 張表）同 `.env`。
- **冇 migration 機制**：`infra/db/migrations/*.sql` 冇任何 script 去行；`infra/docker/init/02-schema.sql` 只得 2 張表，而且只會喺空 volume 第一次開機行。即係新機開出嚟會缺表。
- **自動 deploy**：`.github/workflows/deploy.yml` 一 push `main`（改 `backend/`、`infra/droplet/`）就 SSH 入機 `git reset --hard` 再 build。違反「唔好自行 deploy」，要先改。
- **Redis** 喺 compose 有開，但 code 冇用。
- **`gym_data`**：`activity.service.ts` 讀外部 DB `studio.by_member` 攞上堂歷史（`GYM_DATA_URL`）。邊個系統寫入呢個 DB 未確認（見決定 B6）。
- **PGM**：同一個 tenant（`go24fitness-hk.perfectgym.pl/Api/v2.2`）。`PgmBookingAdapter` 攞**成個 tenant** 嘅班表，冇按品牌篩。

### 用邊套 PGM API（2026-10-26 定）

- **用 v2.2 管理 API**（`/Api/v2.2`，有公開文件，有 key，現有 code 用緊）。Backend 用 server 嘅 client ID／secret 代已登入會員做嘢；「每個會員只可以郁自己嘢」由我哋 backend 負責（`memberId` 只由 JWT 取、唔傳 override、throttle）。
- **唔用 GO 會員 API**（`goapi2.perfectgym.com/v1/`，PG GO app 用嘅私底 API，Codex 研究包 GATE-04）：冇授權、冇合約；要冒用 GO24 white-label ID 同官方 app 版本 header。PGM 書面批准之前一條都唔 call，測試都唔 call。
- 2026-10-26 已 email PGM 問建議做法、goapi2 可唔可以用、v2.2 經 API 約嘅規則有冇分別、每場一個 zone、rate limit、只限指定 endpoint 嘅 API client（launch plan G7）。**唔等回覆開工**。
- 第 1 星期 PGM 探順便：用測試會員經 v2.2 約一次，對比 PGM 會員規則（每日上限、截止時間、開放時間）係咪同 PG GO app 一樣；唔同就喺 backend 補返。同時量 v2.2 回應時間（一星期班表、我的預約、Visits）。

### 現有模組 → LAB v1 點處理

| 模組 | Route | LAB v1 |
|---|---|---|
| `auth` | `/auth/login`、`request-otp`、`verify-otp`、`refresh`、`logout`、`me` | **用**。加 throttle、refresh 重查會員狀態、JWT 加 `brand` |
| `bookings`（新） | `POST/DELETE/GET /bookings`、`/webhooks/pgm/*` | **用**。有 idempotency、state machine、outbox、reconcile。webhook 要 secret；reconcile 要先查 PGM |
| `booking`（舊） | `GET /booking/classes`、`classes/week`、`classes/:id`、`my` | **用**（讀班表）＋加品牌篩選 |
| `booking`（舊） | `POST/DELETE /booking/classes/:id/book` | **刪**（繞過 1 日 1 堂、168 小時、idempotency） |
| `dashboard` | `/me/dashboard`、`memberships`、`profile` | **用** |
| `dashboard` | `POST /me/pay-outstanding` | v1 關（LAB 冇付款） |
| `checkin` | `GET /checkin/qr` | **用**（Member pass）；QR 用獨立 key（決定 #22） |
| `notifications` | device、list、unread、read | **用**；加 `brand`、登出刪 token、100 個一批、處理 receipts |
| `notifications` | `broadcast`（`BROADCAST_SECRET`）、`webhook/checkin-failed` | broadcast **刪**；checkin-failed 加 secret |
| `settings` | `/me/settings` | **用**（visit 目標）；加 validator |
| `activity` | `/activity` | **用**，但資料來源見決定 B6 |
| `payments`、`signup`、`referral`／`banners`、`pt`、`favourites`、`membership-requests`、`milestones` | 多個 | v1 **關**：用品牌功能開關擋（回 404），code 唔刪，第二期再開 |
| `metrics`、`/api-docs` | — | 唔再公開（Caddy 擋） |

## 要新做嘅嘢

### N1. 品牌層（約 2 日）
- 表：`brands`（`lab`、`foundry`、`go24`、`onyx`）、`brand_clubs`（brand、PGM club ID）、`brand_features`（brand、feature、on/off）。
- 登入前：App 帶 `X-App-Brand`；登入後：寫入 JWT `brand` claim，之後只信 JWT。
- `BrandFeatureGuard`：`@RequiresFeature('payments')` 之類，未開就 404。
- 篩選：班表（`PgmBookingAdapter` 按 `clubId`）、`public/clubs`、我的預約、設施 zone 全部只出白名單分店。
- 取代 `signup.service.ts:77` 用名有冇「ONYX」分品牌。

### N2. Recovery 設施預約（約 6 日）
PGM REST：`GetFacilityBookingOptions`、`BookFacility`、`CancelFacilityBooking`；OData：`ClubZones`、`FacilityBookingRules`、`FacilityBookings`、`FacilityBookingCancelReasons`。
- `GET /v1/facilities?category=recovery`（只出品牌白名單分店嘅 zone，1 小時 cache）
- `GET /v1/facilities/:zoneId/options?date=`（每次 ≤ 4 小時；回傳係短期 snapshot，唔好當「剩幾多位」）
- `POST /v1/facility-bookings`（idempotency key；`memberId` 只由 JWT 取；唔傳任何管理 override）
- `DELETE /v1/facility-bookings/:id`、`GET /v1/facility-bookings`
- **撞時間檢查**（prototype 有）：book 之前查自己嘅上堂＋設施預約，重疊就拒絕（`TIME_OVERLAP`）。
- 逾時／唔知結果：寫 request ledger，reconcile job 對返 PGM。
- **收費 zone**（例如 Novotel Private Recovery，產品 #230）：v1 唔俾 book，回 `PAY_AT_FRONT_DESK`。

### N3. Coaching 諮詢（約 1.5 日）
- `POST /v1/coaching/enquiries`（目標、時段偏好、分店）→ 存 `coaching_enquiries` → 通知前台（去邊度見決定 B4）。
- 每人每日上限（throttle），回覆講明「未有教練聯絡你」。

### N4. 刪除帳戶（約 1.5 日，上架必須）
- `POST /v1/me/account/deletion` → 電郵確認連結 → 刪 sessions、device tokens、settings、favourites、enquiries，`users` 標記 deleted。
- 文案講明**唔會取消 PGM 會籍**；PGM 資料唔郁。

### N5. App 設定（約 0.5 日）
- `GET /v1/app-config`（按品牌）：最低版本、維修中訊息、功能開關（讀 `brand_features`）。

### N6. Passport visits（約 1.5 日）
- 今月入場次數、連續星期：讀 PGM OData `/odata/Visits`，沿用 `dashboard.service.ts`、`activity.service.ts` 已有嘅查詢；visit 目標存 `user_settings`。
- 上堂歷史：`gym_data` 有人更新就繼續用，冇就改讀 PGM `/odata/ClassBookings`（`PgmBookingAdapter.listMyBookings` 已經用緊，決定 B6）。

## 保安同穩定（約 3 日；＝board C2）
沿用 `mvp-plan.md` 第 2 步，加埋今次查到嘅：
1. 補 migration 機制（下面「基建」）同欠嘅表／欄位：`charges`、`face_enrollments`、`member_milestones`、`membership_requests`、`user_favourites`、`user_settings`；`bookings.class_date/class_name/club_name/start_time`；`idx_one_booking_per_day`。
2. `PgmWebhookController`、`checkin-failed`、Suprema webhook：冇 secret 就拒絕（timing-safe 比較）。
3. 刪舊 `POST/DELETE /booking/classes/:id/book`；刪 `BROADCAST_SECRET` route。
4. `@nestjs/throttler`：login、request-otp、verify-otp、refresh、enquiries。
5. `ReconcileJob`：`pending_verify` 先查 PGM `listMyBookings` 先判 failed；PGM client POST 唔重試。
6. `refresh` 重查 user status；`cors` 收窄（native app 唔使 CORS）。
7. DTO validator 補齊（settings、favourites 等）。
8. Adyen webhook：LAB v1 唔用；**舊 domain 仲有 10 萬次重試**，要喺 Adyen 後台停咗佢（決定 B7）。

## 基建（約 3 日；開機要 Anthony 批）
| 項目 | 做法 |
|---|---|
| Droplet | DigitalOcean SGP1 `s-2vcpu-4gb`（約 US$24／月），跑 `infra/droplet/setup.sh`；直接做 production，唔再分 staging |
| Domain | 一個 API domain 俾三個品牌共用（決定 B1），Caddy 自動 HTTPS |
| Migration | 改用 TypeORM migrations：第一個 = 由 `go24-schema.sql` 生成嘅 baseline，之後每次改表一個 migration；container 開機前行 `migration:run`；`synchronize` 保持 `false` |
| Secrets | `.env` 由 `go24.env` 還原；**`JWT_SECRET`、Postgres、Redis 密碼換新**；PGM／Adyen key 換唔換見決定 B8。`.env` 唔入 git |
| Deploy | `deploy.yml` 改成**只准手動**（`workflow_dispatch`），由 Anthony 撳；唔再 push 就上 |
| 備份 | 舊 backup cron 從來冇行過。新：每日 `pg_dump` 上 DigitalOcean Spaces（另一個地方）＋ droplet weekly backup；**試一次還原** |
| 監察 | Sentry（API）、UptimeRobot 監 `/v1/health`；Caddy 擋 `/api-docs`、`/metrics` |
| CI | `ci.yml` 已有 lint／typecheck／test；加 migration 喺空 DB 行一次 |
| 本機開發 | `infra/docker/docker-compose.yml` + 同一套 migration；測試用 PGM 測試會員（決定 G6），因為冇 PGM sandbox，所有預約都係真 |
| Redis | v1 唔用；throttler 用 memory（得一部機）。之後多過一部機先用 |

## PGM 只讀探（約 1 日，第 1 星期）
用救返嘅 PGM key，**只讀**：
- `Clubs`：THE LAB 係邊幾個 club ID（＝決定 G3），寫入 `brand_clubs` seed。
- `ClubZones`、`ClubZoneTypes`、`FacilityBookingRules`、`FacilityBookingRulePricingScheduleItems`：LAB 有咩 recovery zone、邊啲收費。
- LAB 分店嘅 `Classes`、`ClassTypes`：班表正常出到。
- `Visits`：日期格式、查詢速度（Passport 用）。
結果寫入 `docs/function-review.md`。

## 次序同估時（1 個 backend 開發者）

| 星期 | 做乜 | 關卡 |
|---|---|---|
| 1 | 本機起返；migration baseline；保安修正 1–7；PGM 只讀探；改 `deploy.yml` | 本機 `npm test` 全綠；空 DB 行 migration 出齊 16 張表 |
| 2 | N1 品牌層；N5 app-config；push 修正；**開 droplet、domain、備份、Sentry**（要 G5） | App 指住新 API 登入到，只見 LAB 分店班表；備份還原試過 |
| 3–4 | N2 Recovery 設施預約 | 測試會員約到、取消到 LAB recovery；撞時間被拒；收費 zone 回 `PAY_AT_FRONT_DESK` |
| 5 | N3 Coaching 諮詢；N4 刪除帳戶；N6 Passport visits | 刪帳戶全流程走通；前台收到諮詢 |
| 6 | 修 bug、壓力測試（班表、options）、同 App 對 API、API 文件 | 同 App 一齊走驗收清單 |

**合共約 6 星期**，同 App 第 1–6 星期並行；第 7–8 星期支援上架同真機測試。

| 項目 | 估時 |
|---|---|
| 保安同穩定 | 3 日 |
| 基建 | 3 日 |
| PGM 探 | 1 日 |
| N1 品牌層 | 2 日 |
| N2 Recovery | 6 日 |
| N3 Coaching | 1.5 日 |
| N4 刪除帳戶 | 1.5 日 |
| N5 app-config | 0.5 日 |
| N6 Passport visits | 1.5 日 |
| Push 修正 | 1 日 |
| 測試、修 bug、文件 | 5 日 |
| **合共** | **約 25 日（5–6 星期）** |

## 驗收
- `npm run typecheck`、`npm test`（現有 `bookings` spec + 新 spec：品牌篩選、撞時間、feature guard、刪帳戶）全綠；CI 喺空 DB 行到 migration。
- 用 LAB 測試會員（真 PGM）：登入 → 班表只見 LAB 分店 → 約堂 → 滿堂候補 → 取消 → 約 recovery → 同時段再約被拒 → Passport 見到 → 收到 push → 申請刪帳戶 → 電郵確認 → 再登入要重新開始。
- 冇 secret 打 webhook 回 401；舊 `/booking/classes/:id/book` 回 404；`/api-docs`、`/metrics` 由外面打唔到；login 連打 10 次被 throttle。
- 用 `foundry` 品牌 JWT 打 LAB club 嘅資料攞唔到；關咗嘅功能（例如 `/payments/card`）回 404。
- 備份：由 Spaces 攞最新 dump 還原到本機 DB 成功。

## 要 Anthony 決定（backend）
| # | 問題 | 建議 |
|---|---|---|
| B1 | API 用咩 domain？ | 三個品牌共用一個，例如 `api.<集團 domain>` |
| B2 | Droplet＋備份＋Spaces 每月約 US$35 | OK 就開 |
| B3 | 主分店唔係 LAB 嘅會員（GO24、ONYX）可唔可以登入 LAB app？ | 准登入，只見 LAB 分店；約唔約到由 PGM 會籍規則決定 |
| B4 | Coaching 諮詢送去邊？ | n8n → LAB 前台 WhatsApp／電郵；或者開 PGM CRM lead（`Crm2Leads`） |
| B5 | 收費 recovery v1 唔開放，叫會員去前台？ | 係（launch plan 已假設） |
| B6 | `gym_data`（`studio.by_member`）邊個系統寫入、仲有冇更新？（`Accounts/recon-ui` 同 `Accounts/budget-fy2728` 都讀緊同一個 schema，似係另一個系統維護緊；寫入方未搵到） | 有人維護就沿用同一個 DB；冇就 v1 改讀 PGM API |
| B7 | 喺 Adyen 後台停舊 webhook（仲有 10 萬次重試） | 停，付款第二期再設新網址 |
| B8 | PGM／Adyen key 換唔換？（舊機已毀，key 只喺本機 backup） | JWT、DB 密碼一定換；PGM／Adyen 建議都換 |

## 唔做（呢份 plan）
錢包、signup＋付款、Social Play、DUPR、Messages、管理頁（`mvp-plan.md` D、E 節）；Staff app（C5）；任何 deploy 或開機，要 Anthony 親口批。
