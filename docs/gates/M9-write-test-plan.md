# Gate M9（舊 G9）· 受控寫入測試計劃（真 PGM tenant）

日期：2026-10-26 · 狀態：**只係計劃，未執行；呢份文件冇 call 過 PGM** · 對應：[`member-apps-launch-plan.md`](../member-apps-launch-plan.md) G7b ②③、G9 · [`backend-plan.md`](../backend-plan.md) W1-3、驗收、「用邊套 PGM API」 · [`function-review.md`](../function-review.md) §12 · 前置：[`M3-test-members.md`](M3-test-members.md)（測試會員 T1–T6）

## 0. 點解要做、做咩

PGM 冇 sandbox，**每一個測試約堂都係喺 live tenant 真約**（club 45「The LAB by ONYX」）。真會員用 THE LAB app 約堂之前，要用測試會員證明三件事：

1. 經 v2.2 管理 API（`BookClass`）代會員約堂，結果同會員自己喺 PGM 渠道約堂一致（G7b ②）。
2. 取消只郁**一筆**（`CancelSingleBooking`），唔連累同堂其他人或者同一會員其他堂。
3. 逾時／結果未知（POST 冇回音）時，reconcile 會對返 PGM，**唔會誤判失敗、唔會重複約、唔會留低候補**。

**規則**

- **每個案要 Anthony 逐個批**（每案下面有批核行）。批咗某案，唔等於批下一案。冇批 = 唔做。
- 只用 M3 嘅測試會員（見 §2）；**唔 call `goapi2`**；唔用 `CancelMemberBookingsForClass`、`BookClassMultipleTimes`、`SetMembersPresenceOnClass`、任何 override。
- 除咗 §5 M9-10 嘅「GO app 對照」（由人手用 PerfectGym 官方 GO app 做，唔係我哋 code），全部寫入都經我哋 backend（`POST/DELETE /v1/bookings`），因為要測嘅就係呢條路。
- 暫停／停手條件見 §7；停手後唔准自己重試，要 Anthony 重新批。

## 1. 讀 code 得出嘅 9 點（會影響測試設計；每點喺對應案確認）

| # | 觀察（出處） | 影響 |
|---|---|---|
| O1 | PGM 業務錯誤係 HTTP **499**，body 係 `errors[].code`（swagger：`DailyBookingLimitReached`、`ClassesAlreadyBooked`、`TimeLimitReached`、`CancelLimitExceeded`、`BookingAlreadyCancelled`、`StandbyLimitReached` 等）。`pgm-adapter/error-normalize.ts` 只讀 `data.errorCode ?? data.code`，**唔讀 `errors[]`** | 預期呢啲全部變 `UNKNOWN`（HTTP 500）；`CANCEL_TOO_LATE` 有定義但冇 map。**測試要記錄實際回應**，唔係修（M9-10、M9-3） |
| O2 | `BookingsService.cancel()` 遇非暫時性錯誤（例如 O1 嘅 `UNKNOWN`）直接 throw，**冇 complete idempotency key** | 同一個 `Idempotency-Key` 再試會 409 `IN_PROGRESS`（24 小時內）。測試每次重試都用新 key |
| O3 | 本地 `class_date` 用 `new Date(startTime).toISOString().slice(0,10)`＝**UTC 日期**；每日一堂靠 DB unique index `idx_one_booking_per_day (user_id, class_date)` | HKT 00:00–07:59 嘅堂，UTC 日期係前一日。可能：同一 HKT 日兩堂放行、或者不同 HKT 日被誤擋（M9-5） |
| O4 | 候補轉正（waitlist→confirmed）只靠 PGM webhook（`handlePgmPromoted`）；reconcile 只處理 `pending`／`pending_verify`／取消未知 | 本機冇 webhook：PGM 已轉正但本地 DB 仍係 `waitlist`（M9-7）。記錄為已知落差 |
| O5 | `GET /v1/bookings`（`listMine`）只讀本地 DB | 會員喺 GO app 約嘅堂，我哋 app 見唔到（M9-10 交叉渠道） |
| O6 | Backend 168 小時窗口（`startTime > now+168h` → 400）；`getRawClasses()` 只攞今日起 15 日 | 「遠期堂」最遠只可以係約 7 日後；第 8–15 日嘅堂會被 168h 擋；15 日後 `CLASS_NOT_FOUND`（M9-2） |
| O7 | Reconcile 三個 job 都係 `@Cron('0 */5 * * * *')`，要 `BACKGROUND_JOBS_ENABLED=true`；**冇手動觸發 endpoint**。`pending` 要超過 180 秒先會被 `reconcileStalePending` 處理 | 逾時測試要開 flag 等 ≤5 分鐘（M9-8、M9-9） |
| O8 | `PgmClient`：axios timeout **8 秒**、opossum breaker **10 秒**；POST 唔重試；GET 重試 2 次 | 逾時模擬要令 PGM 回應 >8 秒（用 15 秒較穩陣）；速度 >8 秒＝app 會當 `TEMP_FAIL`（M9-1） |
| O9 | `bookClass` 一律唔傳「接受候補」概念：PGM 滿堂時自己開 standby 並回 `isStandby:true`；`acceptWaitlist:false` 時 backend 先再 `CancelSingleBooking` 放棄 | 「PGM 臨時有 standby」係**真實存在嘅寫入**，要驗證確實放棄（M9-6、M9-9） |

## 2. 前置條件（全部 ✅ 先開始 M9-0）

### 2.1 人、帳戶
- [ ] **M3 完成**：T1、T2 已開，密碼登入成功（M3 V3），前台已手動確認可約 LAB 堂而且**唔收錢**（M3 V4）。T3（刪帳戶專用）**M9 唔用**；T4（GO24 主店會員）只用於 M9-2 嘅 brand 驗證，選用。
- [ ] 角色分工：寫入以 **T2** 為主（T1 係 reviewer 帳戶，要保持乾淨，只用作「第二個人」：佔位、被候補測試、跨會員驗證）。PGM 有「30 日內取消次數上限」（`CancelLimitExceeded`），**M9-0 先問前台上限幾多**，全程計算 T2／T1 已用幾多次取消，唔好令 reviewer 帳戶 T1 用盡。
- [ ] 會員號（`pgmId`）、email、密碼存共用保險庫 `LAB-App-Test`；**唔貼入 chat、唔入 repo、唔印落 log**。
- [ ] 通知 LAB 前台同教練：測試日期、時間、會用邊幾堂、點解會有 TEST 會員出現。**測試時段內要有一個前台／Anthony 喺 PGM 後台待命**（萬一取消唔到，要由職員喺後台取消，且不收費）。

### 2.2 Backend 環境
- **首選：本機 backend**（唔使 G5 開 droplet；DB 空、只有測試資料；可放 fault proxy 喺 `127.0.0.1`）。Server 版只喺 droplet 獲批後先用，規則一樣，但 M9-8／M9-9 嘅逾時模擬只可以本機做。
- 本機 Postgres 空 DB 行晒 migration（`1761400000000-Baseline`、`…ReferralsAndBannerFix`、`1761500000000-BrandLayer`）。**呢個 DB 只准有 T1／T2（／T4）嘅 row**，因為 §3 開 `BACKGROUND_JOBS_ENABLED=true` 嗰段時間 cron 會對所有 row 做嘢。
- `.env.local`：`PGM_API_BASE=https://go24fitness-hk.perfectgym.pl/Api/v2.2`；`PGM_CLIENT_ID`／`PGM_CLIENT_SECRET` 用救返嘅真 key（唔入 git、唔 echo）；`PGM_WEBHOOK_SECRET` 設任意值（本機冇人 call webhook）；`JWT_SECRET` 用本機新值。
- **`BACKGROUND_JOBS_ENABLED`**：預設 `false`。**只喺 M9-8、M9-9 嘅指定窗口設 `true`**（重啟 backend），窗口完即設返 `false` 再重啟。`false` 時 `autoReleaseWaitlistSpots`、三個 reconcile、每月總結 push 全部唔行（見 `config/background-jobs.ts`）。
- 品牌資料：`GET /v1/app-config`（header `X-App-Brand: lab`）要見 `features.classes=true`；`brand_clubs` 的 `lab` 只有 club `45`。登入時帶 `X-App-Brand: lab`，JWT 先有 `brand=lab`。
- 時區：本機 TZ 用 `Asia/Hong_Kong`（`getRawClasses` 用 server 本地時間 `setHours` 計 15 日窗口）。
- 每次 `POST`／`DELETE` 用**新** UUID 做 `Idempotency-Key`（除非案內明寫「同 key 重試」）。
- 日誌：backend stdout、fault proxy log 全程存檔（日期＋案號命名），唔准有 `X-Client-Secret`、密碼。

### 2.3 測試堂（M9-0 只讀揀好，揀完交 Anthony 批晒先開始）

只讀揀堂：`GET /odata/Classes?$filter=clubId eq 45 and startDate ge … and startDate le …&$select=id,startDate,endDate,classTypeId,attendeesCount,attendeesLimit,standbyListLimit,isDeleted`。

| 代號 | 用途 | 條件 |
|---|---|---|
| **堂 A** | M9-3 主線、M9-8 逾時 | club 45；`attendeesCount=0`、上限 16（有餘位）；開堂時間約 **+100 至 +165 小時**（4–7 日後，貼近 168h 上限但留 3 小時以上餘裕，見 O6）；非繁忙時段（深夜／星期日）；盡量唔係真會員熱門堂型。**呢個就係「遠期、有餘位、真會員唔需要」嘅堂** |
| **堂 B** | M9-6、M9-7、M9-9 滿堂／候補 | 上限細嘅堂，`attendeesLimit=1` 而且 **`standbyListLimit ≥ 1`**（若 `standbyListLimit=0`，PGM 唔會開 standby，行為不同，案 M9-6／7 標 blocked 並記錄）。**首選**：由營運喺 PGM 開一堂專用 `TEST – do not book`（club 45、上限 1、候補 ≥ 2、+4 至 +6 日、離峰；屬營運寫入，要 Anthony 批）。**後備**：現有 THE FORGE (Upper) 上限 1、`attendeesCount=0`，並且已同教練／前台講好（M3 亦要求） |
| **堂 C、D** | M9-4（T2 兩日各一堂）、M9-5 | 另外兩堂有餘位嘅堂，分別在不同 HKT 日；M9-5 時區測試要揀：①同一 HKT 日、一堂 **00:00–07:59 HKT**、一堂 **08:00 之後**；②連續兩個 HKT 日，前日 **08:00 之後** 同翌日 **00:00–07:59** 各一堂（UTC 日期會相同）。若 club 45 冇咁嘅堂，M9-5 時區部分標 N/A，改由單元測試覆蓋 |
| **堂 E** | M9-10 取消截止（高風險，**獨立批**） | 有餘位，開堂時間落喺 PGM 取消截止**之內**（例如截止係開堂前 N 小時，揀 N−1 小時內）。約到之後會員**取消唔到**，要職員喺後台取消 |

揀好嘅堂記入 §8 表頭：堂 ID、開堂時間（HKT）、人數上限、候補上限、基線 `attendeesCount`。

## 3. 只讀驗證方法（R1–R6）

全部係 GET。用 shell 變數載入 key，**唔 echo**。OData `isCanceled` 得一個 `l`。**只查測試會員號**，唔查全堂（避免讀到真會員 ID）。

| 代號 | 做法 | 用嚟睇 |
|---|---|---|
| **R1** | `GET $PGM/odata/ClassBookings?$filter=memberId eq {pgmId} and classId eq {X}&$select=id,classId,memberId,isStandby,isCanceled,isDeleted&$top=20` | 該會員喺該堂有幾多筆、係 confirmed（`isStandby=false`）定候補、有冇取消 |
| **R2** | `GET $PGM/odata/Classes?$filter=id eq {X}&$select=id,startDate,attendeesCount,attendeesLimit,standbyListLimit,isDeleted` | 人數變化：約＋1、取消後返基線 |
| **R3** | `GET $PGM/odata/ClassBookings?$filter=(memberId eq {T1} or memberId eq {T2}) and classId eq {X}&$select=…` | 兩個測試會員同堂嘅狀態（M9-4、6、7） |
| **R4** | 本機 DB：`SELECT id,status,external_id,pgm_member_id,class_id,club_id,class_date,error_code,waitlist_position,version FROM bookings WHERE user_id=…;` 同 `SELECT from_state,to_state,reason,actor,created_at FROM booking_events WHERE booking_id=… ORDER BY created_at;` 同 `SELECT key,endpoint,status,result_kind FROM idempotency_keys WHERE user_id=…;` | 本地狀態機、reason、idempotency |
| **R5** | backend log：`pgm_ghost_booking`（shadow read 搵唔到）、`Reconcile:`、`PGM circuit breaker` | 異常訊號 |
| **R6**（選用） | 前台喺 PGM 後台睇該堂 attendee list 截圖（只截測試會員） | 人手核對同「同會員渠道一致」 |

API 呼叫範本（`$API`＝本機 backend 網址；token 來自 `POST $API/auth/login`，header `X-App-Brand: lab`）：

```bash
# 約堂（接受候補用 "acceptWaitlist": true）
curl -sS -X POST "$API/bookings" -H "Authorization: Bearer $TOKEN" -H "X-App-Brand: lab" \
  -H "Idempotency-Key: $(uuidgen)" -H "Content-Type: application/json" \
  -d '{"classId": 12345, "acceptWaitlist": false}'

# 取消（:id 係回傳嘅本地 bookingId，唔係 PGM booking ID）
curl -sS -X DELETE "$API/bookings/$BOOKING_ID" -H "Authorization: Bearer $TOKEN" \
  -H "X-App-Brand: lab" -H "Idempotency-Key: $(uuidgen)"
```

## 4. 逾時模擬做法（M9-8、M9-9 用；不影響 PGM、不改 repo code）

目標：令 backend **睇唔到 PGM 嘅回應**，但 PGM 嗰邊要真係「做咗」或者「冇做」，先測到 reconcile 對返 PGM。**唔需要令 PGM 壞**。

- 寫一個**一次性本機 fault proxy**（約 30 行 Node，放 scratchpad，**唔入 repo**），只 listen `127.0.0.1:9099`，用嚟代替 `PGM_API_BASE=http://127.0.0.1:9099/Api/v2.2`（跟真 base path），backend 其餘設定唔變。Proxy 會把 header 原樣轉去真 PGM（即係帶 client id/secret），**唔准記錄 header**。**Proxy 腳本要 Anthony（或指定人）睇過先行**，因為佢經手 API key。
- 模式（用檔案或 HTTP 控制切換，無需重啟 backend）：

| 模式 | 行為 | 令 PGM 狀態 | 模擬 |
|---|---|---|---|
| `PASS` | 原樣轉發 | 正常 | 平時 |
| `FWD_THEN_HANG` | 只對 `POST /ClassBooking/*` 生效：**轉發去 PGM、收埋回應、15 秒後先斷線／唔回** | PGM **已執行** | 「PGM 做咗但我哋唔知」 |
| `DROP_BEFORE_SEND` | 只對 `POST /ClassBooking/*`：**唔轉發**，15 秒後斷線 | PGM **冇執行** | 「請求冇去到」 |
| `GET_FAIL` | 對 `GET /odata/ClassBookings*` 回 502 | 不變 | 「reconcile 查唔到 PGM」 |

- 因為 axios timeout 係 8 秒、breaker 10 秒（O8），proxy 一定要 >10 秒先斷，令 axios 先 timeout（`ECONNABORTED` → `TEMP_FAIL`，而唔係 breaker 嘅 timeout 錯誤）。
- 每個逾時案 ≤3 次，唔會達 breaker `volumeThreshold: 10`；案與案之間確認 log 冇 `circuit breaker OPEN`。
- 逾時案完成：proxy 切返 `PASS`，用 R1 確認所有測試預約已取消，再停 proxy、`PGM_API_BASE` 還原。

---

## 5. 測試案例

> 每案格式：**目的／前置 → 步驟（API）→ 預期 PGM 狀態（只讀查法）→ 預期 app／DB 狀態 → 清理 → 批核**。步驟內 `X` ＝該案嘅堂 ID。所有案開始前先用 R2 記基線人數；完成後 R1／R2 要返基線。

### M9-0 預檢（只讀＋登入，唔約）
- **目的**：確認環境、揀堂、量基線、問清楚取消上限。
- **步驟**：①`GET /v1/app-config`（`X-App-Brand: lab`）→ `classes=true`；②T1、T2 `POST /auth/login`（密碼）→ token，JWT `brand=lab`；③`GET /v1/booking/classes/week` 只見 club 45；④按 §2.3 只讀揀堂 A–E，記基線（R2）；⑤R1：T1、T2 喺堂 A–E 應該 0 筆；⑥問前台：`CancelLimitExceeded` 上限（30 日內幾多次）、取消截止（開堂前幾多小時）、有冇遲取消費、每日／同時有效預約上限、預約窗口幾遠；全部抄入 §8.3；⑦確認 `BACKGROUND_JOBS_ENABLED=false`，backend log 冇任何 PGM POST。
- **預期 PGM**：無改變（登入只驗證）。**預期 DB**：只多 `users`／`sessions` row；`bookings` 空。
- **清理**：無。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-1 按會員查詢速度（只讀；G6／G9 要量）
- **目的**：§12 話 `Members` 全表 `$top=0` 要 9.5 秒、`ClassBookings` 冇 filter 60 秒未返。要知道**按會員 filter** 係咪夠快（登入、reconcile、我的預約都靠佢）。PgmClient timeout 係 **8 秒**，超過就變 `TEMP_FAIL`（O8）。
- **步驟**（T1、T2 各做；每條 5 次，分開兩個時段——例如上午、傍晚——避開同一個 cache；記每次毫秒，計 p50／最大）：
  1. `Members`：`$filter=id eq {pgmId}&$select=Id,IsActive,IsDeleted&$top=1`（登入後查會籍狀態）。
  2. `Members`：`$filter=email eq '{email}'&$select=Id,IsActive,IsDeleted&$top=2`（D5 嘅 email 查找）。
  3. `ClassBookings`：`$filter=memberId eq {pgmId}&$select=id,classId,memberId,isStandby,isCanceled,isDeleted&$orderby=id desc&$top=50`（`listMyBookings`）。
  4. `ClassBookings`：`$filter=memberId eq {pgmId} and classId eq {X}&$select=…&$top=20`（reconcile `findMemberBookingsForClass`）。
  5. `MemberClubVisits`：按會員＋日期 filter（已知約 2 秒，作對照）。
  6. 同一個 query 用 key 直取（若 swagger 容許，例如 `Members({id})`）作比較。
- **判準**：p50 < 3 秒＝✅；3–8 秒＝⚠️（要 cache／減少調用，登入唔好每次都查）；最大 ≥ 8 秒＝❌（現有 timeout 會令正常請求失敗，要改查法或加大 timeout 並重新評估）。
- **預期 PGM／DB**：無改變（全 GET）。
- **清理**：無。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-2 拒絕類（唔寫 PGM）：168 小時、brand、他人預約
- **目的**：證明 backend 層嘅規則擋得住，而且**擋嗰陣完全冇 call PGM POST**。
- **步驟**：
  1. **168h**：T2 約一堂開堂 **> 168 小時**（第 8 日）嘅 club 45 堂 → 預期 **400** `Class is outside the 168-hour booking window`。
  2. 約一堂 **> 15 日後** 嘅堂 → 預期 **404** `CLASS_NOT_FOUND`（O6，記錄用）。
  3. **brand**：用 `X-App-Brand: foundry` 登入嘅 token（T4 或 T2 重新登入）約 club 45 堂 → 預期 **404** `CLASS_NOT_FOUND`。若 `brand_clubs` 暫時只有 lab，改為驗證未登記品牌被拒；記錄實際。
  4. **他人預約**：待 M9-3 步驟 1 後，T1 用 T2 嘅本地 bookingId 打 `DELETE /v1/bookings/{T2 bookingId}` → 預期 **400** `Booking not found`；R1 確認 T2 預約**未被郁**。（此步放喺 M9-3 步驟 2 之後執行。）
- **預期 PGM**：R1 對上述每堂、每個會員都係 **0 筆新增**（除步驟 4 嘅 T2 預約原封不動）。backend log 冇 `POST /ClassBooking/*`。
- **預期 DB**：`bookings` 冇因 1–3 而新增 row（`getClass`／brand 檢查喺建 row 之前）。
- **清理**：無（步驟 4 嘅預約由 M9-3 取消）。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-3 主線：約堂 → 取消（堂 A，T2）
- **目的**：證明經 API 約同取消，效果同會員自己做一致（G7b ②）；重試唔會重複約。
- **步驟**：
  1. T2 `POST /bookings {classId: A}`，key K1 → 預期 **200** `{success:true,status:"confirmed"}`。記錄由送出到 R1 可見嘅延遲（shadow read 重試 2／4／6 秒）。
  2. **同 key K1 重試一次** → 預期 **200 同樣回應**，唔會再 call PGM POST。
  3. 立即 R1／R2／R4／R5。
  4. **「同會員渠道一致」核對（人手，R6／GO app）**：T2 登入官方 PG GO app → 「我的預約」見到呢堂；預約狀態、座位（無）、顯示字眼同一般會員預約一樣；有冇確認電郵／通知；扣堂數／用量同會員自約一致；前台後台 attendee list 見到佢，來源欄（如有）記低是否顯示 API／管理渠道。全部抄入 §8.1 表。
  5. 取消：T2 `DELETE /bookings/{id}`，key K2 → 預期 **204**。
  6. R1／R2／R4。
  7. **重複取消**（新 key K3）→ 預期失敗（PGM `BookingAlreadyCancelled`，按 O1 預期顯示 `UNKNOWN`）；**記錄實際回應，確認無副作用**（R1 仍然 1 筆 `isCanceled=true`）。
- **預期 PGM**：步驟 3：R1 剛好 **1 筆**，`isStandby=false`、`isCanceled=false`、`isDeleted=false`；R2 `attendeesCount` ＝基線＋1。步驟 6：同一筆 `isCanceled=true`；`attendeesCount` ＝基線。
- **預期 app／DB**：步驟 3：`bookings` 1 行 `status=confirmed`、`external_id`＝R1 嘅 `id`、`pgm_member_id`＝T2、`club_id=45`、`class_date` 有值；`booking_events`：`pending→confirmed`（reason `PGM confirmed`）；`idempotency_keys` K1 `done/terminal`；log 無 `pgm_ghost_booking`；`outbox_events` 有 `booking.confirmed`。步驟 6：`status=cancelled`，events `confirmed→cancelled`（`user cancel`）。
- **清理**：已取消。若取消失敗 → 見 §7。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-4 取消只郁一筆（堂 A、堂 C，T1＋T2）
- **目的**：證明 `CancelSingleBooking` 只取消指定嗰一筆（D1 修正）。注意：PGM 唔准同一會員同堂約兩次（`ClassesAlreadyBooked`），所以用「同堂兩個會員」同「同一會員兩日兩堂」兩個角度。
- **步驟**：
  1. T1 約堂 A（confirmed）；T2 約堂 A（confirmed）；T2 再約堂 C（另一個 HKT 日，confirmed）。R3 ＝兩人喺堂 A 各 1 筆，R2 `attendeesCount` ＝基線＋2。
  2. **T2 取消堂 A** → 204。
  3. R3／R1／R2／R4。
  4. T2 取消堂 C。T1 取消堂 A（收尾）。
- **預期 PGM**：步驟 3：T2 堂 A 嗰筆 `isCanceled=true`；**T1 堂 A 嗰筆仍然 `isCanceled=false`、`isStandby=false`**；**T2 堂 C 嗰筆仍然 active**；堂 A `attendeesCount` ＝基線＋1。
- **預期 DB**：T2 堂 A `cancelled`；T1 堂 A、T2 堂 C 仍 `confirmed`，`version` 不變。
- **清理**：步驟 4 全部取消，R3／R1 確認冇 active。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-5 每日一堂（本地 index＋時區）（堂 A、堂 C、堂 D，T2）
- **目的**：驗證「1 日 1 堂」（本地 index），並確認 O3（UTC 日期 vs HKT 日期）有冇實際問題；知道 PGM 自己嘅每日上限（`DailyBookingLimitReached`）幾多。
- **步驟**：
  1. **基本**：T2 約同一 HKT 日、同為 08:00 後嘅兩堂（堂 A＋另一堂）。第二堂 → 預期 **400** `Daily limit reached — you can only book 1 class per day`；R1 確認第二堂 **0 筆**（本地擋，PGM 唔會被 call）。
  2. **時區 ①**（同一 HKT 日，一堂 00:00–07:59、一堂 08:00 後）：T2 約兩堂。若本地放行第二堂（因 UTC 日期不同）→ 由 PGM 決定：記錄 PGM 接受定回 `DailyBookingLimitReached`。
  3. **時區 ②**（前日 08:00 後 ＋ 翌日 00:00–07:59，UTC 日期相同）：T2 約兩堂。若第二堂被本地擋 → 記錄「不同 HKT 日被誤擋」。
  4. 結果記錄對照 GO app（M9-10）。
- **預期 PGM**：①R1 只有第一堂 active。②③按實際記錄。
- **預期 DB**：第二堂被拒時無新 `bookings` row（unique 違反在 insert，`23505 idx_one_booking_per_day`）。
- **清理**：全部成功預約逐筆取消（M9-3 方式）。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-6 滿堂＋不接受候補（`acceptWaitlist=false`）→ standby 必須放棄（堂 B，T1＋T2）
- **目的**：證明 PGM 因滿堂而開咗 standby 之後，backend 真係取消咗佢（D2 修正），會員冇留喺候補。
- **步驟**：
  1. T1 約堂 B（上限 1）→ confirmed。R2 `attendeesCount=1`（滿）。
  2. T2 `POST /bookings {classId: B}`（唔傳 `acceptWaitlist`）key K1 → 預期 **409** `BOOKING_FULL`。
  3. R1（T2＋堂 B）、R3、R4、R5。
  4. **同 key K1 重試** → 預期返同樣已完成結果（`success:false`，`BOOKING_FULL`），唔會再開 standby。
- **預期 PGM**：R1（T2）：**有 1 筆，`isStandby=true` 而且 `isCanceled=true`**（曾開、已放棄）；**冇任何 `isCanceled=false` 嘅 T2 預約**；T1 嗰筆仍 active、`attendeesCount` 仍 1。
- **預期 DB**：T2 `bookings` row `status=failed`、`error_code=BOOKING_FULL`、`external_id` ＝R1 嗰筆 id；events：`pending→failed`，reason `standby declined and released`；`idempotency_keys` K1 `done/terminal`。T2 之後可再約（唔受 index 阻，因 `failed` 唔在 index）。
- **清理**：保留 T1 佔位，直接接 M9-7。M9-7 完成後統一取消。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-7 滿堂＋接受候補（`acceptWaitlist=true`）→ 轉正（堂 B，接 M9-6）
- **目的**：驗證候補寫入同轉正行為，並確認 O4 嘅落差。
- **步驟**：
  1. T2 `POST /bookings {classId: B, acceptWaitlist: true}`，新 key → 預期 **200** `status:"waitlist"`。
  2. R1／R3／R4。
  3. **T1 取消堂 B**（M9-3 方式）→ 204。R1（T2）每 30 秒查，直到 `isStandby=false`（記錄 PGM 轉正延遲）；PGM 可能向 T2 發通知，記錄。
  4. R4：本地 T2 狀態。
  5. T2 取消（用 API）：此時 PGM 側係 confirmed，本地可能仍 `waitlist`。
- **預期 PGM**：步驟 2：T2 1 筆，`isStandby=true`、`isCanceled=false`；步驟 3：T1 `isCanceled=true`，T2 轉為 `isStandby=false`、`isCanceled=false`，`attendeesCount=1`。
- **預期 DB**：步驟 2：`status=waitlist`、`external_id` 有值、`waitlist_position=null`（已知冇顯示位置）；步驟 4：**預期仍係 `waitlist`（O4，未有 webhook 同步）**—— 記錄為已知落差，唔係測試失敗，交 Anthony 決定 v1 要唔要補（reconcile 補轉正／接 PGM webhook）；步驟 5：取消成功，`waitlist→cancelled` 合法。
- **清理**：確認 T1、T2 於堂 B 全部 `isCanceled=true`，`attendeesCount=0`。
- **補充**：`autoReleaseWaitlistSpots`（開堂前 5 小時自動放棄候補）**唔喺 M9 實測**——需要 5 小時內嘅堂＋開 `BACKGROUND_JOBS_ENABLED`，風險同價值唔成比例；留單元測試。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-8 逾時／結果未知＋reconcile（堂 A，T2，fault proxy；**要開 `BACKGROUND_JOBS_ENABLED=true` 窗口**）
- **目的**：證明 POST 逾時不重試、當「未知」處理，reconcile 對返 PGM 之後落啱狀態（D3／D4 修正、取消逾時）。
- **前置**：§4 proxy 已被睇過；本機 DB 淨係測試 row；backend 以 `PGM_API_BASE=http://127.0.0.1:9099/…`、`BACKGROUND_JOBS_ENABLED=true` 啟動；每個子案 ≥ 3 分鐘前確認上一個子案已清理。Cron 喺每 5 分鐘（:00、:05…）行，所以每個子案最多等 5 分鐘＋。
- **8a 取消逾時，PGM 已取消**（`FWD_THEN_HANG`）
  1. proxy `PASS`：T2 約堂 A → confirmed。
  2. proxy 切 `FWD_THEN_HANG`：T2 `DELETE /bookings/{id}` → 約 8 秒後預期 **503 `TEMP_FAIL`**。
  3. 馬上 R1 → PGM 該筆已 `isCanceled=true`；R4 → 本地仍 `confirmed`、`error_code=CANCEL_UNKNOWN`；idempotency `done/transient`。
  4. proxy 切返 `PASS`，等 reconcile（≤5 分鐘）。
  - **預期最終**：本地 `cancelled`、`error_code=null`，events：`confirmed→cancelled`，reason `reconcile: cancelled in PGM`。PGM 無改變。
- **8b 取消逾時，PGM 未取消**（`DROP_BEFORE_SEND`）
  1. T2 約堂 A（`PASS`）→ confirmed；切 `DROP_BEFORE_SEND`；`DELETE` → **503**。R1：仍 active。
  2. 切 `PASS`，等 reconcile。
  - **預期最終**：本地仍 `confirmed`、`error_code=null`（標記清除，預約仍在）；log `Reconcile: cancel of booking … did not take effect in PGM; booking stands`。PGM 無改變（仍 active）。然後 T2 用 `PASS` 正常取消（清理）。
- **8c 約堂逾時，PGM 已約**（`FWD_THEN_HANG`）
  1. 切 `FWD_THEN_HANG`；T2 `POST /bookings {classId: A}` → 約 8 秒後 **503 `TEMP_FAIL`**。
  2. R1 → PGM 有 1 筆 active；R4 → `pending_verify`、`error_code=TEMP_FAIL`、idempotency `transient`。此時 T2 再約同日另一堂應被本地 index 擋（`pending_verify` 在 index 內）——記錄。
  3. 切 `PASS`，等 reconcile。
  - **預期最終**：`confirmed`、`external_id`＝R1 嗰筆 id、`error_code=null`，reason `reconcile: found in PGM`。**PGM 只有 1 筆**（冇重複約；證明 POST 唔重試）。
- **8d 約堂逾時，PGM 冇約**（`DROP_BEFORE_SEND`）
  1. T2 `POST` → **503**；R1 → 0 筆。
  2. 切 `PASS`，等 reconcile。
  - **預期最終**：`failed`、`error_code=NOT_IN_PGM`；T2 可以再約。
- **8e reconcile 查唔到 PGM**（`GET_FAIL`）
  1. 先做 8c 步驟 1 造出 `pending_verify`；proxy 轉 `GET_FAIL`（POST 可 `PASS`）。
  2. 等兩個 cron 週期。
  - **預期**：仍 `pending_verify`，**唔會變 `failed`**；log `Reconcile: PGM lookup failed … still confirming`。再切 `PASS`，下個週期落到 `confirmed`（PGM 已有該筆）。
- **8f 請求中途 crash 留低 `pending`**（選用）
  1. `FWD_THEN_HANG` 下 T2 約堂 A；喺 8 秒內 kill backend 進程。重啟。
  2. R4：row 仍 `pending`；等 >180 秒＋下個週期。
  - **預期最終**：`confirmed`（PGM 有一筆）。
- **8g PGM 重複預約（同會員同堂兩筆 active）**：PGM 唔准（`ClassesAlreadyBooked`），**無法喺 live tenant 製造**，只靠單元測試（`reconcile.job.spec.ts`），不在 M9 實測。
- **預期 PGM（整案）**：自始至終 T2 在堂 A 最多 1 筆 active；結束時 0 筆 active。
- **清理**：proxy 切 `PASS`，R1 確認 T1／T2 堂 A 全部 `isCanceled=true`；`BACKGROUND_JOBS_ENABLED=false`、`PGM_API_BASE` 還原、停 proxy、重啟 backend。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-9 放棄候補失敗 → reconcile 補放棄（堂 B，T1＋T2，fault proxy；**要開 flag 窗口**）
- **目的**：驗證 M9-6 嘅失敗版：放棄 standby 時 `CancelSingleBooking` 冇到達 PGM，會員唔會永遠留喺候補。
- **步驟**：
  1. T1 約堂 B（`PASS`）→ confirmed（滿）。
  2. proxy 切 `DROP_BEFORE_SEND`，**但只影響 `CancelSingleBooking`**（`BookClass` 要放行）；T2 `POST /bookings {classId: B}`（不接受候補）→ 預期 **409 `BOOKING_FULL`**。
  3. R1（T2）→ **standby 仍 active**（`isStandby=true`、`isCanceled=false`）；R4 → `pending_verify`、`error_code=WAITLIST_DECLINED`。
  4. 切 `PASS`，等 reconcile。
- **預期最終**：PGM：T2 嗰筆 `isCanceled=true`；DB：`failed`、`error_code=BOOKING_FULL`，reason `reconcile: declined standby released`。
- **清理**：T1 取消堂 B；R3 確認全部 `isCanceled=true`；`attendeesCount=0`；還原環境（同 M9-8）。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

### M9-10 規則對照 PerfectGym GO app（G7b ②；每日上限、取消截止、預約窗口）
- **目的**：比較「會員用官方 GO app」同「經我哋 API」嘅規則，列出差異（可接受／要 backend 補／要問 PGM）。GO app 操作由**人**用 T2 帳號喺官方 app 做；我哋唔 call `goapi2`、唔寫腳本去打 GO API。
- **A. 唯讀對照（唔使寫）**：①GO app 班表顯示幾遠嘅堂；②堂詳情有冇寫取消截止／遲取消費；③問前台後台設定。結果入 §8.3。
- **B. 每日上限**：T2 喺 GO app 約同一 HKT 日兩堂（含 M9-5 嘅時區組合）。記錄：GO app 擋唔擋、訊息字眼（對應 PGM `DailyBookingLimitReached`／`GlobalActiveBookingLimitReached`）。對照 M9-5 結果：我哋 1 日 1 堂（本地 index）係**刻意比 PGM 嚴**定**一致**？
- **C. 預約窗口**：GO app 約一堂 +8 日（> 168h）嘅堂；擋唔擋（對應 `BookingTimeLimitExceeded`／`TooSoonToBook`）。我哋 backend 固定擋 168h，PGM 實際窗口若短過 168h，會令我哋出現「backend 放行、PGM 拒絕」（O1 → `UNKNOWN`）。
- **D. 取消截止（高風險，獨立批；堂 E）**：
  1. 步驟：T2 經 API 約堂 E（開堂時間落喺截止之內）；馬上 `DELETE` → 預期 PGM `TimeLimitReached`，我哋顯示 **`UNKNOWN`（O1）**，本地仍 `confirmed`；用新 key 再試一次（O2）確認 `IN_PROGRESS` 行為。
  2. 取消截止之外（堂 A，M9-3 已測）係成功；兩者結合得出邊界。如要找精確邊界（例如截止係開堂前 4 小時），用接近邊界兩堂：邊界前 30 分鐘（應該得）同後 30 分鐘（應該被拒）；每次嘗試都會計入 30 日取消限額（`CancelLimitExceeded`）。
  3. **風險**：遲取消可能被收費或記 no-show。M3 已要求測試會員唔俾收錢；**進行前向前台確認遲取消冇費用**；堂 E 取消唔到之後 **即刻請前台喺 PGM 後台取消（不收費）**，並核對 T2 冇帳單／罰款。
  4. 對照：GO app 對同類遲取消顯示咩（**只睇顯示，唔做第二次遲取消**；睇堂詳情／按鈕狀態／截止文字）。
- **E. 交叉渠道**：①喺 GO app 約嘅堂，`GET /v1/bookings` 見唔見（O5，預期見唔到）；②喺 GO app 取消一筆由 API 約嘅預約，本地 DB 之後點（預期仍 `confirmed`，只靠 reconcile／webhook 都唔會處理；記錄）；③喺我哋 API 取消一筆 GO app 約嘅預約（本地冇 row → `Booking not found`，預期）。
- **預期 PGM／DB**：B、C 若 GO app 成功約到，要在同一案內取消；D 見上。
- **清理**：全部取消；堂 E 由職員取消；R1 確認 T1／T2 冇 active。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________（D 另批：__________）

### M9-11 收尾核對（所有案完）
- R1：T1、T2（及 T4）喺堂 A–E **全部 `isCanceled=true`**；R2 全部返基線。
- DB：`bookings` 所有 row 為 `cancelled`／`failed`，冇 `pending`／`pending_verify`／`waitlist` 殘留；`idempotency_keys` 冇卡住嘅 `in_flight`（O2 造成嘅，標記）。
- 環境還原：`BACKGROUND_JOBS_ENABLED=false`、`PGM_API_BASE` 還原、proxy 停止並刪除、backend log 已存檔且冇 secret。
- 前台確認 T1／T2 冇帳單、冇遲取消費、冇封鎖備註（blocking note）。
- 結果交 Anthony 簽 §8.4。
- **批核**：批 ✅ / ❌，Anthony：__________，日期：__________

---

## 6. 預計約花嘅「取消額度」（對 §2.1 嘅上限）

M9-3（2）、M9-4（3）、M9-5（約 3）、M9-6／7（2）、M9-8（約 5）、M9-9（1）、M9-10（約 4）≈ **20 次取消**。若 PGM 30 日取消上限小於呢個數，T2 會中途被 `CancelLimitExceeded` 擋。**M9-0 問到上限後再決定分幾日做、或用 T1／額外測試會員分擔**；T1（reviewer 帳戶）唔好用到上限。

## 7. 停手條件

出現以下**任何一項**即停（唔再發新請求）：

1. 任何結果同「預期」不符，而且唔係案內已列明嘅「預期落差」（O1、O3、O4、O5）。
2. R1／R2 見到**非測試會員**嘅預約出現喺測試堂，或者 `attendeesCount` 變化同我哋嘅操作對唔上。
3. 一次取消令**多於一筆**預約變 `isCanceled`，或者見到非指定預約被取消。
4. 測試會員被收費、出帳單、遲取消費、被加 blocking note。
5. 真會員開始預約測試堂（堂 B 若係現有堂），或前台話要用返嗰堂。
6. 連續兩次 5xx／`circuit breaker OPEN`、查詢反覆 >8 秒。
7. `BACKGROUND_JOBS_ENABLED=true` 出現喺窗口之外，或 DB 見到非測試 row。
8. `CancelLimitExceeded` 已出現喺 T1／T2。
9. 時間窗口完、前台／職員待命人員離開、Anthony 暫停。

**停手後必做**：
1. 停發新請求；`BACKGROUND_JOBS_ENABLED=false`，proxy 切 `PASS`/停。
2. 記錄：時間、案號、完整請求（無 secret）、回應、R1／R2／R4／R5 結果，寫入 §8。
3. **取消已建立嘅預約**：先用 API（`PASS`）逐筆取消；唔得就請前台喺 PGM 後台取消（不收費）。
4. R1 確認冇 active；通知 Anthony。
5. 該案標 ❌；**未經 Anthony 重新批准唔准重試**。

## 8. 結果表（執行時填）

### 8.0 測試堂基線（M9-0 填）
| 代號 | 堂 ID | 開堂時間（HKT） | 堂型 | 上限 | 候補上限 | 基線人數 | 備註 |
|---|---|---|---|---|---|---|---|
| A | | | | | | | |
| B | | | | | | | |
| C | | | | | | | |
| D | | | | | | | |
| E | | | | | | | |

### 8.1 案結果
| 案 | 日期 | 執行人 | 會員 | 堂 | 預期（摘要） | 實際 | R1／R2 PGM 狀態 | R4 DB 狀態 | 清理完成 | 結果 ✅／⚠️／❌ | Anthony 批核日期 | 備註／issue |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M9-0 | | | T1、T2 | — | | | | | — | | | |
| M9-1 | | | T1、T2 | — | 見 8.2 | | — | — | — | | | |
| M9-2 | | | T2（T4） | | 全部拒絕、無 PGM POST | | | | — | | | |
| M9-3 | | | T2 | A | 約→取消，一致 | | | | | | | |
| M9-4 | | | T1、T2 | A、C | 只取消指定一筆 | | | | | | | |
| M9-5 | | | T2 | A、C、D | 1 日 1 堂；時區 | | | | | | | |
| M9-6 | | | T1、T2 | B | standby 已放棄 | | | | | | | |
| M9-7 | | | T1、T2 | B | 候補→轉正 | | | | | | | |
| M9-8a | | | T2 | A | 取消逾時（PGM 已取消）→ reconcile 補 | | | | | | | |
| M9-8b | | | T2 | A | 取消逾時（PGM 未取消）→ 預約仍在 | | | | | | | |
| M9-8c | | | T2 | A | 約逾時（PGM 已約）→ confirmed | | | | | | | |
| M9-8d | | | T2 | A | 約逾時（PGM 冇）→ failed | | | | | | | |
| M9-8e | | | T2 | A | 查唔到→仍確認中 | | | | | | | |
| M9-8f | | | T2 | A | crash 留 pending→confirmed（選用） | | | | | | | |
| M9-9 | | | T1、T2 | B | 放棄失敗→reconcile 補放棄 | | | | | | | |
| M9-10 | | | T2 | A、E | 規則對照 | 見 8.3 | | | | | | |
| M9-11 | | | — | — | 全部返基線 | | | | — | | | |

### 8.2 速度（M9-1 填；毫秒）
| 查詢 | 會員 | 時段 | 第 1–5 次 | p50 | 最大 | 判準 ✅（<3s）／⚠️（3–8s）／❌（≥8s） |
|---|---|---|---|---|---|---|
| `Members` by id | T1 | | | | | |
| `Members` by id | T2 | | | | | |
| `Members` by email（`$top=2`） | T1 | | | | | |
| `ClassBookings` by member（`$top=50` desc） | T1 | | | | | |
| `ClassBookings` by member | T2 | | | | | |
| `ClassBookings` by member＋class | T2 | | | | | |
| `MemberClubVisits`（對照） | T1 | | | | | |
| 約堂後 R1 可見延遲（M9-3） | T2 | | | | | |

### 8.3 規則對照（M9-0、M9-5、M9-10 填；G7b ②）
| 規則 | PerfectGym GO app／後台（會員渠道） | 我哋 API | 一致？ | 處理（接受／backend 補／問 PGM） |
|---|---|---|---|---|
| 每日上限（同一 HKT 日） | | 本地 1 日 1 堂（UTC 日期，O3）＋PGM 自己判斷 | | |
| 全局有效預約上限（`GlobalActiveBookingLimitReached`） | | 無本地限制 | | |
| 預約窗口（最遠幾耐） | | 固定 168h | | |
| 太近唔准約（`TooSoonToBook`／`BookingTimeLimitExceeded`） | | 無本地限制 | | |
| 取消截止（開堂前幾小時） | | 交 PGM；錯誤顯示 `UNKNOWN`（O1） | | |
| 遲取消費／no-show 處理 | | 唔送 `doNotChargeForLateCancellation` | | |
| 30 日取消次數上限 | | 交 PGM | | |
| 同時段有其他預約 | | `bookDespiteOtherBookingsAtTheSameTime:false` | | |
| 滿堂候補上限／位置顯示 | | 位置唔顯示 | | |
| 候補轉正通知 | | 靠 webhook（O4） | | |
| GO app 約嘅堂喺我哋 app 見唔見（O5） | | 唔見 | | |
| 同會員渠道一致嘅其他觀察（來源欄、通知、扣堂數） | | | | |

### 8.4 結論（Anthony 簽）
- G7b ② 證據齊？ ☐ 齊 ☐ 有已知差異（列於 8.3，已決定處理） ☐ 未齊
- 已知落差交代：O1（錯誤碼）、O3（UTC 日期）、O4（候補轉正）、O5（跨渠道）→ 處理決定：______________________
- 速度結論（登入／reconcile 要唔要 cache）：______________________
- 可否對真會員開放約堂／取消寫入（仍受 G7b ①、G8 約束）：☐ 可 ☐ 唔可以，原因：__________
- 簽名：__________，日期：__________
