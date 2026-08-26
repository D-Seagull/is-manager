import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Shared header for the top-level section screens (Chat, Trips, Fleet…).
 * The ☰ button on the left always returns to the full-screen Menu hub —
 * sections are pushed over the menu, so this is the "home" affordance.
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
  const { t } = useTranslation();

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
        onPress={() => router.navigate('/(manager)' as never)}
        hitSlop={10}
        style={styles.menuBtn}
        accessibilityLabel="Меню"
      >
        <Ionicons name="menu" size={26} color={c.foreground} />
      </Pressable>
      <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>
        {right}
        <Pressable
          onPress={() => Alert.alert(t('nav.notifications', 'Сповіщення'), t('common.soon', 'Скоро'))}
          hitSlop={10}
          style={styles.bellBtn}
          accessibilityLabel={t('nav.notifications', 'Сповіщення')}
        >
          <Ionicons name="notifications-outline" size={22} color={c.mutedForeground} />
        </Pressable>
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
  bellBtn: { padding: 4 },
});
