# PGM API Reference (extracted from swagger v2.2)

**Source**: `https://presentation.perfectgym.pl/Api/swagger/docs/v2.2/`
**Swagger version**: 2.0
**Base path**: `/Api/v2.2`
**Spec file**: `docs/pgm-swagger.json` (full 1.4MB)
**Total endpoints**: 371

## Auth scheme

```
Headers (server-to-server):
  X-Client-Id: <our backend client id>
  X-Client-Secret: <our backend client secret>
```

呢個係 B2B API key — 我哋 NestJS backend 用，**唔暴露畀 mobile**。Mobile 永遠經我哋 backend gateway。

---

## 🔐 MemberAuth (11 endpoints) — 認證會員

| Method | Path | 用途 | Request | Response |
|---|---|---|---|---|
| POST | `/MemberAuth/VerifyMemberCredentials` | Email + Password 驗證 | `{email, password}` | `{memberId, status}` |
| POST | `/MemberAuth/VerifyCredentials` | Email **或** Username + Password | `{credentials, password}` | similar |
| POST | `/MemberAuth/SendOneTimeCode` | PGM send OTP（佢哋自己出 SMS / Email） | `{memberId, codeDestination}` | `{}` |
| POST | `/MemberAuth/VerifyOneTimeCode` | 驗 OTP | `{memberId, code}` | `{codeMatches, memberId}` |
| POST | `/MemberAuth/ConfirmMemberEmail` | 確認 email | | |
| POST | `/MemberAuth/ConfirmMemberPhoneNumber` | 確認電話 | | |
| POST | `/MemberAuth/SendEmailConfirmationMessage` | Send 驗證 email | | |
| POST | `/MemberAuth/SendPhoneNumberConfirmationMessage` | Send 驗證 SMS | | |
| GET | `/MemberAuth/GenerateResetPasswordToken` | 由 email 生成 reset token | | |
| GET | `/MemberAuth/GenerateResetPasswordTokenUsingMemberId` | 由 memberId 生成 | | |
| POST | `/MemberAuth/SendResetPasswordLink` | Send reset password link | | |

**OTP code valid 15 min**（per PGM docs）。`codeDestination` enum 可能係 `Email` / `Sms` / `Both`。

⚠️ **Note**：PGM 唔 issue session token 畀會員 — 我哋 backend 認證 OK 後 issue 自己 JWT。

---

## 🚪 AccessControl (8 endpoints) — 出入閘

| Method | Path | 用途 |
|---|---|---|
| POST | `/AccessControl/ValidateMemberVisit` | 驗會籍狀態（用唔用得到入場）|
| POST | `/AccessControl/RegisterMemberVisit` | Log 入場（要 memberId, clubId, enterDate, exitDate, entranceProductId）|
| POST | `/AccessControl/OpenGate` | 🔥 遠端開閘（memberId, deviceId）|
| POST | `/AccessControl/GenerateQrCode` | 出 QR 畀會員 |
| POST | `/AccessControl/GetMemberIdFromQrCode` | 由 QR → memberId |
| POST | `/AccessControl/EndCurrentMemberVisit` | 標記離場 |
| POST | `/AccessControl/ValidateCardScan` | Card-based scan 驗證 |
| POST | `/AccessControl/ConfirmCardScan` | Card-based scan 確認 |

**我哋 Face check-in flow**：
```
1. n8n face match → memberId
2. POST /ValidateMemberVisit → 確認會籍 OK
3. POST /RegisterMemberVisit → 寫 log
4. POST /OpenGate → 真開閘
```

---

## 📅 ClassBooking (5 endpoints) — 團體課

| Method | Path | 用途 |
|---|---|---|
| POST | `/ClassBooking/BookClass` | Book + auto waitlist (return `{bookingId, isStandby}`) |
| POST | `/ClassBooking/BookClassMultipleTimes` | 一次 book 多堂 |
| POST | `/ClassBooking/CancelSingleBooking` | Cancel 單堂 |
| POST | `/ClassBooking/CancelMemberBookingsForClass` | Cancel 全部某堂 |
| POST | `/ClassBooking/SetMembersPresenceOnClass` | 教練標出席 |

**BookClass body**：
```json
{
  "memberId": int,
  "classId": int,
  "bookDespiteOtherBookingsAtTheSameTime": false,
  "seatNumber": null,
  "comments": ""
}
```
**Returns**：`{bookingId, isStandby}` — `isStandby: true` = 候補

---

## 💪 PersonalTrainings (6 endpoints) — PT

| Method | Path | 用途 |
|---|---|---|
| POST | `/PersonalTrainings/BookPersonalTraining` | Book PT |
| POST | `/PersonalTrainings/CancelPersonalTraining` | Cancel PT |
| POST | `/PersonalTrainings/CompletePersonalTrainingBooking` | Mark PT 完成（教練側）|
| POST | `/PersonalTrainings/CompletePaidInArrearsBooking` | Mark paid-after PT 完成 |
| POST | `/PersonalTrainings/GetPersonalTrainerAvailabilitySlots` | 拎教練空檔 |
| POST | `/PersonalTrainings/GetPersonalTrainerAvailabilityBlocks` | 拎可 book block |

**BookPT body**：
```json
{
  "memberId", "personalTrainingDefinitionId", "startDate",
  "clubId", "clubZoneId", "instructorId", "comments"
}
```

---

## 💳 Payments / ClientPortal — 付款

| Method | Path | 用途 |
|---|---|---|
| POST | `/ClientPortal/GeneratePaymentLink` | 🔥 PGM 自己出 payment link！ |
| GET | `/ClientPortal/GetPaymentStatus` | 查 fiscalization status |
| POST | `/Payments/PayWithPrepaidAccount` | 用 prepaid 餘額付 |
| POST | `/Payments/PrepaidTopup` | 充 prepaid |

⚠️ **重要**：`GeneratePaymentLink` 可能 means 我哋唔需要直接駁 Adyen — PGM 已有 payment link 機制（內部行 Adyen / Stripe / 任何 gateway PGM 配置）。需要試下實際 link 點 work。

---

## 📋 Contracts (11 endpoints) — 會籍合約

| Method | Path | 用途 |
|---|---|---|
| POST | `/Contracts/AddContract` | 新會籍 |
| POST | `/Contracts/Cancel` | 取消會籍 |
| POST | `/Contracts/Freeze` / `/DeleteFreeze` / `/UpdateFreeze` | 暫停會籍 |
| GET | `/Contracts/CalculateProrata` | 比例計算 |
| POST | `/Contracts/SimulateNewContract` | 試算新合約 |
| POST | `/Contracts/SignContractDocument` | 簽電子合約 |

---

## 🔗 ClientPortal (7 endpoints) — 跳去 PGM Web

| Method | Path | 用途 |
|---|---|---|
| POST | `/ClientPortal/GenerateLogInUrl` | 🔥 一次性 SSO link 登入 PGM web |
| POST | `/ClientPortal/CreateContractLink` | 跳去新會籍頁 |
| POST | `/ClientPortal/ContractFreezeLink` | 跳去 freeze 頁 |
| POST | `/ClientPortal/ClassesUrl` | 跳去 class calendar |
| POST | `/ClientPortal/GeneratePaymentLink` | 同上 |

**用法**：mobile app 唔想自己 build 嘅 flow（例如複雜 freeze 流程）→ 撳 button → backend 攞 SSO URL → 用 in-app browser 開 PGM web。

---

## 📊 odata (247 endpoints) — Read-only queries

PGM 用 OData 暴露大量讀取 endpoint（members, classes, transactions, schedules, etc）。
**例**：`GET /odata/Members?$filter=Email eq 'foo@bar.com'`
詳細見 swagger spec。

---

## 🎯 我哋唔用 PGM 嘅地方

| 我哋自己做 | 點解 |
|---|---|
| **Face matching** | PGM 無 face check-in API |
| **PT log content**（動作 / 重量 / 相）| PGM 只有 booking + complete，無 exercise log schema |
| **Push notification** | PGM 唔 issue device push |
| **In-app analytics** | 我哋自己 track event |
| **AI booking 推薦**（將來）| 我哋自己 build |

PT log 完成後 call `CompletePersonalTrainingBooking` 通知 PGM「呢堂用咗」，但動作詳情存我哋自己 DB。

---

## ⚠️ 仲要 confirm（你熟 PGM 答到）

- [ ] `codeDestination` enum 真實 value（`Email` / `Sms` / `Phone` / `Both`?）
- [ ] PGM 你哋 instance 用緊 SMS 定 Email 做 OTP delivery？
- [ ] `entranceProductId` — 邊度攞？應該係 club / membership type 設定
- [ ] `OpenGate.deviceId` — 邊度配置？每個閘機一個 ID？
- [ ] `GeneratePaymentLink` 內部 gateway 用緊咩（係咪 Adyen）？
- [ ] PGM webhook 機制有冇？（spec 入面冇見到 webhook config endpoint）
- [ ] 你哋 instance 嘅 base URL（唔係 presentation.perfectgym.pl）
- [ ] X-Client-Id / X-Client-Secret 點申請

---

## Cross-reference

呢份 doc 同 `13-flows.md` 配對使用：
- `13-flows.md` 講我哋 mobile 接 backend 嘅 flow
- `14-pgm-api-reference.md`（呢份）講 backend 接 PGM 嘅 endpoint

Stage 2 PGM Adapter 寫 code 時兩份對住 build。
