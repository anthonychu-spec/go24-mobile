# Plan: Replace Perfect Gym Pro with Custom Member + Trainer Apps

## Context

目前 gym 用緊 Perfect Gym Pro (PGM)，已經有 n8n 每日將 PGM 數據 import 入自己 Postgres (`gym_members`, `gym_sales`, `gym_pt`)，加埋一個 WhatsApp AI bot 畀老闆查數。

用戶想自起兩個 mobile app **取代 PGM 前端**：
- **Member App**（會員用）：book 堂、續會、查 PT 餘堂、出入閘、簽到
- **Trainer App**（教練用）：睇更表、帶堂簽到、寫 PT log、睇佣金 / PT agreement

目標：**先 co-exist**（Phase 1: app 透過 PGM API 做主要 CRUD，自己 DB 做 AI/報表），**再逐步 replace**（Phase 2: 自己 DB 變 source of truth），最終可以停用 PGM。

---

## Tech Decisions

| 層 | 選擇 | 理由 |
|---|---|---|
| Mobile | **React Native + Expo (EAS Build)** | 一套 codebase 出 iOS+Android；Member/Trainer 兩個 app 共用 shared package (auth, API client, design system) |
| Backend API | **NestJS (Node.js) on Postgres** | TypeScript 同 RN 共通；NestJS module 結構清晰；方便以後 swap PGM adapter 為 native logic |
| Auth | **Reuse PGM credentials** — backend forward {phone, password} 去 PGM login → issue 自己 JWT (15min) + refresh (30 日 rotated) | 會員零 onboarding（已有 PGM 帳號）；無 OTP / 無 WhatsApp dependency；migration 順 |
| Realtime | **Postgres LISTEN/NOTIFY 或 Supabase Realtime** (booking availability) | Book 堂時 concurrent 爭位要即時反映 |
| Face Detection | **App 端純影相上傳；matching engine 延後決定**（AWS Rekognition / Azure Face / 自 host face-api.js，n8n 階段再 benchmark 揀）| App 只定義 contract：`POST /checkin/face` with image → 收 `{status, member}`。Engine 可以 swap，唔 block mobile dev |
| Payment | **Adyen Pay by Link**（現有 gateway）| 後端 call Adyen API 生成 link → WhatsApp send → webhook 收 payment event。無 in-app payment |
| Infra | **Self-host**（現有已經有 n8n + Postgres）+ Cloudflare Tunnel 出 public | 沿用，但要加 Redis / Replica / Queue / 每日 backup（見下）|
| Multi-branch | `branch_id` 加入 `classes`/`bookings`/`trainers`/`checkins` | 5+ 店要分得清，會員可跨店 book |
| **i18n** | **`i18next` + `react-i18next`** 中英切換 | Translation key 集中喺 `packages/i18n/zh-HK.json` + `en.json`；Stage 1 起就要 lock key naming convention |
| **Time zone** | **TIMESTAMPTZ 全部 column；server UTC；mobile display HKT** | 5+ 店全部 HK，但 server 跑 UTC 防多區擴張 |
| **Offline strategy** | **Cache-first（read）+ Outbox queue（write）** | 入閘 / book 堂可能網絡差；class list cache 5 min；book / check-in 寫入 client outbox queue 重試 |
| **App version control** | **`GET /config` 返 `min_supported_version`** + force-upgrade modal | Backend breaking change 唔會炒舊 mobile app |
| **Feature flag** | **GrowthBook self-host** 或 ConfigCat free tier | Stage 9 beta cohort rollout、A/B test |

---

## System Architecture

```
┌─────────────────┐   ┌─────────────────┐
│  Member App     │   │  Trainer App    │   React Native (Expo)
│  (iOS+Android)  │   │  (iOS+Android)  │
└────────┬────────┘   └────────┬────────┘
         │                     │
         └──────────┬──────────┘
                    │ HTTPS (JWT)
                    ▼
         ┌──────────────────────┐
         │  NestJS API Gateway  │   ← 自己寫
         │  /auth /booking      │
         │  /checkin /pt /...   │
         └──────┬───────────────┘
                │
      ┌─────────┼───────────┬────────────────┐
      ▼         ▼           ▼                ▼
   ┌──────┐ ┌────────┐ ┌──────────┐   ┌─────────────┐
   │ Own  │ │ PGM    │ │ Face     │   │ WhatsApp /  │
   │ PG   │ │ REST   │ │ Embedding│   │ Stripe link │
   │ DB   │ │ API    │ │ Service  │   │ (via n8n)   │
   └──────┘ └────────┘ └──────────┘   └─────────────┘
      ▲         ▲
      │         │  (Phase 1: PGM 為 write source)
      └─── n8n daily import ────
```

### Phase 1 (MVP, 3-4 個月)
- App 所有 booking / payment / membership update 行 **PGM REST API** (透過 gateway adapter)
- 自己 Postgres 繼續做 read-side（AI bot, 報表, face embedding store）
- Gateway 有 adapter pattern：`IBookingRepo` → `PgmBookingAdapter`

### Phase 2 (6-12 個月後)
- 將 booking / class schedule / check-in 改為寫返自己 DB
- Adapter swap：`IBookingRepo` → `NativeBookingAdapter`
- PGM 降級為 archive / payroll only，最終停用

---

## MVP Feature Scope

### Member App
1. **Login** — phone + WhatsApp OTP
2. **Dashboard** — 會籍到期日、PT 餘堂、下一堂時間
3. **Book 堂** — 團體課 list / 篩選分店、時段、教練；即時睇名額；加入 waitlist
4. **My Bookings** — 睇未來 / 過往堂；cancel (>X 小時前)
5. **PT Session 查詢** — 睇總堂/已用/剩餘；下次預約
6. **Face Check-in（🌟 旗艦 feature，新 app 賣點）**
   - Dashboard 最大 tile，一撳即開相機
   - 流程：開相機 → auto detect 面（唔使撳掣）→ 連續 capture 2-3 張 → upload → n8n match → 1-3 秒內返 pass/fail
   - 成功：全 screen 綠色 ✅ + 「歡迎 Trudy」+ 會籍 / PT 餘堂資訊 + haptic feedback
   - 失敗：提示「再試多次」或「用 QR code」
   - **離線 fallback**：network 差時自動 fallback QR code
   - **閘機對接**：成功後 server push signal 開閘（如果閘機有 API；否則 staff 睇 app 放行）
7. **QR Check-in（fallback，保留）** — 如 face 失敗 / 唔肯用；Dashboard 細 tile
7. **續會 / 買 package** — 揀 plan → app 生成 invoice link → WhatsApp send link
8. **Profile** — 改電話、看交易紀錄

### Trainer App
1. **Login** — email + password（加 2FA optional）
2. **我的更表** — 今日 / 本週團體課 + PT 預約
3. **帶堂簽到** — 開堂時 scan 會員樣 / QR 簽到；標 no-show
4. **PT Log** — 每次 PT 之後記錄：動作、重量、組數、備註；會員 app 睇到
5. **PT Agreement 查詢** — 每個會員個 agreement、堂數、到期
6. **我的佣金** — 當月 / 上月 PT 堂數 × commission rate = 應收（呼應現有 PGM vs PT Agreement 對數 workflow）
7. **Face Enrollment** — 為新會員 enrol 人臉（影 3-5 張）→ upload → n8n 抽 embedding 存 DB

### 唔包喺 MVP
- Staff / admin web dashboard（用現有 PGM web 先）
- 多分店 inventory
- 會員間社交 / leaderboard
- Wearable integration

---

## Data Model (新增 table，喺現有 `gym_members` DB 加)

```sql
-- Auth
users (id, role [member|trainer], phone, email, password_hash, member_code FK, trainer_code, created_at)
otp_codes (phone, code, expires_at, used)
sessions (user_id, jwt_id, device, last_seen, revoked)

-- Booking (Phase 1: mirror PGM；Phase 2: authoritative)
classes (id, pgm_class_id, branch, coach_code, type, start_at, end_at, capacity, booked_count,
         last_synced_at, source, version)
bookings (id, user_id, class_id, external_id,  -- external_id = PGM id Phase 1，phase 2 可 null
          status [pending|confirmed|failed|waitlist|cancelled|pending_verify|attended|no_show],
          idempotency_key UNIQUE, error_code, created_at, updated_at,
          last_synced_at, source, version)
booking_events (id, booking_id, from_state, to_state, reason, actor, at)  -- audit
idempotency_keys (user_id, key, endpoint, status [in_flight|done], response JSONB,
                  result_kind [terminal|transient], created_at, completed_at, expires_at,
                  PRIMARY KEY (user_id, key))    -- composite 防跨 user 碰撞
outbox_events (id, topic, payload JSONB, created_at, dispatched_at)  -- transactional outbox

-- Check-in
face_embeddings (member_code, vector (pgvector 128d), enrolled_at, enrolled_by_trainer)
checkins (id, member_code, branch, method [face|qr|manual], matched_score, at)

-- PT
pt_logs (id, agreement_id, trainer_code, member_code, session_at, exercises JSONB, notes)

-- Outbox (invoice links etc) — message dispatch (separate from outbox_events)
outbox_messages (id, to_phone, channel [whatsapp|email], template, payload, sent_at, status)
```

**Time zone convention**：所有 timestamp column 用 `TIMESTAMPTZ`（with timezone）。Server / Postgres 跑 UTC，Mobile app 顯示時 convert HKT (Asia/Hong_Kong)。`class.start_at` 一定 with timezone，避免「14:30 點解係 UTC 22:30」嘅災難。

**Key indexes**（5000 會員 / 多店場景）：
```sql
CREATE INDEX idx_bookings_user_status_class ON bookings(user_id, status, class_id);
CREATE INDEX idx_classes_branch_starttime  ON classes(branch, start_at);
CREATE INDEX idx_checkins_member_at        ON checkins(member_code, at DESC);
CREATE INDEX idx_idempotency_expires       ON idempotency_keys(expires_at);
CREATE INDEX idx_outbox_pending            ON outbox_events(dispatched_at) WHERE dispatched_at IS NULL;
```

Reuse 現有：`members`, `gym_sales.*`, `gym_pt.*`。用 **pgvector extension** 做 face embedding similarity search。

---

## Critical Files / Modules (預期)

```
/perfect-gym-replacement
  /apps
    /member-app              React Native (Expo)
      app/(auth)/login.tsx
      app/(tabs)/book.tsx
      app/(tabs)/checkin.tsx
      app/(tabs)/pt.tsx
    /trainer-app             React Native (Expo)
      app/(tabs)/schedule.tsx
      app/(tabs)/pt-log.tsx
      app/(tabs)/commission.tsx
  /packages
    /shared-ui               共用 component + theme
    /api-client              auto-gen from OpenAPI
    /face-sdk                wrap Expo FaceDetector + embedding upload
  /backend
    /nest-api
      src/auth/              OTP + JWT
      src/booking/           IBookingRepo + PgmBookingAdapter
      src/checkin/           face compare (pgvector cosine)
      src/pt/                agreement + log + commission
      src/pgm-adapter/       PGM REST client (axios + retry)
      src/outbox/            WhatsApp / email dispatch
  /infra
    docker-compose.yml       postgres + nest + n8n
    schema/migrations/       SQL migrations (Flyway or node-pg-migrate)
```

**Reuse 現有**：
- `pgm-import/schema.sql` — `members`, `import_log` table 保持不變
- `pgm-import/workflow-whatsapp-ai-bot.json` — AI bot 唔使改，繼續 read 同一個 DB
- `pgm-import/workflow-daily-import.json` — Phase 1 繼續跑，Phase 2 才考慮下架

---

## Production Hardening（死穴預防）

### 1. Booking Flow — Idempotency + State Machine

**❌ Naive flow（會出事）**
```
App → Nest → DB check capacity → call PGM → save DB
```
問題：DB 同 PGM drift；race condition 其實喺 PGM 唔喺 DB；重試會 double book。

**✅ Correct flow (Phase 1)**
```
App  ──[Idempotency-Key: uuid]──► Nest
                                   │
                                   ├─ SELECT ... FOR UPDATE idempotency table
                                   │    (如果 key 已存在 → return cached result)
                                   ├─ INSERT booking (status='pending', idempotency_key)
                                   ├─ call PGM /book
                                   │    ├─ success → UPDATE status='confirmed', pgm_id
                                   │    ├─ reject  → UPDATE status='failed', error_code
                                   │    └─ timeout → UPDATE status='pending_verify'
                                   ├─ emit event booking.created (bus: Redis Pub/Sub)
                                   └─ return {status, waitlistPosition?}
```

**#1 Idempotency Key（必須）**
```
POST /bookings
Headers: Idempotency-Key: <uuid v4>
```
防：
- User double-click
- Network retry
- n8n / webhook 重試
- Mobile app restart 中途

Client 端 generate UUID；server cache key → response 24h。

**#2 Booking State Machine**
```
states: pending · confirmed · failed · cancelled · waitlist · pending_verify · attended · no_show

transitions:
  init           → pending
  pending        → confirmed (PGM ok)
  pending        → failed    (PGM reject: full / duplicate / invalid)
  pending        → waitlist  (PGM full + user opted waitlist)
  pending        → pending_verify (PGM timeout — 需 reconcile job)
  confirmed      → cancelled (user cancel, 先 call PGM)
  waitlist       → confirmed (升位通知)
  confirmed      → attended  (check-in)
  confirmed      → no_show   (after class end)
```
每次 transition log 入 `booking_events` table (audit trail)。

**#3 Reconcile Job**
每 5 分鐘掃 `pending_verify` → call PGM query → update 正確 state。

---

### 2. PGM Adapter — Circuit Breaker + Error Normalize + Shadow Read

**Package**：`@go24/pgm-adapter` (`backend/nest-api/src/pgm-adapter/`)

**Structure**
```typescript
PgmClient:
  baseURL: env.PGM_API_BASE
  auth:    API_KEY + SECRET (HMAC / Bearer)
  timeout: 3000ms
  retry:   2x exponential backoff (250ms, 1000ms)
           // 只 retry 5xx + timeout，4xx 不 retry
  breaker:
    failure_rate_threshold: 50%
    window: 30 requests
    open_duration: 30s
    half_open_probe: 1 req
  metrics: prometheus (latency, error_rate per endpoint)
```
用 library: `opossum`（circuit breaker）+ `axios-retry`。

**Error Normalize table**（唔可以漏）
```
PGM raw message                →  Internal error code  →  Mobile display
"Class is fully booked"         →  BOOKING_FULL         →  "呢堂滿晒，可加入候補"
"Member already has booking"    →  DUPLICATE_BOOKING    →  "你已 book 咗呢堂"
"Class not found"               →  CLASS_NOT_FOUND      →  "呢堂 temporarily 唔見"
"Session expired"               →  UPSTREAM_AUTH        →  (refresh PGM token, retry)
HTTP 408 / 504 / timeout        →  TEMP_FAIL            →  "暫時未能處理，請再試"
HTTP 500                        →  UPSTREAM_ERROR       →  "系統忙，請稍後"
Circuit open                    →  UPSTREAM_DOWN        →  "系統維護中"
```
Mobile app **永遠唔應該**見到 PGM raw 英文 message。所有 error 一定經 normalize layer。

**Shadow Read (silent failure detector)**
每次 booking success 後：
```
await call PGM /book → got booking_id
await call PGM /member/:id/bookings → assert booking_id ∈ list
  if missing → log alert "pgm_ghost_booking" + mark pending_verify
```
抓 PGM 話成功但實際冇記錄嘅 silent failure。Sentry alert 即 page 人。

同樣應用落：
- Cancel booking → shadow check 係咪真係 cancelled
- PT session book → shadow read agreement remaining

---

### 3. Data Sync Strategy — Tiered + Conflict Resolver

**❌ 現況**：`n8n daily import` — booking 速度 unacceptable。

**✅ 雙層 sync**

#### Tier 1: Critical (near-realtime)
資料：`bookings`, `checkins`, `pt_sessions`, `memberships`（當 active）

策略（由先至後揀）：
- **Webhook**（最好）：PGM push event → Nest `/webhooks/pgm` → update local DB
- **Polling**（fallback）：BullMQ job 每 30-60s 掃 `recently_modified`
- **Shadow-on-write**（最即時）：我哋每次 write 完順手 verify（見 §2）

#### Tier 2: Non-critical (batch)
資料：`sales reports`, `historical attendance`, `payroll aggregate`
策略：保留現有 n8n daily XLS import → Postgres `gym_sales`, `gym_pt`

#### Conflict Resolver

每個 synced table 加 column：
```sql
ALTER TABLE bookings ADD COLUMN last_synced_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN source VARCHAR(10);  -- 'pgm' | 'local'
ALTER TABLE bookings ADD COLUMN version INT DEFAULT 1; -- optimistic lock
```

**Priority rule**（phase-dependent）：
| Phase | Source of truth | Merge rule |
|---|---|---|
| **Phase 1** (PGM 為主) | PGM > LOCAL | PGM webhook / poll win；local 寫必須先 call PGM |
| **Phase 2** (自家為主) | LOCAL > PGM | LOCAL write authoritative；PGM 降為 read-only archive |

**Merge algorithm**（sync job）：
```
for each updated row:
  if row.source == 'pgm' and local.version > 1 and local.source == 'local':
      # 本地有人改過 → conflict
      log_conflict(row, local)
      notify_admin
      keep local (Phase 2) / keep pgm (Phase 1)
  else:
      apply remote
      increment version
      set last_synced_at = now()
```

Conflict log 開獨立 dashboard，每日 review。

---

## Execution Blueprint — Booking Module（核心 reference code）

呢 section 係**寫錯一次之後成個 system 要推倒重來**嘅部分，先 lock 定。

### File layout
```
backend/nest-api/src/bookings/
├── booking.controller.ts
├── booking.service.ts
├── booking.module.ts
├── dto/
│   └── book.dto.ts
├── entities/
│   ├── booking.entity.ts
│   └── idempotency-key.entity.ts
├── repositories/
│   └── booking.repo.ts
├── errors/                          # normalized errors
│   ├── booking-full.error.ts
│   ├── duplicate-booking.error.ts
│   ├── external-service.error.ts
│   └── index.ts
└── state-machine/
    └── booking.states.ts

backend/nest-api/src/pgm-adapter/
├── pgm.module.ts
├── pgm-client.ts                    # axios + opossum + retry
├── booking/
│   ├── i-booking-repo.ts            # ★ interface (Phase-neutral)
│   ├── pgm-booking.adapter.ts       # Phase 1
│   └── native-booking.adapter.ts    # Phase 2 (未寫，keep interface 同)
└── error-normalize.ts
```

### Interface first — `IBookingRepo`（Phase 1 → Phase 2 唔卡死嘅關鍵）
```ts
// src/pgm-adapter/booking/i-booking-repo.ts
export interface IBookingRepo {
  listClasses(params: ListClassesParams): Promise<ClassDto[]>;
  getClass(classId: string): Promise<ClassDto>;
  bookClass(input: BookClassInput): Promise<{ externalId: string }>;
  cancelBooking(externalId: string): Promise<void>;
  listMyBookings(userId: string): Promise<BookingDto[]>;
  joinWaitlist(classId: string, userId: string): Promise<{ externalId: string; position: number }>;
}
```
Phase 1 注入 `PgmBookingAdapter`，Phase 2 只需換 `NativeBookingAdapter`，**整個 system 唔使改一行業務 code**。

### Controller
```ts
// src/bookings/booking.controller.ts
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  async book(
    @Headers('Idempotency-Key') key: string,
    @Body() dto: BookDto,
    @Req() req: AuthedRequest,
  ) {
    if (!key) throw new BadRequestException('Idempotency-Key header required');
    return this.bookingService.book({
      userId: req.user.id,
      classId: dto.classId,
      idempotencyKey: key,
    });
  }

  @Delete(':id')
  async cancel(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.bookingService.cancel(id, req.user.id);
  }

  @Get()
  async list(@Query('status') status: string, @Req() req: AuthedRequest) {
    return this.bookingService.listMine(req.user.id, status);
  }
}
```

### Service（核心邏輯）
```ts
// src/bookings/booking.service.ts
@Injectable()
export class BookingService {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly idempotencyRepo: IdempotencyRepository,
    @Inject('IBookingRepo') private readonly pgm: IBookingRepo,
    private readonly events: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  async book(input: {
    userId: string;
    classId: string;
    idempotencyKey: string;
  }) {
    // 1. Idempotency check (replay protection)
    const cached = await this.idempotencyRepo.find(input.idempotencyKey);
    if (cached) return cached.response;

    // 2. Create pending booking (local first)
    const booking = await this.bookingRepo.create({
      userId: input.userId,
      classId: input.classId,
      idempotencyKey: input.idempotencyKey,
      status: 'pending',
      source: 'local',
    });

    try {
      // 3. Call PGM — source of truth (Phase 1)
      const pgmResult = await this.pgm.bookClass({
        classId: input.classId,
        userId: input.userId,
      });

      // 4. Update local → confirmed
      await this.bookingRepo.update(booking.id, {
        status: 'confirmed',
        externalId: pgmResult.externalId,
      });

      // 5. Shadow read (silent failure detector)
      void this.verifyShadow(booking.id, input.userId, pgmResult.externalId);

      const response = { success: true, bookingId: booking.id, status: 'confirmed' };

      // 6. Cache idempotency (TTL 24h)
      await this.idempotencyRepo.save(input.idempotencyKey, response);

      // 7. Emit event
      this.events.emit('booking.created', { bookingId: booking.id });

      return response;

    } catch (err) {
      const errorCode = mapPgmError(err); // normalize
      const finalStatus = errorCode === 'TEMP_FAIL' ? 'pending_verify' : 'failed';

      await this.bookingRepo.update(booking.id, {
        status: finalStatus,
        errorCode,
      });

      // Cache fail response too (avoid retry loop)
      const response = { success: false, error: errorCode };
      await this.idempotencyRepo.save(input.idempotencyKey, response);

      throw err;
    }
  }

  private async verifyShadow(bookingId: string, userId: string, externalId: string) {
    try {
      const pgmBookings = await this.pgm.listMyBookings(userId);
      if (!pgmBookings.some(b => b.externalId === externalId)) {
        this.logger.error({
          event: 'pgm_ghost_booking',
          bookingId,
          externalId,
        });
        await this.bookingRepo.update(bookingId, { status: 'pending_verify' });
      }
    } catch {
      // Shadow failure — non-critical, schedule reconcile
    }
  }
}
```

### PGM Adapter implementation
```ts
// src/pgm-adapter/booking/pgm-booking.adapter.ts
@Injectable()
export class PgmBookingAdapter implements IBookingRepo {
  constructor(private readonly client: PgmClient) {}

  async bookClass(input: BookClassInput) {
    try {
      const res = await this.client.post('/bookings', input);
      return { externalId: res.data.id };
    } catch (err) {
      throw normalizePgmError(err);
    }
  }

  async cancelBooking(externalId: string) {
    try {
      await this.client.delete(`/bookings/${externalId}`);
    } catch (err) {
      throw normalizePgmError(err);
    }
  }
  // ... listClasses / listMyBookings / joinWaitlist
}
```

### Error normalize
```ts
// src/pgm-adapter/error-normalize.ts
export function normalizePgmError(err: any): AppError {
  const msg = err?.response?.data?.message ?? err?.message ?? '';
  const status = err?.response?.status;

  if (/full|capacity/i.test(msg))         return new BookingFullError();
  if (/already.*booked|duplicate/i.test(msg)) return new DuplicateBookingError();
  if (/not.found/i.test(msg))             return new ClassNotFoundError();
  if (/session.*expired|unauth/i.test(msg))   return new UpstreamAuthError();
  if (status === 408 || status === 504)   return new TempFailError();
  if (status >= 500)                      return new UpstreamError();
  if (err?.code === 'EOPENBREAKER')       return new UpstreamDownError();

  return new ExternalServiceError(msg);
}
```

### Module wiring（關鍵：DI token 用 interface）
```ts
// src/bookings/booking.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Booking, IdempotencyKey]), PgmModule],
  controllers: [BookingController],
  providers: [
    BookingService,
    BookingRepository,
    IdempotencyRepository,
    {
      provide: 'IBookingRepo',
      useClass: PgmBookingAdapter,   // Phase 1; Phase 2 swap to NativeBookingAdapter
    },
  ],
})
export class BookingModule {}
```

### Idempotency 細節
```sql
CREATE TABLE idempotency_keys (
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  endpoint VARCHAR(50) NOT NULL,
  status VARCHAR(12) NOT NULL,      -- 'in_flight' | 'done'
  response JSONB,                   -- null when in_flight
  result_kind VARCHAR(12),          -- 'terminal' | 'transient' (transient 可 retry)
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (user_id, key)        -- composite 防跨 user key 碰撞
);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_status  ON idempotency_keys(status, created_at);
-- cron: DELETE WHERE expires_at < NOW() hourly
```
**規則**：
- Key：UUID v4（client generate）
- PK composite `(user_id, key)` — 唔同 user 可以用同 key
- **Atomic claim** 用 `INSERT ... ON CONFLICT DO NOTHING RETURNING *`：第二個 concurrent request 收唔到 row → poll 等第一個完（或者 return `409 IN_PROGRESS`，client 自己 retry-after）
- **只 cache terminal**（`confirmed` / `BOOKING_FULL` / `DUPLICATE` / `NOT_FOUND`）；**唔 cache transient**（`TEMP_FAIL` / `UPSTREAM_DOWN` / `pending_verify`）— 避免「永久失敗」stuck
- Mark `completed_at` 方便 debug

### Service 補強（merge 進上面 code 嘅 production-ready patch）

**① Atomic idempotency claim**
```ts
const claim = await this.idempotencyRepo.tryClaim({
  userId: input.userId,
  key: input.idempotencyKey,
  endpoint: 'POST /bookings',
});

if (claim.kind === 'already_done') return claim.response;          // terminal cached
if (claim.kind === 'in_flight')    throw new InProgressError();    // 409 畀 client retry
// kind === 'claimed' → 繼續落去
```

**② Booking row create + external call 用 saga（避免 orphan pending）**
```ts
// 唔包 transaction（因為 call PGM 耐），但 pending row 有 60s TTL
// Reconcile job 每 5 min 掃 pending > 60s → 驗 PGM → resolve
```

**③ Shadow read 入 BullMQ queue（唔好 void fire-and-forget）**
```ts
await this.shadowQueue.add(
  'verify-booking',
  { bookingId: booking.id, userId: input.userId, externalId: pgmResult.externalId },
  { delay: 2000, attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
);
```

**④ Transactional Outbox（event 唔丟）**
```sql
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY,
  topic VARCHAR(50),
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  dispatched_at TIMESTAMP
);
```
Booking status update 同 outbox insert **同一 DB transaction**；另起 `OutboxDispatcher` BullMQ worker poll `dispatched_at IS NULL` → push Redis Pub/Sub → mark dispatched。保證 **DB committed ⟺ event 一定 publish**。

**⑤ Error normalize：PGM errorCode 優先於 regex**
```ts
export function normalizePgmError(err: any): AppError {
  // 1. Prefer structured code
  const code = err?.response?.data?.errorCode;
  if (code) return mapByCode(code);  // e.g. PGM_E1001 → BookingFullError

  // 2. HTTP status
  const status = err?.response?.status;
  if (status === 408 || status === 504) return new TempFailError();
  if (status === 401 || status === 403) return new UpstreamAuthError();
  if (status >= 500)                    return new UpstreamError();

  // 3. Regex fallback (with fixture test per phrase)
  const msg = err?.response?.data?.message ?? '';
  if (/full|capacity/i.test(msg))       return new BookingFullError();
  // ...
  if (err?.code === 'EOPENBREAKER')     return new UpstreamDownError();
  return new ExternalServiceError(msg);
}
```
**Unit test fixture**：每個已知 PGM error string 寫一個 test case，PGM 改 wording → CI 紅，保證唔會 silent break。

**⑥ DI token 用 Symbol（唔用 string）**
```ts
// src/pgm-adapter/booking/i-booking-repo.ts
export const BOOKING_REPO = Symbol('IBookingRepo');
export interface IBookingRepo { /* ... */ }

// module
{ provide: BOOKING_REPO, useClass: PgmBookingAdapter }

// service
constructor(@Inject(BOOKING_REPO) private readonly pgm: IBookingRepo) {}
```

**⑦ DB check constraint**
```sql
ALTER TABLE bookings
  ADD CONSTRAINT confirmed_has_external
  CHECK (status != 'confirmed' OR external_id IS NOT NULL);
```

**⑧ Cancel 都要 idempotency**（cancel retry 比 book 更頻）— `DELETE /bookings/:id` 都 require `Idempotency-Key`。

**⑨ Waitlist fallback — API contract 明文**
```
POST /bookings {classId, acceptWaitlist?: boolean}
  classId 有位  → {status:'confirmed', bookingId}
  classId 滿   + acceptWaitlist=true → {status:'waitlist', bookingId, waitlistPosition:3}
  classId 滿   + acceptWaitlist=false → 409 BOOKING_FULL
```
唔好 server side 自作主張 fallback（會令 client 以為 book 到 confirmed）。

### 呢個 blueprint 解決嘅問題 ✅
| 問題 | 解決 |
|---|---|
| User double-click | Idempotency-Key cache |
| Network retry | 同上 |
| n8n / webhook 重試 | 同上 |
| PGM timeout | pending_verify + reconcile job |
| PGM silent failure | Shadow read + alert |
| Debug 地獄 | status + errorCode + booking_events audit |
| Phase 1 → 2 遷移 | IBookingRepo interface 只 swap implementation |
| Mobile 見 PGM 英文錯誤 | normalizePgmError 層 |

---

## Operational Readiness（keep system alive）

### A. Mobile ↔ Dev Backend 連線

開發 phase 部手機點 reach 你 dev 機 NestJS：

| 方案 | 用途 | 優劣 |
|---|---|---|
| **同 WiFi local IP** `192.168.x.x:3000` | 第一選擇 | 快、零成本；但要開 Windows Firewall + 同 LAN |
| **ngrok / Cloudflare Tunnel** | LAN 唔同網時 | 免費 quota 足；URL 每次新（要 update `.env`）|
| **Tailscale** | 多人協作 | 免費、stable、去到邊都得 |

Stage 0 之前必須 lock 一個方案，否則 Stage 1 手機驗證做唔到。

### B. WhatsApp OTP 成本 + SMS Fallback

**估算**（5000 會員）：
- WhatsApp Business API authentication template ~ HK$0.55/條
- 月均 4 次登入 × 5000 = 20,000 條 = **HK$11,000/月**
- Login bursts（推廣／系統故障）可炸到 50k/月

**對策**：
1. **Token 長 TTL**（refresh 30 日）減 OTP 次數
2. **Trusted device**（device fingerprint store）跳過 OTP
3. **SMS fallback**（Twilio / 雙向發 SMS / 本地 SMS gateway）— WhatsApp send 失敗 / 唔讀就 fallback
4. **Rate limit + cooldown**（30 秒一條、每日 max 10 條）

Stage 1 一定要實裝 #1 + #4。

### C. Backup / Disaster Recovery

| 層 | 策略 |
|---|---|
| Postgres | `pg_dump` daily → 加密上 S3 / R2，30 日 retention；每月 restore drill |
| Postgres | WAL archiving for point-in-time recovery（Stage 10 上線前） |
| Redis | append-only persistence（已喺 docker-compose）+ snapshots |
| Face embeddings | 同 Postgres 一齊 backup |
| App user data 寫返 PGM | PGM 自身 backup 算 second copy |
| Code | GitHub（已做） |
| Secrets | 1Password / Bitwarden vault（唔入 git） |

### D. Monitoring / Alerting

| 工具 | 用途 |
|---|---|
| **Sentry** | Crash + error（mobile + backend）；team plan 50k events/mo ~ $26/mo |
| **Grafana + Loki + Promtail** self-host | API logs + metrics |
| **Uptime Kuma** self-host | Uptime monitoring（API + DB）|
| **Prometheus** | NestJS `@willsoto/nestjs-prometheus` exporter |
| **PagerDuty (free)** 或 **Telegram bot** | Critical alert page |

關鍵 alert：
- API P99 > 2s for 5 min
- Booking success rate < 95% for 10 min
- PGM circuit breaker open
- Idempotency conflict surge
- Postgres replication lag > 30s

### E. SLA / On-call（5000 會員嘅現實）

1 人 startup 唔可能真 24/7。實際 SLA：

| 嚴重度 | 範例 | Response | Window |
|---|---|---|---|
| P0 | App 完全 down / 全 gym 入唔到閘 | 30 分鐘 | 24/7 |
| P1 | Book 唔到 / Face fail rate 高 | 4 小時 | 09-22 |
| P2 | 個別會員問題 | 1 工作日 | 09-18 |
| P3 | UI bug / typo | 1 週 | 09-18 |

**Public status page**（statuspage.io free / 自寫 simple HTML）讓會員自助知 incident。

### F. Migration from existing PGM Mobile App

現有 GO24 app 點 hand-over 畀新 app：

| Phase | 動作 |
|---|---|
| **T-30 日** | 新 app 上 TestFlight / Play Internal，beta 50 員工試 |
| **T-14 日** | 公告會員（WhatsApp + email）：新 app 即將推出 |
| **T-0 launch** | 新會員強制裝新 app；舊會員兩個 app 並存可選擇 |
| **T+30 日** | 推送 in-app banner 鼓勵舊會員轉新 |
| **T+90 日** | 舊 app 進入「read-only」mode（可登入但 book 唔到） |
| **T+120 日** | 舊 app 從 store remove，舊用戶被迫升級 |

User favourites / preferences：Stage 2 設計 PGM adapter 時 fetch user preferences API → mirror 入新 DB。

### G. Environments

| Env | 用途 |
|---|---|
| `dev` | 你部機 + Docker compose；PGM sandbox（如有）/ mock |
| `staging` | VPS 一台；Adyen TEST + PGM staging（**要問 Perfect Gym 攞 staging access**）|
| `prod` | 多機 Postgres primary+replica + Redis + LB |

每個 env 獨立 Sentry project + database。

### H. Pre-flight Spike（Stage 1 之前要做）

呢啲做唔到 = 全 plan 行唔通：

- [ ] **手機 reach API 方案**（揀 ngrok / Tailscale，document 喺 README）
- [ ] **Face engine spike (1-2 日)** — 試 AWS Rekognition + Azure Face + face-api.js 各 1 個 sample，benchmark 速度 / 成本 / 準確度，**lock 揀邊個**
- [ ] **PGM staging API access** — 問 Perfect Gym sales 攞 staging credentials
- [ ] **WhatsApp Business API quota check** — 確認現有 n8n integration 量足
- [ ] **PDPO privacy policy draft** — 至少 face data section（Stage 5 上線前要 ready）

---

## API Endpoints (Gateway — mobile app call 嘅 URL)

全部 JSON、JWT header `Authorization: Bearer <token>`，Base URL `https://api.go24.fitness/v1`。PGM adapter 喺 gateway 內部做 mapping，mobile app 唔需要知。

### Auth (6)
```
POST   /auth/otp/send              {phone} → 觸發 WhatsApp OTP
POST   /auth/otp/verify            {phone, code} → {token, user, refreshToken}
POST   /auth/trainer/login         {email, password} → {token, user}
POST   /auth/refresh               {refreshToken} → {token}
POST   /auth/logout                (revoke session)
GET    /auth/me                    → 當前 user + role + permissions
```

### Member Profile (5)
```
GET    /me                         → 詳情（會籍 summary / PT summary / streak）
PATCH  /me                         {phone, email, preferences}
POST   /me/avatar                  multipart → 頭像
GET    /me/stats                   → 本月/年度訪問次數、streak、常去店
DELETE /me                         → 刪 account（PDPO 要求）
```

### Memberships (4)
```
GET    /memberships                → current + ended list（帶日期、進度 %、剩餘日）
GET    /memberships/:id            → 單張詳情
GET    /memberships/plans          → 可買嘅 plan list（續會用）
POST   /memberships/renew          {planId} → 生成 Adyen payment link
```

### Clubs / Branches (3)
```
GET    /clubs                      → 5 間店 list（距離、開放時間、設施）
GET    /clubs/:id                  → 單店詳情（地址、照片、facilities）
GET    /clubs/:id/hours            → 今日 / 本週開放時間
```

### Classes / 團體課 (6)
```
GET    /classes?date=&club=&trainer=&type=&favourite=true
                                   → filter 後堂 list（每 item 帶 capacity / my_booking_status）
GET    /classes/:id                → 詳情（description, trainer, participants 頭像, 規則）
GET    /classes/search?q=          → 名 / 教練 search
POST   /classes/:id/favourite      → 加收藏
DELETE /classes/:id/favourite      → 取消收藏
POST   /classes/:id/rate           {stars, comment} → 評分
```

### Bookings / 我嘅預約 (5)
```
GET    /bookings?status=upcoming|past|all
                                   → 我嘅 booking list（含下一堂 countdown）
POST   /bookings                   {classId} → book（或 auto-入 waitlist）→ {status, waitlistPosition?}
DELETE /bookings/:id               → cancel（check 幾小時前 rule）
POST   /bookings/:id/calendar      → return .ics file（加入 calendar）
PUT    /bookings/:id/reminder      {minutesBefore} → 設 push 提醒
```

### PT Sessions / 私教 (7) ⭐ 現有 app 無
```
GET    /pt/agreements              → 我嘅 PT agreement list（餘堂、到期、教練）
GET    /pt/agreements/:id          → 詳情（已用、剩餘、歷史 log）
GET    /pt/sessions?status=        → 我嘅 PT session list（已約 / 已完成）
POST   /pt/sessions                {trainerId, time, agreementId} → book PT
DELETE /pt/sessions/:id            → cancel PT
GET    /pt/sessions/:id/log        → 教練填嘅 log（動作 / 重量 / 備註）
POST   /pt/sessions/:id/rate       {stars, comment}
```

### Check-in (3) 🌟 核心 feature
```
POST   /checkin/face               multipart (image) → {status: ok|fail, member, gateSignal?}
POST   /checkin/qr                 → 返 active QR payload（refresh every 30s）
GET    /checkin/history?limit=     → 我嘅 check-in 紀錄
```

### Face Enrollment (2) — Trainer app 用
```
POST   /face/enroll/:memberId      multipart (3-5 images) → store embedding
DELETE /face/enroll/:memberId      → 刪 embedding（會員要求 / PDPO）
```

### Payments / 收據 (4)
```
GET    /payments                   → 交易歷史 list
GET    /payments/:id/receipt       → PDF 收據
POST   /payments/link              {invoiceId} → 生成 Adyen Pay by Link
POST   /webhooks/adyen             (Adyen → server) → 更新 payment status
```

### Notifications (4)
```
GET    /notifications?tab=personal|announcements
                                   → list with unread count
PATCH  /notifications/:id/read     → mark read
PATCH  /notifications/read-all
GET    /notifications/preferences  → push/WhatsApp/email toggle per category
PUT    /notifications/preferences
POST   /notifications/device       {token, platform} → register FCM/APNS
```

### Goals (2)
```
GET    /goals                      → 我嘅目標
PUT    /goals                      {type, target, deadline}
```

### --- Trainer-specific endpoints ---

### Trainer Schedule (3)
```
GET    /trainer/schedule?date=     → 今日 / 指定日期 schedule（團體課 + PT）
GET    /trainer/members            → 我帶嘅會員 list
GET    /trainer/members/:id        → 某會員詳情（agreement / 歷史）
```

### Trainer PT Log (3)
```
POST   /trainer/pt/:sessionId/log  {exercises[], notes, media[]} → 記錄 PT
PUT    /trainer/pt/:sessionId/log  (編輯)
GET    /trainer/pt/templates       → PT log template（複用）
```

### Trainer Attendance (2)
```
POST   /trainer/classes/:id/checkin       {memberId} → 帶堂簽到（手動）
POST   /trainer/classes/:id/checkin-face  multipart → scan 會員樣
POST   /trainer/classes/:id/no-show       {memberId}
```

### Trainer Commission (2)
```
GET    /trainer/commission?month=  → 我嘅佣金（只自己）
GET    /trainer/commission/detail  → PT 堂數 × rate 明細
```

### --- Shared utility ---

### Health / Config (2)
```
GET    /health                     → server status
GET    /config                     → app config（version, feature flags, urls）
```

**總計 ≈ 58 個 endpoint**。
- Member app 用 ~40 個
- Trainer app 用 ~25 個（部分重疊）
- 一 Swagger / OpenAPI doc → auto-gen typed TS client 入 `/packages/api-client`

---

## M0 Workspace Structure

用 **pnpm workspace monorepo**（輕量、速度快、TS 共享好）。

### Folder layout
```
perfect-gym-replacement/
├── pnpm-workspace.yaml
├── package.json                  # root scripts (dev, build, test, lint)
├── turbo.json                    # Turborepo pipeline (cache + parallel)
├── tsconfig.base.json            # 共用 TS config
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── .env.example                  # template（真 .env 唔入 git）
├── README.md
│
├── apps/
│   ├── member-app/               # Expo RN app (現已 scaffold)
│   │   ├── app/                  # Expo Router pages
│   │   │   ├── (auth)/login.tsx
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── dashboard.tsx
│   │   │   │   ├── clubs.tsx
│   │   │   │   ├── classes.tsx
│   │   │   │   └── profile.tsx
│   │   │   ├── checkin/face.tsx  # 🌟 flagship
│   │   │   ├── checkin/qr.tsx
│   │   │   ├── classes/[id].tsx
│   │   │   ├── pt/index.tsx
│   │   │   └── pt/[id].tsx
│   │   ├── app.json              # Expo config
│   │   ├── eas.json              # EAS Build profiles
│   │   └── package.json
│   │
│   └── trainer-app/              # Expo RN app (greenfield)
│       ├── app/
│       │   ├── (auth)/login.tsx
│       │   ├── (tabs)/
│       │   │   ├── today.tsx
│       │   │   ├── members.tsx
│       │   │   ├── pt-log.tsx
│       │   │   └── me.tsx
│       │   ├── members/[id].tsx
│       │   ├── pt/[sessionId]/log.tsx
│       │   └── enroll-face/[memberId].tsx
│       └── package.json
│
├── packages/
│   ├── shared-ui/                # 共用 component (Button, Card, Input, etc)
│   │   ├── src/
│   │   │   ├── theme/            # brand color, typography
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   └── package.json
│   │
│   ├── api-client/               # auto-gen from OpenAPI
│   │   ├── src/
│   │   │   ├── generated/        # openapi-typescript output
│   │   │   └── client.ts         # axios wrapper + auth interceptor
│   │   └── package.json
│   │
│   ├── shared-types/             # shared DTO types
│   │   ├── src/
│   │   └── package.json
│   │
│   └── config/                   # shared eslint / tsconfig / jest presets
│       ├── eslint-preset.js
│       └── tsconfig-preset.json
│
├── backend/
│   └── nest-api/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── auth/             # OTP + JWT
│       │   ├── members/
│       │   ├── classes/
│       │   ├── bookings/
│       │   ├── pt/
│       │   ├── checkin/          # 🌟 face + qr
│       │   ├── payments/         # Adyen
│       │   ├── notifications/
│       │   ├── trainer/
│       │   ├── pgm-adapter/      # PGM REST client (all 對外 call)
│       │   ├── outbox/           # WhatsApp/email via n8n
│       │   └── common/           # guards, pipes, decorators
│       ├── test/                 # e2e tests
│       ├── nest-cli.json
│       ├── tsconfig.json
│       └── package.json
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml    # postgres + redis + nest + n8n (dev)
│   │   ├── docker-compose.prod.yml
│   │   └── Dockerfile.api
│   ├── db/
│   │   ├── migrations/           # node-pg-migrate files
│   │   └── seed/                 # dev seed data
│   └── scripts/
│       ├── setup.sh              # 一鍵 setup dev env
│       └── gen-api-client.sh     # 由 Nest OpenAPI gen TS client
│
└── docs/
    ├── architecture.md
    ├── api-contract.md           # OpenAPI rendered
    └── runbook.md                # deploy / rollback
```

### Package managers / tools
- **pnpm** — workspace manager（快、空間慳）
- **Turborepo** — build cache + parallel task（`pnpm dev` 一 command 起 3 個 app 同 backend）
- **EAS Build** — Expo 出 iOS/Android binary（不需要 Mac）
- **node-pg-migrate** — DB migration
- **openapi-typescript** — auto-gen API client from Nest Swagger

### Shared config
- `tsconfig.base.json`：`strict: true`，`paths` 設 `@go24/shared-ui`, `@go24/api-client` 等 alias
- ESLint preset：共用 rules，apps extend
- Prettier：單 config root

### Initial dev setup (M0 執行步驟)
```bash
# 1. 初始化 monorepo
pnpm init
pnpm add -Dw turbo typescript prettier eslint

# 2. 建立 workspace
echo "packages:\n  - 'apps/*'\n  - 'packages/*'\n  - 'backend/*'" > pnpm-workspace.yaml

# 3. Move 現有 member-app 入 apps/
mv member-app apps/member-app

# 4. Scaffold trainer-app
cd apps && npx create-expo-app@latest trainer-app --template blank-typescript && cd ..

# 5. Scaffold NestJS
cd backend && nest new nest-api --package-manager pnpm && cd ..

# 6. 起 shared packages
mkdir -p packages/shared-ui packages/api-client packages/shared-types packages/config
# ...each with package.json + tsconfig

# 7. Docker
mkdir -p infra/docker infra/db/migrations infra/scripts
# 寫 docker-compose.yml (postgres + redis)

# 8. CI (GitHub Actions)
mkdir -p .github/workflows
# lint + test + build on PR

# 9. 跑通
pnpm install
pnpm dev                          # Turbo 並行起 member + trainer + nest
```

### Git / branch 策略
- `main` — protected，CI 綠先 merge
- `dev` — integration
- `feat/<milestone>-<feature>` — feature branch
- Commit convention：`feat(booking): ...` / `fix(auth): ...`（Conventional Commits）

### CI (GitHub Actions)
```yaml
# .github/workflows/ci.yml
# on: pull_request
# - lint (eslint + prettier check)
# - typecheck (tsc --noEmit)
# - test (jest)
# - build (turbo build)
```

### Secrets 管理
- `.env.local`（dev，唔入 git）
- 生產用 Docker secrets / Cloudflare
- Expo：`eas.json` → EAS Secrets（API base url per env）

---

## Milestones

> **Removed.** 詳細 stage breakdown 已 split 去 `01-stage-0-foundation.md` ... `12-stage-10-launch.md`，timeline 喺 main overview file。呢個舊 M0-M8 table 為避免兩個 source of truth 衝突已刪除。

---


## Risks & Mitigation

| Risk | Mitigation |
|---|---|
| PGM REST API 無 documented / rate limit | 早期起一個 `pgm-adapter` spike，記錄 endpoint / limits；唔得就改 scrape PGM web + n8n |
| Face detection false positive / 私隱投訴 | Enrollment 一定要會員親身 + 雙因素；每次 check-in log 相似度分數；會員可以要求刪 embedding |
| App Store 審批（尤其 face data） | 寫清楚 privacy policy，iOS 用 `NSCameraUsageDescription` + data deletion flow |
| 會員唔慣新 app | Trainer app 先上線畀教練 onboard，會員 app 分批（新會員強制，舊會員 opt-in） |
| Booking race condition | Idempotency-Key + State Machine + PGM authoritative；見 §Production Hardening |
| PGM silent failure | Shadow read after write；pending_verify state + reconcile job；circuit breaker 防 cascade |
| DB 同 PGM drift | Tiered sync (webhook/poll critical；daily batch non-critical)；Conflict Resolver with source + version |

---

## Verification Plan (per milestone)

- **M1 Auth**：Jest unit test OTP expiry；手機實測 OTP 收到 < 30 秒
- **M2 PGM adapter**：
  - Chaos test：kill PGM network 30s 期間 app 要 return `UPSTREAM_DOWN`（circuit open），唔可以 5xx 爆 mobile
  - Error normalize：餵 20 條已知 PGM error，每條都 map 到正確 internal code
  - Shadow read：人工整一次 PGM ghost（mock 返 booking_id 但 list 冇），要 trigger `pgm_ghost_booking` alert
- **M3 Booking write**：
  - k6 load test — 50 concurrent 搶最後 1 個位，確保只有 1 個 success；其餘正確入 waitlist
  - Idempotency test — 同 key call 100 次只應該產生 1 個 booking
  - State machine test — 每條 transition 覆蓋，invalid transition 要 reject
  - PGM timeout 恢復 test — timeout 落 `pending_verify`，reconcile job 5 min 後 resolve 正確 state
- **M3.5 Sync**：人手改 PGM 一張 booking → polling / webhook 後 local 正確 update；local 同 PGM 同時改 → conflict log 出正確紀錄
- **M4 Face** 🌟：
  - Enrol 20 個 staff → 跨光線 / 眼鏡 / 口罩 / 化妝測試
  - 目標指標：**同一人 match 準確率 > 98%**，**誤認他人率 < 0.1%**
  - 速度：拎起手機到顯示歡迎 **< 3 秒**
  - n8n workflow timeout < 2s（否則 fallback 用 cache）
  - Load test：1 分鐘內 50 個會員同時 check-in 唔可以 timeout
- **M5 PT commission**：跑現有 `pgm-pt-discrepancy-checker` skill，比較新 app 計出嚟數字 vs Excel master，差異 = 0
- **M7 Beta**：Crashlytics / Sentry 每週 review；每個 active user bug report 清零先 M8

---

## Answered Decisions

1. **PGM API**：有 REST API + 文件 ✅ → Phase 1 直接寫 `PgmAdapter`（axios + retry + rate-limit），無需 reverse engineer
2. **規模**：5+ 間店、> 5000 會員 → infra 要認真做：
   - **Postgres**：Primary + Read Replica（report / AI bot 行 replica）
   - **Redis**：session / class availability cache / rate limit
   - **Nginx / Cloudflare**：TLS termination + CDN for static assets
   - **Queue (BullMQ)**：async job（WhatsApp send、face embedding、PGM sync）
   - **Monitoring**：Sentry (error) + Grafana + Loki (logs) + uptime-kuma
   - **Multi-branch schema**：`branch_id` 加去 `classes`, `bookings`, `checkins`, `trainers`，users 可 cross-branch
3. **Payment**：有 Adyen → 新 app generate **Adyen Pay by Link** URL → 透過 WhatsApp send 畀會員。Webhook 接 Adyen payment-authorized event → mark invoice paid + PGM sync
4. **Commission 可見性**：每個 trainer 只睇自己 → JWT 帶 `trainer_code`，server side filter `WHERE trainer_code = :self`，簡單

## Still Open（需要確認）

5. **Face data 法規（HK PDPO）**：邊個 review privacy policy？會員 opt-in flow 要寫清楚「收集 face embedding、用途、保留幾耐、點刪」

---

## UI Reference — 現有 GO24 / ONYX by GO24 App

### Brand Identity (沿用)
- **Primary**: 深紅 `#B5001E` 類（header / text accent）
- **CTA**: 橙色 `#FF6A00` 類（"SAVE FILTERS" 按鈕）
- **Accent**: 紫色圓形 icon（位置 pin）
- **Typography**: 粗體 header，乾淨大字
- **Bottom tabs (4)**: Dashboard / Find Clubs / Classes / Profile

### 🚨 現有 App 關鍵缺失（用戶痛點確認）

1. **PT Session 完全唔顯示** — 現有 app 無任何 PT 餘堂 / 預約 / 紀錄 UI。會員要問櫃台 / 教練先知。**新 app 必須有獨立 PT 模組（Dashboard stat + 詳情頁）**
2. **會籍到期日唔見** — 要 tap Memberships 先知
3. **無 streak / visit 統計** — Activities 頁只 list 紀錄無 summary
4. **書咗嘅堂無 countdown** — 下一堂幾時開都要自己計
5. **Book 成功無 follow-through**（加 calendar / 提醒）
6. **教練完全無 mobile app** — 而家只有 PGM Web (電腦/pad)；**Trainer app 係 greenfield，最大 differentiator**
7. **Memberships 無日期 / 混亂 list**（5 個 `ONYX 1 DAY ACCESS` 重複）
8. **QR check-in 頁淨係得 QR，無 context**

### Screen-by-Screen 分析 + 新版改良

| 現有 Screen | 優點 | 痛點 | 新 App 改良 |
|---|---|---|---|
| **Activities (check-in history)** | 日期分組清楚、位置 icon 明顯 | 名叫「Activities」含糊；無 summary；只係過去紀錄無 forward-looking | 改名「訪問紀錄」；頂加 streak card（本月 N 次 🔥、連續 N 日）；加 heat-map calendar view |
| **Memberships** | Current / Ended 分開 | **完全唔顯示到期日**；要 tap 入去先睇到；下半空白浪費 | List item 直接顯示「剩 N 日」+ 進度 bar + inline「續會」orange button；到期 30 日內紅色警告 |
| **Find Clubs (filter)** | Favourite / specific 分組、距離標示 | 無 map view；5+ 店 scroll 長 | 頂 map view 釘 pin；下 list auto sort by distance；filter 收埋做 drawer |
| **Book classes list** | 日期 tab 一覽、時間紅色、`+` 圓掣清晰、waitlist `+` 加鐘 icon 巧思、filter icon 橙點 indicator | 無 capacity（X/Y）；橙 👥 icon 意思不清；無扣堂數 / 價錢；已 book 堂無 badge；無 inline club filter；日 picker 只 7 日；無 favourite toggle | 新 app：<br>• 每 item 右下細字 `剩 2 位` 或 `已滿 · 候補 3 人`<br>• 主 CTA 左上加 badge：`已 BOOK` / `候補中 #2` / `+` 空白<br>• Day picker 加「揀日期」jump button → full calendar<br>• 頂 tab 加 3 個 chip：`全部` · `我收藏` · `我店`（1-tap toggle）<br>• Item 右上細字顯示扣堂 / 免費<br>• 長按 item → quick actions（收藏 / share / set reminder）|
| **Class details** | Hero image、時間 box 清晰、participants 頭像 social proof、waiting-list banner 搶眼 | 無 capacity（X/Y）；READ MORE 截描述；無價錢 / 扣堂數；無 map / 交通；橙 + 掣意思唔清 | 新 app：頂 banner 改 `WAITING LIST · 你會係第 3 位` / `餘 2 位 (18/20)`；description 全顯示；加「扣 1 堂」標示；加 mini map + 地址 copy 掣；主 CTA 改大 button「加入候補 (第 3 位)」或「即時 Book (剩 2 位)」，唔用 ambiguous icon |
| **Book success modal ("Spot reserved")** | Thumbs up + ✅ 清楚；date/time repeat | 無加 calendar、無跳去 my bookings、無 reminder 設定、無 share | 新 app：一個 modal 畀齊 3 個 action — `加入 Calendar` / `提醒我 1h 前` (default on) / `睇我預約`；底部 `OK` secondary |
| **Profile 頁** | Section 分組清、QR card button 搶眼、log out 明顯 | 無 inline edit、無交易 / 收據、無 PT link、無 notification prefs、無 referral、「My Activities / Goal / Membership」應該 promote 上 Dashboard | 新 Profile：<br>• Header：頭像 + 名 + 會籍狀態 chip（`活躍 · 剩 47 日`）<br>• 2×2 grid：`會籍 & 續會` · `PT & Session` · `付款 & 收據` · `通知設定`<br>• ACCOUNT：改資料（inline edit）· 語言 · 主題<br>• OTHERS：介紹朋友 · 支援 · 關於 · Privacy<br>• 底部：Log out |
| **Memberships 頁** | Current / Ended 分組、Buy Membership CTA 清 | **完全無日期**；5 條同名 entry 混亂；無合併歷史；無 spent total | 新版：<br>• Current：大 card 顯示 `Onyx Annual · 剩 47 日 · 到 2026-06-10 · HK$12,000/年` + 進度 bar<br>• 到期 30 日內自動顯示紅色 `Renew now` button<br>• Ended：合併同類（`ONYX 1 Day Access × 5`，撳入睇個別日期）<br>• 底部細字：`已付總額 HK$ 24,300 · 加入 2024-08-15` |
| **QR code 頁（現有 check-in）** | 純粹全 screen QR | 單調、無 context（邊間店、會員姓名、expire countdown）；掃完無 confirmation；無 tip | 新 Face check-in screen：<br>• 頂：`Face Check-in @ GO24 Taikoo` + 關閉 `×`<br>• 中：圓形 camera view + face outline guide + countdown `3 · 2 · 1`<br>• 自動影相（user 唔使撳掣）<br>• 成功：全 screen 綠 ✅ + `歡迎 Anthony` + 會籍 / PT 資訊 + haptic<br>• 失敗：紅 + `再試一次` / `用 QR` fallback button<br>• 底細字 tip：`請除口罩 · 光線要充足`<br>新 QR fallback：同上但顯示 QR + 會員姓名 + 店名 + 30s refresh |
| **Activities 頁** | 兩種 icon 分 class / visit | 無 summary、無 filter、無 streak | 新版頂部加 stat row：`本月 12 次 🔥` / `連續 5 日` / `年度 87 次`；加 filter chip：`全部 / 團體課 / PT / 入場`；加 heat-map view toggle |
| **Notifications** | 時間標籤、Mark all as read | 全部係 broadcast announcement；**零個人通知**；無分類；5 店全部推；長標題截；無 type icon | 新版分 2 個 tab：<br>**① 我嘅 (personal)** — 預約確認 / 候補升級 / 堂前提醒 / PT reminder / 到期警告 / 付款通知（每條有 action button）<br>**② 公告 (announcements)** — 只推我 favourite 店 + 全店 critical；用 icon 分：🔧 維修 / 🕐 時間 / 🎉 promo<br>Header 加 filter chip（`未讀 / 全部`）；Mark all read 改做 header 細 link 唔佔 primary CTA |
| **Waitlist confirm modal** | 簡潔；CANCEL / CONFIRM 清楚 | 無講排第幾；無講 waitlist 規則（幾時通知？幾時 auto-upgrade 到 confirmed？）；無講 push notification opt-in | 新 app：加「你會排第 3 位，前面有人 cancel 會 WhatsApp + push 通知你，需要 5 分鐘內 confirm」；toggle「收通知」default on |
| **Dashboard** | Nearest club + 時間、QR code tile 突出、waitlist position 橙 banner 清楚、rating prompt、bell + count | 會籍到期日要 tap 先見；**完全無 PT 餘堂**；無 streak / visit stats；"What's your goal?" 佔太多位無 action；得 1 個 upcoming class；無下一堂 countdown | 新 app Dashboard 重新設計（由上至下）：<br>① Header：GO24 logo + bell<br>② **Next class countdown** card（`下一堂：14:30 Reformer @ Taikoo，仲有 2h 13m`）<br>③ **Stats row**：會籍剩 47 日 ｜ PT 餘 8 堂 ｜ 本月 12 次 🔥<br>④ **🌟 大 Face Check-in button**（佔 1/3 screen，圓形藍綠漸變，一撳即開相機）<br>⑤ **Secondary actions (row)**：QR code · Book class · Renew<br>⑤ Upcoming classes（全部 list，可 swipe）<br>⑥ Nearest club（縮細啲）<br>⑦ Rating prompt（只有有待評）<br>⑧ Goal（可 dismiss） |
| **PT 餘堂 / session** | （未見到）| - | 要睇多啲 screenshot |
| **Check-in 入閘** | （未見到）| - | 要睇多啲 screenshot |

### Tab 結構 — 新 app 建議沿用 + 改良

**Member App**（4 tab，對齊現有）：
1. **Dashboard** — streak、下一堂、會籍倒數、PT 餘堂（整合左所有關鍵 info 喺首頁）
2. **Find Clubs** — map + list
3. **Classes** — book 堂（核心 feature，放第 3 格方便大拇指）
4. **Profile** — membership / activities / settings 收埋

**Trainer App**（✨ Greenfield，4 tab 新設計 — 教練現有零 mobile 工具，呢個係行業新事）：
1. **Today** — 今日 schedule（團體課 + PT）、帶堂簽到（Face scan 會員 / QR / 手動）、no-show 標示、堂前 check list
2. **Members** — 我帶緊嘅會員 list（search / filter），每個會員：PT 餘堂、agreement、歷史 log、body metrics
3. **PT Log** — 完成一堂即填：動作 / 重量 / 組數 / 備註 / 相 / 影片；template 複用；歷史查詢
4. **Me** — 本月佣金（只我自己）、schedule 調休申請、我 profile、enrol 新會員人臉

### Screenshot 收集完成 ✅

已 capture 現有 app 所有主要 screen（Dashboard / Activities / Memberships / Find Clubs / Book classes list / Class details / Waitlist modal / Book success modal / Profile）。

- **QR check-in**：確認淨係全屏 QR，無其他 info
- **PT session**：確認 **現有 app 根本冇呢個 feature**
- **Trainer**：確認 **完全無 mobile app**（用 PGM web 喺電腦）
