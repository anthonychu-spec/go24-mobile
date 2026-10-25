# The Foundry Member App — 畫面對照表

更新日期：2026-10-24 · 配合 `docs/mvp-plan.md` 使用。

來源：`Documents\ChatGPT\Mobile Apps\Foundry-App-Final-reviewed.zip`（`project/F-*.dc.html`，共 34 個檔），同設計 canvas https://claude.ai/artifact/4e5BxbjsJm1ihFoVmB4A5s 「Foundry」頁（41 個 board，多咗嘅係同一畫面嘅狀態，例如 Book list、Social Play、Golf、Physio、Passport 各分頁）。

- 「改」= 現有 Expo 檔案轉 Foundry 款；「新」= 新檔案。
- 估時只計 frontend（一個人、用新 component 起），backend 見 `mvp-plan.md`「Backend 工作」。
- 相片一律用 placeholder，唔計相片工作。
- 「待探 PGM」= 畫面做得，但資料來源未核實。

## 導航結構

```
app/
  (auth)/landing.tsx, login.tsx          Welcome / Sign in
  (tabs)/_layout.tsx                     4 tab + 中間 QR 掣
  (tabs)/index.tsx                       Home
  (tabs)/book/_layout.tsx                Sports / Recovery / Classes / Fitness 頂部分類 tab
  (tabs)/book/sports.tsx                 Reserve / Social Play / What's on / Coaching
  (tabs)/book/recovery.tsx
  (tabs)/book/classes.tsx
  (tabs)/book/fitness.tsx
  (tabs)/passport.tsx                    Visits / Milestones / Bookings / History / Levels
  (tabs)/profile.tsx                     Memberships / Settings
  member-pass.tsx                        中間 QR 掣（modal）
  book/checkout.tsx, class/[id].tsx ...  見下表
```

現有 `(tabs)/activity.tsx`、`bookings.tsx`、`notifications.tsx`、`pt.tsx`、`settings.tsx` 唔再係 tab：內容搬入 Passport、Profile 同獨立頁。

## 主 tab

| # | Prototype 畫面 | Expo route | 改／新 | 內容重點 | 估時 |
|---|---|---|---|---|---|
| 1 | Home `F-Main` | `app/(tabs)/index.tsx` | 改 | Logo header + 4 個 icon（Find players、Messages、News、Notifications）；問候 + 分店；Your next session；Explore tile（Active／Recovery／Social pillar 款）；This month visits → Passport；First class 卡 | 1.5 日 |
| 2 | Tab bar（`support.js` `tabsHTML`） | `app/(tabs)/_layout.tsx` | 改 | 5 tab 改 4 tab：Home／Book／Passport／Profile；中間圓形 QR 掣開會員證；QR 頁時冇 tab 高亮 | 0.5 日 |
| 3 | Book 分類 tab（`bookTabsHTML`） | `app/(tabs)/book/_layout.tsx` | 新 | Sports／Recovery／Classes／Fitness 底線 tab；撳 Book tab 時開 Profile › Settings 揀嘅預設分類 | 0.5 日 |
| 4 | Book · Sports · Reserve `F-Book`（+ canvas「Book · Courts」） | `app/(tabs)/book/sports.tsx` | 新 | 運動 chip（Pickleball／Tennis／Golf Sim）；分店、只顯示有空、日期、時長、開始時間；**預設 court layout 圖**，可切 List；Book again、Favourites；sticky bar（場 · 價錢、日期 · 時間 · 時長、Review）；冇位狀態 | 4 日 |
| 5 | Sports · Social Play | 同上（`view=match`） | 新 | Open match 清單；按等級、日期、分店篩選；Rated／DUPR 標記；Join；冇 match 時「Host a Social Play session」 | 2 日 |
| 6 | Sports · What's on | 同上（`view=events`） | 新 | 活動清單（Mixer、Ladder Night、Longest Drive 等）；Reserve a place | 1 日 |
| 7 | Sports · Coaching | 同上（`view=lessons`） | 新 | 教練卡（相、資歷、專長）；group lesson／private lesson；揀時間 → checkout。Golf 只有 Reserve + Coaching | 1.5 日 |
| 8 | Recovery `F-Wellness` | `app/(tabs)/book/recovery.tsx` | 新 | Segmented：Recovery Lounge／Plunge／Physio；服務清單（時長、價錢、邊個 tier 包）；bottom sheet 揀日期時間；Good to know | 2.5 日 |
| 9 | Classes `F-Classes` | `app/(tabs)/book/classes.tsx` | 改（由 `(tabs)/classes.tsx` 搬） | Group X／HYROX／Reformer／Yoga；日期、分店篩選；Included in membership／Drop-in 價；Yoga Loft「coming soon」 | 2 日 |
| 10 | Fitness `F-Fitness` | `app/(tabs)/book/fitness.tsx` | 新 | Strength floor 介紹；PT 30 分鐘免費諮詢；Meet your coaches；去 Classes 連結 | 1.5 日 |
| 11 | Passport `F-Activity`（+ `F-MyBookings`、`F-SkillLevel` 只係轉頁） | `app/(tabs)/passport.tsx` | 改（合併 `activity.tsx` + `bookings.tsx`） | 5 個 segmented 分頁（可橫掃）：**Visits**（今月次數、每月目標、連續星期）、**Milestones**（徽章 + 進度）、**Bookings**（將來，可取消）、**History**（過去 + 再約）、**Levels**（自選等級、DUPR 連結、Golf HCP） | 4 日 |
| 12 | Profile `F-Me` | `app/(tabs)/profile.tsx` | 改（合併 `settings.tsx` + `membership.tsx`） | 未登入版；頭像 + Member since + 會員號；Balance 卡 + Top Up；Current plan（book ahead、recovery、guest passes、Compare & upgrade）；Member card、Family、Freeze、Billing；Settings 分頁：Book 預設、常用運動／分店／時長、court 顯示方式、Favourite courts、個人資料、Sport levels、Payments、Notifications、Clubs、Shop、Sign out | 3 日 |
| 13 | Member pass `F-MemberCard` | `app/member-pass.tsx` | 改（由 `checkin/qr.tsx`） | 白底 QR（quiet zone 保持純白）、會員號、tier、狀態 | 1 日 |

## Book 流程頁

| # | Prototype 畫面 | Expo route | 改／新 | 內容重點 | 估時 |
|---|---|---|---|---|---|
| 14 | Court Booking Review / Checkout `F-Checkout` | `app/book/checkout.tsx` | 新 | 摘要；Match type：Just your group（全數）／Social Play（開位、分攤、每人價）；Who can join + 等級；6 小時規則說明；Submit to DUPR + DUPR Plus／Verified 限制；付款：Foundry Balance／存咗嘅卡；餘額不足提示；取消政策；成功頁 + Ref。Guest 版（填資料 + 卡）見 `mvp-plan.md` 決定 #14 | 2.5 日 |
| 15 | Class Booking Review `F-ClassConfirm` | `app/class/[id].tsx` | 新（取代 modal） | 堂資料、取消政策（「Cancel at least 12 hours before class at no charge.」）、Confirm booking／Join the waitlist、成功狀態 | 1 日 |
| 16 | First Timer Guide `F-FirstTimer` | `app/class/first-timer.tsx` | 新 | 強度、要帶乜、幾點到、去邊間房 | 0.5 日 |
| 17 | Rate Your Class `F-RateClass` | `app/class/rate.tsx` | 新 | 5 星 + chip（What stood out）+ 留言；由 push 開 | 1 日 |
| 18 | Personal Training `F-PT`（只係轉去 Fitness） | `app/pt/index.tsx`、`pt/sign.tsx` | 改（由 `(tabs)/pt.tsx` 搬） | 現有 PT 合約、堂數、簽名轉新款；入口喺 Fitness 同 Passport | 1 日 |
| 19 | Book · Courts `F-Facility`、`F-FacilityConfirm` | — | — | Prototype 入面只係轉頁去 #4 同 #14，唔使獨立 route | 0 |

## Social

| # | Prototype 畫面 | Expo route | 改／新 | 內容重點 | 估時 |
|---|---|---|---|---|---|
| 20 | Find Players `F-Players` | `app/social/players.tsx` | 新 | 搜尋、按運動篩選；DUPR／Level／Handicap；Follow；未登入版 | 1.5 日 |
| 21 | Messages `F-Messages` | `app/social/messages/index.tsx`、`[threadId].tsx` | 新 | Thread 清單（match 夥伴、教練、Front Desk）；對話；送出；檢舉／封鎖（上架要求） | 3 日 |
| 22 | News & Calendar `F-News` | `app/news.tsx` | 新 | News／Calendar 兩段；新聞卡；本星期日曆（自己預約 + open match + 活動） | 1 日 |
| 23 | Workout Buddies `F-Buddy` | `app/social/buddies.tsx` | 新 | 邀請朋友一齊上堂／打波；Request sent 狀態 | 1.5 日 |
| 24 | Notifications `F-Notifications` | `app/notifications.tsx` | 改（由 `(tabs)/notifications.tsx` 搬） | 分段 + 按日分組；新類型：match、message、wallet | 0.5 日 |

## 帳戶、會籍、付款

| # | Prototype 畫面 | Expo route | 改／新 | 內容重點 | 估時 |
|---|---|---|---|---|---|
| 25 | Top-Up & tiers `F-TopUp` | `app/wallet/top-up.tsx`、`app/membership/tiers.tsx` | 新 | 餘額；$500／$1,000／$2,000／$5,000 + tier bonus；用存咗嘅卡付；4 個 tier 比較表 + Upgrade | 2.5 日 |
| 26 | Payments · Day Pass `F-Payments` | `app/payments/index.tsx`（+ 現有 `payments/history.tsx`、`payment/*`） | 改 | 欠款 + ENTRY PAUSED + 即付；付款方式；Day pass HK$150；紀錄同收據 | 1.5 日 |
| 27 | Clubs `F-Clubs` | `app/clubs/index.tsx` | 新 | 分店清單、篩選（Pickleball、Golf、Recovery、Reformer…）、Home club | 1 日 |
| 28 | Club Detail `F-ClubDetail` | `app/clubs/[id].tsx` | 新 | 相片、地址、地圖、開放時間（包括假期）、設施、電話、Book 掣 | 1 日 |
| 29 | Shop · Packs `F-Shop` | `app/shop.tsx` | 新 | 分類：Class packs、PT、Recovery、Add-ons（毛巾、儲物櫃）；For a friend；用卡／餘額買 | 2 日 |
| 30 | Family `F-Family` | `app/family.tsx` | 新 | 家人會籍；幫家人約堂、睇預約 | 1.5 日 |
| 31 | Freeze Membership `F-Freeze` | `app/membership/freeze.tsx` | 改 | 由「申請」改自助：凍結類型、原因、日期條、即時計費、確認 | 1.5 日 |

## 入會同登入

| # | Prototype 畫面 | Expo route | 改／新 | 內容重點 | 估時 |
|---|---|---|---|---|---|
| 32 | Welcome `F-Landing` + Sign in `F-Login` | `app/(auth)/landing.tsx`、`login.tsx` | 改 | 全屏相（`court-aerial`）+ Logo；SIGN IN／JOIN THE FOUNDRY／Book a free club tour；登入 sheet（密碼／Email me a code）；Continue as Guest。REVIEW.md 指兩個入口重複，揀一個（決定 #15） | 1.5 日 |
| 33 | Join `F-Signup` | `app/signup/*`（6 個檔） | 改 | 步驟條；揀分店同方案；開始日期；資料；自拍；Review & pay | 2 日 |
| 34 | Book a Tour · Trial `F-TourBooking` | `app/tour.tsx` | 新 | Tour／Trial；分店；日期時間；聯絡資料 → PGM CRM | 1.5 日 |

## 唔係 App 畫面

| Prototype 畫面 | 處理 |
|---|---|
| Web booking grid `F-Web` | 網頁版（Play、Open Match、My Bookings、Top-Up、Guest checkout）。唔係 Expo App 嘅一部分，見 `mvp-plan.md` 決定 #13 |

## 合計

| 部分 | 估時 |
|---|---|
| Expo 工程基礎（`mvp-plan.md` Z 節，包括 Maestro） | 6.5 日 |
| 品牌設定（`mvp-plan.md` A0 App 部分） | 2 日 |
| 設計基礎 + component（`mvp-plan.md` A 節） | 8.5 日 |
| 34 個畫面（上表） | 55 日 |
| 三種狀態（冇位／載入／出錯）、未登入版、真機調整 | 5 日 |
| **Frontend 合共** | **約 77 日（約 15.5 星期，一個人）** |

管理頁（`apps/admin-web`）唔喺呢個表，見 `mvp-plan.md` E 節（約 25 日）。
