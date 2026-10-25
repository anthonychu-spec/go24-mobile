# THE LAB by ONYX — Member App（網頁版，同 Foundry 網頁版一樣）

來源：`Documents\ChatGPT\Mobile Apps\THE-LAB-App-v1-Red.zip`（Codex 做嘅 v1 Red 原型，2026-10-25），4 分頁 Home／Book／Passport／Profile，LAB 紅黑配色。畫面同功能原封不動，只加咗 PWA 同部署設定，同 `apps/foundry-prototype-web` 一個做法。

- `site/`：網站檔案（純靜態，32 個檔，2 個頁面：`index.html`、`mobile-preview.html`）
- `the-lab-prototype-web.zip`：`site/` 壓縮（15 MB），直接上載用
- `scripts/`：`add-pwa.mjs`（manifest + service worker）、`make-icons.ps1`（icon）、`pack.ps1`（打包）
- `server.mjs`／`START.cmd`：本機預覽（`npm run dev` → http://127.0.0.1:4182/）
- `QA.md`、`previews/`：Codex 嘅驗證紀錄同截圖

改動（App 本身冇改）：`site/` 入面加咗 `manifest.webmanifest`、`sw.js`（離線緩存）、`pwa.js`、`icons/`、`_headers`（唔俾搜尋器收錄、`sw.js` 唔長時間緩存），兩個頁面 `<head>` 加咗 `<!-- pwa -->` 標籤。

## 示範範圍

全部係樣本數據：冇真登入、付款、PGM、門禁、後端、推送。預約、候補、諮詢、偏好只存喺嗰部機嘅瀏覽器（localStorage）。QR 唔可以入閘。詳見 `QA.md`。網址加 `?app=1` 會隱藏桌面預覽欄（PWA 安裝後用呢個）。

## 放上網（同 Foundry 一樣）

**Cloudflare Pages**：Workers & Pages → Create → Pages → Upload assets，項目名例如 `thelab-demo`，拖入 `the-lab-prototype-web.zip` → Deploy。要限制邊個睇，用 Zero Trust → Access → Self-hosted，Policy 揀 Emails。更新：同一項目再 Create deployment。

**自己 server**：純靜態，放喺網站根目錄或子資料夾都得，唔使 Node、資料庫。要加密碼見 `../foundry-prototype-web/README.md` 嘅 Caddy／Nginx／cPanel 例子（域名同路徑改成呢個項目）。

**HTTPS 先可以安裝 PWA**。iPhone：Safari → 分享 → 加入主畫面；Android／電腦 Chrome：安裝應用程式。

## 改咗檔案之後

```bash
node scripts/add-pwa.mjs site
powershell -File scripts/pack.ps1
```

**唔好用檔案總管或 Compress-Archive 壓縮**：路徑會變反斜線，Cloudflare 會當成檔名，相同字體全部唔見。

## 已測試（2026-10-25，本機）

- `node --check site/app.js` 通過。
- 本機 server 載入：service worker 啟動、31 個檔全部緩存、manifest 回 `application/manifest+json`、console 冇錯誤。
- 375 px 手機闊度 `?app=1` Home 全屏顯示正常。
- 未做：真 iPhone／Android 安裝、斷網測試、Cloudflare 實際上載。

## 注意

- 字體 Bebas Neue、Montserrat 同相片取自 THE LAB 官網（原作者擁有權利）；公開之前同 Foundry 一樣先確認授權，建議先加密碼。
- 未 deploy、未 commit。
