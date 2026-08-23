import { Redirect, Stack } from 'expo-router';

import { useDmUnreadSync } from '@/hooks/use-direct-messages';
import { useFleetSync } from '@/hooks/use-fleet-sync';
import { usePresenceSync } from '@/hooks/use-presence';
import { useAuthStore } from '@/store/auth';

export default function ManagerLayout() {
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  // Global live sync — always active while authenticated so statuses, unread
  // badges and presence update everywhere instantly (no reload).
  useDmUnreadSync();
  usePresenceSync();
  useFleetSync();

  // Bounce to login once we know there's no session.
  if (isHydrated && !token) {
    return <Redirect href="/(auth)/login" />;
  }

  // Hub-and-spoke: `index` is the full-screen Menu; every section is pushed
  // over it and returns via the ☰ button (SectionHeader) or the back gesture.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="trips" />
      <Stack.Screen name="trucks" />
      <Stack.Screen name="my-trucks" />
      <Stack.Screen name="drivers" />
      <Stack.Screen name="managers" />
      <Stack.Screen name="account" />
      <Stack.Screen name="dm/[userId]" />
      <Stack.Screen name="group/[groupId]" />
      <Stack.Screen name="truck/[truckId]" />
    </Stack>
  );
}
