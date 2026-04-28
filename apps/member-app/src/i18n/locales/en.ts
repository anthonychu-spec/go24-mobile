export const en = {
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to your GO24 account',
    emailLabel: 'Email',
    emailPlaceholder: 'your@email.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password',
    submit: 'Sign In',
    forgotPassword: 'Forgot password?',
  },
  errors: {
    invalidCredentials: 'Invalid email or password',
    memberInactive: 'Account is inactive. Please contact the gym.',
    accountLocked: 'Account locked. Please try again later.',
    networkError: 'Connection error. Please try again.',
    unknown: 'Something went wrong. Please try again.',
  },
  auth: { logout: 'Logout' },
} as const;
