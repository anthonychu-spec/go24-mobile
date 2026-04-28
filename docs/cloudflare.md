# Cloudflare Setup（DNS + DDoS + 免費 TLS）

兩個方案揀一個：

## 方案 A: 直接 Caddy 出 cert（簡單）

1. Domain DNS 改去 Cloudflare nameservers（Cloudflare dashboard → Add site）
2. DNS 加 A record：
   - Name: `api.go24-dev`
   - Content: <DROPLET_IP>
   - **Proxy: DNS only**（灰雲，唔經 Cloudflare proxy）
3. 留住 80 + 443 port 開（setup script 已開）
4. Caddy 第一次起會自動 Let's Encrypt 攞 cert
5. ✓ 完成 — `https://api.go24-dev.fitness` 已 work

**好處**：簡單。
**Trade-off**：無 Cloudflare DDoS 保護（但 droplet 帶寬足）。

## 方案 B: Cloudflare Proxied（推薦 — 加 DDoS / WAF / cache）

1. 同 A 但 DNS A record 設 **Proxy: Proxied**（橙雲）
2. SSL/TLS settings → Mode: **Full (strict)**
3. Cloudflare 出 origin cert：SSL/TLS → Origin Server → Create Certificate
   - Hostname: `*.go24-dev.fitness, go24-dev.fitness`
   - Validity: 15 years
   - Save 兩段 .pem 檔（cert + key）
4. 上傳兩段去 droplet `/opt/go24/certs/`：
   ```bash
   scp cert.pem deploy@<IP>:/opt/go24/certs/
   scp key.pem deploy@<IP>:/opt/go24/certs/
   ```
5. 改 Caddyfile 用呢個 cert：
   ```
   {$API_DOMAIN} {
       tls /opt/go24/certs/cert.pem /opt/go24/certs/key.pem
       reverse_proxy api:3000 { ... }
   }
   ```
6. Cloudflare → Security → WAF → Enable managed rules（free tier）
7. Cloudflare → Speed → Optimization → Auto Minify 唔 enable（API 唔需要）
8. Cloudflare → Caching → Configuration → Cache Level: **Bypass**（API 永遠唔 cache）

**好處**：DDoS 保護、WAF 擋 SQL injection / XSS / scrapers、bot management、analytics free。
**Trade-off**：多一層 — 偶爾 troubleshoot 時要禁 proxy 排除 Cloudflare 問題。

## 方案 C: Cloudflare Tunnel（最 secure，無 public IP）

Droplet 完全唔開 public 80/443 port，靠 cloudflared agent 主動連 Cloudflare：

1. Cloudflare → Zero Trust → Networks → Tunnels → Create tunnel `go24-droplet`
2. Cloudflare 畀你個 install command，run on droplet：
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   sudo cloudflared service install <token>
   ```
3. Tunnel routes：
   - `api.go24-dev.fitness` → `http://localhost:80`（Caddy 仍喺度，唔使 expose）
4. Droplet firewall 可以禁 80/443 inbound — 只 outbound 到 Cloudflare

**好處**：Droplet 0 attack surface，Cloudflare 全面盾住。
**Trade-off**：多一個 service，debug 多一層。

## 我建議：先用 A，準備 launch 升 B

Dev / staging 階段 A 夠（最少 moving parts），Production 升 B 攞 DDoS + WAF。

## DNS 環境清單

確認以下 DNS record 存在（按你方案）：
- `api.go24-dev.fitness` A → droplet IP（A 或 B）
- `_acme-challenge.api.go24-dev.fitness` TXT → 由 Caddy 自動處理（如用方案 A）
- 加埋 CAA record 限制 cert 由 letsencrypt 出（提升信任）：
  - `go24-dev.fitness` CAA: `0 issue "letsencrypt.org"`

## Test

```bash
# DNS resolve
nslookup api.go24-dev.fitness

# Cert chain
openssl s_client -connect api.go24-dev.fitness:443 -servername api.go24-dev.fitness </dev/null 2>/dev/null | grep -E 'subject=|issuer='

# Endpoint
curl -I https://api.go24-dev.fitness/v1/auth/me
# Expected: HTTP/2 401 (server alive, JWT missing)
```
