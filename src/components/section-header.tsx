import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationsBell } from '@/components/notifications-bell';
import { Colors, Spacing } from '@/constants/theme';
import { useBackToParent } from '@/hooks/use-back-to-parent';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUser } from '@/store/auth';

/**
 * Shared header for the top-level section screens (Chat, Trips, Fleet…).
 * The button on the left goes ONE step back — to wherever you came from (the
 * menu hub, or another section opened from a notification / a link). It used
 * to jump straight to the hub every time. With no history (opened cold from a
 * push) it falls back to the hub.
 * `backTo` pins the button to a fixed parent instead (strict "up", Android
 * back included) — the Chat list passes the Menu, so it can't bounce back
 * into the chat that sent you there.
 * `right` renders an optional trailing control (e.g. the notifications bell).
 */
export function SectionHeader({
  title,
  right,
  backTo,
}: {
  title: string;
  right?: ReactNode;
  backTo?: Href;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  // Admins don't use trip notifications — hide the bell on their screens.
  const isAdmin = useUser()?.role === 'ADMIN';
  const goUp = useBackToParent(backTo);
  const goBack = () =>
    router.canGoBack() ? router.back() : router.navigate('/(manager)' as never);

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: c.card,
          borderBottomColor: c.border,
          paddingTop: insets.top + Spacing.xs,
        },
      ]}
    >
      <Pressable
        onPress={backTo ? goUp : goBack}
        hitSlop={10}
        style={styles.menuBtn}
        accessibilityLabel="Назад"
      >
        <Ionicons name="chevron-back" size={26} color={c.foreground} />
      </Pressable>
      <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>
        {right}
        {!isAdmin && <NotificationsBell />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  menuBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
