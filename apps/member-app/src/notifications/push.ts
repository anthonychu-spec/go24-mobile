import { Platform } from 'react-native';
import { apiClient } from '../api/client';

export async function registerPushToken(): Promise<void> {
  // Web doesn't support Expo push notifications
  if (Platform.OS === 'web') return;

  try {
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    const platform = Platform.OS as 'ios' | 'android';

    await apiClient.post('/notifications/device', { token, platform });
  } catch {
    // Non-critical — app works without push
  }
}
