# VS Code Remote-SSH Setup（喺 droplet 上 dev，速度同 local 一樣）

## 點解用

- 唔使每次 `git push` 等 deploy
- Save file 直接喺 droplet hot reload
- IntelliSense / TypeScript 走 droplet 嘅 node_modules（保證一致）
- 部手機可以即刻試新 endpoint

## Setup

### 1. 裝 extension

VS Code → Extensions → 搜 "Remote - SSH"（Microsoft 出）→ Install

### 2. 配 SSH config

開 file：`C:\Users\LENOVO\.ssh\config`（無就建立）：

```sshconfig
Host go24-droplet
    HostName <YOUR_DROPLET_IP>
    User deploy
    IdentityFile C:\Users\LENOVO\.ssh\go24_droplet
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

### 3. Connect

VS Code F1 → `Remote-SSH: Connect to Host` → 揀 `go24-droplet`

第一次會 install VS Code Server 入 droplet（~30s）。

### 4. Open folder

連入後：File → Open Folder → `/opt/go24`

### 5. Dev mode container

喺 droplet 上面新開一個 dev-mode docker-compose（hot reload）：

```yaml
# infra/droplet/docker-compose.dev.yml (新檔，下面 Claude 寫)
services:
  api-dev:
    build:
      context: ../../
      dockerfile: infra/droplet/Dockerfile.api.dev
    volumes:
      - ../../backend/nest-api/src:/app/src   # bind mount source
      - ../../backend/nest-api/tsconfig.json:/app/tsconfig.json
    command: pnpm start:dev   # nest start --watch
    ports:
      - "3001:3000"
    environment:
      NODE_ENV: development
      # ... same as prod
```

```bash
# Run dev container alongside prod
docker compose -f infra/droplet/docker-compose.prod.yml \
               -f infra/droplet/docker-compose.dev.yml up -d api-dev
```

Save TypeScript file in VS Code → Nest auto restart → 即時試。

### 6. Tunnel ports back to local（optional）

如果想喺本機 browser 開 droplet 嘅 Swagger：
VS Code 入面 PORTS tab → Forward Port → `3000` → 本機 `http://localhost:3000` 就係 droplet 個 API。

### 7. 部手機測試

部手機就直接 open `https://api.go24-dev.fitness/api-docs`（droplet 嘅 public URL）— 唔使 ngrok / Tailscale。

## Tip

- Settings: `"remote.SSH.connectTimeout": 30` 避免 slow link drop
- 用 `Ctrl+Shift+P` → `Remote-SSH: Open SSH Configuration File` 直接喺 VS Code 改 config
- 萬一 VS Code Server stuck：`Remote-SSH: Kill VS Code Server on Host`
