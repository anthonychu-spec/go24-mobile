# 會員 App（THE LAB → Foundry → GO24）· Expo 上架計劃

日期：2026-10-26 · 狀態：**計劃，未開工**（跟 PM↔OFFICE 試行流程：Anthony OK → OFFICE 上板＋brief → 先開工）

## Context

- 而家有兩個已做好嘅會員 app 原型：
  - **THE LAB by ONYX**：`apps/lab-prototype-web/`（Codex v1 Red，PWA，紅黑，Bebas Neue＋Montserrat）。功能：Home／Book／Passport／Profile、班堂（候補）、Recovery circuit、Coaching 諮詢、Member pass、visit 目標。
  - **The Foundry**：`apps/foundry-prototype-web/`（34 畫面，已批核）＋ `apps/foundry-demo/`（Expo SDK 58 可撳 demo，假數據）。
- 正式 app `apps/member-app/` 係舊 GO24 版：Expo 54／RN 0.78 版本唔夾、`newArchEnabled: false`、品牌寫死 GO24、連住已死嘅 staging（`src/api/client.ts`）。Backend `backend/nest-api` 冇機行（droplet 已毀，資料喺 `go24-backup`）。
- 現有 `docs/mvp-plan.md` 係 Foundry 全套（約 17 星期、4 條線），太大。
- **已定（Anthony 2026-10-26）**：
  1. 三個都係**會員 app**；Staff app（C5，`hrms/apps/mobile`）唔喺呢個 plan。
  2. 第一次上架只做**核心版**；錢包、Social Play、DUPR、Messages 等第二期。
  3. **THE LAB 先上**（功能最少，用嚟走通上架流程），之後 Foundry，GO24 等 Anthony 自己整嘅樣板。
  4. **一個集團 Apple／Google 開發者帳戶**上晒三個 app。

## 做法：一份 code、三個品牌 build

- 升級 `apps/member-app`（保留現有登入、token 續期、約堂、候補、push、QR、SecureStore、i18n），唔另起新 repo。
- 品牌層跟 `mvp-plan.md` A0：`app.json` → `app.config.ts`，按 `APP_BRAND=lab|foundry|go24` 讀 `brands/<brand>/brand.ts`（名、bundle id、scheme、API base、顏色 token、字體、logo、功能開關）＋ `brands/<brand>/assets/`。
- `eas.json`：`lab-preview`／`lab-production`（之後 `foundry-*`、`go24-*`）；每個品牌獨立 Expo project（push credential 分開），EAS Update channel 對應 profile。
- 畫面同 component 由 `apps/foundry-demo/src/{theme,components,features}` 搬過嚟改做 token 驅動；LAB 只係換 token＋關功能（`sports`、`wallet`、`socialPlay` = off）。
- Backend：`brands`／`brand_clubs`／`brand_plans` 表；App 帶 `X-App-Brand`，登入寫入 JWT `brand` claim；分店、班表、設施按品牌白名單篩（取代 `signup.service.ts:77` 用名有冇「ONYX」分品牌）。

## 階段

### 第 0 階段 — 經理枱閘口（而家就開始，同其他並行）
| # | 事項 | 邊個 | 阻住乜 |
|---|---|---|---|
| G1 | 申請 D-U-N-S → Apple Developer（公司）US$99；Google Play（**機構**帳戶，避開新個人帳戶「12 人測 14 日」規則）US$25 ＝ board H103 | Anthony | TestFlight、送審 |
| G2 | 確認 LAB v1 Red 係定稿 UI（而家只有 Foundry ZIP 有批核紀錄） | Anthony | 畫面開工 |
| G3 | THE LAB 屬邊幾個 PGM club ID（白名單）；Recovery 喺 PGM 開咗咩 zone／產品 | Anthony／營運 | Book、Recovery |
| G4 | LAB 官網相片授權；App 名、bundle id（例如 `com.onyx.thelab`）、私隱政策網址、support 電郵 | Anthony | 上架資料 |
| G5 | 開 production droplet（錢）＋ API domain | Anthony 批 | 所有真數據 |
| G6 | 2–3 個測試會員帳戶（俾 Apple reviewer 用，唔可以係真會員資料） | Anthony／前台 | 送審 |
| G7 | **PGM 回覆 API 用法**（email 已發，2026-10-26）：建議做法；可唔可以用 GO 會員 API `goapi2.perfectgym.com`；v2.2 經 API 約會唔會行唔同規則；每個場開獨立 zone；rate limit；可唔可以開只限指定 endpoint 嘅 API client | 等 PGM | **唔阻開工**：預設用 v2.2（現有 code）；PGM 准用 goapi2 先再評估登入同 backend 做法 |

字體：Bebas Neue、Montserrat 係 Google Fonts（OFL），可以商用，**LAB 冇 IvyJournal 嗰種授權阻滯**（Foundry 先有，決定 #5）。

### 第 1 階段 — Backend 返生（約 1 星期；＝board C2）
Backend 詳細 plan（模組逐個點處理、新 endpoint、基建、6 星期次序、決定 B1–B8）：[`backend-plan.md`](backend-plan.md)。

跟 `mvp-plan.md` 第 2 步：補 6 張表＋bookings 欄位、修保安洞（webhook secret、刪舊 booking route、throttler、reconcile 查 PGM）、`client.ts` 改 env API base；加 A0 backend 品牌表；探 LAB club 嘅班表同設施（`ClubZones`、`FacilityBookingRules`）。

### 第 2 階段 — App 工程底（約 1.5 星期）
`mvp-plan.md` Z 節：SDK 54 → 58（逐級，`expo-doctor`）、新架構、`expo-dev-client`、`expo-updates`（fingerprint）、Sentry、`GET /v1/app-config` 強制更新、`jest-expo`。加品牌層（上面「做法」）；LAB token 由 `lab-prototype-web/site/app.css` 抽。

### 第 3 階段 — LAB 核心畫面（約 4 星期）
| 範圍內 | 用乜 |
|---|---|
| Welcome／Sign in（現有密碼／OTP） | 現有 auth |
| Home | 現有 home API |
| Book · Classes（約、候補、取消） | 現有 booking module |
| Book · Recovery（約時段、撞時間檢查） | 新設施 adapter（`mvp-plan.md` 第 3 步，只做 LAB 用到嘅 zone） |
| Coaching 諮詢（送 request，唔即時約） | 現有 PT／新簡單 endpoint → 前台／n8n |
| Passport：Bookings、visits、每月目標 | 現有 activity＋`user_settings` |
| Profile：個人資料、設定、通知、**刪除帳戶**（上架必須） | 現有＋新刪帳戶流程 |
| Member pass（QR 或會員號，視乎 G 決定 #22） | 現有 QR |
| Push：上堂提醒、候補轉正 | 現有 outbox＋Expo push（加 `brand` 欄） |

**唔包（第二期）**：Balance／Top-Up、收費預約（v1 收費項目顯示「去前台」）、新會員 signup＋付款（v1 只俾現有會員登入）、Social、Messages、Shop、Family、Freeze 自助。

### 第 4 階段 — 上架準備同送審（約 1–1.5 星期）
- Icon（冇 alpha）、splash、App Store／Play 截圖、描述、App Privacy／Data safety 表、權限文案（相機、通知）。
- Reviewer 測試帳戶＋示範說明；講明係「現有會員專用」。
- TestFlight 內部 → Android internal → 真機驗收（iOS、Android 各一部）→ 送審（Apple 一般 1–3 日）。

### 第 5 階段 — Foundry build
加 `brands/foundry/`，開 `sports` 功能：Sports Reserve、court layout、Coaching、Fitness 等 Foundry 獨有畫面（`foundry-demo` 搬）；前提係 PGM 拆場（決定 #6）、IvyJournal 授權（決定 #5）。

### 第 6 階段 — GO24 build
等 Anthony 嘅 GO24 樣板 → `brands/go24/`，大部分畫面共用。

### 第二期（三個品牌共用）
錢包／Top-Up、signup＋付款、Social Play、DUPR、Messages、管理頁 `apps/admin-web` 等（`mvp-plan.md` D、E 節）。

## 估時（1 backend + 1 app 開發者）
| 階段 | 時間 |
|---|---|
| 1 Backend 返生（同 2 並行） | 第 1 星期 |
| 2 App 工程底 | 第 1–2 星期 |
| 3 LAB 核心畫面（backend 同時做設施 adapter、刪帳戶、品牌篩選） | 第 3–6 星期 |
| 4 上架準備＋TestFlight | 第 7–8 星期 |
| **LAB 送審** | **約第 8 星期**（前提：G1 帳戶已批，D-U-N-S 要 1–2 星期，要即刻申請） |
| 5 Foundry | LAB 之後約 4–6 星期（只計核心＋sports） |

## 要改嘅主要檔案
- `apps/member-app/app.json` → `app.config.ts`；新 `apps/member-app/brands/{lab,foundry,go24}/`；`eas.json`
- `apps/member-app/src/theme/*`（改 token 驅動）、`src/api/client.ts`（env base＋`X-App-Brand`）
- 由 `apps/foundry-demo/src/theme/tokens.ts`、`src/components/ui.tsx`、`src/features/**` 搬
- `backend/nest-api`：migrations、品牌表、設施 adapter、刪帳戶、`signup.service.ts`
- `docs/mvp-plan.md`：加「LAB 核心版先上」一節（唔刪 Foundry 全套）

## 驗收
- `npx expo-doctor` 全綠；`tsc --noEmit`、`jest-expo` 通過；`APP_BRAND=lab` 同 `APP_BRAND=foundry` 都 build 到。
- LAB build 只見 LAB 白名單分店；用測試會員：登入 → 約堂 → 滿堂候補 → 取消 → 約 Recovery → 撞時間被拒 → Passport 見到 → 收到 push → 刪帳戶。
- iOS、Android 真機各走一次；Sentry 收到測試錯誤；EAS Update 推一個文案改動，`lab-preview` build 收到、`foundry-preview` 收唔到。
- TestFlight build 通過 Apple 自動檢查；Play internal track 裝到。

## 開工前要做（流程）
1. Anthony OK 呢份 plan（或者改）。
2. OFFICE：上板（LAB 會員 app 新 C 號；C2 backend 返生併入第 1 階段；C3 改成第 5 階段）＋寫 brief；Anthony 喺 board 開 G1–G6。
3. Anthony 點名板號開門，先寫 code。唔會自行 deploy、開 droplet、申請帳戶。
