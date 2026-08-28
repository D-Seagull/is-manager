import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { playAlarmSound } from '@/lib/sounds';

interface Notice {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Push payloads the backend sends that concern a manager. `MESSAGE` is trip
// chat; DM/group message types are added when their backend push lands.
type PushType =
  | 'ALARM'
  | 'MESSAGE'
  | 'MANAGER_ASSIGNED_TRUCK'
  | 'MANAGER_REMOVED_TRUCK'
  | 'TRUCK_REASSIGNED'
  | 'MANAGER_ASSIGNED_TRIP'
  | 'TRIP_STATUS'
  | 'TEST';

/**
 * Shows a centered dismissible modal on a foreground push, refreshes the
 * relevant caches on receive/tap, and navigates to the right screen when the
 * user taps a background banner. Chat messages arrive over the socket already,
 * so they refresh silently without a modal.
 */
export function PushNoticeOverlay() {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const qc = useQueryClient();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as unknown as { __triggerTestPush?: () => void }).__triggerTestPush = () => {
      setNotice({ title: 'Test push', body: 'Simulated foreground notification.', data: { type: 'TEST' } });
    };
  }, []);

  useEffect(() => {
    if (!Notifications) return;

    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['trucks-my'] });
      qc.invalidateQueries({ queryKey: ['trucks-all'] });
      qc.invalidateQueries({ queryKey: ['trips-all'] });
      qc.invalidateQueries({ queryKey: dmKeys.conversations });
      qc.invalidateQueries({ queryKey: dmKeys.unreadSummary });
      qc.invalidateQueries({ queryKey: groupKeys.unread });
      qc.invalidateQueries({ queryKey: ['trip-unread'] });
    };

    // Route a background-banner tap to the most relevant screen.
    const navigate = (data?: Record<string, unknown>) => {
      const type = data?.type as PushType | undefined;
      const truckId = typeof data?.truckId === 'string' ? data.truckId : null;
      const userId = typeof data?.userId === 'string' ? data.userId : null;
      const groupId = typeof data?.groupId === 'string' ? data.groupId : null;
      if (
        truckId &&
        (type === 'MANAGER_ASSIGNED_TRUCK' ||
          type === 'TRUCK_REASSIGNED' ||
          type === 'MANAGER_ASSIGNED_TRIP' ||
          type === 'TRIP_STATUS' ||
          type === 'MESSAGE')
      ) {
        router.push(`/(manager)/truck/${truckId}` as never);
      } else if (userId) {
        router.push(`/(manager)/dm/${userId}` as never);
      } else if (groupId) {
        router.push(`/(manager)/group/${groupId}` as never);
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
      if (payload?.type === 'MESSAGE') return;

      setNotice({ title: title ?? t('push.noticeTitle', 'Сповіщення'), body: body ?? '', data: payload });
    });

    // Background/closed → user taps the system banner → app foregrounds.
    const respSub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as Record<string, unknown> | undefined;
      refresh();
      navigate(data);
    });

    return () => {
      recvSub.remove();
      respSub.remove();
    };
  }, [qc, t]);

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
