import { Redirect, Stack } from 'expo-router';

import { PushNoticeOverlay } from '@/components/push-notice-overlay';
import { useAppStatePresence } from '@/hooks/use-app-state-presence';
import { useChatAlerts } from '@/hooks/use-chat-alerts';
import { useDmUnreadSync } from '@/hooks/use-direct-messages';
import { useFleetSync } from '@/hooks/use-fleet-sync';
import { useTripUnreadSync } from '@/hooks/use-notifications';
import { usePresenceSync } from '@/hooks/use-presence';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useSyncPushLanguage } from '@/hooks/use-sync-push-language';
import { useUserStatusSync } from '@/hooks/use-user-status-sync';
import { useAuthStore } from '@/store/auth';

export default function ManagerLayout() {
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  // Global live sync — always active while authenticated so statuses, unread
  // badges and presence update everywhere instantly (no reload).
  useDmUnreadSync();
  useChatAlerts();
  usePresenceSync();
  useUserStatusSync();
  useFleetSync();
  useAppStatePresence();
  useTripUnreadSync();
  usePushNotifications();
  useSyncPushLanguage();

  // Bounce to login once we know there's no session.
  if (isHydrated && !token) {
    return <Redirect href="/(auth)/login" />;
  }

  // Hub-and-spoke: `index` is the full-screen Menu; every section is pushed
  // over it and returns via the ☰ button (SectionHeader) or the back gesture.
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="trips" />
        <Stack.Screen name="trucks" />
        <Stack.Screen name="my-trucks" />
        <Stack.Screen name="drivers" />
        <Stack.Screen name="managers" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="account" />
        <Stack.Screen name="person/[id]" />
        <Stack.Screen name="dm/[userId]" />
        <Stack.Screen name="group/[groupId]" />
        <Stack.Screen name="truck/[truckId]" />
      </Stack>
      <PushNoticeOverlay />
    </>
  );
}
