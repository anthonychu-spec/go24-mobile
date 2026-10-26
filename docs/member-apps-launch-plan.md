# 會員 App（THE LAB → Foundry → GO24）· Expo 上架計劃

日期：2026-10-26（同日按 Codex review 修訂）· 狀態：**計劃；C2 已開門（backend 第 1 星期）**

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
  5. **用 PGM v2.2 管理 API**，由我哋 server 代會員做嘢；GO 會員 API（`goapi2`）等 PGM 書面批准先考慮（詳見 [`backend-plan.md`](backend-plan.md)）。
- **2026-10-26 Codex 只讀 review**：方向啱，但「有管理 API key」同「確認可以安全代會員約堂」之間嘅工夫估少咗。今次修訂跟佢 10 點建議改：閘口分兩層、登入同取消收緊、Recovery 要有降級方案、刪帳戶補齊、上架準備提早、時間表改為**第 8 星期有條件、計劃第 10–12 星期送審**。

## 做法：一份 code、三個品牌 build

- 升級 `apps/member-app`（保留現有登入、token 續期、約堂、候補、push、SecureStore、i18n），唔另起新 repo。
- 品牌層跟 `mvp-plan.md` A0：`app.json` → `app.config.ts`，按 `APP_BRAND=lab|foundry|go24` 讀 `brands/<brand>/brand.ts`（名、bundle id、scheme、API base、顏色 token、字體、logo、功能開關）＋ `brands/<brand>/assets/`。
- `eas.json`：`lab-preview`／`lab-production`（之後 `foundry-*`、`go24-*`）；每個品牌獨立 Expo project（push credential 分開），EAS Update channel 對應 profile。
- 畫面同 component 由 `apps/foundry-demo/src/{theme,components,features}` 搬過嚟改做 token 驅動；LAB 只係換 token＋關功能（`sports`、`wallet`、`socialPlay` = off）。
- Backend：`brands`／`brand_clubs`／`brand_features` 表；App 帶 `X-App-Brand`，登入寫入 JWT `brand` claim；**每次讀寫**（唔只係列表）按 class／zone／booking ID 驗證屬於該品牌白名單分店。
- 三個 app 要各有清楚用途（各自分店、服務、內容），唔係換 logo 嘅複製品；保存集團同各品牌嘅擁有／授權文件，送審時用得著（Apple 4.2.6 白牌規則）。

## 閘口

### 第 0 階段 — 經理枱閘口（而家就開始，同其他並行）
| # | 事項 | 邊個 | 阻住乜 |
|---|---|---|---|
| G1 | 申請 D-U-N-S → Apple Developer（公司）US$99；Google Play（**機構**帳戶，避開新個人帳戶「12 人測 14 日」規則）US$25 ＝ board H103 | Anthony | iOS build、TestFlight、送審 |
| G2 | 確認 LAB v1 Red 係定稿 UI（而家只有 Foundry ZIP 有批核紀錄） | Anthony | 畫面開工 |
| G3 | THE LAB 屬邊幾個 PGM club ID（白名單）；Recovery 喺 PGM 開咗咩 zone／definition／產品 | Anthony／營運 | Book、Recovery |
| G4 | LAB 官網相片授權；App 名、bundle id（例如 `com.onyx.thelab`）、私隱政策網址、support 電郵、**刪帳戶網頁網址**；集團同 LAB 品牌嘅擁有／授權證明 | Anthony | 上架資料 |
| G5 | 開 production droplet（錢）＋ API domain | Anthony 批 | 所有真數據 |
| G6 | **Reviewer 同測試帳戶**：2–3 個長期有效、唔係真會員資料嘅 PGM 帳戶；reviewer 要唔使收電郵驗證碼都登入到（用密碼登入）；**另外一個可以重置嘅帳戶專門測刪帳戶**；唔准開繞過正式登入嘅後門 | Anthony／前台 | 受控寫入測試、送審 |
| G8 | **登入政策**：要唔要強制兩步驗證；同一個 email 有幾個 PGM 會員點處理；凍結／過期會員登唔登入到 | Anthony | 登入正式開放 |

### PGM 閘口（G7 拆兩層）
| # | 事項 | 狀態 | 阻住乜 |
|---|---|---|---|
| G7a | **離線開工**：本機 backend、migration、保安修正、mock 數據畫面、只讀探 PGM | ✅ 唔使等 | 冇 |
| G7b | **正式開放會員寫入**（登入、約堂、取消、Recovery）要有以下證據：①PGM 書面准用 v2.2 代會員做嘢，或者開咗只限指定 endpoint 嘅 API client（研究包 GATE-04）；②經 v2.2 約堂嘅規則同會員渠道一致（或者已知差異並喺 backend 補返）；③Recovery 嘅渠道可見性、rule-zone 配對、免費確認 | 等 PGM 回覆（email 2026-10-26）＋受控寫入測試 | 對真會員開放寫入、送審 |
| G9 | **受控寫入測試**：用 G6 測試會員喺真 PGM 約／取消，要 Anthony 逐次批（第 1 星期只讀，唔會約） | 等 G6＋Anthony | G7b ② ③ |

字體：Bebas Neue、Montserrat 係 Google Fonts（OFL），可以商用，**LAB 冇 IvyJournal 嗰種授權阻滯**（Foundry 先有，決定 #5）。

## 階段

### 第 1 階段 — Backend 返生（第 1–2 星期；＝board C2）
詳細見 [`backend-plan.md`](backend-plan.md)。次序：**先封部署同外部副作用 → migration → 修身份同約堂一致性 → 其餘保安 → 只讀探 PGM**。
- `deploy.yml` 改手動，加 migration 失敗即停、health check 失敗即報錯、可以回復上一版。
- 本機用假 PGM key、關背景會寫入 PGM 嘅 cron。
- Migration baseline 覆蓋所有 v1 啟用 entity（包括 `notifications`），本機同 production 只有一套建表流程。
- 取消改單筆（`CancelSingleBooking`）；修「唔要候補但 PGM 留咗候補」、stale pending／pending_verify 未查 PGM 就判失敗、取消逾時。
- 登入：處理重複 email、核對會員狀態、access token 可以即時撤銷。

### 第 2 階段 — App 工程底（第 1–2 星期，同第 1 階段並行）
`mvp-plan.md` Z 節：SDK 54 → 58（逐級，`expo-doctor`）、新架構、`expo-dev-client`、`expo-updates`（fingerprint）、Sentry、`GET /v1/app-config` 強制更新、`jest-expo`。加品牌層；LAB token 由 `lab-prototype-web/site/app.css` 抽。
- **第 2 星期前出第一個簽咗名嘅 Android build；G1 一批就出 iOS build**，唔好等到上架前先發現原生問題。

### 第 3 階段 — LAB 核心畫面（第 3–7 星期）
| 範圍內 | 用乜 | 正式開放條件 |
|---|---|---|
| Welcome／Sign in（PGM 密碼／驗證碼） | 現有 auth（修正後） | G7b ①、G8 |
| Home | 現有 home API | — |
| Book · Classes（約、候補、單筆取消） | 現有 booking module（修正後） | G7b ①②、G9 |
| Book · Recovery（約時段、撞時間檢查） | 新設施 adapter，**只開「證實免費」白名單 zone** | G7b ③、G9；唔過就用降級方案 |
| Coaching 諮詢（送 request，唔即時約） | 新簡單 endpoint → 前台／n8n | — |
| Passport：Bookings、visits、每月目標 | 現有 activity＋`user_settings`；讀唔到就顯示「暫時未有」，唔當 0 次 | — |
| Profile：個人資料、設定、通知、**刪除帳戶** | 現有＋新刪帳戶流程（app 內＋網頁） | — |
| Member pass | **v1 顯示會員號／卡號**；QR 要確認分店有裝置驗證先開（決定 #22） | — |
| Push：上堂提醒、候補轉正 | 自己嘅 Expo sender（加 `brand`），驗收送達同換帳戶後唔會收錯人 | — |

**Recovery 降級方案**（第 6 星期決定）：G7b ③ 未過 → 經 PGM Client Portal 約（`GenerateLogInUrl`，`afterLoginState=Facility`，要先確認會員驗證同回跳方式）；再唔得 → 顯示前台聯絡／查詢。唔會因為 Recovery 拖住成個 app。

**唔包（第二期）**：Balance／Top-Up、收費預約（backend 直接拒絕，唔係淨係隱藏畫面）、新會員 signup＋付款、Social、Messages、Shop、Family、Freeze 自助。

### 第 4 階段 — 上架準備（第 1 星期開始，第 8–11 星期完成）
- **第 1–2 星期開始**：reviewer 帳戶（G6）、品牌提交權（G4）、**私隱資料清單**——按最終 build 列出收集咩（會員身份、到訪／預約、push token、Sentry 診斷）、交俾邊個（PGM、Expo、Sentry）、用途、保留幾耐；第三方 SDK 嘅私隱聲明同 iOS privacy manifest；權限只留 v1 真係用到嘅（v1 冇相機就唔要相機權限）。
- Icon（冇 alpha）、splash、截圖、描述、App Privacy／Data safety 表。
- Reviewer 示範說明：講明係「現有會員專用」，邊個帳戶測咩，刪帳戶用專用帳戶。
- Google：刪帳戶網頁入口（卸載咗 app 都用得到）＋ app 內入口；講明刪 app 帳戶唔會取消 PGM 會籍。
- TestFlight 內部 → 外部測試 → Android internal → closed testing → 真機驗收 → 送審。審批時間唔當排期保證。

### 第 5 階段 — Foundry build
加 `brands/foundry/`，開 `sports` 功能：Sports Reserve、court layout、Coaching、Fitness 等 Foundry 獨有畫面（`foundry-demo` 搬）；前提係 PGM 拆場（決定 #6）、IvyJournal 授權（決定 #5）。

### 第 6 階段 — GO24 build
等 Anthony 嘅 GO24 樣板（`apps/go24-prototype-web/`）→ `brands/go24/`，大部分畫面共用。

### 第二期（三個品牌共用）
錢包／Top-Up、signup＋付款、Social Play、DUPR、Messages、管理頁 `apps/admin-web` 等（`mvp-plan.md` D、E 節）。

## 時間表（1 backend + 1 app 開發者）

| 星期 | Backend | App | 上架／閘口 |
|---|---|---|---|
| 1–2 | 封部署、migration、身份同約堂修正、保安、只讀探 PGM | SDK 58、品牌層、工程底、第一個 Android build | 開始 G6 reviewer 帳戶、私隱清單、G4 提交權 |
| 3–5 | 品牌層、app-config、push、Recovery adapter（mock＋只讀）、Coaching、刪帳戶 | LAB 畫面（mock 數據起） | G9 受控寫入測試（Anthony 批） |
| 6–7 | Recovery 寫入（如 G7b ③ 過）、Passport、修 bug | 接真 API、真機調整 | **第 6 星期：Recovery 原生定降級** |
| 8 | 穩定、壓力測試 | TestFlight 外部、closed testing | **第 8 星期：有條件送審**（見下） |
| 9–11 | 支援、修 bug | 修 bug、上架資料 | |
| **10–12** | | | **計劃送審窗口** |
| 之後 | | | Foundry 約 4–6 星期（核心＋sports） |

**第 8 星期送審嘅條件（全部要過）**：G1、G4、G6、G8 已完成；G7b ①② 已有證據；Recovery 已過 G7b ③ 或者已轉降級方案；iOS、Android 真機驗收清單走完；私隱表同刪帳戶網頁已上線。任何一樣未過 → 用第 10–12 星期窗口，唔硬上。

**裁剪決定日**：
- **第 4 星期**：PGM 有冇回覆；冇 → Anthony 決定係咪催／改用 G7b 其他證據。
- **第 6 星期**：Recovery 原生定 Portal／前台降級。
- **第 8 星期**：go／no-go 有條件送審。

外部等待（PGM 回覆、D-U-N-S、Apple／Google 審批）唔計入工程時間，獨立追蹤。

## 要改嘅主要檔案
- `apps/member-app/app.json` → `app.config.ts`；新 `apps/member-app/brands/{lab,foundry,go24}/`；`eas.json`
- `apps/member-app/src/theme/*`（改 token 驅動）、`src/api/client.ts`（env base＋`X-App-Brand`）
- 由 `apps/foundry-demo/src/theme/tokens.ts`、`src/components/ui.tsx`、`src/features/**` 搬
- `backend/nest-api`：見 [`backend-plan.md`](backend-plan.md)
- `docs/mvp-plan.md`：加「LAB 核心版先上」一節（唔刪 Foundry 全套）

## 驗收
- `npx expo-doctor` 全綠；`tsc --noEmit`、`jest-expo` 通過；`APP_BRAND=lab` 同 `APP_BRAND=foundry` 都 build 到。
- LAB build 只見 LAB 白名單分店；用 G6 測試會員（G9 批咗先做）：登入 → 約堂 → 滿堂候補 → 單筆取消（同一堂其他預約唔受影響）→ 約 Recovery（或者降級方案）→ 撞時間被拒 → Passport 見到 → 收到 push → 用專用帳戶刪帳戶 → 舊 access token 即時失效。
- 登出再換另一個帳戶登入，唔會收到前一個帳戶嘅 push 或者見到佢嘅資料。
- iOS、Android 真機各走一次；Sentry 收到測試錯誤；EAS Update 推一個文案改動，`lab-preview` build 收到、`foundry-preview` 收唔到。
- TestFlight build 通過 Apple 自動檢查；Play closed testing 裝到。

## 流程
1. C2 已開門（2026-10-26）：backend 第 1 星期，唔 deploy、唔開機、唔 push。
2. OFFICE：上板 LAB 會員 app（新 C 號，包 app 部分）＋寫 brief；C3 改成第 5 階段；Anthony 喺 board 開 G1–G9。
3. 對真會員開放寫入、deploy、開機、申請帳戶，全部要 Anthony 親口批。
