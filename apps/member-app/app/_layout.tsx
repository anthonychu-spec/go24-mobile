import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
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
