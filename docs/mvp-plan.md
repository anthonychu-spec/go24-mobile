# The Foundry Member App — 第一版計劃

更新日期：2026-10-24

取代 2026-10-23 版（GO24 App、Sterling 風格、GO24 紅）。第 1 至 3B 步沿用，其餘重寫。

## 目標

內部試用嘅第一版 = **The Foundry Athletics by ONYX 會員 App**：用呢個 repo（`apps/member-app` Expo + `backend/nest-api` NestJS + PGM）起，UI 跟已批核嘅 Foundry prototype。

- **品牌**：先出 The Foundry；同一份 code 之後再出 GO24（white-label，見 A0 節）。
- **PGM**：Foundry、GO24、ONYX 用同一個 tenant；App 同 backend 按品牌（club ID 白名單）篩選分店、堂、設施、方案。
- **UI**：`Documents\ChatGPT\Mobile Apps\Foundry-App-Final-reviewed.zip`；canvas https://claude.ai/artifact/4e5BxbjsJm1ihFoVmB4A5s 「Foundry」頁。App 文案只用英文。
- **技術**：App 繼續用 **Expo（React Native）**，唔轉 Flutter（2026-10-24 決定，見「技術選擇」）。
- **管理頁**：第一版要有一個網頁管理頁（`apps/admin-web`），營運自己換相、管內容、處理錢包同檢舉，唔使出新 App（見 E 節）。
- **相片**：Prototype 嘅相係 placeholder。真相由營運喺管理頁上載，唔使改 code；拍攝同揀相唔計入排期。

## 範圍

**現有功能（修好 + 轉 Foundry 款）**：登入（密碼／OTP）、首頁、班表預約／候補／取消、我的預約、活動紀錄、通知同 push、PT（合約、堂數、簽名）、會員 QR、會籍、凍結、收藏、推薦同 banner、設定、存卡、找欠款、日票、付款紀錄同收據 PDF、入場被拒畫面、新會員 signup（方案、開始日期、自拍 Face ID、付款）、上堂提醒、每月總結 push、刪除帳戶（上架要求）。

**設施預約**：Sports（Pickleball、Tennis、Golf Sim）Reserve，預設顯示 court layout；Recovery（Lounge、Plunge、Physio）。

**Prototype 新功能（backend 全部未有）**：

| 組 | 功能 |
|---|---|
| 錢包同會籍 | Foundry Balance、Top-Up + bonus、用餘額付款；4 個會籍 tier、比較同升級；tier 福利（book ahead 日數、場租折扣、包 recovery、guest pass） |
| Social Play | Open match 清單、按等級加入、host 開 match、分攤付款、6 小時規則、DUPR 提交 |
| Passport | Visits（每月目標、連續星期）、Milestones 徽章、Passport 等級、Bookings、History、運動 Levels |
| Social | Find players（follow）、Messages、What's on 活動、News & Calendar、Workout buddies |
| Coaching | 教練、group lesson、private lesson 預約；Fitness 頁 PT 免費諮詢 |
| 其他（function-review 第 11 節，prototype 已有畫面） | 分店資料、數碼會員證、Shop（套票、PT 配套、加購）、家庭帳戶、自助凍結、上完堂評分、預約參觀／試堂、新手指南、Book again、收藏球場、預約偏好 |
| 管理頁（prototype 冇，你 2026-10-24 加） | 相片同內容位、banner、news、活動、教練、tier 設定、會員查詢、錢包調整同退款、Social Play、訊息檢舉、push 廣播、球場位置圖、報表、職員帳戶同紀錄 |

**唔包**：Trainer App；網頁版 booking（`F-Web`，見決定 #13）；Guest 落單付款（見決定 #14）；GO24 build（Foundry 上線後先出）。

畫面逐個對照見 [`docs/foundry-screen-map.md`](foundry-screen-map.md)。

## 現況

- 130 個 commit，最後一次 2026-05-15；GO24 功能同舊 UI 大致做完（見 HANDOFF.md）。
- **冇 backend 行緊。**Staging droplet 已刪；最後資料（2026-09-30）已救落本機 `Documents\Claude\go24-backup\rescue-2026-10-23\`（真 schema、`gym_data` DB、`.env` 密鑰），DigitalOcean 亦有 snapshot `247670432`。
- App 寫死連 `api-staging.go24fitness.com`（`apps/member-app/src/api/client.ts`），個 domain 已經無效。
- App 套件版本唔夾：`apps/member-app/package.json` 用 Expo `~54.0.33`，但 React Native 係 `0.78.2`（Expo 54 應該配 0.81）；`newArchEnabled: false`；未裝 `expo-updates`；`test` script 只係 placeholder。
- 冇管理頁：banner 同緊急廣播靠 `BROADCAST_SECRET`（`referral.controller.ts`、`notifications.controller.ts`），冇上載相片嘅地方。
- App 品牌寫死 GO24：`app.json`（`com.go24.member`、scheme `go24`、深色 splash）、`src/theme/colors.ts`（GO24 紅）、`src/theme/fonts.ts`（Inter）。Backend 用 `clubName.includes('ONYX')` 分品牌（`signup.service.ts:77`）。
- 設施預約：GO24 已經喺 PGM 設定咗，而且有人用緊（function-review 4.1）；repo 冇 code。PGM 每間分店只有一個 8 位 Pickleball 區域，**要營運拆做 Court 1–8 先顯示到邊個場**（function-review 4.2）。
- 詳細風險對照見 Codex 研究包：`Documents\Claude\PGM\go24-app-research\go24-research-pack\`。

## 範圍變大咗幾多

舊計劃 6 至 7 星期。新範圍多咗約 20 個新畫面、成套新設計系統、品牌層、管理頁，同埋 backend 要自己起錢包、Social Play、Passport、訊息呢啲 PGM 冇嘅嘢。

| 線 | 估時 |
|---|---|
| Backend A（PGM、核心、付款） | 約 57 日 |
| Backend B（自建新功能 + 管理頁 API） | 約 56.5 日 |
| App frontend（Expo） | 約 77 日 |
| 管理頁 frontend（`apps/admin-web`） | 約 25 日 |

**合共約 17 星期出內部試用版，另加 1 至 2 星期緩衝**（4 條線並行）。

- 只得 3 個人（冇人專做管理頁）：管理頁由 Backend A 第 13 星期起做，約 20 星期。
- 只得 2 個人（1 backend + 1 App）：約 24 星期。

## 技術選擇：Expo（2026-10-24 決定）

| 考慮 | 結論 |
|---|---|
| 現有 code | 登入同 token 續期、API client、預約、候補、Adyen 存卡、PT 簽名、自拍、QR、SecureStore、i18n 都已經做好，用 Expo 可以保留，淨係換畫面 |
| 同 backend | App 同 NestJS 都用 TypeScript，API type 可以共用；管理頁都用 TypeScript |
| Push | Backend 用 Expo push，唔使改；Flutter 要改 FCM／APNs |
| White-label | `app.config.ts` + EAS profile 每個品牌一組 |
| 即時更新 | EAS Update 可以唔經商店審批推 JS／樣式修正（原生改動仍要新 build） |
| Flutter 代價 | 我估多 3 至 4 星期；Codex 另外睇 code 估多 4 至 8 星期。新功能兩邊都要由頭做，轉框架唔慳到 |
| 換相 | 同框架無關：相放雲端，App 讀網址，營運用管理頁換（E 節） |

**轉返 Flutter 只會喺以下情況考慮**：之後請 Flutter 團隊長期維護，或者決定舊 code 全部唔要。

## 階段

### 第 1 步 — 探 PGM tenant（1 至 2 日）

設施部分已經喺 2026-10-24 探咗（function-review 4.1）。用救返嘅 `PGM_CLIENT_ID/SECRET` 只讀探埋以下，結果寫入 function-review：

| 探乜 | PGM 表／API | 決定咩 |
|---|---|---|
| 分店清單 | `Clubs` | Foundry 白名單用邊幾個 club ID（決定 #7） |
| 網球場、Golf 模擬器 | `ClubZones`、`ClubZoneTypes` | Tennis 有冇得約；Golf 2 個位係咪 2 部機 |
| 設施價錢 | `FacilityBookingRules`、`FacilityBookingRulePricingScheduleItems` | 場租同繁忙時段價放 PGM 定 App |
| 儲值／預付 | 會員 balance 可唔可以係正數、`Transactions` 有冇預付款類型 | 錢包用 PGM 定自建（決定 #1） |
| 會籍方案 | `PaymentPlans`、`Contracts`、轉方案 API | Tier 點對應 PGM、升級點做 |
| 運動等級 | `ActivityMemberLevels`、`ActivitySkills`、`ActivitySkillProgressionStages` | Levels 用 PGM 定自建 |
| 入場紀錄 | `Visits` | Passport visits、milestones |
| 教練同課 | `PersonalTrainings`、員工／教練資料、課堂類型 | Coaching 用 PGM 預約定自建 |
| 產品 | `Products`、`ProductCatalogCategories`、`ProductCatalogCategoryAppAvailabilities`、`MembershipAddons`、`MemberProducts` | Shop 賣乜、點入數 |
| 家庭 | `MemberRelations` | 家庭帳戶 |
| 凍結 | `FreezeTypes`、`FreezeReasons`、`ContractFreezes` | 自助凍結 |
| 評分 | `Ratings`、`ClassRatings`、`ClassTypeRatingSummaries` | 評分 |
| CRM | `Crm2Leads`、`Crm2ConsultantAvailability`、`Crm2Events` | 參觀／試堂 |
| 分店資料、會員證 | `ClubOpeningHours`、`ClubOpeningHoursExceptions`、`ClubPhotos`、`ClubEquipment`、`ClubContacts`、`MemberCards`、`MemberPhotos` | Clubs、Member pass |

下面標「待探 PGM」嘅部分，都要等呢步結果。

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
4. `client.ts` 改用 env 設定 API base（每個品牌一個，見 A0）。
5. 設定 Adyen webhook 指向新 domain（舊 domain 累積 10 萬次失敗重試）。

### 第 3 步 — 設施預約（約 2 星期）

| 部分 | 內容 |
|---|---|
| Backend adapter | 包 `GetFacilityBookingOptions` / `BookFacility` / `Cancel`；zone、zone type、rule 用 1 小時 cache |
| Backend 規則 | `memberId` 只由 JWT 取；唔傳任何管理 override 欄位；Options 每次 ≤ 4 小時；逾時／未知結果用 request ledger 記低再對帳；只回傳當前品牌白名單分店嘅 zone |
| 場名 | 每個場 = 一個 PGM zone（function-review 4.2 方法 A）。**營運要先喺 PGM 拆 Pickleball Court 1–8（BOFA、Novotel），Golf Simulator 1–2**；Tennis 待探 PGM |
| Court layout | Prototype 嘅位置圖只係示意。App 用每間分店一個 layout 設定檔（場名 → 圖上位置），等營運俾真平面圖；PGM 未拆場之前預設改 List |
| 價錢 | 只顯示 server 回傳嘅價（tier 折扣、繁忙時段由 server 計）；App 唔自己計總價。價放 PGM 定 App 見決定 #9 |
| 付款 | 免費直接完成；收費用 Foundry Balance 或存咗嘅卡（見「付款」）；book 成功 ≠ 已付款，兩個狀態分開 |
| Recovery | Private Recovery（PGM 產品 #230，收費）、Cold Plunge、Physio 用同一個 adapter；prototype 其他服務（Infrared Sauna、Compression 等）要營運喺 PGM 開 zone 或產品，待探 PGM |
| 我的預約 | 同上堂預約放埋 Passport › Bookings；取消原因由 `FacilityBookingCancelReasons` 提供 |

設計原則（來自 Codex 研究）：Options 回傳係短期 snapshot，UI 唔好將 capacity 顯示成「剩餘位置」；rule ID 同 zone ID 只用 server 回傳嘅組合，唔自己配對。

### 第 3B 步 — 現有功能補完（約 2 星期）

| 功能 | 要修 | 估時 |
|---|---|---|
| Adyen webhook（存卡、付款結果全部靠佢） | 改用 Adyen 標準簽名（每個 item 嘅 `additionalData.hmacSignature`）、timing-safe 比較、按 `pspReference` 去重；`ADYEN_ENVIRONMENT` 預設改 `TEST`；用 Adyen test notification 驗證 | 1 日 |
| 找欠款 | 扣款前建立 `Charge` 記錄；per-user 鎖防重複扣款；確認點樣喺 PGM 銷數（`Transactions/AddContractPayment` 或 n8n），並接上 | 1.5 日 |
| 日票 | 防重複購買；確認日票點樣喺 PGM 開通入場；`STAFF_NOTIFICATION_WEBHOOK_URL` 加入 compose | 0.5 日 |
| 新會員 signup | DTO 加 validator（現時一律 400）；伺服器向 Adyen 核實付款同金額；金額由方案計，唔信 client；加 idempotency 防重複開會員；PGM 三步寫入失敗要可補做；方案只出當前品牌白名單 | 2 日 |
| Face ID（Suprema） | Webhook 加 secret；Suprema 未配置時唔好長期保留自拍相 | 0.5 日 |
| Push | 登出時刪 device token；每次最多 100 個分批送；處理 Expo receipts 清走失效 token；token 加 `brand` 欄 | 1 日 |
| 候補 | 候補提醒文案改正、唔好每 15 分鐘重複推；PGM 轉正時真係發 push（接 outbox） | 0.5 日 |
| 會員 QR | 確認分店有冇裝置掃 QR；有就改用獨立 `QR_SIGNING_KEY` 同提供驗證 endpoint；冇就 Member pass 顯示會員號 + PGM 會員卡號 | 0.5 日 |
| 推薦／banner | 刪走 `BROADCAST_SECRET` 嘅 admin route（改由管理頁 + 職員登入做，見 E 節）；banner `linkUrl` 只准 `https:` 同品牌 scheme；banner 按品牌 | 0.5 日 |
| 凍結、設定、收藏 | Body 加 validator（現時完全唔驗證） | 0.5 日 |
| 每月總結 push | 核對 Visits OData 日期格式，確認真係發到 | 0.5 日 |
| 刪除帳戶（新） | 申請 → 電郵確認 → 清 session、push token、社交資料；文案講明唔會取消會籍 | 1 日 |

### 第 4 步 — 工程基礎、品牌層、設計系統、新功能、管理頁

見下面 Z 至 E 節，按「執行次序」做。

### 第 5 步 — Build 同內部試用（1 星期）

- `eas.json`（`foundry-preview`、`foundry-production`；GO24 profile 預留），出 TestFlight / Android internal build。
- EAS Update channel 同 build profile 一一對應（`foundry-preview` build 只收 `foundry-preview` 更新）。
- 試用名單：內部同事 + 幾位熟客。

## Z. Expo 工程基礎（第 1 星期，約 5 日，另加第 14 星期 Maestro 1.5 日）

先做呢節，之後所有畫面先起喺穩陣嘅底上面。

| 項目 | 做法 | 估時 |
|---|---|---|
| 套件對齊 | `npx expo install --check` 將 React Native 同其他套件對齊 Expo SDK 54（RN 0.81）；確認 `@adyen/react-native` 版本支援；清走用唔到嘅套件 | 1 日 |
| 新架構 | `newArchEnabled: true`；逐個試 Adyen 存卡、簽名、自拍、QR、SecureStore；有問題嘅套件換版本或替代。Expo 之後嘅版本預計只支援新架構，而家轉最平 | 1 日 |
| Development build | 加 `expo-dev-client`；Adyen 呢類原生功能只喺 development build 測，唔用 Expo Go | 0.5 日 |
| EAS Update | 裝 `expo-updates`；`runtimeVersion` 用 `fingerprint` 政策（原生有改就自動要新 build）；每個品牌、每個環境一個 channel | 0.5 日 |
| 錯誤監察 | Sentry（App + NestJS），試用期間睇 crash 同 API 錯誤 | 0.5 日 |
| 測試 | `test` script 改用 `jest-expo` 測核心邏輯（token 續期、價錢顯示、預約狀態）；第 14 星期加 Maestro 走 5 條主要流程（登入、約堂、約場、top-up、取消） | 0.5 日（+ 第 14 星期 1.5 日） |
| 強制更新 | App 開機查 `GET /v1/app-config`：最低版本、維修中提示、功能開關（由管理頁設定） | 0.5 日 |
| 圖片 | 用 `expo-image`（有磁碟 cache）；新 component `SlotImage`：按「內容位」讀管理頁發佈嘅相，冇就用 App 內 placeholder | 0.5 日 |

## A0. 品牌層（white-label）

**App（約 2 日）**

| 項目 | 做法 |
|---|---|
| 品牌設定 | `apps/member-app/brands/foundry/`、`brands/go24/`：`brand.ts`（App 名、scheme、bundle id、API base、顏色 token、字體、logo、語言、功能開關）+ `assets/`（icon、splash、adaptive icon、logo、pattern、字體檔） |
| Build 設定 | `app.json` 改 `app.config.ts`，按 `APP_BRAND` 讀品牌；`eas.json` 每個品牌一組 profile；每個品牌獨立 Expo project（push credential 分開） |
| Theme | `src/theme/*` 由品牌 token 生成，畫面只用 token，唔寫死顏色 |
| 功能開關 | 例如 `sports`、`wallet`、`socialPlay`、`dupr`；GO24 冇球場就關 |
| 文案 | Foundry 只出英文，隱藏語言設定；i18n key 保留俾 GO24 |

**Backend（約 2 日）**

| 項目 | 做法 |
|---|---|
| 資料表 | `brands`（`foundry`、`go24`、`onyx`）、`brand_clubs`（brand、PGM club ID）、`brand_plans`（signup 方案白名單）、`brand_settings`（Adyen merchant、電郵範本、support 聯絡） |
| 請求 | App 每個 request 帶 `X-App-Brand`；登入時寫入 JWT `brand` claim，之後以 JWT 為準 |
| 篩選 | 分店、班表、設施 zone、產品、signup 方案、banner、news／events、open match、find players 全部按品牌白名單 |
| 取代舊邏輯 | 刪 `signup.service.ts` 用分店名有冇「ONYX」分品牌嘅做法，改查 `brand_clubs` |
| 跨品牌會員 | 主分店唔喺白名單嘅會員登入時點處理，見決定 #7 |

## A. 設計基礎同 component（約 8.5 日）

來源：prototype `brand-v22.css`、`four-tabs.css`、`review-fixes.css`；官方 Brand Colours／Brand Typefaces PDF（prototype 已合規）。

| 項目 | 內容 | 檔案 |
|---|---|---|
| 顏色 token | Dark Blue `#102940`（主色、文字、已選）、Teal `#045668`、Orange `#CE5531`（重點、QR 掣外框）、Blue `#5889BD`、Ice Blue `#97BAD4`、Warm Brown `#674736`、Warm Yellow `#EADCAF`、Gold `#C5A75F`、Beige `#E4E0D4`（線、segmented 底）、Dark Brown `#371B19`；底色 `#F7F6F2`、soft `#EFECE5`、muted `#586979`、白。頭像底色只用 `#102940`、`#045668`、`#674736`、`#371B19`（白字 ≥ 4.5:1） | `brands/foundry/brand.ts`、`src/theme/colors.ts` |
| 淺色主題 | 現有 App 係深色 splash／`userInterfaceStyle: dark`；Foundry 轉淺色 | `app.config.ts` |
| 字體 | **只用 IvyJournal Regular（標題）同 Outfit Regular（內文）**，唔用粗體；層次靠大細同大楷。用 `expo-font` 載入 package 入面嘅 ttf。IvyJournal 要先買商用授權（決定 #5） | `src/theme/fonts.ts` |
| 字級 | IvyJournal：登入 hero 42、大 display 36、分類頁 hero 32、頁標題 28、section 標題 24、卡標題／大數字 20／17／15。Outfit：list 標題 15、內文 13–14、meta／掣／tab 12、大楷 label 11。最細 11 | `src/theme/typography.ts` |
| 主掣 | 一款：48 px 高、4 px 圓角、Outfit 12 px 大楷、字距 0.14 em；所有可撳位最少 44 px | `src/components/Button.tsx` |
| 圓角 | 卡同 tile 6 px、主掣 4 px、segmented 全圓、sticky bar 14 px | `src/theme/radius.ts` |
| Pillar | Active = Teal + Orange（Sports、Classes、Fitness）、Recovery = Blue + Ice Blue、Social = Warm Brown + Warm Yellow（Players、Messages、News、Notifications）、Belonging（Profile 等）；白卡同功能 tile 用淡 pattern mask（`pattern-*-soft.png`）；**QR quiet zone 保持純白**；唔用角位括號（REVIEW #3） | `src/theme/pillars.ts` |
| 新 component | `TabBar`（4 tab + 中間 QR 掣）、`AppHeader`（logo 或 Top-Up pill + 4 個 icon）、`CategoryTabs`（Book 底線 tab）、`SegmentedControl`（Recovery／Fitness／Passport 二級 tab，可橫掃）、`PillarTile`、`DateStrip`、`ChipGroup`、`StickyReviewBar`、`SummaryCard`、`StatusBadge`、`CourtLayout`（SVG 示意圖，按設定檔畫場）、`InitialsAvatar`、`BottomSheet`、`BalanceCard`、`TierTable`、`EmptyState`（冇位 + 下一步建議） | `src/components/` |
| 現有 component | `Button`、`Card`、`Badge`、`ScreenHeader`、`Input`、`ListRow` 轉 Foundry token；`Avatar` 併入 `InitialsAvatar` | `src/components/` |
| 設計文件 | 更新 `design-system/MASTER.md`：Foundry token、字級、component 用法；舊 GO24／Sterling 部分標明已取代 | `design-system/MASTER.md` |

## B. 導航

- Tab bar：**Home／Book／Passport／Profile**，中間圓形 QR 掣開 Member pass（開住時冇 tab 高亮）。
- Book 頂部：Sports／Recovery／Classes／Fitness。Sports 入面：Reserve／Social Play／What's on／Coaching；Golf 只有 Reserve + Coaching。
- **Book · Courts 預設 court layout 圖**，可切 List；PGM 未拆場之前預設 List。
- 撳 Book tab 開 Profile › Settings 揀嘅預設分類／運動。
- Header 4 個 icon：Find players、Messages、News & Calendar、Notifications（REVIEW 提過 Calendar 同 Passport › Bookings 重複，可以之後刪）。
- 現有 Activity、Bookings、Notifications、PT、Settings 唔再係 tab（見畫面對照表）。

## C. 畫面

全部 34 個 prototype 畫面嘅 route、改／新同估時見 [`docs/foundry-screen-map.md`](foundry-screen-map.md)。摘要：

| 部分 | 畫面數 | 估時 |
|---|---|---|
| 主 tab（Home、Book 4 類、Passport、Profile、Member pass） | 13 | 25 日 |
| Book 流程（Checkout、Class review、First timer、Rate、PT） | 6 | 6 日 |
| Social（Players、Messages、News、Buddies、Notifications） | 5 | 7.5 日 |
| 帳戶、會籍、付款（Top-Up、Payments、Clubs、Shop、Family、Freeze） | 7 | 11 日 |
| 入會同登入（Welcome／Sign in、Join、Tour） | 3 | 5 日 |
| 三種狀態、未登入版、真機調整 | — | 5 日 |
| 品牌設定（A0 App 部分）+ 設計基礎 + component（A 節） | — | 10.5 日 |
| Expo 工程基礎（Z 節）+ Maestro 測試 | — | 6.5 日 |
| **App frontend 合共** | 34 | **約 77 日** |

## D. Backend 新功能

全部新表用 TypeORM migration；金額一律由 server 計；寫入 PGM 嘅動作用 request ledger + idempotency key；所有 list 按品牌篩選。

### D1. 錢包（Foundry Balance）同 Top-Up（約 6 日）

| 項目 | 內容 |
|---|---|
| 來源 | **待探 PGM**：PGM 有冇真儲值（會員 balance 可唔可以係正數、預付款類型）。有 → 用 PGM，App 只做顯示同入數；冇 → 自建 ledger（決定 #1） |
| 資料（自建） | `wallets`（user、brand、balance 快照）、`wallet_entries`（只加唔改：top-up、bonus、付款、退款、人手調整；每筆有 `charge_id`／`booking_id`、原因、操作人） |
| Top-up | 金額 $500／$1,000／$2,000／$5,000；bonus % 跟 tier（prototype：0／3／5／10%，樣本）；Adyen 用存咗嘅卡收錢，webhook `AUTHORISATION` 成功先入數；bonus 分開一筆，方便會計同退款 |
| 用餘額付 | 場、recovery、lesson、event、shop、Social Play 份額；扣款同預約用同一個 transaction；預約失敗自動退返 |
| 退款 | 取消預約退返錢包（唔退卡）；top-up 退款規則見決定 #1 |
| 管理 | 財務喺管理頁人手調整（要原因，超過上限要第二個人批，見 E3 #8）；每日對帳 Adyen 收款 vs ledger |

### D2. 會籍 tier 同升級（約 5 日）

| 項目 | 內容 |
|---|---|
| 來源 | Tier = PGM 會籍方案（`PaymentPlans`），用 ID 對應；升級 = PGM 轉合約／轉方案，**待探 PGM** 有冇 API；冇就做「申請升級」交前台（同舊凍結申請一樣） |
| 資料 | `tiers`（brand、名、PGM plan ID 清單、月費顯示、排序）、`tier_benefits`（book ahead 日數、場租折扣 %、每月 rentals、guest pass、包邊啲 recovery、top-up bonus %、可唔可以打 ranked） |
| 規則 | 設施預約：book ahead 日數同折扣由 server 按 tier 計；recovery「包咗」嘅服務價錢 = 0；每月配額（rentals、guest pass）要計數表 `benefit_usage` |
| 名同價 | Prototype 嘅 Social／Active／All Access／ONYX Black 同價錢係樣本（決定 #2） |

### D3. 付款（Adyen）（約 2 日，喺 D1 之上）

| 流程 | 做法 |
|---|---|
| 共用 | 一個 `PaymentsService`：server 計金額 → 建 `charges` → Adyen `/payments`（存咗嘅卡，shopper 在場 = CIT）→ webhook 確認 → 業務動作；每個 charge 有 idempotency key；按 `pspReference` 去重 |
| 用途 | Top-up、場租、Social Play 份額、recovery、coaching、events、shop、signup（現有）、找欠款（現有）、日票（現有） |
| 退款 | Adyen `/refunds`（退卡）或錢包入數（退餘額），按決定 #1 |
| Social Play 補款 | 開場前 6 小時仲有空位、host 揀「付餘額」時：由錢包扣最簡單；如果要直接扣卡就係 merchant-initiated，要先喺 checkout 取得同意（`UnscheduledCardOnFile`），見決定 #3 |
| 上架 | 場、堂、recovery 係 App 外用嘅實體服務，按 Apple／Google 規則可以用 Adyen，唔使 in-app purchase；送審時講明 |

### D4. Social Play（約 8 日）

| 項目 | 內容 |
|---|---|
| 來源 | 自建。場地本身用第 3 步嘅 `BookFacility`，**PGM 預約掛喺 host 名下**；其他球員只記喺 App（前台喺 PGM 只見 host）。PGM 可唔可以加同場參加者：待探 PGM |
| 資料 | `matches`（facility booking ID、運動、分店、場、時間、時長、等級範圍、人數上限、ranked、DUPR 設定、狀態）、`match_players`（user、角色 host／player、份額、付款狀態、加入時間）、`match_events`（加入、退出、補款、取消） |
| 流程 | Host 喺 checkout 揀 Social Play → 預約場 → 付自己份額 → match 公開；其他人按等級篩選加入 → 付份額；滿員 → 通知全部人 |
| 6 小時規則 | Job 每 5 分鐘檢查：開場前 6 小時仲有空位 → 推 host「免費取消」或「付返剩低份額」；冇回應嘅預設行為見決定 #3 |
| 等級 | 只有等級符合（或 host 准）先加入到；等級來自 D6 |
| 通知 | 有人加入、滿員、6 小時提醒、取消；match 自動開一個群組 thread（D8） |

### D5. DUPR（約 4 日，要 DUPR 批 API）

| 項目 | 內容 |
|---|---|
| 來源 | DUPR partner API（唔係 PGM）；要先申請（決定 #4） |
| 功能 | 會員連結 DUPR 帳戶（OAuth）、讀 rating 顯示喺 Players／Levels；ranked match 完場後由 host 輸入比分 → 提交 DUPR；DUPR Plus／Verified 限制 |
| 資料 | `dupr_links`（user、DUPR ID、token、最後同步）、`match_results`（比分、提交狀態、DUPR 回應） |
| 後備 | 未批到 API：連結改人手輸入 DUPR ID 同 rating，Submit to DUPR 掣隱藏 |

### D6. 運動等級（約 3 日）

| 項目 | 內容 |
|---|---|
| 來源 | **待探 PGM**：`ActivityMemberLevels`、`ActivitySkills`、`ActivitySkillProgressionStages`。有 → 讀寫 PGM；冇 → 自建 `member_sport_levels`（user、運動、等級、來源：自選／教練／DUPR、更新時間） |
| 規則 | Pickleball：自選等級 + DUPR；Tennis：自選，教練每 5 場 ranked 檢討一次（prototype 文案）；Golf：handicap（決定 #16） |
| Ladder | Profile 嘅 Club ladder／Tennis ladder／Longest drive 排行：自建，由 ranked 結果計；冇 DUPR 時只計 App 內結果 |

### D7. Passport（約 4 日）

| 項目 | 內容 |
|---|---|
| Visits | PGM `Visits`（現有 activity module 同 `gym_data`）；今月次數、每月目標（`user_settings` 存）、連續星期 |
| Milestones | 現有 `member_milestones` 表（要先補 migration）；規則表 `milestone_definitions`（例如第一次入場、5 堂 group class、試 3 種活動、連續 3 星期、50 次入場、一次 recovery）；每次同步 visits／預約完成後計 |
| Passport 等級 | 按完成嘅 milestone 計（prototype：Starter → … 樣本名）；只計已完成嘅 check-in，唔計將來預約 |
| Bookings／History | 合併上堂、設施、match、lesson、event 預約；History 有「再約」 |
| 獎勵 | 有冇（例如送 PT 一堂）見決定 #17 |

### D8. Find players、Messages、Buddies（約 13 日）

| 項目 | 內容 | 估時 |
|---|---|---|
| 社交檔案 | `member_profiles`（顯示名、頭像、運動、等級、主分店、**公開設定預設關**）；`follows`；只搜到同品牌、已公開嘅會員 | 3 日 |
| Messages | `threads`（1 對 1、match 群組、教練、Front Desk）、`thread_members`、`messages`、`message_reports`、`blocks`；第一版用 push + 拉取，唔做 websocket；新訊息 push | 5 日 |
| 上架要求 | 用戶互傳內容：要有檢舉、封鎖、過濾，同埋營運處理檢舉嘅流程 | 計入上面 |
| Front Desk | Front Desk thread 接去職員收件箱：可以用現有 Chatwoot（`go24-chatwoot` droplet）或簡單 admin 頁，見決定 #12 | 2 日 |
| Workout buddies | 邀請 follow 咗嘅人一齊約同一堂／場；`buddy_invites`（邀請人、被邀請人、預約、狀態） | 3 日 |

### D9. What's on、News、Coaching（約 8.5 日）

| 項目 | 內容 | 估時 |
|---|---|---|
| What's on 活動 | **待探 PGM**：活動可唔可以開做 PGM 課堂（有名額、預約、前台睇到）。可以 → 用現有班表 adapter，按課堂類型分出嚟；唔可以 → 自建 `events`、`event_registrations` + admin | 3 日 |
| News & Calendar | 自建 `news_posts`（品牌、標題、內文、相、標籤、日期）；Calendar = 自己預約 + 公開 match + 活動 | 1.5 日 |
| Coaching | 教練資料：PGM 員工／教練（**待探 PGM**）+ 自建 `coach_profiles`（相、資歷、專長、運動）；group lesson = PGM 課堂；private lesson = PGM PT 預約（`PersonalTrainings`，**待探 PGM** 有冇會員自助預約 API）。冇 → 「申請時段」交教練確認 | 4 日 |

### D10. 其他 prototype 功能（約 19 日）

| 功能 | 來源 | 估時 |
|---|---|---|
| 分店資料、Home club | PGM `ClubOpeningHours`、`ClubOpeningHoursExceptions`、`ClubPhotos`、`ClubEquipment`、`ClubContacts`（待探 PGM 資料齊唔齊） | 2 日 |
| Member pass | 現有 QR + PGM `MemberCards`、`MemberPhotos` | 1 日 |
| Shop | PGM `Products`、`ProductCatalogCategories`、`ProductCatalogCategoryAppAvailabilities`、`MembershipAddons`；賣出點樣喺 PGM 開產品／入數，待探 PGM；付款用 D3 | 4 日 |
| 家庭帳戶 | PGM `MemberRelations`（待探 PGM）；家長幫子女約堂、睇預約；權限檢查 | 4 日 |
| 自助凍結 | PGM `FreezeTypes`、`FreezeReasons`、`ContractFreezes`（待探 PGM）；即時計費 → 確認 → 寫 PGM；取代舊「凍結申請」 | 3 日 |
| 上完堂評分 | PGM `Ratings`、`ClassRatings`（待探 PGM）；堂完 1 小時推送 | 2 日 |
| 參觀／試堂 | PGM `Crm2Leads`、`Crm2ConsultantAvailability`（待探 PGM）；未登入都用到；防濫用（throttle + 驗證碼電郵） | 3 日 |

### D11. 偏好、收藏、通知類型、新手指南（約 3 日）

| 項目 | 內容 | 估時 |
|---|---|---|
| 預約偏好 | Book 預設分類、常用運動／分店／時長／時間、court 顯示方式：存現有 `user_settings`（prototype 只存瀏覽器） | 0.5 日 |
| 收藏球場 | `favourite_courts`（運動、分店、場）；Book again 用過去預約計 | 0.5 日 |
| 新手指南 | 堂型說明（強度、要帶乜、幾點到、房）：自建 `class_type_guides`，內容由營運寫 | 1 日 |
| 通知類型 | match、message、wallet、event、評分；跟現有 outbox + push | 1 日 |

### Backend 合共

| 線 | 內容 | 估時 |
|---|---|---|
| Backend A（PGM、核心、付款） | 第 2 步、第 3 步、第 3B 步、A0、D1、D2、D3、D10 | 約 57 日 |
| Backend B（自建新功能 + 管理頁 API） | D4、D5、D6、D7、D8、D9、D11、E 節 backend | 約 56.5 日 |
| **合共** | | **約 113.5 日** |

## E. 管理頁（`apps/admin-web`）

### E1. 原則

- **營運自己做得到，唔使搵 developer**：換相、出 news、開活動、改 tier 福利、處理錢包同檢舉。
- **每個新功能 = App API + 管理頁 API 一齊交**：例如做 Social Play 嘅時候，同時做「睇 match、取消、退款」嘅 admin endpoint。
- **頂部揀品牌**（Foundry／GO24）：所有內容、相片、報表按品牌分開；職員只見到佢有權限嘅品牌。
- **改動要留紀錄**：每次新增、修改、刪除、發佈都寫 `admin_audit_log`（邊個、幾時、改咗乜、改之前同之後）。
- **先草稿、後發佈**：相片同內容可以預覽先發佈，亦可以預設發佈時間；發佈錯咗可以一撳還原上一版。

### E2. 技術

| 項目 | 做法 |
|---|---|
| 前端 | `apps/admin-web`：React + Vite + TypeScript，用 React-Admin（開源版）起清單、表格、表單，唔使逐頁手寫；同 App 共用 API type |
| 部署 | Build 成靜態檔，Caddy 喺 `admin.<domain>` 提供；同 API 同一部 droplet |
| 登入 | 獨立職員帳戶（`staff_users`），同會員帳戶分開；密碼 + **TOTP 兩步驗證（必須）**；token 用獨立 secret 同 `aud: admin`；閒置 30 分鐘登出；登入加 throttle |
| 權限 | 角色（見 E4）+ 品牌範圍；backend 每個 `/v1/admin/*` endpoint 檢查角色，唔靠前端隱藏掣 |
| CORS | `/v1/admin/*` 只准 `admin.<domain>` |
| 相片儲存 | DigitalOcean Spaces（S3 兼容）+ CDN。管理頁攞 presigned URL 直接上載；backend 用 `sharp` 出幾個尺寸（例如 750、1500 闊，WebP + JPEG）；每次換相都係新網址，App cache 唔會一直顯示舊相 |
| 取代舊做法 | 刪走 `BROADCAST_SECRET` route；banner、廣播、推薦清單全部搬入管理頁 |
| 外觀 | 用 React-Admin 預設樣式 + Foundry 主色；字體用系統字，唔使另買 IvyJournal 網頁授權 |
| 手機 | 以電腦用為主；相片上載同檢舉處理喺手機瀏覽器都要用到 |

### E3. 頁面

| # | 頁面 | 做咩 | 用嘅資料 | UI 估時 |
|---|---|---|---|---|
| 1 | 登入、品牌切換、職員帳戶、改動紀錄 | 開職員帳戶、設角色同品牌、重設兩步驗證；查邊個改過乜 | `staff_users`、`admin_audit_log` | 3 日 |
| 2 | **相片庫 + 內容位** | 上載、裁切（按每個位嘅比例）、alt 文字；揀每個內容位用邊張相；手機框預覽；預設發佈時間；還原 | `media_assets`、`image_slots`（見 E5） | 3 日 |
| 3 | Banner、News | 首頁 banner（排序、分店、開始／結束時間、連結檢查）；News 文章（標題、內文、相、標籤） | `banners`（現有）、`news_posts` | 1.5 日 |
| 4 | What's on 活動 | 開活動（如果唔用 PGM 課堂，見 D9）、名額、價錢；報名名單、取消、退款 | `events`、`event_registrations` | 1.5 日 |
| 5 | 教練、新手指南、分店補充資料 | 教練相、資歷、專長；每種堂嘅新手說明；PGM 冇嘅分店相同設施 | `coach_profiles`、`class_type_guides`、分店補充表 | 1.5 日 |
| 6 | Tier 同 Top-Up 設定 | 每個 tier 嘅福利、對應 PGM 方案；top-up 金額同 bonus % | `tiers`、`tier_benefits`、top-up 設定 | 1 日 |
| 7 | 會員查詢（只讀） | 搜會員：會籍、預約、match、錢包紀錄、push token、檢舉紀錄；幫客服答問題 | 合併 PGM + App 資料 | 2 日 |
| 8 | 錢包 | Ledger 明細；人手加減（要寫原因）；退款（退卡或退餘額）；**超過上限要第二個人批**（決定 #18） | `wallet_entries`、`charges`、`wallet_adjustment_requests` | 2 日 |
| 9 | Social Play | 睇 match、參加者、付款狀態；取消 match、退款；處理投訴 | `matches`、`match_players` | 1 日 |
| 10 | 訊息檢舉 + Front Desk | 檢舉清單：隱藏訊息、封鎖會員、結案；Front Desk 收件箱（如果唔用 Chatwoot，決定 #12，另加 2 日） | `message_reports`、`blocks`、`threads` | 2.5 日 |
| 11 | Push 廣播 | 揀品牌、分店、會員類型；排期；先送自己測試；送出後睇送達數 | 現有 outbox + push | 1.5 日 |
| 12 | 球場位置圖 | 上載分店平面圖；將 PGM 每個場（Court 1–8）拉到圖上位置；App 嘅 court layout 讀呢個設定 | `court_layouts` | 2 日 |
| 13 | 報表 | 每日：預約數、top-up、收款；Adyen 收款 vs 錢包 ledger 對帳結果；open match 成團率 | 只讀統計 | 1.5 日 |
| 14 | App 設定 | 每個品牌：最低 App 版本、維修中提示、功能開關（例如未批 DUPR 就關 Submit to DUPR） | `app_config` | 1 日 |
| | **管理頁 UI 合共** | | | **約 25 日**（用 Chatwoot 嘅話；自建 Front Desk 收件箱 +2 日） |

### E4. 角色

| 角色 | 可以做 |
|---|---|
| Super admin | 全部；開職員帳戶、改角色 |
| 內容編輯 | 相片、內容位、banner、news、教練、新手指南 |
| 營運 | 活動、Social Play、球場位置圖、push 廣播、會員查詢 |
| 客服／前台 | 會員查詢、訊息檢舉、Front Desk；錢包只可以「申請」調整 |
| 財務 | 錢包調整同退款、批第二重批核、tier 同 top-up 設定、報表 |

邊個職員用邊個角色見決定 #18。

### E5. 內容位（換相）

App 每個用相嘅位置有一個固定名，營運喺管理頁揀相；App 開嗰陣讀 `GET /v1/content/slots`（有 ETag，cache 喺手機），冇設定就用 App 內 placeholder。

| 組 | 內容位例子 |
|---|---|
| 入口 | `landing.hero`（Welcome 全屏相）、`signup.plan.<方案>` |
| Home | `home.hero`、`home.explore.active`、`home.explore.recovery`、`home.explore.social`、`home.first-class` |
| Book | `book.sports.<運動>`、`book.recovery.<lounge／plunge／physio>`、`book.classes.<groupx／hyrox／reformer／yoga>`、`book.fitness.floor`、`book.fitness.pt` |
| 分店 | `club.<club ID>.cover`、`club.<club ID>.gallery`（多張） |
| 人 | `coach.<教練 ID>`（喺教練頁管理） |
| 其他 | Banner、News、活動相各自喺嗰頁上載 |

資料：`media_assets`（品牌、原檔、各尺寸網址、闊高、alt、上載人、時間）、`image_slots`（內容位名、品牌、相、裁切、狀態：草稿／已發佈、發佈時間、改動人）。

### E6. Backend（計入 Backend B）

| 項目 | 估時 |
|---|---|
| 職員帳戶、TOTP、角色、品牌範圍、改動紀錄 | 4 日 |
| 相片：Spaces、presigned 上載、`sharp` 出尺寸、內容位 API、發佈／還原 | 3 日 |
| 各頁 admin endpoint（會員查詢、錢包第二重批核、廣播、報表、app-config、球場位置圖） | 6 日 |
| **合共** | **13 日** |

## 執行次序

四條線並行：**Backend A**（PGM、核心、付款）、**Backend B**（自建新功能 + 管理頁 API）、**App**（Expo）、**管理頁**（`apps/admin-web`）。App 同管理頁頭幾星期唔使等 backend（用 mock data 起）。

| 時間 | Backend A | Backend B | App | 管理頁 | 關卡 |
|---|---|---|---|---|---|
| Day 1–2 | 第 1 步：探 PGM（上表全部） | 同 A 一齊探 | Z 節：套件對齊 Expo 54 | — | **決定 Foundry 白名單分店**；決定邊啲功能用 PGM、邊啲自建 |
| 第 1 星期 | 開 production droplet、還原 `.env`、補 migration、修保安洞、Adyen webhook 新網址同正確簽名；A0 品牌層 | 資料表設計（社交、等級、Passport、管理頁） | Z 節：新架構、development build、EAS Update、Sentry、`app-config`、`SlotImage` | — | App（新架構）登入到新 backend，只見到 Foundry 分店，班表預約行得通 |
| 第 2 星期 | 找欠款、日票、signup 付款核實、Face ID webhook | E6 職員帳戶、TOTP、角色、改動紀錄 | A0 品牌設定（`app.config.ts`、`brands/foundry/`）；設計 token、淺色主題、字體 | — | 用 Adyen TEST 走通存卡、找欠款、日票、signup。**決定 #1（錢包）、#2（tier）、#3（Social Play 付款）要有答案** |
| 第 3 星期 | 第 3 步設施 adapter + 規則層；reconcile 查 PGM | E6 相片上載、內容位 API；D7 Passport | Component 完成 + 展示頁 | 起 `apps/admin-web`；登入、兩步驗證、品牌切換、職員帳戶、改動紀錄；App 設定 | 設施 API 用測試會員約到同取消到；職員登入到管理頁 |
| 第 4 星期 | 設施：場租、tier 折扣、繁忙時段；Recovery | D7 Passport 完成；D6 等級 | Tab bar + 中間 QR 掣、Book 分類 tab、Home、Classes | 相片庫 + 內容位、Banner、News | **營運要喺 PGM 拆好 Pickleball Court 1–8、Golf Simulator 1–2**；否則 Reserve 先用 List、唔顯示場名。**管理頁上載一張相，App 即刻見到** |
| 第 5 星期 | D1 錢包 ledger、top-up、bonus | D8 社交檔案、follow；D4 Social Play 資料表 | Class review、PT、Sports · Reserve | 教練、新手指南、分店資料；Tier 同 Top-Up 設定；會員查詢 | — |
| 第 6 星期 | D1 用餘額付、退款；D3 共用付款 | D4 Social Play：加入、份額、6 小時 job + admin endpoint | Reserve 完成、Checkout、First timer、Rate | 錢包（調整、退款、第二重批核）；球場位置圖 | 用錢包約到收費場；Social Play 4 個測試會員走通；退款喺管理頁做到 |
| 第 7 星期 | D2 tier 同福利、升級 | D5 DUPR（或後備）；D6 ladder | Recovery、Social Play、What's on | 活動、Social Play、Push 廣播 | **DUPR API 批咗未**：未批就用後備，管理頁關 Submit to DUPR |
| 第 8 星期 | D10 Shop、Member pass | D8 Messages | Coaching、Fitness、Passport | 報表（含 Adyen vs ledger 對帳） | Top-up 用 Adyen TEST 入數、bonus 正確、對帳一致 |
| 第 9 星期 | D10 家庭、自助凍結 | D8 檢舉／封鎖、Front Desk；D9 What's on | Passport 完成、Member pass、Profile | 訊息檢舉 + Front Desk；全部頁接真 API | — |
| 第 10 星期 | D10 分店資料、評分、參觀／試堂 | D9 News、Coaching | Top-Up、Payments、Shop | 營運試用、修 bug、寫使用說明 | **營運開始用管理頁入真相、活動、教練** |
| 第 11 星期 | 第 3B 步餘下：push 清理同分批、候補 push、QR、刪除帳戶、validator、每月總結、banner | D8 Workout buddies；D11 | Freeze、Family、Find players、Tour | 支援營運；（自建 Front Desk 收件箱嘅話喺呢度做） | — |
| 第 12 星期 | 監察、對帳 job、殘餘 bug | 管理頁 API 執尾、修 bug | Messages、News、Buddies、Notifications | 支援營運 | **IvyJournal 授權要買咗**（或者換字體），先可以出商店 build |
| 第 13 星期 | 修 bug、壓力測試（班表、設施 Options） | 修 bug | Clubs、Club detail、Welcome／Sign in、Join | 修 bug | — |
| 第 14 星期 | 修 bug | 修 bug | 三種狀態、未登入版、真機調整、Maestro 5 條流程 | 修 bug | **所有內容位都有真相**（冇就用 placeholder 試用） |
| 第 15 星期 | 修 bug | 修 bug | 全部畫面接真 backend、修 bug | 修 bug | **Feature freeze** |
| 第 16 星期 | 監察 | 監察 | EAS build、TestFlight／Android internal、真機驗收 | — | iOS、Android 各一部真機走完驗收清單 |
| 第 17 星期 | — | — | — | — | **內部試用開始** |
| 緩衝 | 預留 1 至 2 星期 | | | | |

管理頁線約 9 星期全職，第 10 星期起可以兼職支援營運。

**如果 PGM 冇真儲值、又未決定錢包**：第 5–6 星期 Backend A 改做 D10，錢包順延；Checkout 先只用卡，管理頁錢包頁順延。

**如果營運未拆場**：Reserve 用 List（只顯示「有場」，唔顯示場名），court layout 圖同管理頁球場位置圖等拆場後再開；Social Play 照做（PGM 預約一個位）。

**如果只得 3 個人（冇人專做管理頁）**：管理頁由 Backend A 第 13 星期起做（約 5 星期），約第 20 星期出試用版；營運入內容都要順延。

**如果只得 2 個人（1 backend + 1 App）**：約 24 星期。

## 驗收

- 每個畫面同 prototype（canvas「Foundry」頁）並排比較：版面、字級、掣、pillar pattern 一致；字體只係 IvyJournal Regular + Outfit Regular。
- 所有可撳位 ≥ 44 px；文字最細 11 px。
- 冇位、載入中、出錯三種狀態都有設計；未登入版（Profile、Messages、Top-Up 等）有 Sign in 引導。
- Foundry build 只見到白名單分店、方案、活動；GO24 測試帳戶登入見決定 #7 嘅結果。
- 錢包：每筆 Adyen 收款同 ledger 對得上；取消預約退款正確。
- iOS、Android 各一部真機走完：登入 → 約堂 → 約場（揀場）→ 開 Social Play → 第二個帳戶加入同付份額 → top-up → 用餘額約 recovery → 取消 → 睇 Passport → 發訊息。
- 管理頁：內容編輯換首頁相，App 重開就見到新相；還原上一版都得。
- 管理頁：客服只可以申請錢包調整，財務批咗先入數；每個改動喺改動紀錄搵到。
- 管理頁：未開兩步驗證嘅職員登入唔到；客服角色開唔到錢包批核同職員帳戶頁。
- 營運用使用說明自己做到：上載相、出 news、開活動、改 tier 福利、發 push 廣播。

## 第一版之後再做

- GO24 build（用同一份 code，換 `brands/go24/`）
- 網頁版 booking（`F-Web`），如果決定 #13 唔放第一版
- 候補排名：`waitlistPosition` 永遠 null，要 PGM 提供位置資料先做到
- `CANCEL_TOO_LATE` 錯誤 mapping 同遲取消提示（要先知 PGM 回傳格式）
- Messages 改 websocket 即時
- `/api-docs`、`/metrics` 唔再公開；收窄 `cors`
- Trainer App

## 要 GO24／Foundry 決定嘅事

**錢包、會籍、付款**

1. **錢包**：用 PGM 真儲值（前台同 App 同一個餘額；待探 PGM 有冇呢個功能），定 App 自己記嘅 credit（只可以喺 App 用，前台睇唔到）？另外要定：top-up 可唔可以退款；bonus 幾時失效（prototype 寫「會籍有效期間永不過期」）；會計點入帳。如果餘額可以喺幾間唔同公司（GO24、ONYX、Foundry）嘅服務用，要問律師使唔使儲值支付工具牌照（《支付系統及儲值支付工具條例》）。
2. **Tier**：Prototype 嘅 Social／Active／All Access／ONYX Black 同月費（HK$680–3,280）、福利同 bonus 係樣本，要真名、真價、真福利，同對應邊個 PGM 方案。Prototype 入面 Join 頁又用另一套方案名（Single Club、All The Foundry Clubs、ONYX Premium），要統一做一套。升級即時生效定下期？按比例收費？
3. **Social Play 付款**：建議每人加入時付自己份額（餘額或卡）；開場前 6 小時仲有空位 → host 揀免費取消或者付餘下份額。要定：host 唔回應時預設取消定扣款；可唔可以直接扣 host 張卡（要佢預先同意），定只扣餘額；退出 match 幾時前可以退款；非會員朋友可唔可以加入。
4. **DUPR**：要唔要申請 DUPR partner API（連結帳戶、讀 rating、提交 ranked 結果）？邊個負責申請？未批到之前用後備（人手填 DUPR ID 同 rating，唔自動提交）。
5. **IvyJournal 商用授權**：Package 入面嘅字體寫明 NOT FOR COMMERCIAL USE。要喺 https://ivyfoundry.com/families/ivyjournal/ 買 App 用嘅授權（mobile app／embedding license），第 12 星期前要買好；唔買就要揀替代 serif 字體。

**PGM 同營運設定**

6. **PGM 拆場**：營運喺 PGM 將 BOFA、Novotel 嘅 Pickleball 拆做 Court 1–8（function-review 4.2 嘅 6 個步驟）；Golf 2 個位係咪 2 部模擬器，係就拆 Simulator 1／2。拆場後每人每日最多約幾多次（而家 8 次）？一次可唔可以約幾個場？第 4 星期前要做好。
7. **Foundry 分店白名單**：Prototype 列咗 Whampoa、Lai Chi Kok、North Point、Kennedy Town、ONYX Novotel Wan Chai、ONYX Central · BOFA Tower（「7 間」），當中 North Point、Kennedy Town 而家係 GO24 分店。實際邊幾個 PGM club 屬 Foundry？一間分店可唔可以同時屬兩個品牌？GO24／ONYX 會員可唔可以登入 Foundry App，登入後見到乜？
8. **Tennis**：Prototype 有網球場（Novotel、BOFA），但 PGM 設施清單冇。有冇網球場？冇就第一版隱藏 Tennis。
9. **場租同 recovery 價錢**：PGM 而家 Pickleball、Golf 免費；prototype 收 HK$280／360／400 一小時、繁忙時段另價。價錢放 PGM 預約規則（建議，前台同 App 一致）定 App？Tier 折扣係咪由 App 計？
10. **Recovery 服務**：Prototype 有 Infrared Sauna、Compression、Contrast Suite、Red Light、Stretch Lab、Physio 各項等等，PGM 而家只有 Private Recovery、Cold Plunge、Physio Room。實際有邊啲服務、邊個 tier 包、喺 PGM 點設定？Physio 可唔可以會員自己約（function-review 4.4）？
11. **活動同 Coaching**：What's on 活動同 group lesson 喺 PGM 開做課堂，定 App 自己管理？教練資料、相、資歷邊個提供同更新？Private lesson 會員直接約，定教練確認？

**Social 同內容**

12. **Messages**：Front Desk 對話由邊個覆、幾點至幾點？用現有 Chatwoot，定管理頁自建收件箱（多 2 日）？會員之間嘅訊息檢舉由邊個角色處理？
13. **網頁版 booking（`F-Web`）**：Prototype 有網頁版（約場、Open Match、Top-Up、Guest checkout），唔係 App。要唔要放第一版？建議 App 上線後先做。
14. **Guest**：「Continue as Guest」只係瀏覽，定可以以非會員身份約場付款（要喺 PGM 開 prospect、收卡）？建議第一版只瀏覽。
15. **入口畫面**：Welcome 同 Sign in 兩頁都有 Sign in／Register，揀一個（REVIEW.md）。「Create your account」（以 Social member 加入）同 Join 入會流程係咪同一樣嘢？
16. **Golf handicap**：Prototype 寫「Simulator handicap is based on your last 10 rounds」。模擬器（TrackMan 等）有冇 API 俾數？冇就第一版人手填或者隱藏。
17. **Milestones 獎勵**：有冇獎勵（例如送 PT 一堂、recovery 一次）？Passport 等級正式名稱？
18. **管理頁**（已決定要自建，見 E 節）：邊幾位職員用、各自咩角色？錢包人手調整同退款超過幾多錢要第二個人批（建議 HK$1,000）？管理頁用咩 domain（例如 `admin.<domain>`）？要唔要只准公司網絡登入？相片放 DigitalOcean Spaces（每月約 US$5 起）OK 唔 OK？

**上架同基建（沿用）**

19. App 名、bundle id（例如 `com.thefoundry.member`）、用邊間公司嘅 Apple Developer／Google Play 帳戶；Adyen 用同一個 merchant account 定 Foundry 另開（收據同信用卡月結單顯示名）。
20. 新機直接做 production？Foundry 用邊個 domain？
21. 找欠款同日票付款後，PGM 由邊個銷數／開通（App 直接寫 PGM，定 n8n）？
22. 分店有冇裝置掃會員 QR？冇就 Member pass 顯示會員號同卡號。
23. 2 至 3 個測試會員帳戶（最好有 Foundry、GO24、ONYX 各一個，同一個有家人關係）；內部試用名單。
