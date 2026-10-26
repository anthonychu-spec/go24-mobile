import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { brand } from '../brand';

const PUSH_TOKEN_KEY = 'push_token';
let loggedNoProject = false;

/** The Expo push token last registered with the API — sent on logout so this phone stops getting push. */
export const pushTokenStorage = {
  get:   () => AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null),
  clear: () => AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {}),
};

export async function registerPushToken(): Promise<void> {
  // Web doesn't support Expo push notifications
  if (Platform.OS === 'web') return;

  const projectId = brand.easProjectId;
  if (!projectId) {
    if (!loggedNoProject) console.info(`[push] no easProjectId for "${brand.id}"; skipping registration`);
    loggedNoProject = true;
    return;
  }

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

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const platform = Platform.OS as 'ios' | 'android';

    await apiClient.post('/notifications/device', { token, platform });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch {
    // Non-critical — app works without push
  }
}
