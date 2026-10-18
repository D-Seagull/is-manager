import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
// Type-only import — erased at compile time, so it never triggers the Android
// Expo Go module-load crash (that only happens on a runtime require).
import type { ExpoPushToken } from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import i18n from './i18n';
import { registerPushToken, unregisterPushToken } from './push-api';

/**
 * The `alarm` channel needs is_alarm.mp3 bundled in the binary — Android
 * builds from versionCode 3 on. A channel's sound is fixed the moment it is
 * created, so creating it from an OTA running on an older binary would leave
 * it silent for good (until a reinstall). Older binaries skip it and keep
 * getting alarms on `default`. Read from the binary, not the update manifest.
 */
export const HAS_ALARM_SOUND =
  Platform.OS !== 'android' || Number(Application.nativeBuildVersion ?? 0) >= 3;

/** Channels this version creates beyond the original two (PushService.channelFor). */
const ANDROID_CHANNELS = HAS_ALARM_SOUND ? ['chat', 'alarm'] : ['chat'];

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
  /**
   * The backend sends every push; whether it shows is decided here, the
   * moment it lands — only the phone knows for sure that the app is on screen
   * (the server's guess lagged, and a locked phone went silent).
   *  - on screen: no banner, no tray entry, no sound — the app shows it itself
   *    (PushNoticeOverlay modal, chat chime from the socket);
   *  - an alarm still rings through its channel;
   *  - not on screen (iOS `inactive`: tray pulled down, app switcher): the OS
   *    shows and sounds it as usual.
   * Background / closed: this handler doesn't run — the OS shows the push.
   */
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const onScreen = AppState.currentState === 'active';
      const alarm =
        (n.request.content.data as { type?: unknown } | null)?.type === 'ALARM';
      return {
        shouldShowBanner: !onScreen,
        shouldShowList: !onScreen || alarm,
        shouldPlaySound: !onScreen || alarm,
        shouldSetBadge: false,
      };
    },
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
    // Chat messages get their own channel: on Android 8+ the sound belongs to
    // the CHANNEL (the push's `sound` is ignored) and a channel's sound can't
    // change once created — hence a new id rather than editing 'default'.
    // The file is bundled via app.json → expo-notifications `sounds`.
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'push_message.mp3',
      vibrationPattern: [0, 250, 250, 250],
    });
    // `chat`: every IS Fleet push, MAX importance + public on the lock screen
    // (pops up and shows in full while locked, wakes the screen where the
    // firmware does that). A NEW channel because existing ones can't change;
    // the backend uses it only for devices that report it (ANDROID_CHANNELS).
    await Notifications.setNotificationChannelAsync('chat', {
      name: i18n.t('push.channels.chat'),
      importance: Notifications.AndroidImportance.MAX,
      sound: 'push_message.mp3',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    // `alarm`: alarms set for this manager. Played on the ALARM audio stream,
    // so it rings on silent and vibrate like the system alarm clock; with
    // "Do not disturb" access granted (Account → reliable notifications) it
    // rings through DND too. Without it alarms fell back to `default` and
    // stayed silent on a phone in silent mode. Same channel as the driver app.
    if (HAS_ALARM_SOUND) await Notifications.setNotificationChannelAsync('alarm', {
      name: i18n.t('push.channels.alarm'),
      importance: Notifications.AndroidImportance.MAX,
      sound: 'is_alarm.mp3',
      vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 800],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
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
      Platform.OS === 'android' ? ANDROID_CHANNELS : [],
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
