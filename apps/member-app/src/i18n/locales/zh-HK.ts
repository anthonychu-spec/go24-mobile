export const zhHK = {
  login: {
    title: '歡迎回來',
    subtitle: '登入您的 GO24 帳戶',
    emailLabel: '電郵',
    emailPlaceholder: 'your@email.com',
    passwordLabel: '密碼',
    passwordPlaceholder: '密碼',
    submit: '登入',
    forgotPassword: '忘記密碼？',
  },
  errors: {
    invalidCredentials: '電郵或密碼不正確',
    memberInactive: '帳戶已停用，請聯絡健身房',
    ambiguousAccount: '此電郵已連結多於一個會籍，請到前台登入',
    accountLocked: '帳戶已鎖定，請稍後再試',
    rateLimited: '嘗試次數過多，請稍候再試',
    networkError: '網絡連線錯誤，請重試',
    unknown: '發生錯誤，請重試',
  },
  appStatus: {
    updateTitle: '需要更新',
    updateBody: '此版本已不再支援，請到 App Store 或 Google Play 更新應用程式',
    maintenanceTitle: '系統維護中',
    retry: '重試',
  },
  auth: { logout: '登出' },
} as const;
