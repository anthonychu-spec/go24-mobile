# Gate M1 · 開發者帳戶（D-U-N-S → Apple → Google）申請清單

日期：2026-10-26 · 對應：[`member-apps-launch-plan.md`](../member-apps-launch-plan.md) G1 · 辦公室板 H103 · 負責：**Anthony**（錢、帳戶、法律身份都係經理枱嘅事；工程側唔會代申請）

> 官方要求以下面嘅連結為準，2026-10-26 查過。**官方頁面冇列嘅嘢，我標咗「（非官方）」**，唔好當成保證。

## 先睇：今日要準備

D-U-N-S 係成條線最長嘅等待（Apple 話最多 5 個工作天，Google 話可能要 30 日），所以**今日就申請**，其他慢慢嚟。

- [ ] **決定持牌公司**：邊間法律實體持有帳戶（見下面第 1 節）。必須係**註冊公司**（有限公司），唔係商號／品牌名／分店。
- [ ] **搵齊公司文件**（PDF 或相）：公司註冊證書（Certificate of Incorporation）、商業登記證（Business Registration Certificate）、最新周年申報表／董事資料。
- [ ] **抄低呢幾樣，一個字都唔好改**（跟註冊證書）：公司**法定全名**（英文）、註冊地址、通訊地址、公司電話、公司網站。
- [ ] **搵出 Account Holder**：必須係有權代公司簽約嘅人（老闆／董事／高層，或者獲高層授權嘅員工）。建議 Anthony 自己或另一位董事。
- [ ] **開一個公司域名電郵**畀 Apple ID 用（例如 `apple-dev@公司域名`），唔好用 Gmail／個人電郵。要收得到短訊／電話驗證嘅人要長期穩定。
- [ ] **公司網站**：要公開、有內容、域名屬於公司（唔接受社交平台連結、域名註冊商空白頁）。
- [ ] **付款卡**：Apple US$99／年（會自動續費）、Google US$25（一次性）。信用卡建議係公司卡。
- [ ] 揀一部有 Apple ID 登入嘅手機或 iPad／Mac，用嚟開兩步驗證。

## 1. 邊間公司持有帳戶（要 Anthony 決定）

- 已定：**一個集團帳戶**上晒 THE LAB、Foundry、GO24 三個 app（見 `STATE.md` 2026-10-26）。
- 揀**一間**註冊公司做 Account Holder 同「賣家」。Apple 同 Google 都用呢間公司嘅**法定名稱**公開顯示做 app 發行者（Apple 係 Seller，Google 係 Developer name）。即係 THE LAB 嘅商店頁面會見到集團公司名，唔係「THE LAB by ONYX」。覺得唔得，要喺申請前諗清楚（Apple 嘅 seller 名跟法定名稱，申請後唔易改）。
- 呢間公司要有**擁有或獲授權**用 THE LAB、Foundry、GO24 品牌嘅文件（launch plan G4／Apple 4.2.6 白牌規則會問）。品牌如果係另一間公司擁有，要有授權書。
- 申請人唔好用**分店名、商號、DBA**：Apple 明確拒絕（[官方](https://developer.apple.com/support/D-U-N-S/)：DBAs, fictitious businesses, trade names, and branches are not accepted）。
- 一旦註冊後換 Account Holder 或換公司，要走 Apple 轉移流程，好煩。**一次揀啱。**

**要寫低畀工程側（填完 Anthony 自己存，唔使貼落 chat）**

| 項 | 內容 |
|---|---|
| 公司法定全名（英文，照證書） | ______ |
| 註冊地址 | ______ |
| 通訊地址 | ______ |
| 公司電話（要有人接） | ______ |
| 公司網站 | ______ |
| Account Holder 姓名、職位 | ______ |
| 公司域名電郵（Apple 用） | ______ |

## 2. D-U-N-S 號碼（免費）

D-U-N-S 係 Dun & Bradstreet 派嘅 9 位數公司識別號，Apple 同 Google 都要。**唔好俾錢畀第三方代辦**（Google 都警告過有人收高價）。

1. 去 Apple 嘅 [D-U-N-S 說明頁](https://developer.apple.com/support/D-U-N-S/)，撳入去 [look up your organization](https://developer.apple.com/enroll/duns-lookup/)。
2. **先查**公司是否已經有號碼（D&B 好多時已經有）。有 → 記低號碼，跳去第 3 節。
3. 冇 → 喺同一頁提交資料畀 D&B 免費申請。要填：**法定公司名、總部地址、通訊地址、工作聯絡資料**。要同註冊文件一致。
4. D&B 可能打電話嚟問行業同員工人數；準備好註冊文件。
5. 等待（官方）：
   - D&B 最多 **5 個工作天**出號碼，加錢加急都冇用。
   - D&B 出號後 Apple 最多再 **2 個工作天**先收到。
   - 超過 **2 個星期**未收到：用頁面連結 [email D&B](https://support.dnb.com/?CUST=APPLEDEV)。
6. 如果 Apple 話「Your organization is not listed as a legal entity」：代表 D&B 資料入面公司類型唔啱（例如寫成獨資）或者未驗證，要 email D&B 附上完整註冊文件更正。更新後最多 2 個工作天傳到 Apple。
7. Google 官方講 D-U-N-S 申請「可能要 30 日」（[Google 說明](https://support.google.com/googleplay/android-developer/answer/13628312)），所以**一拎到就可以同時開 Apple 同 Google**，唔使排隊。

## 3. Apple Developer Program（機構）

入口：[Enroll](https://developer.apple.com/programs/enroll/) · 說明：[Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/)

**要齊（官方）**

- Apple Account **已開兩步驗證（2FA）**；Apple 建議用機構電郵。
- 你係 **Account Holder**，有法律權力代公司簽約。唔係老闆／創辦人嘅話，要有一位高層可以證明你獲授權（Apple 會要 reference）。
- 公司係**法律實體**（見第 1 節）。
- **D-U-N-S** 已登記（第 2 節）。
- 工作電郵要用公司域名。
- **網站**要公開、可運作、域名屬於公司。
- 姓名用**法定名稱**，用暱稱／別名會拖慢審批。
- 年費 **US$99／年**（以結帳時本地貨幣價為準）。

**步驟**

1. 用公司電郵新開（或者用現有）Apple Account，開 2FA。
2. 去 Enroll 頁，揀 **Company / Organization**，填第 1 節嘅資料。
3. 提交後 Apple 會驗證 D-U-N-S、binding authority。**可能要求公證嘅商業文件**（官方有講）。
4. Apple Developer Support 驗證完會 email 通知，之後先可以睇協議同**付費**。如果付費後 24 小時內冇確認 email，要聯絡 Apple 並提供 Enrollment ID。
5. **審批時間官方冇寫。**（非官方）常見經驗係幾日到約兩個星期；Apple 可能打電話到你提交嘅公司電話核實身份，所以**電話要有人接、接到之後要講得出公司業務**。如果擔心，預留 2 星期。
6. 批准之後：用同一個 Apple Account 登入 [App Store Connect](https://appstoreconnect.apple.com/) 同 [developer.apple.com/account](https://developer.apple.com/account)。

**批准後再加（唔使現在）**

- 在 App Store Connect → Users and Access 加工程同營運嘅人（用佢哋自己嘅 Apple Account，邀請電郵）：
  - 工程：**Developer**（上載 build、TestFlight）；要生成憑證嘅人用 **Admin** 或者有「Access to Certificates, Identifiers, and Profiles」嘅 **App Manager**（見 [Expo 角色說明](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/)）。
  - 營運／前台：**App Manager**（睇 TestFlight、填商店資料、睇數據），唔使 Admin。
  - Account Holder 平日唔好用嚟做日常操作。

## 4. Google Play Console（機構帳戶）

入口：[Play Console 註冊](https://play.google.com/console/signup) · 說明：[Create a developer account / 要求](https://support.google.com/googleplay/android-developer/answer/13628312)

**要齊（官方）**

- 揀 **Organization**（機構）帳戶，唔好揀 Personal。
- **D-U-N-S**：Google 話「沒有就開唔到機構帳戶」。（Google 的 D-U-N-S 亦係 D&B 免費，Apple 嗰條 lookup 申請嘅號碼可以用。）
- 機構名稱及地址（跟 Google Payments profile，要同 D-U-N-S 一致）、機構電話、機構網站。
- 聯絡人姓名、聯絡電郵（**唔可以係通用或個人電郵**）、聯絡電話；開發者公開電話及電郵。聯絡及開發者電郵／電話都要 OTP 驗證，並且帳戶存在期間都要一直可用。
- 註冊費 **US$25**，一次性。付款方式驗證最多約 5 日。
- 用公司 Google 帳戶開（唔好用 Anthony 個人 Gmail 做 owner；建議開一個 Google Workspace／公司域名帳戶）。

**12 人測試 14 日規則（已核實）**

- 官方現行（[App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465)）：2023-11-13 之後新開嘅**個人帳戶**，上 production 前要做 closed test：**至少 12 位測試員、連續 14 日 opt-in**，通過後才可以申請 production access。人數由 20 降到 12（2024-12），今次官方頁面寫 12。
- **機構帳戶豁免**：官方頁面標題同內容只寫「new **personal** developer accounts」，**冇明文講機構帳戶**；Google 社群指引寫明「只適用於 2023-11-13 後開嘅個人帳戶，唔影響機構帳戶」（非官方）。所以結論：**用機構帳戶一般唔受呢條規則，但 Google 官方無白紙黑字**，開帳戶後去 Play Console 睇有冇要求做 closed test 嘅提示，有就即刻話工程側知。
- 如果真係有（例如 Google 當我哋係個人），後備：拉 12 個員工／會員做 closed test 14 日，預留 3 星期，會影響第 8 星期上架。
- 驗證過程如果要補文件（例如公司證明），按 Play Console 提示做。

**Android developer verification（新）**：Google 已開始要開發者登記 app **package name**（[官方入門頁](https://support.google.com/googleplay/android-developer/answer/10788890) 提及）。開帳戶後睇 Play Console 有冇「Developer verification」提示，之後同工程確認 bundle／package id（例如 `com.onyx.thelab`）再登記。

**審批時間**：Google 官方：D-U-N-S 可能要 30 日，付款驗證最多 5 日；之後 Play Console 開通通常係幾日內（非官方）。

## 5. 批准後交畀工程側嘅嘢

**原則：憑證唔好貼入 chat、email、WhatsApp、repo、Notion。** 能夠由 Anthony 自己直接上載去 EAS 最好，工程側唔需要見到檔案內容。

| 要交嘅嘢 | 點樣攞 | 點樣安全交 |
|---|---|---|
| **Apple Team ID**（10 位英數） | developer.apple.com → Account → Membership details | 唔係秘密，可以直接 chat 傳。 |
| **Bundle ID 註冊**（`com.onyx.thelab` 等） | Certificates, Identifiers & Profiles → Identifiers；或者由 EAS 自動註冊 | Anthony 同工程確認名稱（G4）後，由有權限嘅人建立。 |
| **App Store Connect API key**（.p8、Key ID、Issuer ID） | App Store Connect → Users and Access → Integrations → App Store Connect API → 新增 Team Key；角色建議 **App Manager**，要由 EAS 管理憑證則用 **Admin**（見 [EAS Submit iOS](https://docs.expo.dev/submit/ios/)） | **.p8 只可以下載一次**。放入公司密碼管理員（例如 1Password／Bitwarden 共享保險庫，只畀指定工程成員），或者由 Anthony 自己喺 EAS Dashboard／`eas credentials --platform ios` 上載。**唔好**入 git。 |
| **Google 服務帳戶 JSON key** | Google Cloud 新 project → 服務帳戶 → 新增 JSON key；開 **Google Play Android Developer API**；Play Console → Users and permissions → 邀請服務帳戶電郵，權限：View app information、Edit and delete draft apps、Release to production / testing tracks、Manage testing tracks、Manage store presence（不用 Admin／財務）。詳細見 [Expo 指引](https://github.com/expo/fyi/blob/main/creating-google-service-account.md) | JSON 係完整密鑰；同上，密碼管理員或者 Anthony 自己上載 EAS（Credentials → Android → Service credentials）。 |
| **Expo 組織**邀請 | 工程側開 Expo 組織／專案（每個品牌一個 project） | Anthony 或指定同事用公司電郵加入。 |

**之後流程（工程側做）**

1. Anthony 將工程成員加入 App Store Connect（Developer／App Manager）同 Play Console（按需要）。
2. 工程第一次 `eas build` 時 EAS 會生成 iOS 發行憑證同 provisioning profile，需要有權限嘅 Apple 帳戶登入一次（或者由 Anthony 先登入一次）。
3. 完成後寫入 `STATE.md` CLOSE，並更新辦公室 PENDING 板 H103。

## 6. 時間表（外部等待，唔計入工程時間）

| 階段 | 預期 |
|---|---|
| 準備文件、查 D-U-N-S | 當日 |
| D-U-N-S 申請 | 最多 5 工作天（官方），Google 話最多 30 日 |
| Apple 收到 D-U-N-S | 再多 2 工作天（官方） |
| Apple 機構審批 | 官方未講；預留約 1–2 星期（非官方） |
| Google 機構帳戶 | 付款驗證最多 5 日；整體幾日到數星期 |
| 兩邊都得 | 計劃假設 **1–2 星期**；超過就跟進 D&B／Apple／Google |

## 7. 風險同要睇嘅位

- 公司名、地址、電話三樣只要同 D&B／註冊文件有出入，就會拖：全部跟註冊證書抄。
- 網站如果係單頁「coming soon」，Apple 會拒。
- Account Holder 嘅 Apple ID 失去（換電話號碼、離職）會好麻煩：用公司電郵、登記公司固定電話或 Anthony 長期使用嘅號碼，並做好備份驗證方式。
- Apple 年費到期忘記續費，所有 app 會下架：設提醒，或者確保卡可扣款。
- 如果結論係 Google 要求 12 人 14 日測試，通知工程重排時間，第 8 星期送審會落空，改用第 10–12 星期。

## 來源（官方）

- Apple：[D-U-N-S Number](https://developer.apple.com/support/D-U-N-S/) · [Enroll](https://developer.apple.com/programs/enroll/) · [Program enrollment help](https://developer.apple.com/help/account/membership/program-enrollment/)
- Google：[Create a developer account](https://support.google.com/googleplay/android-developer/answer/13628312) · [New personal account testing rule](https://support.google.com/googleplay/android-developer/answer/14151465) · [Prepare to publish](https://support.google.com/googleplay/android-developer/answer/10788890)
- Expo：[App credentials](https://docs.expo.dev/app-signing/app-credentials/) · [Apple roles](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/) · [Submit iOS](https://docs.expo.dev/submit/ios/) · [Submit Android](https://docs.expo.dev/submit/android/) · [Google service account](https://github.com/expo/fyi/blob/main/creating-google-service-account.md)
