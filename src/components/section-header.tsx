import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationsBell } from '@/components/notifications-bell';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUser } from '@/store/auth';

/**
 * Shared header for the top-level section screens (Chat, Trips, Fleet…).
 * The button on the left goes ONE step back — to wherever you came from (the
 * menu hub, or another section opened from a notification / a link). It used
 * to jump straight to the hub every time. With no history (opened cold from a
 * push) it falls back to the hub.
 * `right` renders an optional trailing control (e.g. the notifications bell).
 */
export function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  // Admins don't use trip notifications — hide the bell on their screens.
  const isAdmin = useUser()?.role === 'ADMIN';

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
        onPress={() =>
          router.canGoBack() ? router.back() : router.navigate('/(manager)' as never)
        }
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
