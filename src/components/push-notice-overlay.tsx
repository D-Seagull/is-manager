import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, StyleSheet, Text } from 'react-native';

// In Android Expo Go SDK 53+ importing expo-notifications THROWS at module load
// via DevicePushTokenAutoRegistration. iOS Expo Go still works, and EAS
// dev/prod builds always work. So skip the require only for Android-Expo-Go.
const isExpoGoAndroid =
  Constants.appOwnership === 'expo' && Platform.OS === 'android';
type NotificationsModule = typeof import('expo-notifications');
const Notifications: NotificationsModule | null = isExpoGoAndroid
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-notifications') as NotificationsModule);

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { dmKeys } from '@/hooks/use-direct-messages';
import { groupKeys } from '@/hooks/use-groups';
import { getSocket } from '@/lib/socket';
import { playAlarmSound } from '@/lib/sounds';
import { useAuthStore } from '@/store/auth';

interface Notice {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Shows a centered dismissible modal for news that arrives while the app is
 * open, refreshes the relevant caches on receive/tap, and navigates to the
 * right screen when the user taps a background banner. Chat messages arrive
 * over the socket already, so they refresh silently without a modal.
 *
 * While the app is open the backend sends no push — the news comes as the
 * `notice` socket event and is shown the same way (a banner over the open app
 * was the doubled window). The push path stays for older servers and races.
 */
export function PushNoticeOverlay() {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const [notice, setNotice] = useState<Notice | null>(null);

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['trucks-my'] });
    qc.invalidateQueries({ queryKey: ['trucks-all'] });
    qc.invalidateQueries({ queryKey: ['trips-all'] });
    qc.invalidateQueries({ queryKey: dmKeys.conversations });
    qc.invalidateQueries({ queryKey: dmKeys.unreadSummary });
    qc.invalidateQueries({ queryKey: groupKeys.unread });
    qc.invalidateQueries({ queryKey: ['trip-unread'] });
  }, [qc]);

  /** News that arrived while the app is open → our modal, except what the
   *  app already shows on its own. */
  const show = useCallback(
    (title: string | null, body: string | null, payload?: Record<string, unknown>) => {
      // Chat messages (trip / group / DM) already arrive via the socket and
      // show in-app — don't interrupt with a modal.
      if (
        payload?.type === 'MESSAGE' ||
        payload?.type === 'GROUP_MESSAGE' ||
        payload?.type === 'DM_MESSAGE'
      )
        return;
      // Trip status / "driver hasn't set off" — the colored TripStatusBanner
      // already shows it from the socket while the app is open.
      if (payload?.type === 'TRIP_STATUS' || payload?.type === 'TRIP_NOT_DEPARTED')
        return;
      setNotice({ title: title ?? t('push.noticeTitle', 'Сповіщення'), body: body ?? '', data: payload });
    },
    [t],
  );

  // In-app notices: what the backend sends instead of a push while the app is
  // open. Works in every build, Expo Go on Android included.
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const onNotice = (n: { title?: string; body?: string; data?: Record<string, unknown> }) => {
      refresh();
      show(n.title ?? null, n.body ?? null, n.data);
    };
    socket.on('notice', onNotice);
    return () => {
      socket.off('notice', onNotice);
    };
  }, [token, refresh, show]);

  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as unknown as { __triggerTestPush?: () => void }).__triggerTestPush = () => {
      setNotice({ title: 'Test push', body: 'Simulated foreground notification.', data: { type: 'TEST' } });
    };
  }, []);

  useEffect(() => {
    if (!Notifications) return;

    // Route a background-banner tap to the most relevant screen. Most manager
    // pushes carry a truckId (truck/trip/status/manager-change) → open the truck
    // panel; DM/group messages carry userId/groupId instead.
    // A chat-message push opens that chat pointed at the message
    // (`messageId` → the screen scrolls to it and flashes it). Trip chats
    // open through their truck, on the Chat tab.
    const navigate = (data?: Record<string, unknown>) => {
      const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
      const truckId = str(data?.truckId);
      const userId = str(data?.userId);
      const groupId = str(data?.groupId);
      const messageId = str(data?.messageId);
      if (truckId) {
        router.push({
          pathname: '/(manager)/truck/[truckId]',
          params: { truckId, tab: messageId ? 'chat' : undefined, messageId },
        });
      } else if (userId) {
        router.push({ pathname: '/(manager)/dm/[userId]', params: { userId, messageId } });
      } else if (groupId) {
        router.push({ pathname: '/(manager)/group/[groupId]', params: { groupId, messageId } });
      }
    };

    // Foreground: refresh, then show our modal (except for chat messages, which
    // the socket already delivered in-app). On Android a HIGH-importance channel
    // pops a heads-up banner regardless of shouldShowBanner — dismiss it so only
    // the modal remains.
    const recvSub = Notifications.addNotificationReceivedListener((n) => {
      const { title, body, data } = n.request.content;
      void Notifications.dismissNotificationAsync(n.request.identifier);
      const payload = (data as Record<string, unknown> | undefined) ?? undefined;
      refresh();

      if (payload?.type === 'ALARM') playAlarmSound();
      show(title, body, payload);
    });

    // Background/closed → user taps the system banner → app foregrounds.
    const handled = new Set<string>();
    const onResponse = (r: import('expo-notifications').NotificationResponse) => {
      const id = r.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      void Notifications.clearLastNotificationResponseAsync?.();
      const data = r.notification.request.content.data as Record<string, unknown> | undefined;
      refresh();
      // Cold start: let the navigator mount first.
      setTimeout(() => navigate(data), 0);
    };
    const respSub = Notifications.addNotificationResponseReceivedListener(onResponse);
    // The app was fully closed and opened by tapping the banner.
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) onResponse(r);
    });

    return () => {
      recvSub.remove();
      respSub.remove();
    };
  }, [refresh, show]);

  return (
    <Modal visible={!!notice} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
      <Pressable style={styles.backdrop} onPress={() => setNotice(null)}>
        <Pressable style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => {}}>
          <Text style={[styles.title, { color: c.foreground }]}>{notice?.title}</Text>
          {notice?.body ? <Text style={[styles.body, { color: c.foreground }]}>{notice.body}</Text> : null}
          <Pressable
            onPress={() => setNotice(null)}
            style={({ pressed }) => [styles.okBtn, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  title: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  okBtn: { alignSelf: 'stretch', paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center', marginTop: 4 },
  okText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
