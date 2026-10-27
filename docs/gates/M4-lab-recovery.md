# M4 · THE LAB Recovery — PGM 設定清單同降級方案

> 舊編號 G3（Recovery 部分）。2026-10-26 寫。
> 來源：`docs/function-review.md` §4、§12；`docs/backend-plan.md` N2；`docs/member-apps-launch-plan.md`；`docs/pgm-swagger.json`；LAB prototype `apps/lab-prototype-web/site/app.js`；同日 PGM **只讀** GET（只讀設定表，冇讀會員資料，冇寫入）。
> 呢份係畀營運／Anthony 用嘅工作清單。**所有 PGM 改動由營運喺後台做，Claude 唔會寫 PGM。**

---

## 0. 一句講晒

- LAB（PGM club `45`）喺 PGM **只有一個 zone（`71`，成間 club）**，冇 recovery zone、definition、rule、價錢。App 而家冇嘢可以約。
- 但 PGM **已經有 7 個 LAB「Recovery」會籍 plan**（見 §2.4），即係生意上已經賣緊「包 Recovery」嘅會籍，只係未開預約。
- 要原生預約：營運按 §5 開 **LAB 專用** zone type → zone → 開放時間 → definition → rule，然後將 ID 交 backend（§6）。
- **第 6 星期**未做好 → 用 §7 降級方案。注意：**PGM 冇設定嘅話，Client Portal 降級都冇用**（Portal 都係約 PGM 設定咗嘅嘢），只可以用前台聯絡。

---

## 1. LAB App 顯示緊咩 Recovery

Prototype（`app.js` `renderRecovery`、`recoverySheet`、`infoSheet`）：

| App 顯示 | 描述 | Prototype 時長 |
|---|---|---|
| Recovery circuit | Plunge、sauna 同 compression | 45 分鐘 |
| Cold plunge | 冷水浸 | 15 分鐘 |
| Traditional sauna | 傳統桑拿 | 30 分鐘 |
| Compression | 壓力治療 | 30 分鐘 |

其他資料（prototype 引用官網，2026-10-25）：

- 分店設施：「Training floor · Cold plunges · Traditional saunas · Compression · Member lounge」（plunge、sauna 係**複數**）。
- 營業時間：星期一至五 06:30–21:30；週末同公眾假期 08:00–18:00。
- 會籍：**TRAIN + RECOVER**（HK$2,800／月，12 個月）包「THE LAB recovery access」；**TRAIN ONLY** 唔包。
- Drop-in：Recovery HK$250（會員）／HK$300（非會員）；Class + Recovery HK$500。
- 聯絡：thelab@go24.fitness、WhatsApp +852 6778 5099。

Prototype 寫明「Session lengths and availability are illustrative」。上面時長全部要營運確認（§3）。

---

## 2. PGM 現有例子（2026-10-26 只讀查）

### 2.1 Zone type 同 zone

| Zone type | ID | `hasSlots` | 用喺 |
|---|---|---|---|
| RECOVERY | 13 | false | Kennedy Town（club 6）zone `72`「KT Cold Plunge Recovery」 |
| PRIVATE RECOVERY | 14 | false | Novotel（club 41）zone `70`「PRIVATE RECOVERY」 |
| PHYSIO ROOM | 10 | false | North Point zone `51`、Wan Chai zone `63` |
| PICKELBALL | 15 | **true** | BOFA `74`、Novotel `75`（各 8 位） |
| GOLFSIM | 16 | **true** | BOFA `73`（2 位） |

兩個 recovery 例子都係「整間房、唔分位」（`hasSlots=false`）。

### 2.2 Definition（每次幾耐、幾時可以開始）

| ID | 名 | Zone type | 時長 | 開始間隔 | 整個 zone |
|---|---|---|---|---|---|
| 3 | Private Recovery Non Peak Hour | 14 | 45 分鐘 | 15 分鐘 | 係 |
| 4 | Private Recovery Peak Hours | 14 | 45 分鐘 | 15 分鐘 | 係 |
| 5 | KT Cold Plunge Recovery Weekdays | 13 | 45 分鐘 | 60 分鐘 | 係 |
| 8 | KT Cold Plunge Recovery Weekend | 13 | 25 分鐘 | 30 分鐘 | 係 |

全部冇 setup／cooldown 時間，冇「可以連續約幾節」（multiplicity 留空 = 1 節）。

### 2.3 Rule（邊個可以約、收唔收錢、幾時約）

| Rule | Definition | 要咩合約 | 收費 | 最少提早 | 可提早幾耐約 | 時段 | 上限 |
|---|---|---|---|---|---|---|---|
| 3 | 3（Novotel 非繁忙） | AnyContract | Product `230`「Private Recovery One Session」HK$800 | 10 分鐘 | 冇限 | 每日 10:00–18:00 | 冇限 |
| 4 | 4（Novotel 繁忙） | SpecificContract（plan `705`） | Product `230` HK$800 | 冇 | 冇限 | 每日 18:00–20:00 | 冇限 |
| 5 | 5（KT 平日） | AnyContract | 免費 | 10 分鐘 | 冇限 | 一至五 11:00–20:00 | 冇限 |
| 8 | 8（KT 週末） | NotRequiredContract | 免費 | 10 分鐘 | 冇限 | 六日 12:00–18:00 | 冇限 |

- 全部 `refundPolicy=FullRefund`、`maxTimeToCancelForReturn` 留空。
- 取消原因全 tenant 只有一個：`1`「Cancel」。
- **開放時間分兩層**：zone 本身嘅開放時間（`ClubZoneAvailabilities`，每日一條紀錄，例如 KT 平日 10:30–21:30、週末 11:00–19:00），再加 rule 嘅 hourly availability 收窄（KT 平日 11:00–20:00）。兩層都要設。
- 繁忙／非繁忙用**兩個 definition + 兩條 rule + 兩個 hourly availability** 做（Novotel）；平日／週末唔同時長都係咁做（KT）。

### 2.4 會籍點連去 Recovery

- `MembershipRule` 管「邊類會籍入到邊類 zone」。**「The Lab」（rule `27`，會籍類型 `25` The LAB Home）已經包咗 zone type 13、14**；「The LAB All Locations」（rule `28`，會籍類型 `26` The LAB）**冇包**。
- LAB 有 **7 個名有「Recovery」嘅 payment plan**：

| Plan ID | 名 | 會籍類型 |
|---|---|---|
| 749 | ONYX The LAB 6 Months Monthly Autopay 2026 Recovery | 26 |
| 750 | ONYX The LAB Annual Monthly Autopay 2026 Recovery | 26 |
| 752 | ONYX The LAB 4 Weeks Pass Recovery | 26 |
| 754 | ONYX The LAB Weeks Pass Recovery | 25 |
| 756 | ONYX The LAB Drop In Class Recovery | 25 |
| 757 | ONYX The LAB Drop In Recovery - ADDON | 25 |
| 758 | ONYX The LAB Drop In Recovery | 25 |

- 冇 Recovery 嘅 plan（例如 `745` Annual 2026、`746` 6 Months 2026、`753` 4 Weeks Pass、`755` Drop In Class、`729`／`731` 堂數套票）**同 Recovery plan 共用同一個會籍類型（25、26）**。所以**唔可以靠 MembershipRule 分「包唔包 Recovery」**，要靠 rule 嘅 `requiredContract=SpecificContract` + `requiredPaymentPlans` 列明邊幾個 plan（Novotel rule 4 就係咁做）。

### 2.5 由例子學到、LAB 一定要避開嘅位

1. **Zone type、definition、rule 全部係成個 tenant 共用**，API 睇唔到 rule 屬邊間分店。PGM 搵可約時段係用「分店 + zone type」去配 rule。**如果 LAB 嘅 zone 用返現有 type 13「RECOVERY」，KT 嘅 rule 5、8（任何合約、免費、KT 時間）好可能直接套落 LAB**——即係任何分店嘅會員都可以免費約 LAB。**LAB 一定要開自己嘅 zone type。**
2. 要分「Recovery 會籍先約到」，**用 SpecificContract + plan 清單**（§2.4），唔好用 AnyContract。
3. Zone 開放時間係逐日紀錄，要用「每星期重複」加一段長日期範圍，唔係開一次就永遠有效；假期要另外刪。

---

## 3. 營運要先答嘅問題（未答唔好開設定）

| # | 問題 | 點解要知 | Prototype／官網而家寫 |
|---|---|---|---|
| Q1 | LAB 實際有邊幾樣 recovery 可以約？Recovery circuit 係**獨立一樣嘢**（例如成個 recovery 區一節），定只係「plunge + sauna + compression」嘅統稱？ | 決定開幾多個 zone type；circuit 同單項共用同一批設備會撞（見 §4） | 4 樣：circuit、plunge、sauna、compression |
| Q2 | 每樣有幾多個／幾大？幾多個 plunge 池、幾多間 sauna、每間坐幾多人、幾多套 compression？ | 決定「一個房一個 zone」定「一個 zone 幾個位」 | 「Cold plunges」「saunas」係複數，數量未知 |
| Q3 | 一個人包晒（私人）定同其他會員共用？要唔要知會員用**邊一個**池／房？ | PGM 預約**唔記錄邊個位**（§4.2 已查證）；要知邊個 → 每個一個 zone | 未知 |
| Q4 | 每節幾耐？每幾多分鐘可以開始？節與節之間要唔要清潔時間？平日週末唔同？ | definition 嘅 duration、interval、cooldown | 45／15／30／30 分鐘（示意） |
| Q5 | Recovery 幾點到幾點可以約？有冇繁忙／非繁忙？ | zone 開放時間 + rule 時段 | 分店 06:30–21:30（平日）、08:00–18:00（週末） |
| Q6 | **邊啲會籍免費包 Recovery？** 係咪就係 §2.4 嗰 7 個 plan？Employee 會籍包唔包？GO24／ONYX 會員（B3）約唔約到？ | rule 嘅 `requiredPaymentPlans`；backend 只准免費 rule | TRAIN + RECOVER 包；TRAIN ONLY 唔包 |
| Q7 | 冇 Recovery 會籍嘅人：要唔要喺 PGM 開收費 drop-in（HK$250／300）？ | 收費 rule **App v1 唔開放**（B5），只會叫佢去前台；但前台／Portal 可能要用 | Drop-in HK$250／300 |
| Q8 | 每人每日／每星期最多約幾多次？可唔可以同時約兩樣？ | `FacilityBookingRuleLimit` | 未知（KT、Novotel 全部冇限） |
| Q9 | 最早幾耐前可以約（例如 7 日）？最遲幾耐前要約？最遲幾耐前可以取消？No-show 點罰？ | rule 嘅 notice、advance；取消截止 | 未知（例子：提早 10 分鐘截止，冇其他限） |
| Q10 | 有冇年齡限制（`ONYX The LAB KID - 10 SESSIONS` plan 存在）？要唔要先簽健康聲明？ | rule 嘅 `ageLimit`；app 要唔要加確認 | 「Suitability guidance is provided by the club team」 |
| Q11 | 呢啲預約要唔要喺 PGM 自己嘅會員 app／Client Portal 都見到同約到？ | 渠道可見性（G7b ③），亦影響 Portal 降級 | 未知 |

---

## 4. 點樣揀 zone 做法（每樣服務）

| 情況 | 做法 | PGM 設定 |
|---|---|---|
| 一個人／一組人包晒成間房或者一件設備，而且要知係邊個（例如 Sauna 1、Sauna 2 私人房） | **方法 A：每個房／設備一個 zone**（同 §4.2 Pickleball 拆場一樣） | Zone type `hasSlots=false`；每個一個 zone；definition `isEntireZoneBooking=true` |
| 幾個人共用同一個空間，或者設備完全一樣、唔使知邊個（例如 6 人 sauna、4 套 compression） | **一個 zone 幾個位** | Zone type `hasSlots=true`；一個 zone，`zoneCapacity`=人數／套數；definition `isEntireZoneBooking=false`、`maxNumberOfSlotsPerBooking=1` |

**Recovery circuit 要小心：** PGM 一個預約只可以約一個 zone。如果 circuit 同單項用同一批 plunge／sauna／compression，PGM **唔會**知佢哋撞，會出現「有人約咗 circuit，同一時間另一個人約咗同一個 plunge」。兩個揀一個：

- **(a) 只開 circuit**：成個 recovery 區做一個 zone（`hasSlots=true`，`zoneCapacity` = 同一時間最多幾多人），一節 45 分鐘，入面點用由會員自己／職員安排。最簡單，建議 v1 用。
- **(b) 只開單項**：plunge、sauna、compression 各自一個 zone type；app 唔顯示 circuit（或者 circuit 只係介紹文字）。

唔好兩樣同時開，除非 circuit 有自己獨立嘅設備。

---

## 5. PGM 後台設定步驟（營運做）

每樣服務做一次。以下用「Cold plunge，2 個池，私人，15 分鐘」做示範；實際數字用 §3 嘅答案。

**第 0 步 — 答晒 §3，揀好 §4 做法。** 每樣服務填一行：

| 服務 | Zone type 名 | hasSlots | Zone（名 × 數量／位數） | 時長 | 間隔 | 清潔 | 開放時間 | 包嘅 plan | 每人上限 |
|---|---|---|---|---|---|---|---|---|---|
| （例）Cold plunge | LAB COLD PLUNGE | false | LAB Cold Plunge 1、2 | 15 分鐘 | 15 分鐘 | 0 | 一至五 07:00–21:00；六日 08:00–17:30 | 749、750、752、754、756、757、758 | 每日 1 |
| Traditional sauna | LAB SAUNA | ？ | ？ | ？ | ？ | ？ | ？ | ？ | ？ |
| Compression | LAB COMPRESSION | 建議 true | LAB Compression（位數＝套數） | ？ | ？ | ？ | ？ | ？ | ？ |
| Recovery circuit | LAB RECOVERY CIRCUIT | 建議 true | LAB Recovery Circuit（位數＝同時最多人數） | ？ | ？ | ？ | ？ | ？ | ？ |

**第 1 步 — 開 zone type（全 tenant 共用，所以名要有「LAB」）**
- 名：`LAB COLD PLUNGE`（每樣服務一個；**唔好用現有 `RECOVERY`(13)／`PRIVATE RECOVERY`(14)**，原因見 §2.5 第 1 點）。
- `hasSlots`：按 §4。

**第 2 步 — 喺 club 45 開 zone**
- 分店：The LAB by ONYX（45）；上層 zone：`The LAB by ONYX`（71）。
- 方法 A：每個池一個 zone，`LAB Cold Plunge 1`、`LAB Cold Plunge 2`。
- 有位做法：一個 zone，`zoneCapacity` = 位數。

**第 3 步 — 設 zone 開放時間（Zone availability）**
- 揀晒第 2 步嘅 zone，「每星期重複」，揀星期幾同時間，日期範圍拉長（例如到 2027-12-31）。平日、週末時間唔同就分兩次加。
- 公眾假期／維修日：之後逐日刪或者改。
- 唔加呢步，PGM 一個時段都唔會出。

**第 4 步 — 開預約上限（Booking rule limit）**
- 例：名 `LAB Cold Plunge`，類型 `LimitPerDay`，次數 1。冇限就用 `Unlimited`（唔建議）。

**第 5 步（可選）— 開 hourly availability**
- 只係 rule 時段要窄過 zone 開放時間，或者要分繁忙／非繁忙先要。例：`LAB Plunge Weekdays` 一至五 07:00–21:00。

**第 6 步 — 開 booking definition**
- Zone type：`LAB COLD PLUNGE`。
- 時長 `duration`：15 分鐘；開始間隔 `bookingIntervalInMinutes`：15。
- 清潔時間：`cooldownInMinutes`（要就填，例如 5）。
- 整個 zone：方法 A 揀「係」；有位做法揀「否」，每次最多 1 個位。
- 最少／最多節數：1／1（唔准連約）。
- 平日週末唔同時長 → 開兩個 definition（同 KT 一樣）。

**第 7 步 — 開 booking rule（最重要）**

| 欄 | 免費包會籍（App 用呢條） | 說明 |
|---|---|---|
| Definition | 第 6 步嗰個 | |
| 要咩合約 `requiredContract` | **SpecificContract** | 唔好用 AnyContract（任何分店任何會籍都約到） |
| 指定 plan `requiredPaymentPlans` | Q6 答案，例如 749、750、752、754、756、757、758 | 新出 Recovery plan 要記得加返入嚟 |
| 收費 `additionalCharge` | **NoCharge** | Product 留空；價錢表（pricing schedule）留空 |
| 欠款可約 `isDebtAllowed` | 否 | |
| 最少提早 `minimumNoticePeriodInMinutes` | 例：10 | Q9 |
| 最多提早 `maxTimeToBookInAdvance` | 例：10080（7 日） | Q9；留空 = 冇限 |
| 取消退款期 `maxTimeToCancelForReturn` | 留空或者 Q9 答案 | 免費預約冇錢退；取消截止 backend 可以另外執（§6） |
| 退款 `refundPolicy` | FullRefund | 同例子一樣 |
| 上限 `bookingRuleLimit` | 第 4 步 | |
| 時段 `hourlyAvailability` | 第 5 步（如有） | |
| 年齡限制 `ageLimit` | Q10 | |

收費 drop-in（Q7 要先開）：另開一條 rule，`additionalCharge=Product`、product 用 Recovery drop-in 產品。**呢條 backend 唔會放入白名單**，App v1 唔會用（B5），只係前台／Portal 用。

**第 8 步 — 會籍可以入呢類 zone（Membership rule）**
- 將新 zone type 加入 `The Lab`（27）同 `The LAB All Locations`（28）——因為 Recovery plan 兩個會籍類型都有（§2.4）。
- 唔好加入 GO24／ONYX 分店嘅 membership rule（除非 Q6 話佢哋都可以約）。
- 真正「邊個約到」由第 7 步 plan 清單管；呢步係確保 PGM 唔會因為「冇權入呢個 zone」拒絕。

**第 9 步 — 渠道**
- 喺後台睇 definition／rule 有冇「喺會員 app／Client Portal 顯示」之類設定，按 Q11 開。API 睇唔到呢個設定，請營運截圖畀 backend（G7b ③ 證據）。

**第 10 步 — 自己試**
- 營運喺後台用 **G6 測試會員**（唔好用真會員）試約一次再取消，確認時段、價錢 HK$0、上限、冇 Recovery plan 嘅測試會員約唔到。
- 真 PGM 寫入，要 Anthony 批（G9）。

**唔好掂：** KT（zone 72）、Novotel（zone 70）現有設定；`RECOVERY`／`PRIVATE RECOVERY` zone type；任何現有 rule。

---

## 6. 做完要交畀 backend 嘅資料

Backend 會將以下寫入 `facility_whitelist`（`docs/backend-plan.md` N2）。**冇喺白名單嘅 zone 一律唔准約，亦唔會傳任何 staff override（例如 `bookDespiteOverlappingEvents`）。**

每樣服務一行：

| 欄 | 例 | 用嚟做咩 |
|---|---|---|
| 品牌 | `lab` | 品牌白名單 |
| Club ID | 45 | `GetFacilityBookingOptions` 要 |
| Zone type ID | （第 1 步開出嚟） | 查可約時段要用 |
| Zone ID（全部） | （第 2 步） | 每次約之前核對屬 club 45 |
| Definition ID | （第 6 步） | 核對時長 |
| Rule ID（免費嗰條） | （第 7 步） | 只准用呢條 rule 提交 |
| 整個 zone／按位 | 整個 zone，或者按位 `numberOfSlots=1` | 對應 `ruleIdsForEntireZone`／`ruleIdsForSlot` |
| App 顯示名、介紹、相 | Cold plunge | 對返 LAB app 4 樣服務 |
| 免費證據 | `additionalCharge=NoCharge`、`productId` 空、pricing schedule 空、SpecificContract + plan 清單 | 「證實免費」；backend 用 GET 自動再核對 |
| 確認日期、確認人 | 2026-11-xx，營運姓名 | 白名單紀錄 |
| 取消截止（如果 Q9 有） | 例：開始前 120 分鐘 | PGM API 冇獨立取消截止欄，backend 自己執 |

另外要：

- Recovery plan ID 清單（Q6）同埋 limit／hourly availability ID。
- 後台渠道設定截圖（第 9 步）。

Backend 收到之後會做（唔使營運理）：

1. GET 核對所有 ID 都屬 club 45，rule 免費，**同時確認 LAB 時段唔會出現 KT／Novotel 嘅 rule（3、4、5、8）**。
2. 用 G6 測試會員 call `GetFacilityBookingOptions`（club 45 + 新 zone type），睇返出嚟嘅 zone、rule 啱唔啱；冇 Recovery plan 嘅測試會員應該冇時段。
3. G9（Anthony 批）：測試會員約一次、取消一次，撞時間被拒。過咗就係 G7b ③ 證據，app-config 開 `recovery_native`。

---

## 7. 第 6 星期未搞掂：降級方案

**先睇清楚：兩個降級方案嘅前提唔同。**

| 第 6 星期狀態 | 用咩 | App 開關 |
|---|---|---|
| PGM 已設定 + G7b ③ 過 | 原生預約 | `recovery_native` |
| PGM 已設定，但 G7b ③ 未過（PGM 未准 API 代會員約、或者渠道／免費未證實） | **A. Client Portal** | `recovery_portal` |
| **PGM 未設定** | **B. 前台聯絡**（Portal 都冇嘢約） | 兩個都關，Recovery 頁顯示資料 + 聯絡 |

### A. PGM Client Portal 轉介

做法：App 撳「Book recovery」→ backend `POST /v1/facilities/portal-link` → PGM `ClientPortal/GenerateLogInUrl`（`memberId` 由 JWT 攞，`afterLoginState=Facility`）→ 用外部瀏覽器開條 URL，會員直接喺 PGM Portal 約。

| 好處 | 壞處 |
|---|---|
| PGM 自己約、自己執規則同收費；收費 drop-in 都可以喺度約（如果 Portal 有開付款） | 離開 app，Portal 唔係 LAB 紅黑設計 |
| Backend 工夫細（約 1 日：一個 endpoint + 測試） | **要先證實**：條 URL 係咪一次性、幾耐過期、喺手機瀏覽器開唔開到、約完點返 app（G9 用測試會員試） |
| 約完嘅預約喺 PGM 入面，app 仍然可以讀返（`FacilityBookings`）顯示喺 Passport | 條 URL 等於登入憑證：唔可以 log、唔可以 cache、唔可以經 push 傳 |
| | 仍然要 PGM 設定（§5）同 Portal 渠道開咗（Q11）；所以 PGM 未設定時用唔到 |
| | Apple 審核：外部網頁約免費服務一般冇問題；但如果 Portal 收錢買 drop-in，要睇 App Store 對「外部付款」嘅講法（實體服務通常可以，但要喺送審備註講清楚） |

### B. 前台聯絡

做法：Recovery 頁照樣介紹 4 樣服務、時間、邊啲會籍包；「Book recovery」改做 WhatsApp（+852 6778 5099）／電郵（thelab@go24.fitness）／電話，或者 Coaching 嗰種「查詢表」（N3 同一套）送去前台。聯絡資料要 LAB 確認。

| 好處 | 壞處 |
|---|---|
| 零 PGM 依賴，零寫入風險，送審最安全 | 前台要人手處理，繁忙時慢 |
| Backend 幾乎唔使做（app-config 文字 + 可選查詢表約 0.5 日） | 會員唔即時知有冇位，體驗差過其他 app 功能 |
| 唔會拖住成個 app 上架 | 前台冇喺 PGM 開預約嘅話，Passport 唔會見到 recovery 紀錄 |
| | 用 WhatsApp 就要 LAB 有人睇住嗰個號碼 |

### 建議

- **第 2–3 星期**：營運答 §3（最少 Q1–Q6）。答唔到 → 直接計劃 B，唔好等到第 6 星期。
- **第 3–5 星期**：營運按 §5 開設定 → 交 §6 資料 → backend 只讀核對 → G9 測試。
- **第 6 星期**：按上面表揀。B 隨時可以做，所以 app 先做 B 嘅畫面當底，原生／Portal 係加上去。

---

## 8. 順手見到、要營運睇吓（唔屬今次範圍，冇改）

1. **Novotel 繁忙時段 rule 4** 嘅指定 plan 係 `705`「Pickle Ball Access Pass Monthly」——睇落似揀錯 plan；即係繁忙時段可能只有 Pickleball 月票會員約到 Private Recovery。
2. **Novotel rule 3** 有一個 HK$800 價錢表，但收費方式係「Product」（product `230` HK$800），價錢表唔會用到；兩個地方各寫一次容易改漏。
3. **KT rule 5、8** 用 AnyContract／NotRequiredContract，即係任何分店會員（rule 8 甚至冇合約）都可以免費約 KT cold plunge。如果唔係刻意，要收窄。
4. MembershipRule「The Lab」（27）已經包 `RECOVERY`／`PRIVATE RECOVERY` zone type——如果 LAB 開新 zone type，呢兩個可以考慮拎走，免得之後有人誤用。

---

## 9. 等緊邊個

| 事項 | 邊個 | 阻住乜 |
|---|---|---|
| 答 §3 Q1–Q11 | LAB 營運／Anthony | 所有設定 |
| §5 PGM 後台設定 | 營運（PGM 生產資料，經理枱批） | 原生預約、Portal 降級 |
| §6 ID 同截圖交 backend | 營運 → backend | 白名單 |
| G6 測試會員、G9 寫入測試 | Anthony／前台 | G7b ③ |
| 第 6 星期揀方案 | Anthony | LAB 送審範圍 |
