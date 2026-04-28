# Logic Flows — 每個操作每步運作

呢個 file lock 咗每個關鍵 flow 嘅 step-by-step logic。寫 code 前先確認；寫完 code 對返呢度 verify。

**符號**：
- `📱` mobile app
- `🟢` NestJS backend
- `🟦` Postgres DB
- `🔴` Redis
- `🤖` n8n
- `📦` PGM API
- `💳` Adyen
- `📨` Outbox dispatcher

---

## 1. App Launch / Cold Start

```
📱 開 app
   1. 讀 expo-secure-store 攞 JWT + refresh
   2. GET /config (帶 app version)
🟢 /config:
   - 返 {min_supported_version, feature_flags, api_status}
📱 收到 response:
   - if app version < min_supported → 鎖死 + 「請升級」modal（連 link）
   - else 繼續
   3. if 有 JWT → GET /auth/me 驗 token still valid
🟢 /auth/me:
   - JwtAuthGuard 驗 JWT signature + expiry
   - if revoked session → 401
   - 返 user payload
📱
   - 200 → 入 main app (dashboard)
   - 401 → 試 refresh token
        → if refresh OK → retry /auth/me
        → if refresh fail → 跳 login screen + clear secure store
   - if 完全冇 JWT → login screen
```

**冷啟動時間目標**：< 1.5 秒見 dashboard（含 /config + /auth/me 並行 call）

---

## 2. Login (Reuse PGM credentials)

```
📱 用戶輸入 phone + password → 撳 Login

🟢 POST /auth/pgm-login {phone, password, deviceFingerprint}
   1. Validate input shape (phone format / password length)
   2. Rate limit check (per-IP 5/min, per-phone 3/min)
   3. PgmAuthAdapter.login({phone, password})
        → 📦 POST /pgm/login {phone, password}
        → if 200 → {pgmMemberId, role, pgmToken, expiresAt}
        → if 401 → throw InvalidCredentialsError
        → if 429 → throw PgmLockedError
        → if timeout → throw TempFailError (return 503 to mobile)
   4. Upsert local user:
🟦      INSERT INTO users (phone, member_code, pgm_member_id, role, last_pgm_sync_at)
        ON CONFLICT (phone) DO UPDATE SET pgm_member_id, role, last_pgm_sync_at
        RETURNING id, role
   5. 生成 access token (JWT, 15 min) + refresh token (UUID, 30 日)
   6. INSERT sessions (user_id, refresh_token_hash, device_fp, expires_at)
🟦      hash refresh token before storing (bcrypt or sha256)
   7. Cache PGM token in Redis (key: pgm_token:{userId}, TTL = pgmToken.expiresAt)
🔴      之後 PgmAdapter 用呢個 token call PGM
   8. Return {access, refresh, user}

📱
   - Save access + refresh 落 expo-secure-store
   - Save deviceFingerprint
   - 跳 dashboard
```

**Errors**:
| Internal code | Mobile display |
|---|---|
| `INVALID_CREDENTIALS` | 電話或密碼錯誤 |
| `MEMBER_INACTIVE` | 你嘅會籍已暫停，請聯絡櫃台 |
| `RATE_LIMITED` | 試太多次，請 N 分鐘後再試 |
| `TEMP_FAIL` | 系統繁忙，請稍後再試 |

---

## 3. Token Refresh (rotation)

```
📱 axios interceptor 收到 401:
   1. 讀 refresh token from secure store
   2. POST /auth/refresh {refreshToken}

🟢 /auth/refresh:
   1. Hash incoming token
🟦 SELECT FROM sessions WHERE refresh_token_hash = ? AND revoked = false
        AND expires_at > NOW()
        FOR UPDATE
   2. if not found → 401 (force re-login)
   3. **Rotate**:
🟦      UPDATE sessions SET revoked = true WHERE id = current
🟦      INSERT new sessions row (new refresh hash, same device_fp, expires_at + 30d)
   4. Issue new access JWT
   5. Return {access, refresh}

📱
   - Replace tokens in secure store
   - Retry original request with new access
```

**Replay attack 防禦**：if 同一 refresh 用 2 次 → 第二次 hit revoked → 提示「session 被偷」+ revoke ALL sessions for this user + WhatsApp 通知 user。

---

## 4. List Classes (read)

```
📱 撳 Classes tab → 揀日期 → 撳 club filter
   GET /classes?date=2026-04-25&club=Taikoo&favourite=true

🟢 /classes:
   1. JwtAuthGuard
   2. Cache check:
🔴      key = classes:Taikoo:2026-04-25 (TTL 60s)
        if hit → use cached + per-user enrich
   3. if miss:
        PgmAdapter.listClasses({date, branch})
        → 📦 GET /pgm/classes?date=&branch=
        → axios timeout 3s, retry 2x on 5xx
        → opossum circuit breaker check
   4. Cache result (60s)
   5. Per-user enrich:
🟦      SELECT class_id, status FROM bookings
        WHERE user_id = ? AND class_id IN (?,?,...)
   6. Merge: 每個 class 加 myBookingStatus (none/booked/waitlist/attended)
   7. Apply filter (favourite → load user.favourite_class_ids first)
   8. Return list

📱 Render list:
   - 每個 item: 時間、教練、capacity、my status badge
   - 滿但 my=none → 顯示「候補 N 人」
```

**Cache invalidation**：booking webhook from PGM → invalidate `classes:{branch}:{date}` 受影響嘅 key。

---

## 5. Book a Class（最複雜，core flow）

```
📱 撳 + button on class
   1. 自動 generate UUID v4 idempotencyKey 一次（同次撳唔 regenerate）
   2. POST /bookings
      Headers: Idempotency-Key: <uuid>
      Body: {classId, acceptWaitlist: true|false}

🟢 /bookings:
   1. JwtAuthGuard
   2. **Atomic idempotency claim**:
🟦      INSERT INTO idempotency_keys (user_id, key, endpoint, status)
        VALUES (?, ?, 'POST /bookings', 'in_flight')
        ON CONFLICT (user_id, key) DO NOTHING
        RETURNING *
   3. if conflict:
        SELECT * FROM idempotency_keys WHERE (user_id, key) = ?
        if status = 'done' → return cached response
        if status = 'in_flight' → return 409 IN_PROGRESS (client retry-after)
   4. Create local booking:
🟦      INSERT INTO bookings (user_id, class_id, idempotency_key,
                              status='pending', source='local', version=1)
        RETURNING id
🟦      INSERT INTO booking_events (booking_id, from_state=null, to_state='pending',
                                     reason='user_initiated', actor=user_id)
   5. Begin try {
        BookingRepo (= PgmBookingAdapter).bookClass({classId, userId, acceptWaitlist})
        → 📦 POST /pgm/bookings ...
        → 200 confirmed → {externalId, status='confirmed'}
        → 200 waitlist → {externalId, status='waitlist', waitlistPosition: 3}
        → 409 full → throw BookingFullError
        → 409 duplicate → throw DuplicateBookingError
        → timeout / 5xx → throw TempFailError
   6. } catch (err) {
        errorCode = mapPgmError(err)  // BOOKING_FULL / DUPLICATE / TEMP_FAIL ...
        finalStatus = errorCode === 'TEMP_FAIL' ? 'pending_verify' : 'failed'
🟦      UPDATE bookings SET status=finalStatus, error_code=errorCode WHERE id=bookingId
🟦      INSERT booking_events transition

        // Cache result type
        resultKind = (errorCode === 'TEMP_FAIL') ? 'transient' : 'terminal'
🟦      UPDATE idempotency_keys SET status='done', response={success:false, error:errorCode},
                                    result_kind=resultKind, completed_at=NOW()
        // transient → 唔 cache 永久，client 24h 後可以重試
        if (resultKind === 'transient') → DELETE 該 row 即時
        throw err  // map to HTTP via NestJS exception filter
   7. }

   8. Success path:
🟦      UPDATE bookings SET status=pgmResult.status, external_id=pgmResult.externalId,
                            updated_at=NOW(), version=version+1
🟦      INSERT booking_events transition (pending → confirmed/waitlist)
🟦      INSERT outbox_events (topic='booking.created', payload={bookingId, userId, classId})
        ↑ 同 booking update 喺同一 DB transaction (Transactional Outbox)

   9. Schedule shadow read:
        BullMQ.add('verify-booking', {bookingId, externalId, userId},
                   {delay: 2000, attempts: 3})

  10. Cache idempotency:
🟦      UPDATE idempotency_keys SET status='done', response={success:true, bookingId, status},
                                    result_kind='terminal', completed_at=NOW()

  11. Return {bookingId, status, waitlistPosition?}

📨 Outbox dispatcher (every 1s):
   - SELECT * FROM outbox_events WHERE dispatched_at IS NULL LIMIT 100
   - For each: 🔴 publish to Redis Pub/Sub topic
   - UPDATE dispatched_at = NOW()

🤖 BullMQ shadow read worker (after 2s delay):
   - 📦 GET /pgm/members/{userId}/bookings
   - if externalId NOT in list:
        log {event: 'pgm_ghost_booking', bookingId, externalId}
        Sentry alert
🟦      UPDATE bookings SET status='pending_verify' WHERE id=bookingId
   - else: ✅ confirmed truly

📨 Notification dispatcher (subscribes to booking.created):
   - 📱 Expo push to user.deviceTokens: "已 book {className}"
🟦  INSERT notifications row (user_id, type='booking_confirmed', payload, read=false)

📱 Receive response:
   - Show success modal with: 加 calendar / 設提醒 / 睇我 bookings
```

---

## 6. Cancel Booking

```
📱 my bookings → 撳 booking → 撳 Cancel
   DELETE /bookings/:id
   Headers: Idempotency-Key: <uuid>

🟢 /bookings/:id DELETE:
   1. JwtAuthGuard
   2. Idempotency claim (same as book)
🟦 3. SELECT booking WHERE id=? AND user_id=?  // ownership check
        if not found → 404
        if status NOT in (confirmed, waitlist) → 409 invalid state
   4. Check cancellation policy:
        cutoff = class.start_at - X hours (X 由 PGM 決定)
        if NOW() > cutoff → 409 CANCEL_TOO_LATE
   5. PgmAdapter.cancelBooking(externalId)
        → 📦 DELETE /pgm/bookings/{externalId}
   6. Update local:
🟦      UPDATE bookings SET status='cancelled', updated_at=NOW(), version+1
🟦      INSERT booking_events transition
🟦      INSERT outbox_events (topic='booking.cancelled', payload={bookingId, classId})
   7. Schedule shadow verify cancel
   8. Cache idempotency response
   9. Return {success:true}

📨 Outbox:
   - Notification: 「已取消 {className}」
   - if waitlist 有人 → publish topic='waitlist.promote' (Stage 7 詳)
```

---

## 7. Waitlist Promotion (auto)

```
🤖 PGM webhook / polling 收到 waitlist 升位 event
   POST /webhooks/pgm {event: 'waitlist.promoted', userId, bookingId, ...}

🟢 webhook handler:
   1. Verify signature (HMAC)
   2. UPDATE bookings SET status='confirmed', version+1, updated_at=NOW()
                          WHERE external_id=?
   3. INSERT booking_events
   4. INSERT outbox_events (topic='waitlist.promoted')

📨 Notification dispatcher:
   - Expo push「候補升位 — {className}」
🤖 - 同時 trigger n8n: WhatsApp send（critical notification）
   - User 必須 5 分鐘內 confirm（policy 定）
🟦 - INSERT notification (action_required=true, expires_at=NOW()+5min)

📱 User 收 push → 開 app 撳 confirm/decline → POST /bookings/:id/waitlist-confirm
```

---

## 8. Face Enrollment（Trainer side）

```
📱 Trainer app → Members → 揀會員 → 「Enroll Face」
   1. 開相機 → 連續影 5 張（不同角度）
   2. 每張 < 200KB（compressed）
   3. POST /face/enroll/:memberId multipart 5 images

🟢 /face/enroll:
   1. JwtAuthGuard + role=trainer + same branch check
   2. Check member consent:
🟦      SELECT face_consent FROM users WHERE id=memberId
        if not opted-in → 409 NO_CONSENT (trainer 要先帶會員睇 consent screen)
   3. For each image:
        Validate (size, format, single face detected by exif/quick check)
        Upload temp 去 R2 with signed URL (TTL 5 min)
   4. POST 去 n8n webhook /face-enroll {memberId, imageUrls[]}
🤖 n8n workflow:
        - For each imageUrl:
            Fetch image
            Call AWS Rekognition IndexFaces (collection_id = 'go24-members')
            Get faceId + 128d embedding vector
        - Average 5 embeddings → final vector
🟦      - INSERT face_embeddings (member_code, vector pgvector,
                                  enrolled_at=NOW(), enrolled_by=trainerId)
        - DELETE temp images from R2 (privacy)
        - Return {success, faceId}
   5. 🟢 update users.face_enrolled_at
   6. 📨 outbox push to member: 「人臉已登記成功」

📱 Trainer 見 success ✅
```

---

## 9. Face Check-in（旗艦 feature）

```
📱 會員 dashboard → 撳大「Face Check-in」
   1. 開 full-screen camera (expo-camera)
   2. Auto-capture 第一張清晰人臉（vision-camera frame processor）
   3. Compress < 100KB
   4. POST /checkin/face multipart {image, branch=auto-detect-by-geofence}

🟢 /checkin/face:
   1. JwtAuthGuard
   2. Quick image validate (size, single face detected)
   3. Upload R2 temp (signed URL TTL 60s)
   4. POST 去 n8n /face-match {imageUrl, branch}
🤖 n8n match workflow:
        - AWS Rekognition SearchFacesByImage (collection 'go24-members', threshold 85)
        - if 有 match → return {memberId, similarity}
        - else → return {match: false}
   5. 🟢 收 n8n response (timeout 3s):
        if match:
🟦         SELECT * FROM users WHERE id=matchedMemberId
           Validate JWT user_id == matchedMemberId  // 防偷樣
           if mismatch → log security event + return 403
🟦         INSERT checkins (member_code, branch, method='face',
                            similarity_score, at=NOW())
🟦         INSERT outbox_events (topic='checkin.success')
           PgmAdapter.recordCheckin({memberId, branch, at})  // sync 入 PGM
           if 有 gate API → trigger 開閘
           Return {status:'ok', member: {name, membership_summary}}
        else:
           INSERT checkins (member_code=null, branch, method='face',
                            similarity_score=0, at, status='fail')
           Return {status:'fail', message: '請再試一次或用 QR'}
   6. R2 image auto-delete (TTL 5 min)，n8n 處理完即 delete

📱 收 response:
   - Success → 全屏綠 ✅ + name + 會籍 / PT 餘堂 + haptic + 自動 close 5s
   - Fail → 紅 + 「再試」/「用 QR」button
   - Network error → cache image local + queue retry (offline support)
```

**Privacy**：image 從來唔 store；只有 embedding vector store；R2 temp file 5 分鐘 auto-delete。

---

## 10. Renewal Payment (Adyen)

```
📱 Memberships → 撳 「續會」
   POST /memberships/renew {planId}

🟢 /memberships/renew:
   1. JwtAuthGuard
🟦 2. SELECT plan FROM membership_plans WHERE id=? AND active=true
        ↑ Server-side price lookup (don't trust client)
   3. Generate idempotent reference: ref = `renewal-{userId}-{planId}-{yyyymmdd}`
🟦 4. INSERT invoices (user_id, plan_id, amount, currency, status='pending', adyen_ref=ref)
   5. 💳 POST Adyen Pay-by-Link API:
        {amount, currency, reference: invoiceId, returnUrl, expiresAt: NOW()+1h}
        → returns {url, expiresAt}
   6. UPDATE invoices SET adyen_link=url, expires_at=...
🟦 7. INSERT outbox_events (topic='payment.link_generated', payload={userId, link, expiresAt})

📨 Outbox dispatcher → n8n:
🤖    n8n workflow `outbox-payment-link`:
        WhatsApp send template (you've already approved):
        "Trudy，你的續會付款連結 https://... 1 小時內有效"

📱 user 收 WhatsApp → 撳 link → Adyen 收銀台付款
   ↓ Adyen 回調

💳 → POST /webhooks/adyen
🟢 webhook:
   1. **Verify HMAC signature** (Adyen sign each event)
   2. Idempotency: skip if pspReference already processed
🟦 3. Match invoice by reference
   4. event = AUTHORISATION + success=true →
🟦      UPDATE invoices SET status='paid', paid_at=NOW(), psp_reference
        PgmAdapter.extendMembership({userId, planId, days})  // 通知 PGM 加日期
🟦      INSERT outbox_events (topic='payment.success')

📨 Outbox → n8n WhatsApp + push:
   "續會成功！會籍延長至 2027-04-25"

📱 user 收通知 → 開 app → 見 Memberships 已 update
```

**Failure handling**：
- Adyen webhook 重試多次 → idempotency skip dup
- 1 小時 link expire 但用戶遲咗付 → invoice 變 expired，要重 generate
- Payment auth fail → notification「付款失敗，請重試」

---

## 11. PT Log Submission (Trainer)

```
📱 Trainer app → 完 PT 後撳「填 log」
   POST /trainer/pt/:sessionId/log
   {exercises: [{name, sets:[{reps, weight}], notes}], note, mediaUrls?[]}

🟢:
   1. JwtAuthGuard role=trainer
🟦 2. SELECT pt_sessions WHERE id=? AND trainer_id=jwt.userId
        if not own → 403
   3. Validate exercises (Zod schema)
   4. if mediaUrls: validate each is a R2 signed url uploaded earlier
🟦 5. INSERT pt_logs (session_id, agreement_id, member_code, trainer_code, session_at,
                      exercises JSONB, notes, media_urls JSONB)
   6. UPDATE pt_sessions SET status='completed', completed_at=NOW()
   7. PgmAdapter.markPtCompleted(externalId)  // PGM 自己會扣堂數
🟦 8. INSERT outbox_events (topic='pt.completed', payload={memberId, summary})

📨 Outbox → push to member:
   "Skylar 完成你的 PT — 點擊查看訓練紀錄"

📱 Member app → PT 詳情頁 see new log entry with exercises + media
```

---

## 12. Logout

```
📱 settings → Logout
   1. POST /auth/logout {refreshToken}
   2. Clear secure store
   3. 跳 login screen

🟢 /auth/logout:
🟦 1. UPDATE sessions SET revoked=true WHERE refresh_token_hash = hash(?)
   2. 🔴 DELETE pgm_token:{userId}  // forget cached PGM token
   3. Return 204
```

---

## 13. Pending → pending_verify Reconcile (BullMQ cron)

```
🤖 每 5 min 跑：
   1. SELECT * FROM bookings
      WHERE status IN ('pending', 'pending_verify')
        AND updated_at < NOW() - INTERVAL '60 seconds'
      LIMIT 100
   2. For each:
        PgmAdapter.getBooking(externalId or by classId+userId)
        if PGM has confirmed → UPDATE status='confirmed'
        if PGM has cancelled/missing → UPDATE status='failed', error_code='ABANDONED'
        if PGM still error → keep pending_verify, increment retry_count
   3. INSERT booking_events for each transition
   4. If retry_count > 10 → flag manual review, Sentry alert
```

---

## 14. PGM Webhook Inbound (Tier 1 sync)

```
📦 PGM 發送 event:
   POST /webhooks/pgm
   Headers: X-Pgm-Signature: <hmac>
   Body: {eventType, entityType, entityId, payload, occurredAt}

🟢:
   1. Verify HMAC signature → if fail 401
   2. Idempotency: SELECT * FROM pgm_webhook_events WHERE eventId=?
      if exists → 200 (already processed)
🟦 3. INSERT pgm_webhook_events (eventId, eventType, raw, received_at)
   4. Switch eventType:
      - booking.created/updated → upsert local booking, emit booking.synced event
      - booking.cancelled → update status='cancelled'
      - membership.extended → update users.membership_end
      - waitlist.promoted → handle waitlist promotion (flow 7)
      - class.cancelled → cascade update bookings + push notifications
   5. 200 OK

📨 Conflict detection:
   - if local.version > pgm.version AND local.updated_at > pgm.occurredAt
     → potential conflict (both sides changed)
🟦   - INSERT conflict_log (entity, local_state, remote_state, resolved=false)
     - Sentry alert
     - Phase 1: PGM wins (overwrite local)
     - Phase 2: LOCAL wins (skip update)
```

---

## 15. Force Upgrade Modal Flow

```
📱 startup:
   1. GET /config → {min_supported_version: '1.4.0'}
   2. compare to bundled version (e.g. '1.2.0')
   3. if behind:
        Show full-screen modal:
          「app 已過期，請升級至最新版本」
          [Update] button → 開 App Store / Play Store link
        Block all interaction
   4. else: 繼續 startup (flow 1)

🟢 /config 邏輯:
   - 讀 cache (Redis 5 min TTL)
   - 返 hardcoded latest releases for iOS/Android
   - 緊急 disable features 用 feature_flags
```

---

## 16. Offline Behavior（mobile）

```
📱 Network state monitor (NetInfo):
   - Online → normal
   - Offline →
        1. 顯示頂部 banner「離線模式 — 部分功能受限」
        2. Read endpoints 用 cache (TanStack Query 30 min staleTime)
        3. Write endpoints (book / cancel / face check-in):
            - Queue 入 local AsyncStorage outbox
            - 顯示「已 queue，網絡恢復會 retry」
        4. Reconnect:
            - Replay queue（注意 idempotency-key 唔變）
            - if 任何 success → toast「已同步」
            - if 失敗 → 留隊列再 retry
```

**例外**：face check-in 唔 queue（時間敏感），fail 就提示用 QR fallback。

---

## 17. App Termination / Background

```
📱 onBackground:
   - 即時 blur UI（防 task switcher 偷睇）
   - 暫停所有 polling
   - 唔 logout，session keep

📱 onForeground:
   - Re-trigger /config
   - if 已過 30 分鐘 idle → 要 biometric 重驗
   - Refresh active screen data
```

---

## 18. Trainer 帶堂簽到

```
📱 Trainer app → today schedule → 撳 class → 「開始簽到」

🟢 GET /trainer/classes/:id/attendance
   返 enrolled members list (with face_enrolled flag)

📱 Trainer 揀 mode:
   A. Face scan：每個 member 行過嚟 face check-in（重用 flow 9 邏輯）
   B. Tap manually：揀名 → 「已到」

🟢 POST /trainer/classes/:id/checkin {memberId, method}
   1. Validate trainer is assigned to this class
🟦 2. UPDATE bookings SET status='attended', attended_at=NOW(), check_in_method=?
        WHERE class_id=? AND user_id=?
   3. INSERT booking_events
   4. 📨 outbox event for analytics

📱 完堂後：
   POST /trainer/classes/:id/finalize
   Mark all 'confirmed' but not 'attended' as 'no_show'
```

---

## 19. Trainer Commission Calculation

```
📱 Trainer app → Me → 「我嘅佣金」
   GET /trainer/commission?month=2026-04

🟢:
   1. JwtAuthGuard role=trainer
   2. trainerId = jwt.userId  // server-enforced，client 唔可以 specify 別人
🟦 3. SELECT pt_logs WHERE trainer_code=? AND session_at BETWEEN month_start AND month_end
        AND completed=true
   4. count by agreement_type (e.g. PT-30min vs PT-60min 不同 rate)
   5. 計：
        commission = sum(rate_per_session × count)
   6. 返 {month, total, breakdown: [{type, count, rate, subtotal}]}

📱 顯示：
   「3 月 2026: 28 堂 × HK$120 = $3,360」
   detail 撳入睇每堂日期 + member name
```

---

## Cross-cutting：JWT Validation per request（每 endpoint）

```
🟢 JwtAuthGuard:
   1. Extract Bearer token from header
   2. Verify signature (HS256 or RS256 with rotated key)
   3. Decode payload {sub: userId, role, exp, iat, jti}
   4. Check exp > NOW() → if expired → 401
   5. 🔴 Check Redis blacklist: blacklisted_jti:{jti} → if present → 401
   6. Attach req.user = {id, role}
   7. Continue

Logout / revoke 加 jti 入 Redis blacklist (TTL = remaining JWT life).
```

---

## Cross-cutting：Rate Limiting

```
🟢 RateLimitInterceptor (Redis-backed sliding window):
   每 endpoint config:
   - /auth/pgm-login: 5/min per IP, 3/min per phone
   - /bookings POST: 10/min per user
   - /checkin/face: 30/min per user (防 retry abuse)
   - /classes GET: 60/min per user
   Default: 100/min per user

   if exceeded → 429 + Retry-After header
```

---

## Cross-cutting：Audit Log（admin actions）

```
任何 admin / sensitive action 寫一行：
🟦 INSERT audit_log (actor_id, action, entity_type, entity_id, before, after, ip, ua, at)
Append-only，唔可以 UPDATE / DELETE，DB role 限制。
Examples:
- Manual booking cancel (admin)
- Member data export
- Face embedding delete
- Trainer commission rate change
```

---

## Verification Steps（每個 flow 寫完 code 後行）

每個 flow 都要：

1. **Happy path** integration test
2. **Each error path** test（mock 出嚟）
3. **Idempotency** test（call 多次 same key）
4. **Concurrent** test（兩個 request 同時撞）
5. **DB invariant** check（state machine valid transitions）
6. **External call mock** test（PGM 唔 reachable / timeout / 5xx）

---

## Open / TBD（你 confirm 或 PGM 答後 fill）

- [ ] PGM login endpoint 真實 path / shape
- [ ] PGM webhook 支唔支援、event types
- [ ] PGM cancellation policy（幾耐前可以 cancel）
- [ ] PGM 是否扣 PT session 自動 / 我哋要主動 mark
- [ ] 閘機 hardware 開閘 API / 訊號
- [ ] Adyen 經 PGM 定我哋自己 generate link
- [ ] Refund flow（Stage 4 之後）
