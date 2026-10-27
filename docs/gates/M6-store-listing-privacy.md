# M6（前 G4）· 上架資料、私隱、刪帳戶

> 狀態：**草稿，等 Anthony 決定**。2026-10-26 由 Claude 按代碼寫（branch `claude/m6-privacy-deletion-5b3d3c`，由 `feat/backend-week1` 開）。
> 私隱政策草稿：[`M6-privacy-policy-draft.md`](M6-privacy-policy-draft.md)（英文，公開頁用）。**上線前要律師按香港《個人資料（私隱）條例》（PDPO）睇過。**
> 刪帳戶（backend N4）已經寫好、測試過，未 deploy。見第 5 節。

## 1. 要 Anthony 決定

| # | 項目 | 建議 | 備註 |
|---|---|---|---|
| M6-1 | App 名（App Store／Play） | `THE LAB by ONYX` | Apple 名稱上限 30 字元；同 `brands` 表一致 |
| M6-2 | Bundle id／package | `com.onyx.thelab`（佔位） | **上架後改唔到**。要跟集團 Apple／Google 開發者帳戶（G1）嘅擁有人；三個品牌各一個 id |
| M6-3 | Support 電郵 | 例如 `support@<LAB domain>`（有人睇嘅信箱） | Apple、Google 都要；私隱政策同刪帳戶頁會寫埋 |
| M6-4 | 私隱政策網址 | LAB 官網一頁，例如 `https://<LAB domain>/privacy` | 唔好放喺 API domain；兩個商店都要公開、唔使登入 |
| M6-5 | 刪帳戶網址（Google 要） | `https://<API domain>/v1/account-deletion?brand=lab` | 已經寫好（第 5 節）。API domain 等 B1。可以喺官網加一頁連過去 |
| M6-6 | LAB 官網相片授權 | 要書面確認可以用喺 app 同商店截圖 | 攝影師／模特兒授權；冇就換相 |
| M6-7 | 資料使用者（法律實體） | 填公司註冊名同地址 | 私隱政策、商店「開發者」名都要；要同 D-U-N-S 一致 |
| M6-8 | 私隱查詢負責人 | 一個職位＋電郵（例如 Data Protection Officer） | PDPO DPP1 要講明點查詢、點改資料 |
| M6-9 | Sentry 用唔用 | 用，但唔送會員個人資料（backend-plan 監察一節） | 用就要喺 App Privacy 加「Crash Data／Performance Data」；目前代碼**未裝 Sentry** |
| M6-10 | 刪帳戶後發電郵通知 | 第一版唔發；頁面即時顯示結果 | backend-plan N4 寫咗「完成後發電郵通知」，但 backend 冇寄 email 嘅渠道。要發就經 n8n 或者 PGM，另外做 |
| M6-11 | 付款紀錄保留 | 7 年（稅務紀錄） | `charges` 刪帳戶時唔郁。LAB 第一版冇付款功能，主要影響 GO24 |
| M6-12 | 已約嘅堂 | 刪帳戶唔會自動取消 PGM 預約，文案叫會員先取消 | 另一個做法：刪除前檢查有冇未來預約，有就叫佢先取消。要改就話我知 |
| M6-13 | App 權限 | LAB build 拎走 `expo-image-picker`（相機／相簿）同簽名板 | 呢兩樣係 GO24 入會（樣貌登記）同 PT 用；LAB 冇呢啲功能，留住要寫用途說明，審批會問 |
| M6-14 | 年齡分級 | 4+／Everyone | 冇用戶之間嘅內容 |

## 2. 資料清單（按代碼，2026-10-26）

來源：`backend/nest-api/src/**/entities`、services；app 用 `claude/lab-app-foundation-72a87d` 分支。

| 資料 | 由邊度嚟 | 存喺邊 | 用途 | 第三方 | 保留 | 刪帳戶時 |
|---|---|---|---|---|---|---|
| 會員身份：PGM 會員 id、會員號碼、電郵、電話 | 登入（PGM 核實）／入會 | `users` | 登入、顯示會員卡 | PGM（會籍系統，原本已有） | 帳戶存在期間 | 清走，留空殼（status `deleted`） |
| 姓名、會籍、到期日、欠款 | PGM 即時讀取 | **唔存**（只係轉交 app） | Profile、會員卡 | PGM | — | 唔使刪；PGM 嘅資料唔郁 |
| 登入 session（裝置指紋、平台、品牌、最後使用時間） | App | `sessions` | 保持登入、撤銷 | — | 30 日到期 | 刪 |
| Push token | App（Expo） | `device_tokens` | 推送通知 | Expo push service → Apple APNs／Google FCM | 登出或者 app 卸載就刪 | 刪 |
| 通知內容 | Backend | `notifications` | App 收件箱 | — | 帳戶存在期間 | 刪 |
| App 設定（提醒時間、候補自動取消） | App | `user_settings` | 提醒 | — | 帳戶存在期間 | 刪 |
| 約堂紀錄（堂、分店、時間、狀態） | App → PGM | `bookings`、`booking_events`、`outbox_events`；PGM 亦有 | 約堂、取消、對數 | PGM | 帳戶存在期間；刪帳戶後去識別化保留作統計 | 留低但拎走 PGM 會員 id、actor |
| 到訪紀錄（入場次數） | PGM `MemberClubVisits` 即時讀 | 唔存（`member_milestones` 只記里程碑） | Passport | PGM | — | 里程碑刪 |
| 收藏 | App | `user_favourites` | 收藏堂 | — | 帳戶存在期間 | 刪 |
| GO24 專用：卡資料參考（末 4 位、Adyen token 參考）、付款紀錄 | App → Adyen | `payment_methods`、`charges` | 付款 | Adyen | 卡：帳戶期間；付款：7 年（M6-11） | 卡參考刪；付款紀錄留 |
| GO24 專用：樣貌相片 | 入會 | `face_enrollments` | 門禁登記 | Suprema（門禁） | 帳戶期間 | 刪本地相；Suprema 嗰邊要另外處理（第 6 節） |
| GO24 專用：PT 簽名 | App | `pt_logs` | PT 堂確認 | — | 帳戶期間 | 清簽名同備註，留紀錄 |
| GO24 專用：凍結申請、推薦 | App | `membership_requests`、`referrals` | 前台處理 | — | 帳戶期間 | 刪（被推薦嗰邊拎走連結） |
| 伺服器日誌（IP、請求路徑、錯誤） | 系統 | Caddy／Nest log | 保安、除錯 | DigitalOcean（新加坡） | **30 日** | 30 日內自動過期 |
| 資料庫備份 | 系統 | DigitalOcean Spaces（新加坡） | 還原 | DigitalOcean | **30 日** | 30 日內自動過期 |
| 當機／效能診斷（如用 Sentry） | App／API | Sentry | 除錯 | Sentry | 按 Sentry 設定（建議 30 日） | 唔連會員身份 |

**冇收集**：位置、聯絡人、相片（LAB）、健康數據、廣告 ID、瀏覽紀錄；**冇廣告、冇追蹤（tracking）、冇賣資料**。

## 3. Apple App Privacy（App Store Connect）

- **Data used to track you**：無。（冇廣告 SDK、冇同其他公司嘅資料合併。）唔使 ATT 彈窗。
- **Data linked to you**（全部用途：App Functionality；唔係 optional，因為登入要用）：

| Apple 類別 | 項目 | 理由 |
|---|---|---|
| Contact Info | Name、Email Address、Phone Number | 會員身份，由 PGM 讀取／存電郵電話 |
| Identifiers | User ID | PGM 會員 id、會員號碼 |
| Identifiers | Device ID | Push token（保守申報） |
| Other Data | Other Data Types | 約堂紀錄、到訪次數 |

- **Data not linked to you**：如用 Sentry → Diagnostics：Crash Data、Performance Data（用途 App Functionality）。唔用就唔填。
- LAB 第一版**唔填** Financial Info、Photos、Health & Fitness（付款、樣貌、PT 冇開）。GO24 build 要加 Payment Info、Photos、Other User Content（簽名）。
- Privacy manifest（`PrivacyInfo.xcprivacy`）：Expo SDK 58 會合併各 SDK 嘅 manifest；build 完要檢查有冇 required-reason API（例如 UserDefaults、file timestamp）。

## 4. Google Play Data safety

- 有冇收集或者分享資料：**有收集**；**冇分享**（PGM、Expo、DigitalOcean、Sentry 係代我哋處理嘅服務供應商，Google 定義唔計「分享」）。
- 傳送時加密：**係**（HTTPS，Caddy 自動證書）。
- 用戶可以要求刪除：**可以**，填 M6-5 網址。
- 收集項目（全部 required、用途 App functionality＋Account management）：

| Google 類別 | 項目 |
|---|---|
| Personal info | Name、Email address、Phone number、User IDs |
| App activity | Other actions（約堂紀錄、到訪次數） |
| Device or other IDs | Device or other IDs（push token） |
| App info and performance | Crash logs、Diagnostics（**只係用 Sentry 先填**） |

- 「Ephemeral processing」：姓名、會籍資料只係由 PGM 轉交、唔存，但電郵電話有存，所以整體填「collected」。

## 5. 刪帳戶（backend N4）做咗乜

Commit `18719c9`（本地，未 push、未 deploy）。

- **App 內**：`POST /v1/me/account/deletion`（JWT；每人每小時 5 次）。App 嘅 `DeleteAccountScreen` 已經 call 呢個 endpoint，唔使改。
- **網頁**（卸載咗 app 都用得）：`GET /v1/account-deletion?brand=lab` → 輸入電郵 → PGM 寄一次性驗證碼（同登入一樣）→ 入碼、剔「我明白」→ 刪除。純 HTML 表單，冇 JavaScript、冇 cookie；限速：開頁每 IP 每分鐘 30 次、寄碼 10 分鐘 5 次、確認 10 分鐘 10 次。唔存在嘅電郵都顯示同一頁（唔透露邊個係會員）；同一電郵有幾個會員就叫佢搵前台。會籍過期嘅會員都刪到。
- **刪咩**：sessions（所有 app 即刻登出，舊 access token 即時 401）、push token、通知、設定、收藏、idempotency、里程碑、凍結申請、卡參考、樣貌相、佢做推薦人嘅推薦。
- **去識別化（行保留）**：bookings（拎走 PGM 會員 id；未落實嘅預約標記 `ACCOUNT_DELETED`，reconcile 唔再理）、booking_events（actor）、outbox（拎走個人欄位）、PT 簽名同備註、被推薦嘅連結。
- **`users`**：留一行空殼，status `deleted`，email、電話、PGM id、會員號碼全部清。之後用同一個電郵再登入 → 開一個全新空白帳戶。
- **唔郁**：PGM（會籍、PGM 預約、會員資料）、`charges` 付款紀錄。
- **跨品牌**：一個本地帳戶畀所有品牌 app 共用，所以一刪就全部 app 一齊刪；頁面文案講明。
- **網頁文案（草稿）**：中英對照，講明：所有會員 app 共用、刪咩留咩、**唔會取消會籍、唔會停扣款**、已約嘅堂唔會自動取消、日誌同備份 30 日內清除、之後可以再登入開新帳戶。改文案喺 `backend/nest-api/src/account/account-deletion.page.ts`。
- **App 內文案**要跟同一套講法（app session 跟進）。

## 6. 未做／要留意

- Suprema 門禁樣貌模板、Adyen 卡 token：本地參考刪咗，但兩個供應商嗰邊冇自動刪。GO24 上架前要定流程（前台／供應商 API）。LAB 唔受影響。
- 刪帳戶冇發確認電郵（M6-10）。
- 一次性驗證碼由 PGM 寄，PGM 個 email 範本寫住「登入」；頁面已解釋係同一種碼。
- 驗證碼暴力破解：每 IP 10 分鐘 10 次；分散 IP 嘅攻擊靠 PGM 自己嘅限制（未確認 PGM 有冇鎖碼）。登入流程本身都有同一個問題。
- `/auth/request-otp` 對唔存在嘅電郵回 404，可以用嚟探邊個係會員（舊問題，唔係今次引入）。
- 日誌 30 日、備份 30 日要喺開機時設定（G5 基建），而家未有伺服器。
- 私隱政策要律師睇；要有中文版（PDPO 冇硬性要求，但 LAB 會員多數用中文）。
