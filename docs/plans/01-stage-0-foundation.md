# Stage 0 — Monorepo Foundation

**估時**：3-5 日
**前置**：無
**目標**：`pnpm dev` 一 command 起 member-app + trainer-app + NestJS + Postgres
**狀態**：🟡 Scaffold 完成（2026-04-24, commit `4bb0a78`），但 review 揭多 🔴 critical pre-flight 未做（見下）

## Tasks

- [x] 0.1 `pnpm init` + `pnpm-workspace.yaml`（apps/* packages/* backend/*）
- [x] 0.2 Root `tsconfig.base.json`, `.prettierrc`, `.gitignore`, `.editorconfig`
- [x] 0.3 Install Turborepo，寫 `turbo.json`（dev / build / lint / typecheck / test pipeline）
- [x] 0.4 Move 現有 `member-app` → `apps/member-app`
- [x] 0.5 Scaffold `apps/trainer-app`（`create-expo-app` blank-typescript，port 8082）
- [x] 0.6 Scaffold `backend/nest-api`（`nest new`）
- [x] 0.7 4 packages：`shared-ui`, `api-client`, `shared-types`, `config` — 每個有 `package.json` + `tsconfig.json` + `src/index.ts`
- [x] 0.8 `infra/docker/docker-compose.yml`：Postgres 16 (pgvector) + Redis 7；init SQL enable `vector` + `uuid-ossp`
- [x] 0.9 GitHub Actions CI workflow：lint / typecheck / test
- [x] 0.10 `README.md` setup guide + `.env.example`（PGM / Adyen / JWT / DB / Redis / n8n vars）
- [x] 0.11 `pnpm install` 完成（1002 packages, 3m 24s）✅
- [x] 0.12 Turbo 鏈通驗證：`turbo run dev --dry-run` 見到 7 packages（4 shared + member + trainer + nest），typecheck graph 正常
- [ ] 0.13 Root `.eslintrc` — 等 Stage 1 開始寫 TS code 先加
- [x] 0.14 `git init` + first commit (`4bb0a78`) + push to https://github.com/anthonychu-spec/go24-mobile
- [ ] 0.15 部手機試 `pnpm --filter member-app dev` → scan QR 驗證 member-app 起到

## Tasks 補充（review 後加，🔴 critical 要做完先入 Stage 1）

### Pre-flight（Stage 0 → Stage 1 前必做）

- [ ] 0.16 🔴 **手機 reach API 方案**：揀 ngrok / Tailscale / LAN，document 喺 README
- [ ] 0.17 🔴 **WhatsApp OTP cost validation**：確認現有 n8n WhatsApp 月 quota 夠 ~20k 條，定義 trusted device 機制
- [ ] 0.18 🔴 **Face engine spike**（1-2 日）：AWS Rekognition + Azure Face + face-api.js 各 sample 一張 → benchmark 速度 / 成本 / 準確度 → lock 揀
- [ ] 0.19 🔴 **PGM staging API access**：問 Perfect Gym sales 攞 staging credentials（無 staging = 大死）
- [ ] 0.20 🔴 **PDPO Privacy policy draft**（face data section）— Stage 5 上線之前一定要 ready
- [ ] 0.21 🟡 **Time zone convention** lock：所有 DB column `TIMESTAMPTZ`，server / Postgres 跑 UTC，client display HKT

### Code quality（停 CI 假綠）

- [ ] 0.22 🟡 真 ESLint config：root `eslint.config.js`，apps / backend extend；用 `@typescript-eslint`、`prettier`
- [ ] 0.23 🟡 真 Jest config：member-app + trainer-app 加 `jest-expo`，nest-api 已有 `jest`
- [ ] 0.24 🟡 替換 `echo "tbd"` stubs 為真 commands；CI 唔再假綠
- [ ] 0.25 🟡 Husky + lint-staged：pre-commit lint + format
- [ ] 0.26 🟡 `.nvmrc` 寫死 Node `20`，CI / 本機一致

### Infra polish

- [ ] 0.27 🟡 GitHub Actions 加 `cache: pnpm` + `timeout-minutes: 15`
- [ ] 0.28 🟡 Trainer-app 預設 port 改 8082（已 set 喺 dev script，但 `start` script 同步）
- [ ] 0.29 🟢 Postgres backup script `infra/scripts/backup.sh` + cron（Stage 10 才 enable，但 script 而家寫）
- [ ] 0.30 🟢 1Password / Bitwarden vault 開帳 store secrets（API keys / Adyen / PGM）

## 驗收

新手 clone repo → 照 README 15 分鐘內跑到所有 service。

## Notes / Decisions

- **Monorepo root**：`C:/Users/LENOVO/Documents/Perfect Gym/`（原 `pgm-import` 作 sibling 保留，唔入 workspace）
- **Package manager**：pnpm 10.33.2
- **Node**：v24.14.1（實際 machine），`engines.node` 設 `>=20`
- **Ports**：member-app 8081、trainer-app 8082、nest-api 3000
- **DB image**：揀 `pgvector/pgvector:pg16`（自帶 pgvector extension）— Stage 5 Face check-in 要用
- **Expo**：v54.0.33 + React 19 + RN 0.81
- **NestJS**：v11
- **Dev script aliasing**：每 sub-package 加 `dev` script，Turbo 統一 run
- **`.vscode/`、`ios/`、`android/`** 已入 `.gitignore`

## Blockers

(none)
