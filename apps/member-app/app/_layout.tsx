import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_900Black } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '../src/auth/context';
import { registerPushToken } from '../src/notifications/push';

function RouteGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(tabs)/');
  }, [user, loading, segments]);

  useEffect(() => {
    if (user) void registerPushToken();
  }, [user]);

  // Deep link: notification tap → navigate by url in data
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const url: string = (response.notification.request.content.data as any)?.url ?? '';
      if (!url || !user) return;
      if (url.includes('profile') || url === 'go24://profile') {
        router.push('/profile' as any);
      } else if (url.includes('home') || url === 'go24://home') {
        router.push('/(tabs)' as any);
      }
    });
    return () => sub.remove();
  }, [user]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  if (!fontsLoaded) return null;

  return <AuthProvider><RouteGuard /></AuthProvider>;
}
