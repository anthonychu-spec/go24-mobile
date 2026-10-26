import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '../src/auth/context';
import { registerPushToken } from '../src/notifications/push';
import { AppConfigProvider, useAppConfig } from '../src/config/AppConfigProvider';
import { AppStatusScreen } from '../src/config/AppStatusScreen';
import type { Feature } from '../src/brand';
import { t } from '../src/i18n';

/** Feature a route belongs to, by its first segments (null = always available). */
function routeFeature([a, b]: string[]): Feature | null {
  switch (a) {
    case 'signup':     return 'signup';
    case 'payment':
    case 'payments':   return 'payments';
    case 'pt':         return 'pt';
    case 'referral':   return 'referral';
    case 'favourites': return 'favourites';
    case 'checkin':    return 'member_qr';
    case 'membership': return b === 'freeze' ? 'freeze' : null;
    case '(tabs)':
      if (b === 'pt') return 'pt';
      if (b === 'classes' || b === 'bookings') return 'classes';
      return null;
    default:           return null;
  }
}

function RouteGuard() {
  const { user, loading } = useAuth();
  const { config } = useAppConfig();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const feature = routeFeature(segments as string[]);
    const allowed = !feature || config.features[feature];
    const inAuth = segments[0] === '(auth)';
    const inSignup = segments[0] === 'signup' && allowed;
    if (!user && !inAuth && !inSignup) router.replace('/(auth)/login');
    else if (user && inAuth) router.replace('/(tabs)/');
    else if (user && !allowed) router.replace('/(tabs)');
  }, [user, loading, segments, config.features]);

  useEffect(() => {
    if (user) void registerPushToken();
  }, [user]);

  // Deep link: notification tap → navigate by url in data
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const url: string = (response.notification.request.content.data as any)?.url ?? '';
      if (!url || !user) return;
      if (url.includes('profile') || url === 'go24://profile') {
        router.push('/(tabs)/settings' as any);
      } else if (url.includes('home') || url === 'go24://home') {
        router.push('/(tabs)' as any);
      }
    });
    return () => sub.remove();
  }, [user]);

  return <Slot />;
}

/** Blocks the whole app when the build is too old or the brand is in maintenance. */
function AppGate({ children }: { children: React.ReactNode }) {
  const { updateRequired, maintenanceMessage, refresh } = useAppConfig();
  if (updateRequired) {
    return <AppStatusScreen title={t.appStatus.updateTitle} body={t.appStatus.updateBody} />;
  }
  if (maintenanceMessage) {
    return <AppStatusScreen title={t.appStatus.maintenanceTitle} body={maintenanceMessage} onRetry={refresh} />;
  }
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  if (!fontsLoaded) return null;

  return (
    <AppConfigProvider>
      <AppGate>
        <AuthProvider><RouteGuard /></AuthProvider>
      </AppGate>
    </AppConfigProvider>
  );
}
