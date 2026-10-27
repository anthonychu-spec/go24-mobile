# Gate M8（前 B6）· THE LAB 入場紀錄嚟源

日期：2026-10-26 · 只讀調查（冇改任何系統、冇讀會員資料）

## 一句講晒

LAB 喺 PGM 冇入場紀錄，**唔係因為 LAB 用第二套門禁**，而係 **LAB 未開（2026-11-01 開）**，加上將 BioStar 入場寫入 PGM 嘅 n8n workflow **未加 LAB 兩部閘機**。
`gym_data` 只係 PGM 報表嘅副本，LAB 一樣會係空。

**建議：** Passport 繼續讀 PGM `MemberClubVisits`，即係而家 backend 嘅做法，code 唔使改。條件係 11-01 前喺 n8n「BioStar Access」加 `LABIN` 同 `LABOUT` 兩條規則。

---

## 1. 證據

### 1.1 LAB 用同一套 BioStar 門禁，閘機今日先裝好

- `Biostar/face_export/lab_setup.py:19-24`：LAB 有 3 部讀卡機。
  - `538204993` = `LABIN 45`（LAB Turnstile In）
  - `538200488` = `LABOUT 45`（LAB Turnstile Out）
  - `538200482` = `LAB-Recovery 45`（Sauna；名有 recovery，bridge 唔會自動開）
- `Biostar/lab_setup_state.json`：已經開咗 door 59/60/61、door group 23，同 access group 23–27（The LAB Access／Recovery／Home／Home Recovery／Staff）。
- `Biostar/face_export/lab_push.py:1`：「Anthony 2026-10-26: sync ALL BioStar users to the three NEW The LAB readers (club 45, opens 2026-11-01)」。
- `Biostar/lab_push_run_20261026.log` 最尾：28,088 個用戶入面，28,063 個已經確認喺 3 部機都有，25 個未齊。
- 所以 LAB 唔係用另一套系統（冇另一套 Suprema 或者 PGM 門禁設定），同其他分店一樣用 BioStar X。

### 1.2 PGM 嘅入場紀錄係 n8n「BioStar Access」寫入嘅

n8n workflow `EbopPUhK556hH0GN`「BioStar Access」：active，live version `e812b8be`，updatedAt 2026-10-20（我用 MCP 只讀咗）。佢嘅流程：

1. `Schedule Trigger`：07:00–22:00 每分鐘行一次，其餘時間每 5 分鐘。
2. `HTTP Request2`：去 BioStar `/api/events/search` 攞 event `4867`（成功入場）。
3. `Code1`：用讀卡機名最後兩個字做 PGM clubId（`"LABIN 45"` → `45`）。`Biostar/STATE.md:23` 都有寫呢個規則。
4. `Switch`：用讀卡機名子字串分路。
   - IN 機 → `PGM user ID1` → `Visit1` = `POST /Api/v2.1/AccessControl/RegisterMemberVisit`
   - OUT 機 → `PGM user ID` → `Visit` = `EndCurrentMemberVisit`，跟住再做 Validate、合約、付款同 BioStar group 檢查。

live 版 `Switch` 有 34 條規則：
`TKIN TKOUT OC-MallIn QRC-IN OC-MallOut QRC-OUT WC-In WC-Out TW-IN TW-OUT ADM IN ADM OUT MKIN MKOUT LHTIN LHTOUT KTMAIN WTSIN WTSOUT LCKIN LCKOUT NOVIN NOVOUT SKWIN SKWOUT NOVMAIN FHIN YLIN YLOUT FHOUT NPIN KKGIN KKGOUT NPOUT`

- **冇 `LABIN`／`LABOUT`**。`Switch` 冇 fallback，所以 LAB 嘅入場 event 會直接跌咗，唔會寫入 PGM。
- 成個 live workflow 搵唔到 LAB 3 部機嘅 device id（0 次）。對比 KKG 嘅 `538204998` 出現 12 次。
- 對照：10-14 嘅備份 `Biostar/n8n-backups/BioStar_Access_EbopPUhK556hH0GN_v08f8e02c_20261014.json` 得 32 條，冇 KKG。即係 Kwun Tong（43）開店前喺 10-20 加咗 `KKGIN`／`KKGOUT`。**LAB 要照做一次。**

### 1.3 PGM 只讀探（今日，只用 GET，冇讀會員欄位）

`/odata/MemberClubVisits` 唔支援 `$count`，所以我改用「有冇紀錄、最多 500 行」嚟查：

| club | 2026-09-26 至今 | 備註 |
|---|---|---|
| 45 The LAB | **0** | 由 2020-01-01 起計都係 **0** |
| 44 BOFA | 0 | PGM 標咗 hidden |
| 43 Kwun Tong | ≥500（10-19 至今） | 10-20 加咗 n8n 規則之後就有 |
| 1 WTS、37 WC、41 Novotel、42 FH | 每間 ≥500（10-19 至今） | |

- 抽查嘅紀錄 `readerName` 全部係 null，即係 n8n 寫入時冇填。用唔到嚟分辨入場來源。
- `/odata/Clubs`：45 =「The LAB by ONYX」，`isDeleted false`。
- Access control 設定（membership rules、club availability）喺 API 只讀，要喺 PGM 網頁改（`Biostar/STATE.md:39`）。所以今次冇再查。

### 1.4 `gym_data` 係邊個寫

- 真正嗰個喺 dashboard droplet `146.190.87.137`，pm2 `dashboard` 讀佢（`dashboard/STATE.md:3-5`）。
- 寫入方：n8n「PGM Reports → Postgres (All)」`oi6ffiVpu7F8ADTN`（`dashboard/STATE.md:9`）。
  - 佢收 PGM 報表 email → 下載 Excel → 用 `Switch` 分去 `Visit in Club`、`Studio`、`Commissions` 等等（`Mobile App/pgm-import/workflow-pgm-to-postgres.json`）。
  - 用 `/opt/gym-import/` 嘅 Python importer 寫入（`pgm-import/import_visits.py:2`、`visits_importer_service.py:92-148`，寫 `pgm.visits`）。
- `studio.by_member`：一行 = 一次 attended booking，即係 PGM class 報表嘅出席者（`dashboard/STATE.md:13`、`:45`）。每日匯入 5 次（04:34、10:34、14:34、15:35、18:34 UTC），而且唔係 atomic（`:44`）。最近 2026-10-15 仲有更新（`dashboard/STATE.md:118`）。
- `pgm.visits` 就係 PGM「Visit in Club」報表，即係同 `MemberClubVisits` 同一份數，只係遲幾個鐘。**LAB 喺 PGM 冇，喺度都一定冇。**
- 我哋 app 嘅 `GYM_DATA_URL` 指住 `postgres:5432/gym_data`（`go24-backup/rescue-2026-10-23/go24.env`），即係已經拆咗嘅 staging droplet 上面嘅 container 副本，唔係 dashboard 嗰個。冇搵到有人更新呢個副本。
- 救返嘅 `gym_data.dump`（只睇咗 schema）：schema 有 `commissions`、`payments`、`pgm`、`pos`、`studio`。
  - `studio.by_member` 有 `club`（名，唔係 id）、`class_date`（冇時區）、`user_number`、`has_presence` 同姓名、出生日期、性別。
  - `pgm.visits` 有 `club`、`user_number`、`enter_date` 同個人資料。

### 1.5 backend 而家點讀（`backend/nest-api/src/activity/activity.service.ts`）

- `:96-101`：上堂歷史讀 `gym_data` `studio.by_member`（`user_number = memberCode`）。
- `:157-161`：今日之前嘅入場讀 `gym_data` `pgm.visits`。
- `:164-167`：今日嘅入場讀 PGM `MemberClubVisits`。
- `:202-207`：PT 讀 `commissions.done`。
- 即係「本月入場次數」大部分靠 `gym_data`。冇 `GYM_DATA_URL` 嘅話，就淨係得今日嘅 PGM 數，Passport 本月會少計。

---

## 2. 可以用嘅來源

| # | 來源 | LAB 有冇數 | 好處 | 壞處 |
|---|---|---|---|---|
| A | **PGM `MemberClubVisits`**（n8n 加 LAB 規則之後） | 11-01 起有，前提係 n8n 改咗 | 即時（1 分鐘內），同其他分店同一套，backend 已經接好（W1 改咗），唔使碰第二個 DB | 要改 live n8n（Trudy 負責嗰條）。OUT 分支之後會做合約、付款、BioStar group 檢查同 PUT，LAB group 要睇清楚先加 `LABOUT`。冇加就一直係 0 |
| B | `gym_data` `pgm.visits` | 同 A 一樣，靠 A 先有 | 一年歷史一次過攞 | 只係 A 嘅副本，遲幾個鐘，匯入唔係 atomic。要由 app server 跨 droplet 連去 dashboard DB，而 DB 有個人資料。staging 嗰個副本冇人更新 |
| C | BioStar 直接讀（`/api/events/search`，event 4867） | 11-01 起有 | 唔靠 n8n | app backend 要拎 BioStar admin session（入面有開門權限），user_id 要對 PGM member number，要自己去重。保安風險最大，**唔建議** |
| D | **上堂當入場**：PGM `ClassBookings.hasAttended`（swagger 有呢個欄位） | 有堂就有。LAB 18 堂／星期全部喺 PGM，包括 Open Gym | 唔使改 n8n，LAB 係 class-based studio，backend 已經讀 ClassBookings | 要教練或者前台喺 PGM 標出席。dashboard 量過 GO24 嘅 `has_presence` 得 88% 準（NP 9–30%）（`dashboard/STATE.md:13`），可能少計。冇 book 堂入場（如果有）唔會計 |

## 3. 建議

1. **v1 用 A（PGM `MemberClubVisits`）。**
   - 11-01 開店前，喺 n8n「BioStar Access」`Switch` 加兩條規則：
     - `LABIN` → `PGM user ID1`（Register）
     - `LABOUT` → `PGM user ID`（End）
   - 跟 KKG 10-20 嘅做法。`LAB-Recovery` 唔好加，佢唔係入口。
   - 加完之後隔日用只讀 GET 驗證：club 45 有冇紀錄。
2. **LAB 品牌嘅 Passport 唔好靠 `gym_data`。**
   - 本月入場：只讀 PGM `MemberClubVisits`（`memberId` + 本月日期；PGM 約 2 秒）。
   - 上堂歷史：改讀 PGM `ClassBookings`（`hasAttended`）。
   - 咁 LAB 部署唔使 `GYM_DATA_URL`，亦唔使跨 droplet 連 dashboard DB。GO24／ONYX 用唔用 `gym_data` 另外再決定，唔屬 M8。
3. **一日只計一次。** 用香港時間計 `enterDate` 有幾多個唔同日子，咁出入或者一日入幾次都唔會重複計。
4. **後備方案用 D**：如果 n8n 11-01 前改唔切。Passport 寫「上堂次數」，唔好寫「入場」，免得 0 次誤導會員。之後轉 A 唔使改 app，只係 backend 換數據來源。
5. 讀唔到數就照 N6 回「暫時未有」，唔好當 0（`docs/backend-plan.md:54`）。

## 4. 要 Anthony／營運答

1. **可唔可以喺 live n8n「BioStar Access」加 `LABIN`／`LABOUT`？邊個做？幾時做？**（Trudy 負責嗰條 workflow。要喺 11-01 前。）`LABOUT` 會行埋合約、付款同 BioStar group 嗰段，LAB 嘅 access group（The LAB Access／Home 等）係咪啱，要 Trudy 確認。
2. LAB 除咗閘機，**有冇其他入場方法**？例如前台人手 check-in、PGM QR、會員唔使拍卡跟教練入。有嘅話嗰啲唔會有紀錄。
3. Passport 嘅「visit」**以咩為準**：過閘（A），定係上堂出席（D）？目標係咪一日最多計 1 次？
4. LAB 教練或者前台**會唔會喺 PGM 標出席**（`hasAttended`）？上堂歷史同後備方案 D 都靠呢個。

## 5. 順手見到（唔屬 M8，冇郁）

- `Mobile App/pgm-import/import_visits.py:9-10`（同 `import_visits_droplet.py` 等）hard-code 咗 `gym_data` DB 密碼，仲喺 repo 入面。建議另開一項換密碼同清走。
- `Biostar/face_export/pgm_creds.txt` 係明文 PGM 憑證檔。
