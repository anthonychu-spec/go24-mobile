# GO24 Fitness — Member App v1.2（網頁版，同 THE LAB／Foundry 網頁版一樣）

來源：`Documents\ChatGPT\Mobile Apps\GO24-Member-App-v1.2-Foundry.zip`（ChatGPT 做嘅原型，2026-10-26），跟 Foundry 4 分頁 Home／Book／Passport／Profile＋中央會員證，GO24 紅／炭黑配色。Book 分 Sports（BOFA Pickleball／Golf Sim）／Recovery／Classes／Fitness。畫面同功能原封不動，只加咗 PWA 同部署設定，同 `apps/lab-prototype-web` 一個做法。

- `site/`：網站檔案（純靜態，43 個檔，3 個頁面：`index.html`、`mobile-preview.html`、`sports-preview.html`）
- `go24-prototype-web.zip`：`site/` 壓縮（2 MB），直接上載用（冇 commit，用 `pack.ps1` 重做）
- `scripts/`：`add-pwa.mjs`（manifest + service worker）、`make-icons.ps1`（icon，由 `assets/logo.png` 剪紅色標誌）、`pack.ps1`（打包）
- `server.mjs`／`START.cmd`：本機預覽（`npm run dev` → http://127.0.0.1:4184/）
- `QA.md`、`previews/`：ChatGPT 嘅驗證紀錄同截圖

改動（App 本身冇改）：`site/` 入面加咗 `manifest.webmanifest`、`sw.js`（離線緩存）、`pwa.js`、`icons/`、`_headers`（唔俾搜尋器收錄、`sw.js` 唔長時間緩存），三個頁面 `<head>` 加咗 `<!-- pwa -->` 標籤。

## 示範範圍

全部係樣本數據：冇真登入、付款、PGM、門禁、後端、推送。預約、候補、收藏、PT 諮詢、偏好只存喺嗰部機嘅瀏覽器（localStorage key `go24-member-app-v1`）。QR 唔可以入閘。BOFA 球場／Bay 數目、教練、Social Play、價錢沿用 Foundry 示範資料，**唔係已確認營運資料**。觀塘分店按官網「10 月開幕」顯示，未有示範課堂。詳見 `QA.md`。網址加 `?app=1` 會隱藏桌面預覽欄（PWA 安裝後用呢個）。

## 放上網（同 THE LAB 一樣）

**Cloudflare Pages**：Workers & Pages → Create → Pages → Upload assets，項目名例如 `go24-demo`，拖入 `go24-prototype-web.zip` → Deploy。要限制邊個睇，用 Zero Trust → Access → Self-hosted，Policy 揀 Emails。更新：同一項目再 Create deployment。

**自己 server**：純靜態，放喺網站根目錄或子資料夾都得，唔使 Node、資料庫。要加密碼見 `../foundry-prototype-web/README.md` 嘅 Caddy／Nginx／cPanel 例子（域名同路徑改成呢個項目）。

**HTTPS 先可以安裝 PWA**。iPhone：Safari → 分享 → 加入主畫面；Android／電腦 Chrome：安裝應用程式。

## 改咗檔案之後

```bash
node scripts/add-pwa.mjs site
powershell -File scripts/pack.ps1
```

換咗 `assets/logo.png` 先要重做 icon：`powershell -File scripts/make-icons.ps1 -Site site`，再行上面兩句。

**唔好用檔案總管或 Compress-Archive 壓縮**：路徑會變反斜線，Cloudflare 會當成檔名，圖片、字體、icon 全部唔見。

## 已測試（2026-10-26，本機）

- `npm run check`（`foundry-sports.js`、`app.js`）通過。
- 本機 server 載入：service worker 啟動、42 個檔全部緩存、manifest 回 `application/manifest+json`、console 冇錯誤。
- 停咗 server 之後 375 px `?app=1#/book?sport=golf` 照樣開到（離線），圖片、字體正常；`sports-preview.html` 由緩存回 200。
- 未做：真 iPhone／Android 安裝、Cloudflare 實際上載。

## 注意

- GO24 標誌、相片取自 GO24 官網／現有素材；Bebas Neue、Montserrat 字體同 THE LAB 版本一樣。公開之前先確認授權，建議先加密碼。
- 未 deploy。
