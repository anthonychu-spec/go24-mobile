# Stage 1 — Auth (Reuse PGM credentials)

**估時**：1.5 週（簡化咗，原 2 週）
**前置**：Stage 0 merged
**目標**：會員 / 教練用現有 PGM credentials 登入；backend 出自己 JWT；零 OTP / 零 WhatsApp dependency
**狀態**：⚪ 未開

## Auth Flow（confirmed via PGM Swagger v2.2，見 `14-pgm-api-reference.md`）

PGM 用 **B2B API key** (`X-Client-Id` + `X-Client-Secret`) — 我哋 backend 用，唔 issue session 畀會員。我哋認證 OK 後 issue 自己 JWT。

### Option A — Email + Password（簡單，推薦先用）

```
📱 input email + password → POST /auth/login

🟢 backend:
  1. Rate limit (5/min per IP, 3/min per email)
  2. POST PGM /v2.2/MemberAuth/VerifyMemberCredentials {email, password}
     headers: X-Client-Id, X-Client-Secret
  3. PGM returns {memberId, status}
  4. if status != Active → throw MEMBER_INACTIVE
  5. Upsert local users (memberId, email, status)
  6. Issue our JWT (15min access + 30d refresh rotated)
  7. Return {access, refresh, user}

📱 store tokens 落 expo-secure-store → enter app
```

### Option B — OTP（PGM 自帶 send，無需 WhatsApp）

```
📱 input email or phone → POST /auth/request-otp

🟢 backend:
  1. Lookup memberId via OData: GET /odata/Members?$filter=Email eq '...'
     (or PhoneNumber eq '...')
  2. if not found → 404
  3. POST PGM /MemberAuth/SendOneTimeCode {memberId, codeDestination: 'Email'|'Sms'}
     ↑ PGM 自己 send OTP（佢哋自己 SMS gateway / SMTP）
  4. Return {memberIdToken: HMAC(memberId)} (encrypted, expires 15min)

📱 收 SMS / Email OTP → 輸入 6 碼 → POST /auth/verify-otp {memberIdToken, code}

🟢 backend:
  1. Decrypt memberIdToken → memberId
  2. POST PGM /MemberAuth/VerifyOneTimeCode {memberId, code}
  3. PGM returns {codeMatches: bool, memberId}
  4. if false → INVALID_OTP
  5. Upsert local users
  6. Issue JWT + refresh
  7. Return {access, refresh, user}
```

**關鍵**：
- OTP 15 min expire（PGM doc）
- `codeDestination` enum 要確認你 instance 用咩（Email / Sms）
- Option A + B 都可 implement，會員揀（推薦 default A、忘記密碼用 B reset）

### 關鍵 invariants
- 我哋 **唔 store 會員密碼** — forward 去 PGM 一次就算
- PGM B2B API key 喺 backend env，**唔暴露畀 mobile**
- Mobile 永遠經我哋 backend gateway
- JWT signed with our secret, NOT PGM 嘢

## Tasks

### Backend

- [ ] 1.1 DB migration：`users`（id, role, phone, member_code FK, pgm_member_id, last_pgm_sync_at, created_at）
- [ ] 1.2 DB migration：`sessions`（user_id, refresh_token_hash, device_fingerprint, last_seen, revoked, expires_at）
- [ ] 1.3 NestJS `AuthModule` skeleton + JWT strategy + `JwtAuthGuard`
- [ ] 1.4 `POST /auth/login` — receive {email, password} → call `PgmAdapter.verifyMemberCredentials()` → upsert local user → issue JWT + refresh
- [ ] 1.4b `POST /auth/request-otp` — lookup memberId via OData → call `SendOneTimeCode` → return memberIdToken
- [ ] 1.4c `POST /auth/verify-otp` — call `VerifyOneTimeCode` → upsert + issue JWT
- [ ] 1.5 `POST /auth/refresh` — verify refresh token → rotate (issue new refresh, invalidate old)
- [ ] 1.6 `POST /auth/logout` — revoke session by refresh token
- [ ] 1.7 `GET /auth/me` — return current user + role + permissions (decoded from JWT)
- [ ] 1.8 PgmAdapter 加 `IAuthRepo`：`login(credentials)` / `validateToken(pgmToken)` interface + `PgmAuthAdapter` 實現
- [ ] 1.9 Error normalize：PGM `INVALID_CREDENTIALS` / `ACCOUNT_LOCKED` / `MEMBER_INACTIVE` → mobile-friendly message

### Mobile (Member + Trainer)

- [ ] 1.10 Member app login screen：phone + password input → call `/auth/pgm-login`
- [ ] 1.11 Trainer app login screen：same flow（PGM 同一個 login endpoint，role 由 PGM response 決定）
- [ ] 1.12 JWT storage：**`expo-secure-store`**（iOS Keychain / Android Keystore，唔好 AsyncStorage）
- [ ] 1.13 Axios interceptor：attach token + 401 auto-refresh
- [ ] 1.14 Logout flow：call API + clear secure storage + 跳返 login
- [ ] 1.15 i18n setup（`zh-HK` + `en` translation key）

### Security

- [ ] 1.16 🟡 **Biometric re-auth**：30 分鐘 idle 後 / app cold start 要 FaceID / 指紋
- [ ] 1.17 🟡 **Rate limit** on `/auth/pgm-login`：per IP 5/min, per phone 3/min（防 PGM brute force trigger lockout）
- [ ] 1.18 🟡 **Refresh token rotation**：每次 refresh 發新 + revoke 舊
- [ ] 1.19 🟢 `GET /config`：return `min_supported_version`, feature flags

### Tests

- [ ] 1.20 Unit：`AuthService.login` mock PGM adapter（success / wrong pass / locked）
- [ ] 1.21 E2E：login → /auth/me → refresh → logout → /auth/me 401
- [ ] 1.22 Security test：JWT tampered → 401；expired token → 401；revoked refresh → 401

## 驗收

- 會員部手機輸入 PGM 電話 + 密碼 → 入到 app（無需 OTP / 無需 install WhatsApp）
- 30 分鐘冇用 → biometric 重驗
- Logout → JWT revoke，舊 token 用唔到
- PGM 改咗密碼 → 我哋 refresh token 30 日內仲 work（acceptable，refresh 期過咗就要 re-login）

## Open Questions（要確認 PGM）

- [ ] PGM login endpoint URL + request shape (phone? email? member_code? + password format)
- [ ] PGM 返 token format（JWT? opaque session ID? expire policy）
- [ ] PGM 有無 refresh / 用我哋自己 issue 就 OK
- [ ] PGM lock policy（連續 N 次 fail 鎖幾耐）

呢啲你熟 PGM 應該答到，我會 stub PgmAuthAdapter 等你 fill in。

## 後備方案（如 PGM auth 唔可 access via API）

如果 PGM 唔暴露 login API（只有 web SSO）：
- Plan B: PGM 暴露 customer ID / phone → 我哋 issue **WhatsApp OTP**（你有 n8n + WhatsApp）
- Plan C: 教練 email + password 自己 manage，會員初次 onboarding 設密碼

但你話熟 PGM，應該無問題。

## Notes / Decisions

- 唔做 OTP，唔搞 WhatsApp dependency for login
- WhatsApp（n8n）保留做 Stage 4 payment link + Stage 7 critical notifications
- Trusted device flow 暫緩（reuse PGM auth 已經夠順）

## Blockers

(none)
