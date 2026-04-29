import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
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

  // Register push token after login
  useEffect(() => {
    if (user) void registerPushToken();
  }, [user]);

  return <Slot />;
}

export default function RootLayout() {
  return <AuthProvider><RouteGuard /></AuthProvider>;
}
