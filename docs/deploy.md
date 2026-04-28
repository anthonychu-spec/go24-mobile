# Deployment Guide — DigitalOcean Droplet

End-to-end setup from "no server" → "API live with auto-deploy from main".

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Cloudflare (free)                                       │
│  - DNS: api.go24-dev.fitness → droplet IP                │
│  - DDoS / WAF / TLS termination (origin: Caddy)          │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTPS
                   ▼
┌──────────────────────────────────────────────────────────┐
│  DigitalOcean Droplet (Singapore, s-2vcpu-4gb)           │
│  Ubuntu 24.04                                            │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Caddy (auto-SSL, security headers, gzip)        │    │
│  │  ↓                                               │    │
│  │  ┌────────────────┐  ┌──────────┐  ┌─────────┐  │    │
│  │  │ NestJS API     │  │ Postgres │  │ Redis   │  │    │
│  │  │ :3000 internal │──│ :5432    │  │ :6379   │  │    │
│  │  └────────────────┘  └──────────┘  └─────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **DigitalOcean account** — sign up if not yet
2. **GitHub repo** (already done — anthonychu-spec/go24-mobile)
3. **Cloudflare account** — for DNS + DDoS protection
4. **Domain** — e.g. go24.fitness（你現有？或者用 free `*.go24-dev.tk` 都得）
5. **SSH key** on your Windows machine — for connecting to droplet

## Steps

### 1. Generate SSH key (Windows PowerShell)

```powershell
ssh-keygen -t ed25519 -C "trudy@go24.fitness" -f $env:USERPROFILE\.ssh\go24_droplet
# 提示 passphrase 可空白可填密碼
# 輸出 2 個檔案：go24_droplet (private) + go24_droplet.pub (public)
type $env:USERPROFILE\.ssh\go24_droplet.pub
# 複製整段 ssh-ed25519 ... 你下一步要用
```

### 2. Create droplet

DigitalOcean dashboard → Create → Droplet
- **Region**: Singapore (sgp1)
- **Image**: Ubuntu 24.04 LTS x64
- **Size**: **s-4vcpu-8gb ($48/mo)** — confirmed for 15k members + face matching workflow + queue + Postgres + Redis 同 droplet
  - 慳啲：s-2vcpu-4gb ($24/mo) for staging-only without face engine
  - 緊：s-2vcpu-2gb ($12/mo) tight
- **Auth**: SSH key → paste public key from step 1
- **Hostname**: `go24-staging`
- **Backups**: Enable weekly snapshot (+20% = $4.80/mo, 強烈建議)
- **Monitoring**: Enable (free)
- Click **Create Droplet**

After ~1 min, copy droplet's public IP, e.g. `159.65.x.y`

### 3. First connect + run setup script

```powershell
ssh -i $env:USERPROFILE\.ssh\go24_droplet root@<DROPLET_IP>
# 輸入 yes 接受 host key

# 喺 droplet 入面 run setup script
curl -fsSL https://raw.githubusercontent.com/anthonychu-spec/go24-mobile/main/infra/droplet/setup.sh | bash

# Script 做：
# ✓ 升級 system packages
# ✓ 裝 Docker + Compose
# ✓ Firewall (UFW): 只開 22/80/443
# ✓ Fail2ban (防 SSH brute force)
# ✓ 起 deploy user + 2GB swap
# ✓ Postgres daily backup cron
# ✓ SSH hardening (disable password auth)
```

### 4. Clone repo + 配 .env

```bash
# 仍喺 droplet 入面
sudo -u deploy bash
cd /opt/go24
git clone https://github.com/anthonychu-spec/go24-mobile.git .

cp .env.example .env
nano .env
# 填：
#   POSTGRES_USER=go24
#   POSTGRES_PASSWORD=<生個 32-char random>
#   POSTGRES_DB=go24
#   REDIS_PASSWORD=<生個 32-char random>
#   JWT_SECRET=<生個 64-char random>
#   PGM_API_BASE=https://go24fitness-hk.perfectgym.pl/Api/v2.2
#   PGM_CLIENT_ID=<your real PGM client id>
#   PGM_CLIENT_SECRET=<your real PGM client secret>
#   PGM_OTP_DESTINATION=Email
#   API_DOMAIN=api.go24-dev.fitness
```

生 random secret tip：
```bash
openssl rand -hex 32      # 64 char hex
openssl rand -base64 32   # 44 char base64
```

### 5. Cloudflare DNS

1. 將 domain 加入 Cloudflare（如未做）
2. DNS 加 A record：
   - Name: `api.go24-dev` (或 staging / dev 隨意)
   - Content: 你 droplet IP
   - Proxy: **DNS only** (灰雲)，Caddy 自己出 cert；或者 Proxied (橙雲) + Full(strict) mode
3. Wait 1-2 min DNS propagate

### 6. Start stack

```bash
cd /opt/go24
docker compose -f infra/droplet/docker-compose.prod.yml up -d --build

# 第一次 build ~5-8 分鐘
# 之後 Caddy auto 攞 Let's Encrypt cert (~30s)

# Watch logs
docker compose -f infra/droplet/docker-compose.prod.yml logs -f api
```

### 7. Test from your machine

```powershell
curl https://api.go24-dev.fitness/v1/auth/me
# Expected: 401 Unauthorized (because no JWT) → 即係 server up
```

或者 browser 開 `https://api.go24-dev.fitness/api-docs` 睇 Swagger UI。

### 8. GitHub Actions auto-deploy

GitHub repo → Settings → Secrets and variables → Actions → New repository secret：

- `DROPLET_HOST` = droplet IP（或 `api.go24-dev.fitness`）
- `DROPLET_SSH_KEY` = paste private key（**完整檔案內容**，包括 `-----BEGIN OPENSSH PRIVATE KEY-----` 開頭）

之後每次 `git push origin main` 自動 deploy（見 .github/workflows/deploy.yml）。

## VS Code Remote-SSH（推薦 dev 體驗）

```
1. VS Code Extensions: 裝 "Remote - SSH"
2. F1 → Remote-SSH: Connect to Host
3. + Add New SSH Host → 輸入：
     ssh -i C:\Users\LENOVO\.ssh\go24_droplet deploy@<DROPLET_IP>
4. 揀 Linux → 連入
5. Open folder → /opt/go24
6. 之後喺 VS Code 寫 code，save 直接喺 droplet
   Hot reload nest-api: 開 terminal 跑 docker compose ... up + bind mount source 入 container
```

## Daily ops

```bash
# Status
docker compose -f infra/droplet/docker-compose.prod.yml ps

# Logs
docker compose -f infra/droplet/docker-compose.prod.yml logs -f api caddy

# Restart api
docker compose -f infra/droplet/docker-compose.prod.yml restart api

# DB shell
docker exec -it go24-postgres psql -U go24 go24

# Backup manually
sudo -u deploy /opt/go24/backup.sh

# Update + redeploy (or use GitHub Actions)
cd /opt/go24
git pull
docker compose -f infra/droplet/docker-compose.prod.yml up -d --build
```

## Troubleshooting

**Caddy 攞唔到 cert**：DNS A record 仲未 propagate / 80 port 唔通。
**API 啟動 timeout**：`docker logs go24-api` 睇 error；常見係 DB password / PGM creds 錯。
**out of memory**：升級 droplet（5000+ active concurrent 可能要 8GB）。

## Costs

| Item | Monthly |
|---|---|
| Droplet s-4vcpu-8gb | US$48 |
| Backups (weekly snapshot) | US$9.60 |
| Cloudflare | $0 (free tier) |
| Domain | ~US$10/年 (HKD ~$78/月 = ~$6.5) |
| **Total** | **~US$64/月** (~HK$500) |

升 production 加：staging droplet (US$24) + DO managed Postgres (US$15+) + Sentry team (US$26) ~ US$130/mo total.
