import Constants from 'expo-constants';
import * as Device from 'expo-device';
// Type-only import — erased at compile time, so it never triggers the Android
// Expo Go module-load crash (that only happens on a runtime require).
import type { ExpoPushToken } from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken, unregisterPushToken } from './push-api';

// Lazy-load expo-notifications. On Android Expo Go SDK 53+ importing it
// statically eagerly runs `DevicePushTokenAutoRegistration` which THROWS
// ("Android Push notifications removed from Expo Go") and shows a red error
// overlay. iOS Expo Go still works via Apple's legacy bundle, and EAS
// dev/production builds always work. So skip the require only on Android-Expo-Go.
const isExpoGo = Constants.appOwnership === 'expo';
const isExpoGoAndroid = isExpoGo && Platform.OS === 'android';
type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;
if (!isExpoGoAndroid) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications') as NotificationsModule;
  // Foreground policy: don't show the system banner — the app is open and
  // PushNoticeOverlay shows our own modal instead. The notification still lands
  // in the system list for history.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask permission, fetch the Expo push token, and register it on the backend.
 * Returns the token, or null when it couldn't be acquired (emulator, denied
 * permission, missing EAS projectId, or Android Expo Go post-SDK 53).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[push] skip register: not a real device (simulator/emulator).');
    return null;
  }
  if (!Notifications) {
    console.warn('[push] skip register: Android Expo Go has no remote push since SDK 53. Use an EAS dev/production build.');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    console.warn('[push] skip register: notification permission not granted (status=' + status + ')');
    return null;
  }

  // Android needs a default channel before notifications are visible.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // EAS / Expo project id — required by the Expo Push Service.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
      ?.projectId;

  let tokenResponse: ExpoPushToken;
  try {
    tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
  } catch (e) {
    console.warn('[push] getExpoPushTokenAsync failed (is the EAS projectId set?)', e);
    return null;
  }

  const token = tokenResponse.data;
  console.log('[push] got Expo token:', token);

  try {
    await registerPushToken(
      token,
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    );
    console.log('[push] backend registered token for', Platform.OS);
  } catch (e) {
    console.warn('[push] backend register failed', e);
  }

  return token;
}

export async function deregisterPushToken(token: string) {
  try {
    await unregisterPushToken(token);
  } catch (e) {
    console.warn('[push] backend unregister failed', e);
  }
}
