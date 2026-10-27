# M5 · THE LAB 會員 App — UI 定稿確認表（原 G2）

**畀：** Anthony　**準備日期：** 2026-10-26　**狀態：** ⬜ 等 Anthony 確認

## 要你決定咩

確認 Codex 做嘅 **LAB v1 Red**（紅黑、4 個分頁 Home／Book／Passport／Profile、中間一粒會員證掣）係 THE LAB App 嘅**定稿 UI**。

- 為咗趕工，App session 已經跟 v1 Red 起咗 LAB 畫面（假數據，branch `claude/lab-app-foundation-72a87d`，未 merge）。
- 只有 Foundry 有批核紀錄；LAB 呢份**未有**。你撳「定稿」之前，呢啲畫面只當「暫定」。
- 揀一個：☐ **定稿，照住做**　☐ **定稿，但要改下面勾咗嘅項目**　☐ **唔定，要重做／再出稿**

## 點睇（3 行）

1. 原型：`apps/lab-prototype-web` 入面行 `npm run dev` → 開 http://127.0.0.1:4182/（網址加 `?app=1` 隱藏桌面預覽欄）。
2. App：去 App session 嘅 worktree，喺佢 `.claude/launch.json` 啟動 `member-app-lab-web`（port 8095，mock 模式，無熱更新，改完要重啟）。
3. App 登入：任何 email ＋ 6 個字以上密碼；原型登入：任何顯示名稱，唔使密碼。兩邊都係假數據，唔連後端。

---

## 一、逐個畫面對照

> 「原型」＝ `apps/lab-prototype-web/site/`；「App」＝ branch `claude/lab-app-foundation-72a87d`。✅ 相同／基本相同　⚠️ 有差異　🚫 App 冇（v1 刻意唔做）

### 1. Home

| | 內容 |
|---|---|
| 原型 | 「SHOW UP. EVOLVE.」標題＋日期；全幅相片 hero（TRAIN WITH INTENT／BY ONYX、「STRONGER. BY DESIGN.」、箭咀）；4 粒快捷掣 **Classes／Recovery／Coaching／Member pass**；「YOUR NEXT SESSION」（冇預約時「MAKE ROOM FOR PROGRESS.」）；THE LAB PROTOCOL 三張相（LOAD／ADAPT／BALANCE）；Training Passport 條；「THIS IS YOUR LAB.」＋Club info（相＋地址）；未登入時顯示 WELCOME TO THE LAB |
| App | 版面、字眼、hero、Protocol 三張相、Passport 條、Club info 同原型一樣；下一堂課、Club 資料來自（mock）API |
| 差異 | ⚠️ 快捷掣：**Recovery、Coaching 因 v1 關閉而唔出**，改為 **Classes／Bookings／Member pass／Club info**（仍然 4 粒）。⚠️ 原型 Home 有「未登入」版；App 一定要先登入先見到 Home（登入畫面見下） |
| Anthony | ☐ 照 App　☐ 要改：＿＿＿＿＿＿＿＿ |

### 2. Book

| | 內容 |
|---|---|
| 原型 | 「MAKE IT COUNT.」；分類 **Classes／Recovery／Coaching**；相片 banner；10 日日期條；All／LOAD／ADAPT／BALANCE 篩選；每堂顯示時間、時長、課程名、教練、餘位、「Book／Waitlist」；課堂詳情 → 「BOOK WITH INTENT.」確認 → 成功頁（可加入日曆）；「FIRST TIME IN THE LAB?」卡；Recovery 同 Coaching 各有預約／諮詢表單 |
| App | Classes 一個分類（不顯示分類切換，因為只剩一個）；日期條 8 日；同樣篩選、列表、詳情 → 確認 → 成功頁；額外處理：候補（waitlist）、滿額、每日一堂上限、168 小時預約窗口嘅錯誤訊息；FIRST TIME 卡 |
| 差異 | ⚠️ 無 Recovery／Coaching 分頁（v1 關閉；如被打開只會顯示「請聯絡 club team」）。⚠️ 日期條 10 日 → 8 日。⚠️ 成功頁**冇「Add to calendar」**（原型有）。⚠️ 原型課堂詳情有「HK$350 drop-in」價錢；App 冇價錢（見第二節）。⚠️ 原型教練名／餘位係寫死樣本，App 用 API 數據 |
| Anthony | ☐ 照 App　☐ 要加返「Add to calendar」　☐ 要改：＿＿＿＿＿＿＿＿ |

### 3. Passport

| | 內容 |
|---|---|
| 原型 | 「THE PASSPORT.」；三格數字（完成訪問／即將／目標）；Overview／Bookings／History；目標卡＋進度條＋「Edit goal」；LOAD／ADAPT／BALANCE 計數；3 個 milestone（1／5／10）；Bookings 可取消、候補可離開；History 列表 |
| App | 同樣三個分頁、目標卡、pillar 計數、3 個 milestone、取消預約、歷史 |
| 差異 | ⚠️ 數字改為「**本月到訪**」（原型係總完成數）；後端冇資料時顯示「—」，**唔會顯示 0**（決定 B6）。⚠️ 預設目標 12（原型 16），可設 4–40（原型 1–100）。⚠️ 目標存後端（待 N6），暫時未通。⚠️ 資料要下拉更新先會刷新 |
| Anthony | ☐ 照 App　☐ 要改：＿＿＿＿＿＿＿＿ |

### 4. Profile

| | 內容 |
|---|---|
| 原型 | 「YOUR PROFILE.」；紅色會員卡（LAB 000128、TRAIN + RECOVER、VIEW PASS）；Your plan＋「View membership」；列表：My bookings／Personal details／Membership & packages／Preferences／Your club／Help & first visit；Sign out；樓層相＋地址＋營業時間 |
| App | 會員卡（真姓名、會員編號、方案、有效期／狀態）；列表：My bookings／Personal details（**唯讀**，要改請搵 club）／Notifications（課堂提醒 關／30 分／1 小時／2 小時）／Your club／Help & first visit／Sign out／**Delete account**；相＋地址＋營業時間 |
| 差異 | 🚫 **Membership & packages**（價目表）同「View membership」冇。⚠️ Preferences 改名 Notifications，內容變成課堂提醒。⚠️ Personal details 唔可以改（PGM 係正本）。⚠️ 新增 Delete account。⚠️ **Privacy policy／Terms 兩行暫時冇**（等網址，見第三節） |
| Anthony | ☐ 照 App　☐ 要改：＿＿＿＿＿＿＿＿ |

### 5. 會員證（中間掣）

| | 內容 |
|---|---|
| 原型 | 底部中間紅色圓掣 → 彈出「YOU BELONG HERE.」＋**示範 QR**（標明 DEMO PASS · NOT VALID FOR ENTRY）＋姓名、方案 |
| App | 同位置、同標題；v1 顯示 **大字會員編號**（前台出示），姓名、方案；**QR 只喺 `member_qr` 功能開咗先出**（簽名、自動更新） |
| 差異 | ⚠️ v1 **冇 QR**，改成會員編號（QR 入閘仲未開）。⚠️ 無「DEMO」字眼（App 係真嘢） |
| Anthony | ☐ 照 App（v1 用編號）　☐ 一定要 QR　☐ 要改：＿＿＿＿＿＿＿＿ |

### 6. 登入

| | 內容 |
|---|---|
| 原型 | 冇真登入：「WELCOME TO YOUR LAB.」彈窗，輸入顯示名稱就入到（示範） |
| App | **全屏登入畫面**：LAB 紅黑漸變背景＋LAB logo、「WELCOME TO THE LAB.」＋說明、Email＋密碼、Forgot password、登入掣；LAB 冇「Join」（signup 關閉） |
| 差異 | ⚠️ **原型冇呢個畫面**，係 App session 沿用 GO24 登入版型換 LAB 顏色／字體，**從未有人批過**。⚠️ 底板用 LAB 深灰卡色（唔係白）；背景有幾個 GO24 時代嘅圓形／斜線裝飾。⚠️「Forgot password」睇落未接動作（需 App session 確認） |
| Anthony | ☐ 照 App　☐ 要改：＿＿＿＿＿＿＿＿ |

### 7. 刪除帳戶

| | 內容 |
|---|---|
| 原型 | **冇** |
| App | Profile 底部紅色「Delete account」→ 全頁：說明（會員帳戶**同 THE LAB／The Foundry／GO24 三個 App 共用**，一刪全刪）、會被移除嘅資料清單、「會籍唔會被取消，要退會請搵 club」、要打 `DELETE` 確認、「Delete my account」／「Keep my account」 |
| 差異 | ⚠️ 全新畫面（App Store／Play 上架必須有）。⚠️ 後端 `POST /v1/me/account/deletion`（N4）未做，暫時只喺 mock 通。⚠️ 文案係 App session 寫，**未經你或法律睇過** |
| Anthony | ☐ 照 App　☐ 文案要改：＿＿＿＿＿＿＿＿ |

---

## 二、v1 範圍外、App 已隱藏（原型有，App 冇）

| 項目 | 原型 | App | 備註 |
|---|---|---|---|
| Balance／Top-Up | （原型冇，GO24 classic 版先有） | 🚫 隱藏 | v1 無電子錢包 |
| 付費預約／價錢 | 課堂 HK$350、Recovery drop-in HK$300、Review 頁「DUE TODAY」 | 🚫 隱藏 | App 內冇付款；會籍已包 |
| Membership & packages 價目表 | 有（HK$2,800 等，抄自官網） | 🚫 隱藏 | 價錢變動風險；仍可考慮連去官網 |
| Recovery 預約 | 有（4 款，有時段） | 🚫 關閉 | `recovery_native`／`recovery_portal` 未開 |
| Coaching 諮詢 | 有（表單） | 🚫 關閉 | `coaching_enquiry` 未開 |
| 自助註冊（signup） | 冇（原型冇真登入） | 🚫 關閉 | 會員由 club 開戶 |
| Add to calendar | 有（.ics） | 🚫 未做 | 可補 |
| Social／Referral／Favourites | 冇 | 🚫 關閉 | |
| 修改個人資料／電話 | 可改（示範） | 🚫 唯讀 | PGM 為正本 |
| 推送通知 | 本地假 feed | 需 EAS 帳號先開 | 等 G1 |

> ☐ 以上隱藏項目 v1 都同意唔做　☐ 要加返：＿＿＿＿＿＿＿＿

---

## 三、仍然開放嘅 UI 問題

| # | 問題 | 現況 | 需要邊個決定 | Anthony 回覆 |
|---|---|---|---|---|
| 1 | **First-visit 提示文案** | App 暫用 2 句：「Arrive a little early and check in with the club team.」「Bring a water bottle.」；原型嗰 4 張卡（15 分鐘、鞋、教練、聯絡方式）未採用 | Club team 寫真正指引 | ＿＿＿＿ |
| 2 | **相片版權**（官網相：floor、recovery、hero、forge、pulse 等 13 張） | 已打包入 App | 要確認 THE LAB／ONYX 授權先可上架（G4） | ＿＿＿＿ |
| 3 | **Privacy policy／Terms 連結** | Profile 兩行暫時拎走；刪除帳戶頁都冇連結 | 要網址（G4）；上架必須 | ＿＿＿＿ |
| 4 | **顏色** | 紅 `#810917`、背景 `#131313`、面板 `#1D1D1D`、文字 `#FFFFF0`；紅色字太暗，文字用淺粉紅 `#DA8792` | 確認 OK？ | ☐ OK　☐ 改：＿＿＿ |
| 5 | **字體** | 標題 Bebas Neue、內文 Montserrat（500／600／700）。Montserrat 400／900 併入 500／700 | 字體本身可商用（開源）；確認風格 OK | ☐ OK　☐ 改：＿＿＿ |
| 6 | **App icon／啟動畫面** | 暫用 `mark.png` 放大，bundle id `com.onyx.thelab` 係暫定 | 要正式設計稿＋確認 bundle id（G4） | ＿＿＿＿ |
| 7 | **登入畫面設計** | 見第一節 #6，原型冇 | 要睇過 | ＿＿＿＿ |
| 8 | **會員證 v1 用編號、唔用 QR** | 見第一節 #5 | 接受？幾時開 QR？ | ＿＿＿＿ |
| 9 | **刪除帳戶文案** | 見第一節 #7 | 睇過／法律確認 | ＿＿＿＿ |
| 10 | **官網聯絡方式** | 原型 Help 有 `thelab@go24.fitness`、WhatsApp +852 6778 5099；App 冇放 | 要唔要放返？ | ＿＿＿＿ |
| 11 | **原型 footnote／DEMO 字眼** | 原型每頁有「APP PREVIEW · Sample schedules…」；App 已移除 | — | — |

---

## 四、最後簽核

- ☐ LAB v1 Red 定稿，App 現有畫面（連上面勾咗嘅修改）照做
- ☐ 暫時唔定稿，原因：＿＿＿＿＿＿＿＿＿＿
- 簽：＿＿＿＿＿＿　日期：＿＿＿＿＿＿

你簽咗之後，請 OFFICE 把 PENDING 板 M5（G2）更新，並喺 `STATE.md` 寫低「LAB v1 Red 已由 Anthony 於 ＿＿ 定稿」。

---

*資料來源：原型 `apps/lab-prototype-web/site/{index.html,app.js,app.css}` 同 README／QA；App 讀自 `claude/lab-app-foundation-72a87d`（`brands/lab/`、`src/screens/member/`、`src/features/member/`、`app/(tabs)/_layout.tsx`、`app/(auth)/login.tsx`、`app/account/delete.tsx`）及其 STATE.md CLOSE。只讀代碼，冇實際跑過兩邊畫面；表內差異來自睇代碼，簽核前請用上面「點睇」親眼對一次。*
