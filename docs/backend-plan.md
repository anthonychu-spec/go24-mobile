# Backend 計劃 — 會員 App（THE LAB 核心版先上）

日期：2026-10-26（同日按 Codex review 修訂）· 狀態：**C2 已開門，第 1 星期**
上層計劃：[`member-apps-launch-plan.md`](member-apps-launch-plan.md)（閘口 G1–G9、時間表）。Foundry 全套功能（錢包、Social Play 等）照舊見 [`mvp-plan.md`](mvp-plan.md) D、E 節，唔喺呢份。

## 而家有乜（2026-10-26 查）

- **技術**：NestJS 11 + TypeORM + Postgres 16，Docker Compose 一部 droplet（`infra/droplet/`：postgres、redis、api、caddy）。所有 route 前綴 `/v1`。
- **冇機行**：staging droplet 已毀。救返嘅 DB 全部表都係 0 行（`go24-backup/rescue-2026-10-23/row-counts.txt`），**唔使搬資料，開新 DB 就得**。
- **Schema 唔齊**：救返嘅 `go24-schema.sql` 有 16 張表，但**冇 `notifications`**（`notification.entity.ts` 要用；`infra/db/migrations/1745900000000-stage-7-notifications.sql` 有建表）。所以 baseline 要對齊 dump、現有 SQL 同 entity，唔可以淨係照抄 dump。
- **冇 migration 機制**：`infra/db/migrations/*.sql` 冇任何 script 去行；`infra/docker/init/02-schema.sql` 會喺空 volume 第一次開機建 `users`／`sessions`，同 baseline 撞表。
- **自動 deploy**：`.github/workflows/deploy.yml` 一 push `main`（改 `backend/`、`packages/`、`infra/droplet/` 或者 workflow 自己）就 SSH 入機 `git reset --hard origin/main` 再 build；health check 等 60 秒都唔得仍然報「Deploy done」。
- **背景工作會寫入 PGM**：`BookingsService.autoReleaseWaitlistSpots`（每 15 分鐘）會 call PGM 取消候補；`AppModule` 載入晒付款、signup 等模組。route 回 404 唔會停到 cron。
- **Redis** 喺 compose 有開，但 code 冇用。
- **`gym_data`**：`activity.service.ts` 讀外部 DB `studio.by_member` 攞上堂歷史（`GYM_DATA_URL`）。寫入方未確認（決定 B6）。
- **PGM**：同一個 tenant（`go24fitness-hk.perfectgym.pl/Api/v2.2`）。`PgmBookingAdapter` 攞**成個 tenant** 嘅班表，冇按品牌篩。

### 已知缺陷（Codex review 2026-10-26，已對 code 核實）
| # | 缺陷 | 位置 |
|---|---|---|
| D1 | 取消用 `CancelMemberBookingsForClass`，會取消該會員喺嗰堂**所有**預約 | `booking/pgm-booking.adapter.ts` `cancelBooking` |
| D2 | PGM 回候補但會員冇揀接受：本地標 failed，PGM 嗰邊個候補冇取消 | `bookings/booking.service.ts` `book()` |
| D3 | `pending_verify` 超過 30 分鐘、`pending` 超過 3 分鐘，都**唔查 PGM** 就判 failed | `bookings/jobs/reconcile.job.ts` |
| D4 | PGM client 對 POST 都會重試（5xx、網絡錯誤），可能重複約 | `pgm-adapter/pgm.client.ts` |
| D5 | 驗證碼登入：email 搵會員只攞第一個（`$top: 1`），同 email 多個會員會錯人；驗證完直接將本地 user 設 active，冇查 PGM 會籍狀態 | `pgm-adapter/pgm-auth.adapter.ts`、`auth/auth.service.ts` |
| D6 | JWT strategy 唔查 session 撤銷同 user 狀態：登出／刪帳戶後舊 access token 仲用得 15 分鐘 | `auth/jwt.strategy.ts` |
| D7 | webhook 未設 secret 就照收；比較唔係 timing-safe | `bookings/booking.controller.ts`、`notifications`、`signup`（Suprema） |
| D8 | `BROADCAST_SECRET` route（broadcast、POST banners、`referral/list?secret=`） | `notifications`、`referral` |
| D9 | `deploy.yml` 自動 deploy＋health check 失敗都報成功 | `.github/workflows/deploy.yml` |
| D10 | 現有 `booking.service.spec.ts` 8 個 test 本身 fail（冇 mock `NotificationsService`、`SettingsService`） | `bookings/booking.service.spec.ts` |

### 用邊套 PGM API（2026-10-26 定）

- **用 v2.2 管理 API**（`/Api/v2.2`，有公開文件，有 key，現有 code 用緊）。Backend 用 server 嘅 client ID／secret 代已登入會員做嘢；「每個會員只可以郁自己嘢」由我哋 backend 負責。
- **身份**：LAB v1 用 v2.2 `MemberAuth/*` 登入，直接攞管理 API 嘅 `memberId` 建本地身份；**唔用 GO session**，所以唔使解決 GO `remoteId` ↔ v2.2 `memberId` 對應（研究包 RC-03／RC-04 延後）。兩套身份唔准混用。
- **唔用 GO 會員 API**（`goapi2.perfectgym.com/v1/`，研究包 GATE-04）：冇授權、冇合約。PGM 書面批准之前一條都唔 call，測試都唔 call。
- **GATE-04 仲未過**：佢同時要求 PGM 核准「用 gateway 代理管理 API」嘅最小權限做法。2026-10-26 已 email PGM。**離線工程照做（G7a），但對真會員開放登入、約堂、Recovery 寫入要等 G7b 證據**。
- **只准單筆會員操作**（研究包 CLS-02）：約堂 `BookClass`（單次）、取消 `CancelSingleBooking`（用已核實屬於該會員嘅 PGM booking ID）；**禁止** `CancelMemberBookingsForClass`、`BookClassMultipleTimes`、`SetMembersPresenceOnClass`、任何 override、`doNotChargeForLateCancellation`。

### 現有模組 → LAB v1 點處理

| 模組 | Route | LAB v1 |
|---|---|---|
| `auth` | `/auth/login`、`request-otp`、`verify-otp`、`refresh`、`logout`、`me` | **用**，修 D5、D6；加 throttle、JWT 加 `brand`，refresh 保留原品牌 |
| `bookings`（新） | `POST/DELETE/GET /bookings`、`/webhooks/pgm/*` | **用**，修 D1–D4、D7 |
| `booking`（舊） | `GET /booking/classes`、`classes/week`、`classes/:id`、`my` | **用**（讀班表）＋品牌篩選 |
| `booking`（舊） | `POST/DELETE /booking/classes/:id/book` | **刪**（繞過 1 日 1 堂、168 小時、idempotency） |
| `dashboard` | `/me/dashboard`、`memberships`、`profile` | **用** |
| `dashboard` | `POST /me/pay-outstanding` | v1 關（LAB 冇付款） |
| `checkin` | `GET /checkin/qr` | v1 **唔用 QR**：Member pass 顯示會員號／卡號；QR 係自建 HMAC，未驗證可入閘（決定 #22） |
| `notifications` | device、list、unread、read | **用**；加 `brand`、登出刪 token、100 個一批、處理 receipts |
| `notifications` | `broadcast`、`webhook/checkin-failed` | broadcast **刪**；checkin-failed 加 secret |
| `settings` | `/me/settings` | **用**（visit 目標）；加 validator |
| `activity` | `/activity` | **用**；讀唔到就回「暫時未有」，唔當 0 次（決定 B6） |
| `payments`、`signup`、`referral`／`banners`、`pt`、`favourites`、`membership-requests`、`milestones` | 多個 | v1 **關**：品牌功能開關擋 route（404）**同埋**唔註冊佢哋嘅 cron／背景寫入；收費／扣產品流程 backend 直接拒絕 |
| `metrics`、`/api-docs` | — | 唔再公開（Caddy 擋） |

## 第 1 星期（C2 開門範圍）

**次序：封部署同外部副作用 → migration → 身份同約堂一致性 → 其餘保安 → 只讀探 PGM。** 唔 deploy、唔開機、唔 push。

### W1-1 封部署同外部副作用
- `deploy.yml`：只准 `workflow_dispatch`；輸入要指定 commit SHA（必須係 CI 過咗嘅）；migration 失敗即停；health check 失敗即 `exit 1`；保留上一個 image tag 方便回復。
- 本機開發：`.env.local` 用**假 PGM key**；加 `BACKGROUND_JOBS_ENABLED`（預設 `false`），關晒會 call PGM 或者發 push 嘅 cron（候補自動取消、reconcile、outbox、每月總結）。要真 PGM 嘅時候逐項開。

### W1-2 Migration
- TypeORM migrations：`1761400000000-Baseline` = 由 `go24-schema.sql` 整理（去 owner、`\restrict`、冇用到嘅 `vector`）＋ `notifications` 表；之後每次改表一個 migration。
- 開機前行 migration（`migrationsRun` 或者獨立 `migration:run`），migration 要編譯入 runtime image（`Dockerfile.api`）。
- **只有一套建表流程**：刪 `infra/docker/init/02-schema.sql`；舊 `infra/db/migrations/*.sql` 標明已由 baseline 取代（保留喺 git history）。
- **驗收**：空 DB 行完 migration 之後，每個 v1 啟用 entity 嘅表、欄位、index、constraint 都同 entity 對得上（寫一個 test 用 TypeORM metadata 對 DB）；唔係淨係數「16 張表」。

### W1-3 身份同約堂一致性
- D1：`cancelBooking` 改 `CancelSingleBooking({ bookingId })`，`bookingId` 用本地 booking 嘅 `externalId`（即係已經核實屬於該會員）；唔傳 `doNotChargeForLateCancellation`。
- D2：會員唔接受候補 → 用返 PGM 回傳嘅 booking ID 即刻 `CancelSingleBooking`；取消失敗就標 `pending_verify` 交 reconcile。
- D3：`pending`／`pending_verify` 一律先查 PGM `ClassBookings`（按 member＋class）：搵到 → confirmed／waitlist；確定冇 → failed；**查唔到或者唔止一筆 → 保持確認中**，畀支援 reference，唔直接判失敗。
- D4：PGM client 只對 GET 自動重試；POST 逾時當「結果未知」交 reconcile。
- 取消逾時：同樣當「結果未知」，reconcile 對返 PGM。
- D5：email 搵會員改攞最多 2 筆；多過 1 筆 → 唔發驗證碼，回 `AMBIGUOUS_ACCOUNT`（叫會員搵前台；最終做法見決定 G8）；驗證碼通過後用 `odata/Members` 查 `isActive`／`isDeleted`，唔 active 就拒絕。
- D6：JWT strategy 每次查 user 狀態（`status = active`）同 session 冇撤銷（access token 帶 session id；短 cache 30 秒）；登出、刪帳戶即時失效。
- refresh：重查 user 狀態；超過 24 小時冇同 PGM 對過就重查 `isActive`；保留原 JWT `brand`。
- D10：修好現有 spec（補 mock），再加新 test 覆蓋 D1–D6。

### W1-4 其餘保安
- D7：webhook 未設 secret 就拒絕（500 唔係照收）；`timingSafeEqual`；PGM 官方 webhook 用 `X-Perfectgym-Signature`＝`MD5(requestId:secret)`，接 PGM 直出嘅時候跟官方格式。
- D8：刪 `BROADCAST_SECRET` 全部 route。
- `@nestjs/throttler`：login、request-otp、verify-otp、refresh、所有會員寫入（約、取消）、Recovery options 查詢。
- `cors` 收窄（native app 唔使 CORS）；Caddy 擋 `/api-docs`、`/metrics`。
- DTO validator 補齊（settings、favourites、`me/face/retry` 等）。

### W1-5 PGM 只讀探（**只讀，唔約、唔取消**）
用救返嘅 PGM key，只做 GET：
- `Clubs`：THE LAB 係邊幾個 club ID（G3），寫入 `brand_clubs` seed 草稿。
- `ClubZones`、`ClubZoneTypes`、`FacilityBookingRules`、`FacilityBookingDefinitions`、`FacilityBookingRulePricingScheduleItems`、`FacilityBookingCancelReasons`：LAB 有咩 recovery zone、rule-zone 點配對、邊啲收費、取消原因同截止時間。
- LAB 分店嘅 `Classes`、`ClassTypes`：班表正常出到；時區（PGM 時間係 HKT 定 UTC）。
- `Visits`：日期格式、查詢速度。
- 量回應時間（一星期班表、我的預約、Visits）。
- 唔讀會員個人資料（除咗 G6 測試帳戶）。結果寫入 `docs/function-review.md`。

**受控寫入測試（G9）另外做**：用 G6 測試會員喺真 PGM 約／取消，要 Anthony 逐次批，唔喺第 1 星期。

## 要新做嘅嘢（第 2 星期起）

### N1. 品牌層（約 2 日）
- 表：`brands`（`lab`、`foundry`、`go24`、`onyx`）、`brand_clubs`（brand、PGM club ID）、`brand_features`（brand、feature、on/off）。
- 登入前：App 帶 `X-App-Brand`；登入後：寫入 JWT `brand` claim，之後只信 JWT；refresh 保留原品牌。
- `BrandFeatureGuard`：`@RequiresFeature('payments')` 之類，未開就 404。
- **每次讀寫都驗證**：約堂／取消／設施預約前，按 class ID／zone ID／booking ID 查返屬邊間分店，唔喺品牌白名單就拒絕；唔可以淨係篩列表。
- 取代 `signup.service.ts:77` 用名有冇「ONYX」分品牌。

### N2. Recovery 設施預約（約 7 日；寫入要過 G7b ③）
PGM REST：`GetFacilityBookingOptions`、`BookFacility`、`CancelFacilityBooking`；OData：`ClubZones`、`FacilityBookingRules`、`FacilityBookingDefinitions`、`FacilityBookings`、`FacilityBookingCancelReasons`。
- **「證實免費」白名單**：`facility_whitelist`（brand、zone ID、rule ID、definition ID、單一 slot、已確認免費嘅日期同證據）。冇價錢資料唔等於免費；唔喺白名單嘅 zone 一律唔准提交。
- `GET /v1/facilities?category=recovery`（只出白名單，1 小時 cache）
- `GET /v1/facilities/:zoneId/options?date=`（每次 ≤ 4 小時；短期 snapshot，唔當「剩幾多位」；rule／zone 只用 server 回傳嘅組合；throttle）
- `POST /v1/facility-bookings`（idempotency key；`memberId` 只由 JWT 取；唔傳任何 override）
- `DELETE /v1/facility-bookings/:id`（取消原因同截止時間跟 PGM）、`GET /v1/facility-bookings`
- **撞時間檢查**：book 之前查自己嘅上堂＋設施預約，重疊就拒絕（`TIME_OVERLAP`）。
- 逾時／唔知結果：寫 request ledger，reconcile 對返 PGM；查唔到就保持確認中。
- **降級方案**（第 6 星期決定，見 launch plan）：G7b ③ 唔過 → `POST /v1/facilities/portal-link` 經 `ClientPortal/GenerateLogInUrl`（`afterLoginState=Facility`，要先確認會員驗證同回跳）；再唔得 → 回前台聯絡資料。
- 功能開關：`recovery_native`、`recovery_portal`，app 按 `app-config` 顯示。

### N3. Coaching 諮詢（約 1.5 日）
- `POST /v1/coaching/enquiries`（目標、時段偏好、分店）→ 存 `coaching_enquiries` → 通知前台（決定 B4）。
- 每人每日上限，回覆講明「未有教練聯絡你」。

### N4. 刪除帳戶（約 3 日，上架必須）
- **入口**：app 內 `POST /v1/me/account/deletion`；**網頁入口**（卸載咗都用得）：公開頁面輸入 email → PGM 驗證碼核實身份 → 確認。
- **刪咩**：sessions、device tokens、notifications、settings、favourites、coaching enquiries、本地 bookings／booking_events／outbox 入面嘅個人資料（記錄保留但去識別化）；`users` 標記 deleted 並清 email、phone。
- **即時失效**：所有 session 撤銷，舊 access token 即刻用唔到（靠 D6）。
- **跨品牌**：本地 user 係按 PGM 會員共用，刪除＝刪埋三個品牌嘅 app 帳戶資料；文案講明。
- **唔郁 PGM**：會籍同 PGM 資料唔刪，文案講明「唔會取消會籍」。
- **保留政策**：日誌、Sentry、備份入面嘅資料保留幾耐（建議日誌 30 日、備份 30 日自動過期），寫入私隱政策。
- 完成後發電郵通知。

### N5. App 設定（約 0.5 日）
- `GET /v1/app-config`（按品牌）：最低版本、維修中訊息、功能開關（讀 `brand_features`）。

### N6. Passport visits（約 1.5 日）
- 今月入場次數、連續星期：讀 PGM OData `/odata/Visits`，沿用 `dashboard.service.ts`、`activity.service.ts` 已有嘅查詢，加時間範圍上限；visit 目標存 `user_settings`。
- 上堂歷史：`gym_data` 有人更新就繼續用，冇就改讀 PGM `/odata/ClassBookings`（決定 B6）。讀唔到就回「暫時未有」。

### N7. Push（約 1.5 日）
- 自己嘅 Expo sender（唔沿用舊 sender），`device_tokens` 加 `brand`；登出刪 token；100 個一批；處理 receipts 清走失效 token。
- 驗收：送達；同一部機登出換另一個帳戶，唔會收到前一個帳戶嘅 push。

## 基建（開機要 Anthony 批）
| 項目 | 做法 |
|---|---|
| Droplet | DigitalOcean SGP1 `s-2vcpu-4gb`（約 US$24／月），跑 `infra/droplet/setup.sh`；直接做 production，唔再分 staging |
| 驗收環境 | 唔另開 staging：本機＋mock／假 PGM 做離線驗收；真 PGM 測試只用 G6 測試會員（G9）。本機 DB 唔等於 sandbox |
| Domain | 一個 API domain 俾三個品牌共用（決定 B1），Caddy 自動 HTTPS |
| Migration | 見 W1-2 |
| Secrets | `.env` 由 `go24.env` 還原；**`JWT_SECRET`、Postgres、Redis 密碼換新**；PGM／Adyen key 換唔換見決定 B8。`.env` 唔入 git |
| Deploy | 見 W1-1；由 Anthony 撳 |
| 備份 | 每日 `pg_dump` 上 DigitalOcean Spaces＋droplet weekly backup，30 日過期；**試一次還原** |
| 監察 | Sentry（API，唔送會員個人資料）、UptimeRobot 監 `/v1/health` |
| CI | `ci.yml` 已有 lint／typecheck／test；加 Postgres service 喺空 DB 行 migration＋entity 對比 test |
| Redis | v1 唔用；throttler 用 memory（得一部機） |

## 次序同估時（1 個 backend 開發者）

| 星期 | 做乜 | 關卡 |
|---|---|---|
| 1 | W1-1 至 W1-5 | 本機 `npm test` 全綠（包括新 test）；空 DB migration＋entity 對比過；`deploy.yml` 只准手動 |
| 2 | 身份同約堂修正收尾；N1 品牌層；N5 app-config；**開 droplet、domain、備份、Sentry**（要 G5） | App 指住新 API；只見 LAB 分店班表；備份還原試過 |
| 3–4 | N2 Recovery（mock＋只讀）、N7 push | G9：Anthony 批受控寫入測試 |
| 5 | N3 Coaching；N4 刪除帳戶（app＋網頁） | 刪帳戶全流程走通；舊 token 即時失效 |
| 6 | N2 寫入（G7b ③ 過）或者降級方案；N6 Passport | **第 6 星期 Recovery 定案** |
| 7–8 | 修 bug、壓力測試（班表、options）、同 App 對 API、API 文件 | 同 App 一齊走驗收清單 |

**預留 6–8 星期**（Codex 估；5–6 星期係樂觀目標）。外部等待（PGM 回覆、G6 帳戶）唔計入。

| 項目 | 估時 |
|---|---|
| W1 封部署、migration、身份同約堂修正、保安、只讀探 | 7 日 |
| 基建 | 3 日 |
| N1 品牌層 | 2 日 |
| N2 Recovery（含白名單、降級） | 7 日 |
| N3 Coaching | 1.5 日 |
| N4 刪除帳戶（含網頁入口） | 3 日 |
| N5 app-config | 0.5 日 |
| N6 Passport visits | 1.5 日 |
| N7 Push | 1.5 日 |
| 測試、修 bug、文件 | 7 日 |
| **合共** | **約 34 日（6–8 星期）** |

## 驗收
- `npm run typecheck`、`npm test` 全綠：現有 spec 修好＋新 spec（單筆取消、唔接受候補即取消、reconcile 未知保持確認中、POST 唔重試、重複 email、會籍狀態、token 撤銷、品牌每次讀寫驗證、feature guard、刪帳戶、Recovery 白名單）。
- CI 喺空 DB 行到 migration，entity 對比過。
- `BACKGROUND_JOBS_ENABLED=false` 時，本機冇任何 call PGM 嘅 POST。
- 用 G6 測試會員（G9 批咗先做）：登入 → 班表只見 LAB 分店 → 約堂 → 滿堂唔接受候補（PGM 冇留候補）→ 接受候補 → 單筆取消（同一堂其他預約唔受影響）→ 約 Recovery（或者降級）→ 同時段再約被拒 → Passport 見到 → 收到 push → 刪帳戶 → 舊 access token 即時 401。
- 冇 secret 打 webhook 被拒；舊 `/booking/classes/:id/book` 回 404；`/api-docs`、`/metrics` 由外面打唔到；login 連打 10 次被 throttle。
- 用 `foundry` 品牌 JWT 約 LAB club 嘅堂被拒；關咗嘅功能回 404；收費 zone 提交被拒。
- 手動 deploy：health check 唔過就 workflow 失敗；可以回復上一版。
- 備份：由 Spaces 攞最新 dump 還原到本機 DB 成功。

## 要 Anthony 決定（backend）
| # | 問題 | 建議 |
|---|---|---|
| B1 | API 用咩 domain？ | 三個品牌共用一個，例如 `api.<集團 domain>` |
| B2 | Droplet＋備份＋Spaces 每月約 US$35 | OK 就開 |
| B3 | 主分店唔係 LAB 嘅會員（GO24、ONYX）可唔可以登入 LAB app？ | 准登入，只見 LAB 分店；約唔約到由 PGM 會籍規則決定 |
| B4 | Coaching 諮詢送去邊？ | n8n → LAB 前台 WhatsApp／電郵；或者開 PGM CRM lead（`Crm2Leads`） |
| B5 | 收費 recovery v1 唔開放，叫會員去前台？ | 係；backend 直接拒絕 |
| B6 | `gym_data`（`studio.by_member`）邊個系統寫入、仲有冇更新？（`Accounts/recon-ui` 同 `Accounts/budget-fy2728` 都讀緊同一個 schema；寫入方未搵到） | 有人維護就沿用；冇就 v1 改讀 PGM API |
| B7 | 喺 Adyen 後台停舊 webhook（仲有 10 萬次重試） | 停，付款第二期再設新網址 |
| B8 | PGM／Adyen key 換唔換？（舊機已毀，key 只喺本機 backup） | JWT、DB 密碼一定換；PGM／Adyen 建議都換 |
| G8 | 登入政策（launch plan）：兩步驗證、同 email 多個會員、凍結／過期會員 | 第一版：唔強制兩步驗證；同 email 多個會員叫佢搵前台；只准 active 會員 |

## 唔做（呢份 plan）
錢包、signup＋付款、Social Play、DUPR、Messages、管理頁（`mvp-plan.md` D、E 節）；Staff app（C5）；任何 deploy、開機、對真會員開放寫入，要 Anthony 親口批。
