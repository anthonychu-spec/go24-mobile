# Gate M3（舊 G6）· PGM 測試會員開戶清單

日期：2026-10-26 · 狀態：**清單已備；未開戶** · 負責：Anthony／前台（喺 PGM 開）· 工程只讀驗證

上層：[`member-apps-launch-plan.md`](../member-apps-launch-plan.md) G6、G9、第 4 階段 · [`backend-plan.md`](../backend-plan.md) W1-5、驗收 · [`function-review.md`](../function-review.md) §12（THE LAB ＝ PGM club **45**）

## 點解要開

- PGM 冇 sandbox，每一個約堂都係真嘅。冇專用測試會員就：做唔到受控寫入測試（M9／G9）、量唔到 `ClassBookings`／`Members` 按會員 filter 嘅真實速度（§12：`Members` 全表 `$top=0` 都要約 9.5 秒，`ClassBookings` 冇 filter 60 秒未返）、畀唔到 Apple／Google reviewer 登入。
- 辦公室守則：密碼同生產資料係 Anthony 嘅。**呢份檔只係清單，工程唔會喺 PGM 開任何嘢。**

## App 實際會檢查咩（開戶時要滿足）

| 項目 | App／backend 做法（出處） | 對測試會員嘅要求 |
|---|---|---|
| 密碼登入 | `POST /auth/login` → PGM `VerifyMemberCredentials`（email＋密碼）；status 唔係 active／success 就 `MEMBER_INACTIVE`（`auth.service.ts` login） | 要有 email＋PGM 密碼；reviewer 用呢條路，**唔使收驗證碼** |
| 會籍狀態 | 密碼或驗證碼啱之後，仲要 `Members` 查 `IsActive = true` 同 `IsDeleted = false`，否則 `MEMBER_INACTIVE`；refresh 時超過 24 小時會再查，唔 active 即撤銷所有 session（`ensureMemberActive`、`refresh`） | 帳戶要 **Active、未 Deleted**，而且要長期保持 |
| 驗證碼登入 | `POST /auth/request-otp`：用 email 搵會員，`$top 2`；多過 1 個 → `AMBIGUOUS_ACCOUNT`（HTTP 409，唔發碼）；碼預設發去 Email（`lookupMemberIdByEmail`、`PGM_OTP_DESTINATION`） | email 要收得到信；測 AMBIGUOUS 要兩個會員同一 email。**注意：密碼登入唔經呢個查重，所以 AMBIGUOUS 只可以用驗證碼流程測** |
| 只見 LAB | 品牌 `lab` ＝ club 45（`brand_clubs` seed）；班表、約堂、取消、我的預約每次都驗 `cls.clubId` 屬於品牌，否則 `CLASS_NOT_FOUND`（`booking.service.ts`、`brand.service.ts`） | 會員主店唔影響登入（登入只查 IsActive／IsDeleted）；要用 GO24 會員驗「LAB app 只見 club 45」 |
| 168 小時窗口 | 班開始時間 > 現在 + 168 小時 → 400「outside the 168-hour booking window」 | 測試只可以約**未來 7 日內**嘅堂；LAB 一星期約 18 堂，唔好浪費 |
| 每日一堂 | 本地 DB unique index `idx_one_booking_per_day`（user＋classDate）→ 400「Daily limit reached」 | 要用同一個會員約**同一日兩堂**先測到 |
| 候補 | PGM 回 `isStandby`；用戶唔收候補 → 即 `CancelSingleBooking` 放走（失敗就 `pending_verify` 交 reconcile）；收候補 → `waitlist`；`*/15` cron 喺開堂前 5 小時內按用戶設定自動放候補 | 要**兩個**能約 LAB 堂嘅會員；LAB 堂一般上限 16／候補 10，只有 THE FORGE (Upper) 上限 1，所以候補測試最易用嗰類堂 |
| 取消 | 只送 `CancelSingleBooking({ bookingId })`，**永不送** `doNotChargeForLateCancellation`（員工 override） | 遲取消如果 PGM 會收費，測試會員會真係被收——見「唔俾收錢」 |
| 能唔能約堂 | 約堂規則由 PGM 決定（`/ClassBooking/BookClass`）；backend 自己唔睇合約 | 測試會員要有**真係約到 LAB 堂**嘅會籍／合約／堂數；呢點**要開戶後實測確認**（見驗收 V4） |

## 要開幾多個、各自做咩

必開 **3 個**（T1–T3），選開 **3 個**（T4–T6）。T4–T6 可以排喺 T1–T3 之後，視乎 G8（登入政策）。

| 代號 | 用途 | 必／選 | 特點 |
|---|---|---|---|
| **T1** | **Apple／Google reviewer 帳戶**：送審時畀 reviewer；平時量 `Members`／`ClassBookings` 速度、登入主流程回歸 | 必 | **長期有效**（至少到上架後數個月）；**密碼登入**；LAB 會籍 Active，約到 club 45 堂；絕不刪、絕不改密碼 |
| **T2** | **第二個 LAB 會員**：同 T1 一齊做候補（T1 佔位、T2 入候補）、同日兩堂被拒、單筆取消唔影響同堂其他預約、換帳戶登入唔見對方資料／push | 必 | 同 T1 一樣條件；唔交畀 reviewer |
| **T3** | **刪帳戶專用**：測 app 內＋網頁刪帳戶、舊 access token 即時 401 | 必 | **可重置**——刪咗 app 帳戶之後 PGM 會員仍在，可再登入重建；全程只有呢個帳戶會被刪，**T1／T2 絕不做刪除測試** |
| **T4** | **GO24 分店會員**（主店唔係 club 45）：驗 LAB app 只見 club 45 班表、約唔到其他分店嘅堂 | 選 | 要有可約 GO24 堂嘅會籍；只做讀同「被拒」測試，**唔真約** |
| **T5＋T6** | **兩個會員共用同一 email**：驗 `AMBIGUOUS_ACCOUNT`（request-otp 回 409、唔發碼） | 選 | 要確認 PGM 容許同 email 開兩個會員（code 注釋話家人、重新入會會撞，但 PGM 後台有冇擋，**前台試一試先知**）；T5／T6 唔准用嚟約堂 |

> 為免兩部機同時審批時搶位：預設 T1 同時畀 Apple 同 Google。如果 Anthony 想分開（Apple 一個、Google 一個），多開 T1b 同 T1 條件完全一樣，並行審批時唔會因「每日一堂」撞到對方。

## 每個帳戶要填咩（PGM 欄位）

通用規則（T1–T6 都適用）：

| 欄位 | 填法 |
|---|---|
| 姓名 | 明顯標 TEST，例如 `TEST Reviewer` / `LAB-Test-T1`（名 `TEST`、姓 `LAB-T1`）。**唔好用真人名、員工名** |
| Email | **團隊控制嘅信箱**，用 plus-addressing，每個帳戶一個：`<團隊信箱>+lab-t1@<域名>`、`+lab-t2`、`+lab-t3`…（T5／T6 兩個都用同一個 `+lab-t5`）。要確認：①PGM 接受 `+`；②信件真係收到（驗證碼、密碼設定信都靠佢）。**唔好用員工私人信箱，亦唔好用公開嘅 `test@…`** |
| 電話 | 用團隊控制嘅號碼或者明顯假號（符合 PGM 格式）；**唔好填真會員或員工私人電話** |
| 生日／性別／地址／證件 | 填成年人嘅假日期同 `TEST` 地址；**唔好填任何真實身分證／護照／銀行／信用卡資料** |
| 主店 | T1、T2、T3、T5、T6 → **THE LAB by ONYX（club 45）**；T4 → 一間 GO24 分店 |
| 會籍／合約／計劃 | 要揀一個**可以約 LAB 班堂**嘅計劃，而且**免費或者零收費**（見下面「唔俾收錢」）。有效期：T1 至少 12 個月或無限期；T2、T3 至少 6 個月；到期日記入日曆提前 30 日提醒續 |
| 狀態 | **Active**，未 Deleted、未 Frozen／Suspended |
| 密碼 | 由前台／Anthony 喺 PGM 設（或者經 PGM 密碼設定信自己設）。**長度夠、每個帳戶唔同、唔重用其他系統密碼**；入密碼管理器（見下）。具體 PGM 後台邊度設，前台按實際畫面做（呢份清單未睇過 PGM 後台畫面） |
| 通訊／推廣同意 | 全部**唔同意**市場推廣（email／SMS／push 推廣一律關），只保留交易性通知，方便測 push |
| 備註／標籤 | 見下面「唔入報表」 |

**絕對唔准用：**

- 真會員、員工、親友嘅姓名、電話、email、證件、卡號。
- 由真會員「借」或者「改名」嚟做測試（資料會污染）。
- 任何會綁真實付款方式（信用卡、直接扣款）嘅設定。
- 開後門／繞過正式登入嘅特殊權限（G6 明寫唔准）。測試帳戶同真會員行**同一條**正式登入。

## 唔入報表、唔入推廣

PGM 後台有乜標籤／備註／分類功能要前台按實際畫面揀（我哋冇睇過 PGM 後台），原則係：

1. **姓名帶 `TEST`**——任何報表、搜尋一眼睇到、亦方便過濾。
2. **加標籤（tag）或自訂欄位**——如果 PGM 有：`TEST-ACCOUNT`、`LAB-APP`。**冇標籤就寫喺會員備註**：`TEST ACCOUNT – app review/QA – 唔計入會員數、營收、推廣 – 負責人：<名> – 開於 <日期>`。
3. 全部設**唔收推廣**（見上）。
4. 通知營運／財務／市場同事：呢幾個會員號（開完戶先有）要從以下剔走——會員人數、活躍會員、續會率、堂位使用率、入場統計、郵件／SMS／push 推廣名單、任何外部 CRM／廣告受眾同步。
5. 季度檢查一次：標籤仲喺、冇人手改咗名或者主店。

## 點樣唔俾收錢

具體 PGM 選項前台確認；原則：

- **揀免費／零收費嘅計劃**（例如內部或員工 complimentary 計劃），唔好用要月費嘅真計劃。如果 PGM 要求最少一個收費計劃，用開始日期後即刻免費嘅，或者收費設 0。
- **冇綁任何付款方式**：唔入卡、唔簽直接扣款。帳戶餘額唔充值。
- **確認冇其他收費**：入會費、遲取消費、冇到費、堂數用完後 pay-per-class。因為 backend 取消**永不送** `doNotChargeForLateCancellation`，遲取消如果 PGM 有收費規則會真收。**測取消時盡量喺免費取消時限前取消**；要測 `CANCEL_TOO_LATE` 嗰次，先確認該計劃唔會真收。
- 發現測試會員出現帳單：即時停用（見下）、通知財務、記錄喺下面表格。

## 保護真會員

- 測試會員佔用真堂位：**LAB 堂一般上限 16**，測試約咗會佔位。**盡量用冇人約、人數少嘅堂；測完即刻取消**。候補測試用上限細嘅堂（如 THE FORGE (Upper) 上限 1），並同教練／前台預先講。
- **G9 受控寫入測試要 Anthony 逐次批**（`member-apps-launch-plan.md` G9）；開戶完成唔等於可以約。第 1 星期只讀。
- 測試會員唔准加入真實班堂嘅等候名單超過測試所需時間——候補被提升時會推播通知真正需要嗰個人，混亂風險高。

## 開戶後驗收（只讀 + 登入）

開完戶，工程只做以下**只讀**核實（要 Anthony 同意先 call PGM）：

| # | 檢查 | 預期 |
|---|---|---|
| V1 | `Members` 按會員號 `$select=Id,IsActive,IsDeleted`、`$top=1` | `IsActive=true`、`IsDeleted=false`；順手**記時間**（G6／G9 量速度用） |
| V2 | `Members` 按 email filter、`$top=2`（只對 T1–T4 用） | 每個 email 剛好 1 個；T5／T6 剛好 2 個 |
| V3 | 用 T1 密碼登入（`/auth/login`） | 拎到 token，唔需要收碼 |
| V4 | 用 T1、T2 確認**能約到 LAB 堂**：先問前台喺 PGM 後台手動試約一堂（或者等 G9 批准後用 app 約）——**唔好用工程腳本寫入** | 約得到、唔俾收錢 |
| V5 | 用 T2 `request-otp`（只喺 G9 批准後；會寄真信去團隊信箱） | 收到碼 |
| V6 | 只對 T5／T6：`request-otp` | 409 `AMBIGUOUS_ACCOUNT`，**冇寄碼** |
| V7 | `ClassBookings` 按 T1 會員號 filter、`$top=1` | 量到真實 filter 速度，寫入 `function-review.md` §12 |

## 對應 app 驗收流程（`member-apps-launch-plan.md`「驗收」）

| 步驟 | 用邊個 |
|---|---|
| 登入 → 班表只見 club 45 | T1；T4 驗 LAB app 唔見其他分店 |
| 約堂 → 滿堂候補 → 候補轉正 → 單筆取消（同堂其他預約唔受影響） | T1＋T2（同一堂；T1 佔位、T2 入候補；T1 取消後 T2 轉正） |
| 同日第二堂被拒（每日一堂）、超過 168 小時被拒 | T2 |
| 撞時間被拒、Passport、push | T1／T2 |
| 登出再換帳戶，唔收前一個帳戶 push | T1 ↔ T2 |
| 刪帳戶 → 舊 token 即時失效 | **T3 only** |
| `AMBIGUOUS_ACCOUNT` | T5／T6 |

**給工程嘅備註（唔係開戶要求）**：`booking.service.ts` 嘅 `classDate` 用 `toISOString().slice(0,10)`（UTC 日期）。LAB 時區 UTC+8，開始時間 08:00（HKT）之前嘅堂會算成前一日。LAB 現有堂 10:30 起所以暫時無事，但「同日兩堂」測試要揀同一個**香港日期**，並留意此邊界，必要時修正。

## 密碼處理（重要）

- **密碼只經密碼管理器傳遞**（1Password／Bitwarden 等公司共用保險庫），絕不貼落聊天（WhatsApp、Slack、Claude session）、email、`STATE.md`、PENDING 白板或者呢份檔。
- 建議共用保險庫 `LAB-App-Test`，每個帳戶一條記錄，欄位：會員號、email、密碼、備註（用途、有效期）。T1 嘅條目只畀 Anthony 同負責送審嘅人。
- 重置或者輪換密碼：同一條記錄更新，唔通知密碼本身。
- 送審時 reviewer 密碼會填入 App Store Connect／Play Console 嘅表格欄位（唯一要出保險庫嘅位置）；送審後確認 reviewer 密碼係咪要換（Apple／Google 會見到）。

## Reviewer 備註稿（英文，貼入 App Store Connect「App Review Information」／Play Console「App access」）

> **Fill-in 欄位（唔好貼入呢份檔）**：Sign-in required → username `[T1 email]`、password `[T1 password]` 填入 Apple 嘅 Sign-in 欄位／Google 嘅 App access 憑證欄位。下面備註文字內嘅 `[T3 email]`、`[T3 password]` 送審當日由密碼管理器取，直接填入 Console，**唔好**留低喺 repo。

```
THE LAB by ONYX is a members-only app for existing members of THE LAB by ONYX gym.
There is no in-app sign-up or payment: a membership is created at the gym and the
app signs in with that membership.

SIGN-IN (main review account)
Use the credentials in the "Sign-in required" / "App access" fields (email + password).
Choose "Sign in with password". No email verification code is needed for this account.
This test account has an active membership and no real member data.

WHAT TO TRY WITH THE MAIN ACCOUNT
1. Home, Book (class timetable for THE LAB only), Passport, Profile.
2. Book a class (the timetable shows the next 7 days; one class per day per member).
   You may cancel the booking afterwards from Passport > Bookings.
3. Member pass shows the membership number.
Please cancel any class you book, so real members are not blocked.

DELETE ACCOUNT (separate account)
Account deletion should be reviewed with a dedicated account so that the main account
stays usable:
  email:    [T3 email]
  password: [T3 password]
Sign in with this account, then Profile > Delete account. Deleting the app account
removes your data from the app; it does not cancel the gym membership itself.
A web page for requesting deletion is also available at [deletion URL, G4].

NOTES
- Classes and bookings are real, in a live booking system. We have set up only test
  accounts for review.
- Contact for review questions: [support email, G4]
```

## 完成後填呢張表（**唔好填密碼**）

| 代號 | 用途 | PGM 會員號 | 主店 | 開戶人 | 開戶日 | 會籍到期日 | 標籤／備註已加 | 已入密碼管理器 | 備註 |
|---|---|---|---|---|---|---|---|---|---|
| T1 | reviewer | | club 45 | | | | ☐ | ☐ | |
| T2 | 第二 LAB 會員 | | club 45 | | | | ☐ | ☐ | |
| T3 | 刪帳戶專用 | | club 45 | | | | ☐ | ☐ | |
| T4 | GO24 對照（選） | | | | | | ☐ | ☐ | |
| T5 | 共用 email A（選） | | club 45 | | | | ☐ | ☐ | |
| T6 | 共用 email B（選） | | club 45 | | | | ☐ | ☐ | |

**開戶人／日期要填真名同日期；密碼、密碼提示、驗證碼絕對唔好寫喺呢度。** 填完通知 OFFICE：更新 PENDING 白板 M3 狀態，並通知營運／財務／市場同事剔除呢批會員號。

## 未決／要 Anthony 或前台答

1. 揀邊個免費／零收費計劃（係咪已有員工或內部計劃）？
2. PGM 容唔容許同一 email 開兩個會員（決定 T5／T6 做唔做）？
3. T1 要唔要分 Apple／Google 兩個？
4. 團隊信箱用邊個域名／plus 前綴；保險庫用邊個工具？
5. G9 第一次受控寫入測試嘅日子同能約嘅堂（盡量冇真會員嘅堂）。
