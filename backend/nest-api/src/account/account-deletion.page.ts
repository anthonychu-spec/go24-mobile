import { BrandId } from '../brand/brand.constants';

/**
 * HTML for the public account-deletion page (Google Play asks for one that
 * works after the app is uninstalled). Plain forms, no script, no cookies:
 * the PGM one-time code is the only proof of identity.
 *
 * Copy is a draft for Anthony (docs/gates/M6-store-listing-privacy.md).
 */

export const PAGE_PATH = '/v1/account-deletion';

const APP_NAMES: Record<BrandId, string> = {
  lab: 'THE LAB by ONYX',
  foundry: 'The Foundry',
  go24: 'GO24 Fitness',
  onyx: 'ONYX by GO24',
};
const ALL_APPS = 'THE LAB by ONYX, GO24 Fitness, ONYX by GO24, The Foundry';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function appName(brand: BrandId | null): string {
  return brand ? APP_NAMES[brand] : 'GO24 Group member apps';
}

function layout(brand: BrandId | null, body: string): string {
  const title = `${escapeHtml(appName(brand))} · 刪除 App 帳戶 Delete app account`;
  return `<!doctype html>
<html lang="zh-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; --fg:#111; --muted:#555; --bg:#fff; --line:#ddd; --accent:#b3261e; }
  @media (prefers-color-scheme: dark) { :root { --fg:#eee; --muted:#aaa; --bg:#121212; --line:#333; --accent:#f2b8b5; } }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.55 system-ui, -apple-system, "Segoe UI", "Noto Sans HK", sans-serif; }
  main { max-width:560px; margin:0 auto; padding:32px 16px 48px; }
  h1 { font-size:1.5rem; margin:0 0 4px; }
  .app { color:var(--muted); margin:0 0 24px; }
  ul { padding-left:1.2em; }
  li { margin:4px 0; }
  .en { color:var(--muted); font-size:.92em; }
  form { margin:24px 0; }
  label { display:block; font-weight:600; margin:16px 0 6px; }
  input[type=email], input[type=text] { width:100%; box-sizing:border-box; padding:12px; font-size:1rem; border:1px solid var(--line); border-radius:8px; background:transparent; color:inherit; }
  .check { display:flex; gap:10px; align-items:flex-start; font-weight:400; }
  .check input { margin-top:5px; }
  button { margin-top:20px; width:100%; padding:14px; font-size:1rem; font-weight:600; border:0; border-radius:8px; background:var(--accent); color:var(--bg); cursor:pointer; }
  .error { border:1px solid var(--accent); color:var(--accent); border-radius:8px; padding:10px 12px; margin:16px 0; }
  .done { border:1px solid var(--line); border-radius:8px; padding:12px 14px; }
  a { color:inherit; }
</style>
</head>
<body><main>
<h1>刪除 App 帳戶 <span class="en">Delete app account</span></h1>
<p class="app">${escapeHtml(appName(brand))}</p>
${body}
</main></body>
</html>`;
}

function brandField(brand: BrandId | null): string {
  return brand ? `<input type="hidden" name="brand" value="${brand}">` : '';
}

function errorBox(error?: string): string {
  return error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : '';
}

const WHAT_HAPPENS = `
<p>呢個帳戶係所有會員 app 共用（${ALL_APPS}）。刪除之後，所有 app 都會登出，以下資料會一併刪除：</p>
<ul>
  <li>登入紀錄同裝置、推送通知設定、通知、app 設定、收藏</li>
  <li>預約紀錄會保留作統計，但會移除你嘅身份資料</li>
</ul>
<p><strong>唔會</strong>取消你嘅會籍，亦唔會停止會費扣款。會籍同會員紀錄由會所系統保存；如要取消會籍，請聯絡分店前台。已經約咗嘅堂唔會自動取消，請先喺 app 取消或者聯絡前台。</p>
<p>系統日誌同備份入面嘅資料會喺 30 日內自動清除。之後你仍然可以用會員電郵再登入，會開一個新嘅空白帳戶。</p>
<p class="en">One account is shared by all member apps (${ALL_APPS}). Deleting it signs you out everywhere and deletes your sign-in sessions and devices, push settings, notifications, app settings and favourites. Booking records are kept for statistics with your identity removed. Your membership is <strong>not</strong> cancelled and membership fees continue; to cancel your membership, contact the front desk. Classes you have booked are not cancelled. Copies in system logs and backups expire within 30 days.</p>`;

export function renderStart(brand: BrandId | null, error?: string): string {
  return layout(brand, `
${WHAT_HAPPENS}
${errorBox(error)}
<form method="post" action="${PAGE_PATH}/code">
  ${brandField(brand)}
  <label for="email">會員電郵 <span class="en">Member email</span></label>
  <input id="email" name="email" type="email" autocomplete="email" required maxlength="150">
  <button type="submit">寄驗證碼 <span>Send code</span></button>
</form>
<p class="en">We email you a one-time code (the same kind you get when signing in) to confirm it's you.</p>`);
}

export function renderCode(brand: BrandId | null, memberIdToken: string, error?: string): string {
  return layout(brand, `
<p>如果呢個電郵屬於會員，我哋已經寄出一次性驗證碼，15 分鐘內有效。</p>
<p class="en">If this email belongs to a member, we have sent a one-time code. It is valid for 15 minutes.</p>
${errorBox(error)}
<form method="post" action="${PAGE_PATH}/confirm">
  ${brandField(brand)}
  <input type="hidden" name="memberIdToken" value="${escapeHtml(memberIdToken)}">
  <label for="code">驗證碼 <span class="en">Code</span></label>
  <input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" required maxlength="10">
  <label class="check"><input type="checkbox" name="confirm" value="yes" required>
    <span>我明白：所有會員 app 嘅帳戶資料會永久刪除，會籍唔會取消。<br><span class="en">I understand my account data in all member apps is permanently deleted and my membership is not cancelled.</span></span>
  </label>
  <button type="submit">永久刪除帳戶 <span>Delete account</span></button>
</form>
<p><a href="${PAGE_PATH}${brand ? `?brand=${brand}` : ''}">重新開始 Start again</a></p>`);
}

export function renderDone(brand: BrandId | null, deleted: boolean): string {
  const zh = deleted
    ? '你嘅 app 帳戶已經刪除，所有會員 app 都已登出。你嘅會籍維持不變。'
    : '我哋搵唔到呢個會員嘅 app 帳戶資料，可能從未用過 app，或者已經刪除咗。你嘅會籍維持不變。';
  const en = deleted
    ? 'Your app account has been deleted and you are signed out of every member app. Your membership is unchanged.'
    : 'There is no app account data for this member: the app was never used or the account was already deleted. Your membership is unchanged.';
  return layout(brand, `<div class="done" role="status"><p>${zh}</p><p class="en">${en}</p></div>`);
}

export function renderProblem(brand: BrandId | null, message: string): string {
  return layout(brand, `${errorBox(message)}<p><a href="${PAGE_PATH}${brand ? `?brand=${brand}` : ''}">返回 Back</a></p>`);
}

/** Messages shown on the page, by AppError code. Anything else gets TRY_LATER. */
export const MESSAGES = {
  INVALID_OTP: '驗證碼唔正確或者已過期，請再試或者重新開始。The code is wrong or has expired.',
  OTP_EXPIRED: '驗證碼已過期，請重新開始。The code has expired, please start again.',
  AMBIGUOUS_ACCOUNT: '呢個電郵屬於多過一個會員，請聯絡分店前台處理。This email is shared by more than one member; please contact the front desk.',
  NOT_CONFIRMED: '請剔選確認方格。Please tick the confirmation box.',
  INVALID_EMAIL: '請輸入有效嘅電郵。Please enter a valid email.',
  RATE_LIMITED: '嘗試次數太多，請稍後再試。Too many attempts, please try again later.',
  TRY_LATER: '暫時未能處理，請稍後再試。We could not process this right now, please try again later.',
} as const;
