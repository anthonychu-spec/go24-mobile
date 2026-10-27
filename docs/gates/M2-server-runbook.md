# M2 · 開 production API 機 — 決定表＋操作手冊

日期：2026-10-26 · 狀態：**準備好，未開機、未用錢**（閘口 M2＝舊 G5＋B1＋B2）
上層：[`../backend-plan.md`](../backend-plan.md)「基建」· 檔案：`infra/droplet/`、`.github/workflows/deploy.yml`
寫法：只寫變數**名**，冇任何 secret 值。所有開機、DNS、GitHub secret、deploy 都要 Anthony 親口批。

---

## 0. 開機之前一定要先做（唔做會出事）

| # | 事項 | 點解 |
|---|---|---|
| P1 | **先將 `feat/backend-week1` 合入 `main`**（之前要將 GO24 prototype commit `ef48202` 搬走，見 `STATE.md`） | `origin/main` 嘅 `deploy.yml` 仲係**舊版：push `main` 就自動 deploy**，health check 失敗都照報成功；`main` 亦冇 migration、冇 webhook secret 修正。一喺 GitHub 設咗 `DROPLET_HOST`／`DROPLET_SSH_KEY`，下一個 push 到 `main` 就會將舊 code 推上新機。 |
| P2 | 合入 `main` 之後，`main` 上嘅 CI（`ci.yml`）要綠 | 新 `deploy.yml` 要求個 SHA 有一次成功 CI。CI 只喺 push／PR 到 `main`、`dev` 先行，`feat/*` branch 嘅 commit 冇 CI 記錄，deploy 唔到。 |
| P3 | §5 **I1、I2 已修，commit 咗（`59080fb`，`feat/backend-week1`）**：隨 P1 合入 `main` | 修正前就算 `.env` 寫齊，container 都收唔到部分變數。 |
| P4 | 決定 B8（換唔換 PGM／Adyen key）同 §1 嘅 domain | `.env` 要用。 |

---

## 1. 決定表（俾 Anthony）

### 1.1 機同每月成本（DigitalOcean，2026-10-26 查官網價）

| 項目 | 揀 | 每月 US$ |
|---|---|---|
| Droplet | **SGP1（新加坡）**，Basic Regular **`s-2vcpu-4gb`**（2 vCPU／4 GB／80 GB SSD），Ubuntu 24.04 LTS | 24.00 |
| Droplet 備份 | **每星期**（Droplet 價 20%）。DB 另有每日 `pg_dump`，所以唔使揀每日（30%＝US$7.20） | 4.80 |
| Spaces（放 DB 備份） | 一個 bucket，SGP1；基本費包 250 GiB 儲存＋1 TiB 流出 | 5.00 |
| Monitoring | DigitalOcean 內置 metrics／alert | 0 |
| **合共** | | **≈ 33.80**（揀每日 Droplet 備份就 ≈ 36.20） |

可選（唔計入上面）：
- **UptimeRobot**：免費 plan（50 個 monitor、5 分鐘一次）據第三方資料**自 2024 年尾只限非商業用途**；正式商用要 Solo plan，約 US$9–10／月（未喺 UptimeRobot 官網核實）。替代：DigitalOcean 內置 Uptime check、或者其他有免費商用 plan 嘅服務。見 §4。
- **Sentry**：免費 Developer plan 應該夠 v1（1 人、每月有限錯誤量；以 Sentry 官網為準）。
- 價錢未計稅；DigitalOcean 按小時計，月尾封頂。

> **批：** ☐ 開 `s-2vcpu-4gb` SGP1＋每星期備份＋Spaces，約 US$34／月（決定 B2）

為乜係 2 vCPU／4 GB：v1 得一個 API instance（rate limit 喺 memory）＋Postgres＋Caddy；冇 face engine。`docs/deploy.md` 寫 `s-4vcpu-8gb`（US$48）係舊估計（包 face matching），而家唔需要。之後要升級可以喺 DO 撳 Resize（只升 CPU／RAM 唔升 disk 可以再降返）。

### 1.2 API domain（決定 B1：三個品牌共用一個）

App 用 `X-App-Brand` header 分品牌，所以 **一個 domain 就夠**；Caddy 自動出 Let's Encrypt cert。

| 方案 | 例子 | 好處 | 壞處 |
|---|---|---|---|
| **A（建議）** | `api.go24fitness.com` | 集團已經用緊呢個 domain（舊 staging 係 `api-staging.go24fitness.com`），唔使買新 domain | 名有「GO24」，LAB／Foundry 用戶睇 network 會見到（一般用戶唔會見） |
| B | `api.<新中性集團 domain>` | 品牌中立 | 要買 domain＋設 DNS，多一步 |
| C | 每個品牌一個（`api.thelab…` 等） | — | 違反 B1；三張 cert、三套 app 設定，**唔建議** |

注意：`infra/droplet/setup.sh` 預設寫 `api-staging.go24.fitness`、`docs/deploy.md`／`docs/cloudflare.md` 寫 `api.go24-dev.fitness`，兩個都唔係我哋已知擁有嘅 domain，唔好照用。

> **批：** ☐ API domain ＝ `__________________`（建議 `api.go24fitness.com`）

### 1.3 要加嘅 DNS record

開咗 droplet、攞到 IP 之後，喺 domain 嘅 DNS（`go24fitness.com` 而家喺邊度管 DNS 要先確認；`docs/cloudflare.md` 假設 Cloudflare）加：

| Type | Name | Value | Proxy | TTL |
|---|---|---|---|---|
| `A` | `api` | `<droplet IPv4>` | **DNS only（灰雲）** | Auto／300 |
| `CAA`（可選） | `@` 或 `api` | `0 issue "letsencrypt.org"` | — | Auto |

- 第一版用 **DNS only**（`cloudflare.md` 方案 A）：Caddy 自己攞 cert，client IP 直接到機，per-IP rate limit 先準。
- 如果之後要開 Cloudflare 橙雲（Proxied），要同時改 Caddy 信任 Cloudflare IP（見 §5 I9），否則全部人嘅 rate limit 會當成同一個 IP。
- 如果 domain 已經有 CAA record，要包 `letsencrypt.org`，否則 Caddy 攞唔到 cert。
- 唔好開 IPv6 `AAAA` record，除非 droplet 開咗 IPv6 而且 ufw 已設好。

### 1.4 一覽：要 Anthony 批／做嘅嘢

| # | 事項 | 邊個做 |
|---|---|---|
| 1 | 批每月約 US$34（B2） | Anthony |
| 2 | 揀 API domain（B1） | Anthony |
| 3 | B8：PGM、Adyen key 換唔換（見 §2.4） | Anthony |
| 4 | 合 `feat/backend-week1` → `main`（P1） | Anthony 批 merge／push |
| 5 | 開 droplet＋Spaces、加 DNS、設 GitHub secrets | Anthony（或者佢喺 session 明示授權） |
| 6 | 撳第一次 deploy | Anthony |
| 7 | Sentry、UptimeRobot（或替代）開帳戶 | Anthony |

---

## 2. 操作手冊：由空機到 API 健康

> 下面用 `<API_DOMAIN>`、`<DROPLET_IP>`、`<SHA>` 做佔位。每步之後有「✓ 檢查」。

### 2.1 喺 DigitalOcean 開機（Anthony）

1. Create → Droplet：Region **Singapore SGP1**；Image **Ubuntu 24.04 (LTS) x64**；Size **Basic › Regular › s-2vcpu-4gb**；Authentication **SSH key**（唔好用密碼）；Backups **Weekly**；Monitoring ✓；Hostname `go24-api-prod`；Tags `go24`, `prod`。
2. 開 **Cloud Firewall**（免費）：Inbound 只准 TCP 22（最好限 Anthony／辦公室 IP）、80、443；Outbound 全開；套落呢部機。（機入面 `ufw` 都會再擋一次。）
3. 記低 `<DROPLET_IP>`。
4. 加 DNS `A` record（§1.3）。

✓ `nslookup <API_DOMAIN>` 返 `<DROPLET_IP>`。

### 2.2 行 `setup.sh`

`setup.sh` 而家寫死由 GitHub `main` 下載同 clone（§5 I5）。**P1 做完先行**，否則會 clone 到舊 code。

```bash
ssh root@<DROPLET_IP>
# 先睇內容再行（唔好 curl | bash 未睇過嘅 script）
curl -fsSL https://raw.githubusercontent.com/anthonychu-spec/go24-mobile/main/infra/droplet/setup.sh -o /root/setup.sh
less /root/setup.sh
bash /root/setup.sh
```

如果 repo 係 private（本機冇 `gh`，未能確認），`raw.githubusercontent.com` 同 `git clone https://…` 都會失敗：改為喺 GitHub repo 加一條**只讀 Deploy key**（見 2.3），用 `scp` 將 `setup.sh` 抄上機再行。

`setup.sh` 會做：apt 升級、unattended-upgrades、ufw（22/80/443）、fail2ban、Docker＋compose plugin、`deploy` user（docker group）、SSH 關密碼登入、2 GB swap、舊 backup cron（**有 bug，見 §3，唔好靠佢**）、clone repo 去 `/opt/go24`、生 `/opt/go24/.env`（列齊 §2.4 全部變數；Postgres、Redis、JWT、三個 webhook secret 已隨機生成；`API_DOMAIN`、`API_BASE_URL`、`PGM_*`、`ADYEN_*` 要人手填）。

✓ 檢查：
```bash
docker version && docker compose version
ufw status                      # 22, 80, 443 ALLOW
systemctl is-active fail2ban    # active（24.04 早期 fail2ban 有 bug，唔 active 就 apt upgrade fail2ban）
sshd -T | grep -Ei 'passwordauthentication|permitrootlogin'   # no / prohibit-password
swapon --show
ls -la /opt/go24/.env           # -rw------- deploy
```
另外開第二個 terminal 試 `ssh deploy@<DROPLET_IP>` 入到先好關第一個（避免鎖死自己）。

### 2.3 Repo 存取（如果 repo private）

1. 喺 droplet：`sudo -u deploy ssh-keygen -t ed25519 -f /home/deploy/.ssh/github_ro -N ''`
2. 將 `.pub` 加入 GitHub repo → Settings → Deploy keys（**唔好剔 write access**）。
3. `/home/deploy/.ssh/config`：`Host github.com` → `IdentityFile ~/.ssh/github_ro`。
4. `cd /opt/go24 && git remote set-url origin git@github.com:anthonychu-spec/go24-mobile.git && git fetch origin`

✓ `git fetch origin` 唔使密碼。（`deploy.yml` 每次 deploy 都喺機上 `git fetch`，所以呢步係必要。）

### 2.4 `.env`（`/opt/go24/.env`，`chmod 600`，owner `deploy`，**唔入 git**）

由 code 實際讀取嘅變數整理（`grep process.env` ＋ `ConfigService.get`，2026-10-26，branch `feat/backend-week1`；最後對照 `0dade9c`，加咗 `COACHING_NOTIFY_*`）。

點樣傳入（I1、I2 修正後）：
- `docker-compose.prod.yml` 嘅 `api` 用 `env_file: ../../.env`，**成份 `/opt/go24/.env` 原封不動入 container**；`environment:` 只剩 `NODE_ENV`、`PORT`、`DATABASE_URL`、`REDIS_URL`（固定或組合值，會蓋過 `.env` 同名嘅值）。之後 code 加新變數，只要寫入 `.env`，唔使改 compose。
- Compose 本身嘅 `${POSTGRES_PASSWORD}`、`${API_DOMAIN}` 等靠 `--env-file /opt/go24/.env`（`deploy.yml`、`setup.sh` 提示、本手冊命令已統一）。
- 值入面有 `$` 要用單引號包住（`KEY='a$b'`），否則 compose 會當變數展開。
- 冇值嘅可選項目**註解掉，唔好留空**：`APP_BASE_URL`、`API_BASE_URL` 用 `??` 做預設，空字串唔會用預設值。

**來源**：🆕＝新生成（`openssl rand -hex 32`，存入密碼管理器）；♻️＝由救返嘅 `go24-backup/rescue-2026-10-23/go24.env` 還原；✏️＝新填嘅設定值（唔係 secret）。
**B8**：🔁＝一定換；⚠️＝建議換（Anthony 決定）；—＝唔使。

#### A. Compose 用（組合其他變數）

| 變數 | 必要 | 來源 | B8 | 備註 |
|---|---|---|---|---|
| `POSTGRES_USER` | ✓ | ✏️ `go24` | — | |
| `POSTGRES_PASSWORD` | ✓ | 🆕 `setup.sh` 會生 | 🔁 | 新 DB，唔好用舊值 |
| `POSTGRES_DB` | ✓ | ✏️ `go24` | — | |
| `REDIS_PASSWORD` | 而家 ✓ | 🆕 `setup.sh` 會生 | 🔁 | code 冇用 Redis；compose 未拎走 redis 前仍然要（§5 I6） |
| `API_DOMAIN` | ✓ | ✏️ §1.2 決定 | — | Caddy 用；`setup.sh` 預設值錯，要改 |

#### B. API 讀嘅（compose `environment:` 已有）

| 變數 | 必要 | 來源 | B8 | 備註 |
|---|---|---|---|---|
| `NODE_ENV` | ✓ | compose 寫死 `production` | — | production 會關 Swagger；PGM key 冇設會即刻 crash |
| `PORT` | ✓ | compose 寫死 `3000` | — | |
| `DATABASE_URL` | ✓ | compose 由 `POSTGRES_*` 組合 | — | 唔使寫入 `.env` |
| `JWT_SECRET` | ✓ | 🆕 `setup.sh` 會生 | 🔁 | 冇設 API 起唔到（`jwt.strategy.ts`）。換咗之後舊 token 全部失效（新機冇舊用戶，冇影響） |
| `JWT_EXPIRES_IN`、`JWT_REFRESH_EXPIRES_IN` | ✗ | 唔使 | — | **code 冇讀**（寫死 15m）；I2 修正時已由 compose 同 `.env` 模板刪走 |
| `PGM_API_BASE` | ✓ | ♻️（唔係 secret） | — | `https://go24fitness-hk.perfectgym.pl/Api/v2.2` |
| `PGM_CLIENT_ID` | ✓ | ♻️ 或 PGM 發新 | ⚠️ | production 冇設會 crash（`pgm.client.ts`） |
| `PGM_CLIENT_SECRET` | ✓ | ♻️ 或 PGM 發新 | ⚠️ | 舊值曾經放喺已毀嘅機＋本機 backup；建議問 PGM 換（G7 email 可順便問） |
| `PGM_OTP_DESTINATION` | ✗ | ✏️ `Email` | — | |
| `ADYEN_API_KEY` | **✓（起機必要）** | ♻️ 或 Adyen 後台新開 | ⚠️ | `adyen.client.ts` 冇設就 throw，`PaymentsModule` 一定載入 → **v1 唔用付款都要有**（§5 I3） |
| `ADYEN_MERCHANT_ACCOUNT` | **✓（起機必要）** | ♻️ | — | 唔係 secret |
| `ADYEN_ENVIRONMENT` | ✗ | ✏️ | — | code 預設 `TEST`；`setup.sh` 模板寫 `LIVE`，要同 key 一致 |
| `ADYEN_CLIENT_KEY` | ✗ | ♻️ | ⚠️ | 會回俾 app（公開 key），換 API key 時一齊換 |
| `ADYEN_HMAC_KEY` | 付款 webhook 先要 | ♻️ 或新 webhook 新 key | 🔁（跟 B7） | 舊 webhook HMAC 一直 fail（108k 次重試）；B7 建議停舊 webhook，付款第二期設新 webhook＋新 HMAC |
| `PGM_WEBHOOK_SECRET` | 有 webhook 先要 | 🆕 | — | 冇設＝webhook 一律拒絕（安全預設）。要同時設喺 PGM 嗰邊 |
| `N8N_WEBHOOK_SECRET` | 有 n8n 先要 | 🆕 | — | 同時設喺 n8n workflow header `x-webhook-secret` |
| `SUPREMA_WEBHOOK_SECRET` | 有 Suprema 先要 | 🆕 | — | v1 唔用可以留空 |
| `CORS_ORIGINS` | ✗ | ✏️ | — | Native app 唔使。**留空**；N4 網頁刪帳戶頁如果由瀏覽器直接 call API，先加嗰個 origin |
| `EXPO_ACCESS_TOKEN` | 視乎 | 🆕（Expo 帳戶，G1） | — | 只有 Expo project 開咗「Enhanced security for push」先要 |
| `BACKGROUND_JOBS_ENABLED` | ✗ | ✏️ **`false`** | — | 第一次開機一定 `false`；G9 批咗先改 `true`（cron 會寫入真 PGM） |
| `COACHING_NOTIFY_ENABLED` | ✗ | ✏️ **`false`**（唔設＝關） | — | Coaching 諮詢只係存入 DB；`true` 先會通知前台。等 B4 決定送去邊 |
| `COACHING_NOTIFY_WEBHOOK_URL` | ✗ | ✏️ | — | B4 決定後填（例如 n8n webhook）；要同 `COACHING_NOTIFY_ENABLED=true` 一齊先生效 |
| `GYM_DATA_URL` | ✗ | **唔好還原** | — | 舊值指向舊 compose 入面 `postgres` 嘅 `gym_data` DB——新機冇呢個 DB。留空＝上堂歷史返空（`activity.module.ts`）。等 B6 |

#### C. API 讀，以前 compose 冇傳入（I2 修正後經 `env_file` 傳入）

| 變數 | 必要 | 來源 | 備註 |
|---|---|---|---|
| `API_BASE_URL` | ✗（signup 用） | ✏️ `https://<API_DOMAIN>/v1` | 預設值係已毀嘅 `api-staging.go24fitness.com` |
| `APP_BASE_URL` | ✗（referral 連結） | ✏️ | 預設 `https://go24.app`；三個品牌共用一個值，品牌化要改 code |
| `STAFF_NOTIFICATION_WEBHOOK_URL` | ✗ | ✏️ | 付款通知前台；v1 唔用 |
| `DAY_PASS_PRICE_HKD` | ✗ | ✏️ | 預設 150；v1 唔用 |
| `SUPREMA_API_URL`、`SUPREMA_API_KEY` | ✗ | ♻️／新 | face enrol；v1 唔用；救返嘅 env 冇呢兩個 |
| `SENTRY_DSN` | — | 🆕 | **code 未裝 Sentry**（§4、§5 I12） |

#### D. 唔好放（已作廢）

- `BROADCAST_SECRET`：舊 container 有，route 已刪（`c0226d7`）。
- `REDIS_URL`：compose 自己組；code 冇用。
- `TEST_DATABASE_URL`：只係 CI／本機 schema test 用（test 會 **drop 成個 public schema**），伺服器一定唔好設。
- `.env.example` 入面嘅 `N8N_WEBHOOK_WHATSAPP`、`N8N_WEBHOOK_FACE_*`、`PGM_DEFAULT_CLUB_ID`、`EXPO_PUBLIC_*`：API code 冇讀（`EXPO_PUBLIC_*` 係 app build 用）。

#### 點樣安全咁填

- **唔好** copy 成個 `go24.env` 上機（入面有作廢嘅 key 同錯嘅 `GYM_DATA_URL`）。逐個 ♻️ 變數由密碼管理器／本機開檔，喺機上 `nano /opt/go24/.env` 貼。
- 唔好喺 shell 打 `export X=<值>`（會入 `.bash_history`）；唔好 `cat .env` 喺有人睇住嘅畫面。
- 生新 secret：`openssl rand -hex 32`。
- 填完：`chmod 600 /opt/go24/.env && chown deploy:deploy /opt/go24/.env`。
- 檢查（只睇名唔睇值）：`sed 's/=.*//' /opt/go24/.env`

### 2.5 第一次開機＋migration

全部以 `deploy` user 喺 `/opt/go24` 行。**一律加 `--env-file /opt/go24/.env`**（§5 I1）：

```bash
sudo -iu deploy
cd /opt/go24
git checkout --detach <SHA>       # 用 main 上 CI 綠咗嘅 SHA
COMPOSE="docker compose --env-file /opt/go24/.env -f infra/droplet/docker-compose.prod.yml"

$COMPOSE config --quiet && echo compose-ok          # 變數缺漏會喺度報 warning
$COMPOSE up -d postgres redis
$COMPOSE ps                                         # postgres healthy
$COMPOSE build api
$COMPOSE run --rm --no-deps api node dist/database/migrate.js
#  → 應該見 "Applied migrations: Baseline1761400000000, ReferralsAndBannerFix1761400000001, BrandLayer1761500000000,
#     AccountDeletion1761600000000, VisitGoal1761700000000, CoachingEnquiries1761800000000"
$COMPOSE up -d api caddy
```

✓ 檢查：
```bash
$COMPOSE ps                                                    # api healthy, caddy up
$COMPOSE logs --tail=50 api                                    # 冇 "not set" / "Migration failed"
$COMPOSE exec postgres psql -U go24 -d go24 -c "select name from typeorm_migrations order by id;"
$COMPOSE exec postgres psql -U go24 -d go24 -c "select id from brands;"     # lab, foundry, go24…
```

（Postgres 第一次開空 volume 時會行 `infra/docker/init/01-extensions.sql`，裝 `vector`、`uuid-ossp`；baseline migration 自己都會 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`，所以兩樣都冇衝突。）

### 2.6 Caddy TLS

- Caddy 起身就會向 Let's Encrypt 攞 `<API_DOMAIN>` 嘅 cert。前提：DNS 已經指去機、80／443 開咗、冇 CAA 擋。
- `$COMPOSE logs caddy | grep -i "certificate obtained"`
- 攞唔到：睇 `logs caddy` 嘅 ACME error；最常見係 DNS 未生效或者 Cloudflare 開咗橙雲。唔好不停重啟 Caddy（Let's Encrypt 有失敗次數限制）。
- Cert 存喺 volume `caddy_data`，**唔好 `docker compose down -v`**。

### 2.7 Health check（由外面）

```bash
curl -fsS https://<API_DOMAIN>/v1/health                 # {"status":"ok",...}
curl -sI https://<API_DOMAIN>/v1/health | grep -i strict-transport   # 有 HSTS
curl -s -o /dev/null -w '%{http_code}\n' https://<API_DOMAIN>/api-docs     # 404
curl -s -o /dev/null -w '%{http_code}\n' https://<API_DOMAIN>/v1/metrics   # 404
curl -s -o /dev/null -w '%{http_code}\n' -H 'X-App-Brand: lab' https://<API_DOMAIN>/v1/app-config   # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<API_DOMAIN>/v1/notifications/webhook/checkin-failed   # 401/500，唔係 2xx
```
（最後一條確認冇 secret 嘅 webhook 被拒，路徑見 `notifications.controller.ts`。）
唔好喺 production 用真會員試 login／約堂——等 G6 測試會員＋G9。

### 2.8 GitHub secrets（手動 deploy workflow）

**P1 完成（`main` 已經係手動版 `deploy.yml`）之後先設。** Repo → Settings → Secrets and variables → Actions：

| Secret | 內容 | 點整 |
|---|---|---|
| `DROPLET_HOST` | `<DROPLET_IP>`（或 `<API_DOMAIN>`） | |
| `DROPLET_SSH_KEY` | 專用 deploy key 嘅 **private key** | 喺本機 `ssh-keygen -t ed25519 -C gh-actions-deploy -f gh_deploy -N ''`；`.pub` 加入機上 `/home/deploy/.ssh/authorized_keys`；private key 貼入 secret 之後本機刪除。唔好用 Anthony 自己嘅 key |
| （建議）`DROPLET_KNOWN_HOSTS` | `ssh-keyscan -H <DROPLET_IP>` 嘅輸出（喺可信網絡做） | 而家 workflow 每次 deploy 先 `ssh-keyscan`（信任第一次見到嘅 key），§5 I8 建議改用呢個 secret |

順手：檢查 repo 有冇舊 staging 留低嘅 `DROPLET_*` secret，有就刪或覆蓋。另外建議設 GitHub Environment `production`（required reviewer＝Anthony）。

之後每次 deploy：GitHub → Actions → **Deploy to Droplet** → Run workflow（branch `main`）→ 填 40 位 `sha`。Workflow 會：查 CI 綠 → 機上 checkout → build → 舊 image 標 `previous` → 行 migration（失敗即停，舊 API 照跑）→ 起新 API → 60 秒 health check，唔過就換返 `previous` 並報失敗。
注意：rollback 只換 image，**唔會倒返 migration**；所以 migration 要向後兼容，deploy 前最好手動行一次 §3 嘅備份。

---

## 3. 備份

### 3.1 舊備份點解從來冇行過

`STATE.md`：舊機 `/opt/go24-ops/backups` 係空。睇 `setup.sh` 第 9 步有兩個原因：
1. cron 以 `deploy` 身份行，但輸出寫去 `/var/log/go24-backup.log`——`deploy` 冇權喺 `/var/log` 開檔，redirect 一失敗，job 根本冇開始。
2. `backup.sh` 用 `set -u`，但 `$POSTGRES_USER`、`$POSTGRES_DB` 喺 cron 環境冇定義 → 即刻 exit。
另外就算行到，備份都只係喺同一部機（機毀＝備份冇），冇異地。

### 3.2 新做法：每日 `pg_dump` → Spaces，30 日過期

**一次性設定（Anthony 開資源，之後工程做）**
1. DO → Spaces → Create bucket：Region **SGP1**，名例如 `go24-db-backups`，**Restrict file listing ✓**（private），唔開 CDN。
2. DO → Spaces → Access Keys → **Limited access**：只准呢個 bucket，Read/Write/Delete。存入密碼管理器。
3. 機上（root）：`apt-get install -y s3cmd`；設定檔 `/root/.s3cfg`（`host_base = sgp1.digitaloceanspaces.com`、`host_bucket = %(bucket)s.sgp1.digitaloceanspaces.com`、access／secret key），`chmod 600`。
4. 設 30 日過期（Spaces 支援 lifecycle）：
   ```bash
   s3cmd expire --expiry-days=30 --expiry-prefix=db/ s3://go24-db-backups
   s3cmd expire --expiry-mpu-days=1 s3://go24-db-backups   # 注意：expire 每個 bucket 只存一條規則，第二條會覆蓋第一條；要兩條就用 setlifecycle XML
   s3cmd getlifecycle s3://go24-db-backups
   ```
   社群有報告 Spaces lifecycle 設咗但冇刪檔，所以 §3.2 腳本另外每日刪 35 日前嘅檔做後備，並喺第一個月尾確認最舊嗰個檔係 ~30 日。

**腳本** `/opt/go24-ops/backup.sh`（root 擁有，`chmod 700`；建議取代 `setup.sh` 生嗰個）：
```bash
#!/usr/bin/env bash
set -euo pipefail
set -a; . /opt/go24/.env; set +a            # POSTGRES_USER / POSTGRES_DB
BUCKET=s3://go24-db-backups/db
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/opt/go24-ops/backups/go24-$TS.dump
docker exec go24-postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$OUT"
test -s "$OUT"
s3cmd put --no-progress "$OUT" "$BUCKET/"
# 本機只留 3 日
find /opt/go24-ops/backups -name 'go24-*.dump' -mtime +3 -delete
# 後備：刪 Spaces 35 日前嘅檔（lifecycle 唔郁都有保障）
s3cmd ls "$BUCKET/" | awk -v c="$(date -u -d '35 days ago' +%Y-%m-%d)" '$1 < c {print $4}' | xargs -r -n1 s3cmd del
echo "ok $TS $(stat -c %s "$OUT") bytes"
```
cron（root，`/etc/cron.d/go24-backup`）：
```
15 19 * * * root /opt/go24-ops/backup.sh >> /var/log/go24-backup.log 2>&1
```
（19:15 UTC＝香港 03:15。）

- 備份有會員個人資料（email、電話）。建議：bucket private＋limited key 已經夠 v1；想再穩陣可以喺 upload 前用 `age` 公鑰加密，私鑰離線由 Anthony 保管（還原時要用）。
- 保留期 30 日要寫入私隱政策（`backend-plan.md` N4）。
- 加埋：deploy 前手動行一次 `backup.sh`（或者將佢加入 `deploy.yml`，§5 I8）。
- Droplet 每星期備份（§1.1）係第二層：成部機壞咗可以由 DO 還原。

✓ 檢查：`/opt/go24-ops/backup.sh` 手動行一次；`s3cmd ls s3://go24-db-backups/db/` 見到檔；第二朝睇 `/var/log/go24-backup.log` 有 `ok`。

### 3.3 還原測試（上線前一定做一次；之後每季一次）

喺 **droplet 上開一個臨時、隔離嘅 Postgres** 還原，唔郁正式 DB：

```bash
# 1. 攞最新備份
LATEST=$(s3cmd ls s3://go24-db-backups/db/ | sort | tail -1 | awk '{print $4}')
s3cmd get "$LATEST" /tmp/restore-test.dump

# 2. 臨時 Postgres（唔入 go24-net、唔開 port）
docker run -d --name go24-restore-test -e POSTGRES_PASSWORD=restoretest -e POSTGRES_DB=go24 pgvector/pgvector:pg16
sleep 10
docker cp /tmp/restore-test.dump go24-restore-test:/tmp/r.dump
docker exec go24-restore-test pg_restore -U postgres -d go24 --no-owner --exit-on-error /tmp/r.dump

# 3. 對數
docker exec go24-restore-test psql -U postgres -d go24 -c "select name from typeorm_migrations order by id;"
docker exec go24-restore-test psql -U postgres -d go24 -c "select count(*) from users; select count(*) from brands;"
docker exec go24-postgres     psql -U go24     -d go24 -c "select count(*) from users; select count(*) from brands;"

# 4. 清理
docker rm -f go24-restore-test && rm -f /tmp/restore-test.dump
```
通過條件：`pg_restore` 冇錯；migration 名單同正式 DB 一樣；行數相同（或者只差備份之後新增嘅）。結果（日期、檔名、行數）寫入 `STATE.md` VERIFIED FACTS。
（`backend-plan.md` 驗收寫「還原到本機 DB」；本機冇 Docker／Postgres，所以改喺 droplet 上用臨時 container 做，效果一樣；要本機做可以用 session 用過嘅 embedded Postgres 16。）

---

## 4. 監察

### 4.1 Uptime：`/v1/health`

- Monitor：HTTP(s) `https://<API_DOMAIN>/v1/health`，keyword `"status":"ok"`，5 分鐘一次，通知 Anthony email（＋WhatsApp／Slack 如有）。
- **UptimeRobot 免費 plan 據報只准非商業用途**（§1.1），正式要 Solo plan（約 US$9–10／月）或者揀替代：DigitalOcean Monitoring 嘅 Uptime check（同一個帳戶，最簡單）、或其他有商用免費 plan 嘅服務。由 Anthony 揀。
- 另加 DO Monitoring alert（免費）：CPU > 80% 10 分鐘、Memory > 90%、Disk > 80%。
- 可選：備份 cron 加「心跳」監察（例如每日成功後 `curl` 一個 heartbeat URL），冇收到就通知——補返舊 cron 靜靜壞咗都冇人知嘅問題。

`/v1/health` 而家只報 process 生存（`health.controller.ts`），**唔查 DB**。DB 死咗 health 仍然 `ok`。建議加 DB ping（§5 I13）。

### 4.2 Sentry

- **而家 code 冇 Sentry**（`package.json` 冇 `@sentry/*`；`.env.example` 有 `SENTRY_DSN` 但冇人讀）。
- 要做（工程，另開工作項）：裝 `@sentry/nestjs`，`main.ts` 最頂 init，`sendDefaultPii: false`，`beforeSend` 刪走 request body、email、電話、`Authorization` header、`x-webhook-secret`；只喺 `SENTRY_DSN` 有值時 init；compose 加 `SENTRY_DSN`。
- Anthony：開 Sentry org＋一個 Node project（`go24-api`），DSN 入 `.env`。資料區揀 EU 或 US 都得，寫入私隱政策；保留期跟 `backend-plan.md` N4。

---

## 5. Infra 檔案 vs 而家 code 嘅問題（未改檔，只建議）

| # | 位置 | 問題 | 建議修正 | 嚴重 |
|---|---|---|---|---|
| I1 | `docker-compose.prod.yml` ＋ `deploy.yml` ＋ `setup.sh` | Compose v2 預設喺 **project directory（＝第一個 `-f` 檔所在，即 `infra/droplet/`）** 搵 `.env`，`setup.sh` 將 `.env` 放喺 `/opt/go24/`。變數可能全部讀唔到（`${JWT_SECRET}` 變空）。舊機點樣 work 未知（可能人手放咗第二份） | **已修（commit `59080fb`）**：`deploy.yml` 用 `docker compose --env-file /opt/go24/.env -f …`，並喺開始前檢查 `.env` 存在；compose 檔頭註解同 `setup.sh` 提示都改用同一條命令。本機冇 Docker，**未用 `docker compose config` 實測**，開機時第一步做 | 高 → 已修 |
| I2 | `docker-compose.prod.yml` `api.environment` | 漏咗 code 有讀嘅 `API_BASE_URL`、`APP_BASE_URL`、`STAFF_NOTIFICATION_WEBHOOK_URL`、`DAY_PASS_PRICE_HKD`、`SUPREMA_API_URL`、`SUPREMA_API_KEY`（之後仲有 `SENTRY_DSN`）。逐個列，每加一個變數都要改兩個地方 | **已修（commit `59080fb`）**：`api` 用 `env_file: ../../.env`；`environment:` 只留 `NODE_ENV`、`PORT`、`DATABASE_URL`、`REDIS_URL`。`setup.sh` 生嘅 `.env` 模板已列齊 code 讀嘅全部變數（已對比：code 讀而模板冇嘅只有 compose 提供嘅 3 個）。行為改變：`ADYEN_ENVIRONMENT` 唔再有 compose 預設 `LIVE`，改為模板明寫（code 預設 `TEST`）；`BACKGROUND_JOBS_ENABLED` 唔設＝關 | 高 → 已修 |
| I3 | `payments/adyen.client.ts`、`app.module.ts` | `ADYEN_API_KEY`／`ADYEN_MERCHANT_ACCOUNT` 冇設就 throw，`PaymentsModule` 一定載入 → v1 唔用付款都要將 live Adyen key 放上 production 機 | v1 用 feature flag／env 唔載入 `PaymentsModule`＋`SignupModule`，或者 Adyen client 改為 lazy（用時先檢查）。咁 B8 嘅 Adyen key 可以等付款第二期先處理 | 中 |
| I4 | `setup.sh` 第 9 步 | 備份 cron 寫 `/var/log` 冇權、`set -u` 冇變數 → 從來冇行（舊機證實）；而且只係本機備份 | 換成 §3.2 嘅 `backup.sh`（root、讀 `.env`、上 Spaces）；`setup.sh` 唔再生舊腳本 | 高 |
| I5 | `setup.sh` 第 10 步、開頭註解 | 寫死 `main`＋`git reset --hard origin/main`；`curl … | sudo bash` 喺 private repo 用唔到 | 改為 clone 唔 reset（之後由 `deploy.yml` 揀 SHA）；註解改「scp 上機、睇完先行」；private repo 用 deploy key（§2.3） | 中 |
| I6 | `setup.sh` 第 11 步 | 生嘅 `.env` 只有 Postgres／Redis／JWT／PGM 幾個；`API_DOMAIN` 預設 `api-staging.go24.fitness`（錯 domain，舊機係 `go24fitness.com`）；冇 `BACKGROUND_JOBS_ENABLED=false`、webhook secrets、Adyen | **已隨 I2 修（commit `59080fb`）**：模板對齊 §2.4；隨機生成三個 webhook secret；`API_DOMAIN=` 留空要人手填；明寫 `BACKGROUND_JOBS_ENABLED=false`；可選項目註解掉 | 中 → 已修 |
| I7 | `docker-compose.prod.yml` `redis` | Code 冇用 Redis（rate limit 喺 memory），但 api `depends_on` redis healthy，仲要 `REDIS_PASSWORD`、佔 RAM | v1 刪走 `redis` service、`REDIS_URL`、`redis_data` volume、`depends_on.redis`；要多 instance 先加返 | 低 |
| I8 | `deploy.yml` | (a) `ssh-keyscan` 每次信第一次見到嘅 host key；(b) compose 冇 `--env-file`（I1）；(c) migration 前冇備份；(d) rollback 唔倒 migration（要寫明）；(e) 冇用 GitHub Environment 做批准 | (a) 用 `DROPLET_KNOWN_HOSTS` secret；(b) 同 I1；(c) migration 前 `bash /opt/go24-ops/backup.sh`（deploy user 要權，或者改 `sudo` 指定命令）；(e) `environment: production`＋required reviewer | 中 |
| I9 | `Caddyfile` | `header_up X-Forwarded-For {remote_host}`：開 Cloudflare 橙雲後 `remote_host` 係 Cloudflare IP，per-IP rate limit 會將全部人當一個 IP | DNS only 就冇事；轉橙雲時加 Caddy `trusted_proxies`（Cloudflare IP 段）＋用 `CF-Connecting-IP`。Caddy 本身已經自動加 `X-Forwarded-*`，自訂 `header_up` 可以刪 | 低（而家） |
| I10 | `Dockerfile.api` | (a) `node:20-alpine`：Node 20 已於 2026-04 停止支援（lab branch CI 已經轉 Node 22）；(b) `pnpm install --no-frozen-lockfile` → build 唔可重現；(c) 寫死 copy `apps/member-app`、`apps/trainer-app` package.json；(d) CMD 每次起 container 都行 migration（同 `deploy.yml` 重複；migration 失敗會令 container 不停 restart） | (a) 轉 `node:22-alpine`（CI 同步）；(b) 改 `--frozen-lockfile`（要試 build，可能要用 `pnpm fetch`／`pnpm deploy --filter nest-api`）；(c) 只 copy `backend/nest-api`＋所需 `packages/*`；(d) CMD 只起 API，migration 留俾 deploy 步驟（或保留但寫明） | 中 |
| I11 | `docker-compose.prod.yml` | `JWT_EXPIRES_IN`、`JWT_REFRESH_EXPIRES_IN` 傳入但 code 冇讀（寫死 `15m`） | **已隨 I2 刪走（未 commit）**；要改有效期就改 code | 低 → 已修 |
| I12 | `backend/nest-api`、`.env.example` | 有 `SENTRY_DSN` 但冇 Sentry SDK | 見 §4.2 | 中（上線前） |
| I13 | `health/health.controller.ts` | Health 唔查 DB；Caddy／compose／uptime 全部靠佢 | 加 `SELECT 1`（失敗回 503）；保持輕量，唔查 PGM | 中 |
| I14 | `deploy.sh`（repo 根目錄） | `git add -A`＋commit＋**push `main`**；SSH `root@api-staging.go24fitness.com`（已毀）、`StrictHostKeyChecking=no`；寫死另一部電腦嘅 Obsidian 路徑 | **已刪（2026-10-26）**：`deploy.yml` 係唯一 deploy 路徑 | 中 → 已修 |
| I15 | `.github/workflows/deploy.yml` on `origin/main` | `main` 仲係舊版自動 deploy（push 就 deploy、health 失敗報成功） | P1：合入 `feat/backend-week1` 先設 secrets | **高** |
| I16 | `docs/deploy.md`、`docs/cloudflare.md` | 舊：`s-4vcpu-8gb`、`api.go24-dev.fitness`、`cp .env.example .env`、`git clone` 入已存在嘅目錄、「auto-deploy from main」 | `docs/deploy.md` **已改（2026-10-26）**做指向本手冊同手動 `deploy.yml`；`docs/cloudflare.md` 仍舊 | 低 |
| I17 | `signup.service.ts`、`referral.service.ts`、`apps/member-app/src/api/client.ts`（main） | 預設 URL 指向已毀 `api-staging.go24fitness.com`／`go24.app` | 設 env（§2.4 C）；app 用 `EXPO_PUBLIC_API_URL`（lab branch 已改） | 低 |
| I18 | `setup.sh` 第 6 步 | sudoers 直接 append `/etc/sudoers`（冇 `visudo -c`，重行會重複）；`deploy` 喺 docker group＝等同 root，`NOPASSWD /usr/bin/docker` 多餘；`systemctl restart go24` 呢個 service 唔存在 | 改寫入 `/etc/sudoers.d/go24`＋`visudo -cf`；刪多餘規則；如需備份權限，只准 `/opt/go24-ops/backup.sh` | 低 |
| I19 | `docker-compose.prod.yml` `caddy` | Caddy 冇 healthcheck；`depends_on: api` 唔等 healthy | 加 `condition: service_healthy`（api 已有 healthcheck） | 低 |

---

## 6. 完成條件（M2 done）

- [ ] P1–P4 完成
- [ ] Droplet＋Spaces 開咗，成本同 §1.1 一致
- [ ] `https://<API_DOMAIN>/v1/health` 由外面 200，HSTS 有，`/api-docs`、`/v1/metrics` 404
- [ ] `typeorm_migrations` 有 3 條；`brands` 有資料
- [ ] `BACKGROUND_JOBS_ENABLED=false`
- [ ] 第一次 deploy 由 GitHub 手動 workflow 行，health 過
- [ ] 每日備份上 Spaces 至少一次成功；還原測試通過（§3.3），結果寫入 `STATE.md`
- [ ] Uptime monitor 同 DO alert 開咗；Sentry 已接（或者記為上線前未完成項）
- [ ] `STATE.md` VERIFIED FACTS 記：IP、domain、droplet ID、開機日期、SHA（**唔記 secret**）
