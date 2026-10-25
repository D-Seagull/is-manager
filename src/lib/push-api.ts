import { api } from './api';

export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android' | 'web' | 'android-fcm',
  channels: string[] = [],
): Promise<void> {
  await api.post('/users/me/push-token', { token, platform, channels });
}

/** EXPERIMENT: a test push to my own phone, `delaySec` from now (lock it
 *  meanwhile), through Expo or straight through FCM. */
export async function sendTestPush(
  via: 'expo' | 'fcm',
  delaySec = 30,
): Promise<{ scheduled: boolean; tokens: number; reason?: string }> {
  const { data } = await api.post('/users/me/push-test', { via, delaySec });
  return data;
}

export async function unregisterPushToken(token: string): Promise<void> {
  await api.delete(`/users/me/push-token/${encodeURIComponent(token)}`);
}
