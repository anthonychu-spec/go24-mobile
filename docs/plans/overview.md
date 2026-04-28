# Plan: Replace Perfect Gym Pro with Custom Member + Trainer Apps

> **Overview file** — 呢個係 roadmap 同導航頁。詳細內容分散喺：
> - **[`00-architecture.md`](for-for-refactored-tiger/00-architecture.md)** — data model、API、blueprint、production hardening 長期 reference
> - **12 個 stage 檔案** — 執行 checklist（見下面 table）

---

## Context

Gym 而家用 **Perfect Gym Pro (PGM)**。已經有 n8n 每日 import PGM 數據入自己 Postgres (`gym_members`, `gym_sales`, `gym_pt`) + WhatsApp AI bot 畀老闆查數。

用戶（GO24 Fitness / ONYX by GO24，5+ 店、5000+ 會員）想自起兩個 mobile app 取代 PGM 前端：

- **Member App** — book 堂、續會、查 PT、**Face 出入閘（旗艦 feature）**
- **Trainer App** — 更表、帶堂簽到、PT log、佣金（greenfield — 教練現無 mobile app）

策略：**Phase 1 co-exist**（app 透過 PGM API 做主要 CRUD，自己 DB 做 AI/報表）→ **Phase 2 逐步 replace**（自己 DB 變 source of truth）→ 最終停用 PGM。

---

## Tech Stack（一眼總覽）

| 層 | 選擇 |
|---|---|
| Mobile | React Native + Expo (EAS Build) — 一套 codebase 出 iOS+Android |
| Backend | NestJS (Node.js) + Postgres + Redis + BullMQ |
| Auth | **Reuse PGM credentials** → backend issue 自己 JWT (15min + 30日 refresh) — 零 OTP / 零 WhatsApp 依賴 |
| Payment | Adyen Pay by Link（現有 gateway）|
| Face | App 影相 → n8n + face engine（AWS Rekognition / Azure / self-host）|
| Monorepo | pnpm workspace + Turborepo |
| Infra | Self-host Docker + Cloudflare Tunnel + Postgres Primary+Replica |

---

## System Architecture

```
┌─────────────────┐   ┌─────────────────┐
│  Member App     │   │  Trainer App    │   React Native (Expo)
│  (iOS+Android)  │   │  (iOS+Android)  │
└────────┬────────┘   └────────┬────────┘
         └──────────┬──────────┘
                    │ HTTPS (JWT + Idempotency-Key)
                    ▼
         ┌──────────────────────┐
         │  NestJS API Gateway  │   ★ IBookingRepo interface (swap-friendly)
         └──────┬───────────────┘
                │
      ┌─────────┼───────────┬────────────────┐
      ▼         ▼           ▼                ▼
   ┌──────┐ ┌────────┐ ┌──────────┐   ┌─────────────┐
   │ Own  │ │ PGM    │ │ n8n face │   │ Adyen +     │
   │ PG + │ │ REST   │ │ matching │   │ WhatsApp    │
   │ Redis│ │ API    │ │ (pgvector│   │ via n8n     │
   └──────┘ └────────┘ └──────────┘   └─────────────┘
```

詳細見 [`00-architecture.md`](for-for-refactored-tiger/00-architecture.md)。

---

## 🚩 新 App Differentiator（對 PGM）

1. 🌟 **Face check-in**（旗艦，PGM 冇）
2. 🌟 **Trainer mobile app**（行業稀缺，PGM 教練只 web）
3. 💎 **PT Session 模組**（PGM app 零 PT UI）
4. 💎 **Personal notifications**（預約 / 候補 / 到期 / PT reminder — PGM 全零）
5. 💎 **Dashboard 有料**（countdown / streak / 餘堂集中）
6. 💎 **Book 後 follow-through**（calendar / reminder）
7. 💎 **Smart class list**（capacity / already-booked badge / favourite filter）
8. 💎 **Memberships 清晰**（日期 / 進度 / inline renew）

---

## Stage Roadmap（→ click 入去睇 checklist）

| Stage | 名稱 | 估時 | 累計 | 檔案 |
|---|---|---|---|---|
| 0 | Monorepo Foundation | 0.5 週 | 0.5 | [01-stage-0-foundation.md](for-for-refactored-tiger/01-stage-0-foundation.md) |
| 1 | Auth (OTP + JWT) | 2 週 | 2.5 | [02-stage-1-auth.md](for-for-refactored-tiger/02-stage-1-auth.md) |
| 2 | PGM Adapter Hardening | 3 週 | 5.5 | [03-stage-2-pgm-adapter.md](for-for-refactored-tiger/03-stage-2-pgm-adapter.md) |
| 3 | Booking + State Machine | 3 週 | 8.5 | [04-stage-3-booking.md](for-for-refactored-tiger/04-stage-3-booking.md) |
| 3.5 | Data Sync Tier 1 | 1 週 | 9.5 | [05-stage-3.5-sync.md](for-for-refactored-tiger/05-stage-3.5-sync.md) |
| 4 | Adyen Payment Link | 1 週 | 10.5 | [06-stage-4-payment.md](for-for-refactored-tiger/06-stage-4-payment.md) |
| **5** | **Face Check-in 🌟** | **4 週** | **14.5** | [07-stage-5-face.md](for-for-refactored-tiger/07-stage-5-face.md) |
| 6 | PT Session 模組 | 2 週 | 16.5 | [08-stage-6-pt.md](for-for-refactored-tiger/08-stage-6-pt.md) |
| 7 | Notifications | 1 週 | 17.5 | [09-stage-7-notifications.md](for-for-refactored-tiger/09-stage-7-notifications.md) |
| 8 | UI Polish | 2 週 | 19.5 | [10-stage-8-ui-polish.md](for-for-refactored-tiger/10-stage-8-ui-polish.md) |
| 9 | Beta | 3 週 | 22.5 | [11-stage-9-beta.md](for-for-refactored-tiger/11-stage-9-beta.md) |
| 10 | Launch | 2 週 | 24.5 | [12-stage-10-launch.md](for-for-refactored-tiger/12-stage-10-launch.md) |

**理論估時 ≈ 24-25 週（5.5-6 個月）**，1 人全職。2 人可縮到 3-3.5 個月。

**🚨 真實估時建議 +30-50% buffer = 7-9 個月**（軟件項目 100% slip，預埋未知風險、PGM API quirk、App Store 審批 back-and-forth、face engine 調 threshold 等）。

**執行原則**：
- 每 stage = 1 git branch + PR
- 前一 stage merge 後先做下一個
- 每 stage 有驗收標準（見 stage file）先過關

---

## Answered Key Decisions

| 決定 | 結果 |
|---|---|
| PGM API | ✅ 有 REST API + 文件，直接寫 adapter |
| 規模 | 5+ 店、5000+ 會員 → infra 認真做（replica / redis / queue） |
| Payment | Adyen Pay by Link（現有 gateway）|
| Commission 可見性 | Trainer 只睇自己 |
| Face engine | App 只負責影相 — **engine spike 移前到 Stage 0.18**（唔好 Stage 5 才知選錯）|
| Trainer 現狀 | 零 mobile — Trainer app 完全 greenfield |
| Priority | Face check-in 係最重要 feature |

## Still Open

- **PDPO Privacy policy review**：邊個律師 / compliance review？draft 喺 Stage 0.20 開始，Stage 5 face ship 之前一定要有 v1，Stage 9 final review
- **PGM staging API access**：要問 Perfect Gym 攞（Stage 0.19）— 無 staging = booking 唯有 prod test，極危險
- **WhatsApp OTP cost**：5000 會員月 ~HK$11k OTP 開支可接受？定要做 trusted device + SMS fallback aggressively？

---

## 🔴 Pre-flight Blockers（Stage 1 前必做，否則全 plan 行唔通）

1. **手機 reach API 方案**（ngrok / Tailscale / LAN）— Stage 0.16
2. **Face engine spike + lock**（1-2 日 benchmark）— Stage 0.18
3. **PGM staging credentials** — Stage 0.19
4. **WhatsApp OTP cost validation + SMS fallback** — Stage 0.17
5. **PDPO privacy policy v1 draft**（face data section）— Stage 0.20
6. **真 ESLint + Jest setup**（停 CI 假綠）— Stage 0.22-24

詳見 `for-for-refactored-tiger/01-stage-0-foundation.md` § Tasks 補充。

---

## Risks & Mitigation（摘要）

| Risk | Mitigation |
|---|---|
| PGM silent failure | Shadow read + circuit breaker + pending_verify + reconcile job |
| 部手機 reach 唔到 dev API | Stage 0.16 lock 方案（ngrok / Tailscale）|
| WhatsApp OTP cost 爆 | Trusted device 30 日 + SMS fallback + rate limit |
| Face engine 揀錯 | Stage 0.18 spike 移前；唔等到 Stage 5 才知 |
| Postgres 死 / 數據 lost | Daily `pg_dump` + WAL archive + 月 restore drill |
| 舊 PGM app 撞新 backend | `min_supported_version` force-upgrade modal |
| 用戶反映 offline 入唔到閘 | App 端 cache class list + write outbox queue retry |
| Time zone bug（HKT vs UTC）| 全 column TIMESTAMPTZ + server UTC + client convert |
| iOS App Store reject face | PDPO policy + opt-in flow draft from Stage 0，Stage 5 ship 前 final |
| DB 同 PGM drift | Tiered sync + Conflict Resolver（source + version）|
| Booking race condition | Idempotency-Key + state machine + atomic claim |
| Face false positive / PDPO | Opt-in consent + similarity threshold + deletion UI |
| App Store 審批 | Privacy policy + 清楚 camera usage description |
| 會員唔慣新 app | Trainer 先 onboard，新會員強制、舊會員 opt-in |

詳細見 [`00-architecture.md`](for-for-refactored-tiger/00-architecture.md) § Production Hardening。

---

## 檔案結構

```
.claude/plans/
├── for-for-refactored-tiger.md         ← (你而家睇緊) Overview + navigation
└── for-for-refactored-tiger/
    ├── 00-architecture.md              ← Data model + API + Blueprint + Hardening + UI ref
    ├── 01-stage-0-foundation.md
    ├── 02-stage-1-auth.md
    ├── 03-stage-2-pgm-adapter.md
    ├── 04-stage-3-booking.md
    ├── 05-stage-3.5-sync.md
    ├── 06-stage-4-payment.md
    ├── 07-stage-5-face.md              ← 🌟 flagship
    ├── 08-stage-6-pt.md
    ├── 09-stage-7-notifications.md
    ├── 10-stage-8-ui-polish.md
    ├── 11-stage-9-beta.md
    ├── 12-stage-10-launch.md
    └── 13-flows.md                       ← 19 個 logic flow 每步運作（寫 code 前 confirm）
```

**邊個時候睇邊個檔案**：
- **Big picture / 睇進度** → 呢個 overview file
- **寫 code 前查 data model / API / blueprint** → `00-architecture.md`
- **寫某 flow 前對 logic** → `13-flows.md`
- **做緊 Stage N** → `0X-stage-N-*.md`（focus 單一 stage checklist）
