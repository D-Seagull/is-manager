import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatAvatar } from '@/components/chat-avatar';
import { NotificationsBell } from '@/components/notifications-bell';
import { PresenceStatusSheet } from '@/components/presence-status-sheet';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeMode } from '@/hooks/use-theme';
import { useConversations } from '@/hooks/use-direct-messages';
import { useGroupUnread } from '@/hooks/use-groups';
import { useMyTrucks } from '@/hooks/use-my-trucks';
import { fullName } from '@/lib/format';
import { resolveDisplayStatus, STATUS_HEX } from '@/lib/status';
import { useUser } from '@/store/auth';

type Tile = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: string;
  badge?: number;
};

type Hero = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: string;
  sub: string;
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const { resolved: themeResolved, toggle: toggleTheme } = useThemeMode();
  const user = useUser();
  const role = user?.role;

  // TEAMLEAD/ADMIN oversee managers the way a MANAGER oversees their trucks —
  // so the hero (primary working surface) differs by role.
  const elevated = role === 'TEAMLEAD' || role === 'ADMIN';

  // Live chat badge (DMs + groups) — the only real counter until the other
  // sections land.
  const { data: conversations } = useConversations();
  const { data: groupUnread } = useGroupUnread();
  const chatBadge =
    (conversations ?? []).reduce((s, cv) => s + cv.unreadCount, 0) +
    (groupUnread?.total ?? 0);

  // Category colours — translucent chip over the card works in light + dark.
  const CH = {
    my: '#6B5BD1',
    managers: '#C24D74',
    trucks: '#C7791C',
    trips: '#1F9E6B',
    drivers: '#1F93A4',
    chat: c.primary,
  };

  // My-trucks gating mirrors the web: a MANAGER always has the panel; a
  // TEAMLEAD only when trucks are actually assigned to them (else it's absent).
  const { data: myTrucks } = useMyTrucks(elevated);
  const hasMyTrucks = (myTrucks?.length ?? 0) > 0;
  const showMyTrucks = role === 'MANAGER' || (elevated && hasMyTrucks);

  // Hero cards = each role's primary working surface(s). A teamlead leads with
  // Менеджери and also gets a My-trucks hero when they own trucks — same
  // treatment a manager gets.
  const managersHero: Hero = {
    key: 'managers',
    label: t('nav.items.managers', 'Менеджери'),
    icon: 'headset-outline',
    color: CH.managers,
    href: '/(manager)/managers',
    sub: t('home.managersSub', 'Ваша команда менеджерів'),
  };
  const myTrucksHero: Hero = {
    key: 'myTrucks',
    label: t('nav.items.myTrucks', 'Мої вантажівки'),
    icon: 'bookmark',
    color: CH.my,
    href: '/(manager)/my-trucks',
    sub: t('home.myTrucksSub', 'Ваш флот і рейси'),
  };
  const heroes: Hero[] = [
    ...(elevated ? [managersHero] : []),
    ...(showMyTrucks ? [myTrucksHero] : []),
  ];

  // Settings is hidden inside the Account screen (via the manager card), so it
  // is not a grid tile.
  const tiles: Tile[] = [
    { key: 'chat', label: t('nav.items.chat', 'Чат'), icon: 'chatbubbles-outline', color: CH.chat, href: '/(manager)/chat', badge: chatBadge },
    { key: 'trips', label: t('nav.items.trips', 'Рейси'), icon: 'map-outline', color: CH.trips, href: '/(manager)/trips' },
    { key: 'trucks', label: t('nav.items.trucks', 'Вантажівки'), icon: 'bus-outline', color: CH.trucks, href: '/(manager)/trucks' },
    { key: 'drivers', label: t('nav.items.drivers', 'Водії'), icon: 'people-outline', color: CH.drivers, href: '/(manager)/drivers' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      {/* Slim top bar — theme toggle + notifications (right). */}
      <View style={styles.topbar}>
        <Pressable onPress={toggleTheme} hitSlop={10} style={styles.bell} accessibilityLabel={t('settings.theme.title', 'Тема')}>
          <Ionicons name={themeResolved === 'dark' ? 'sunny-outline' : 'moon-outline'} size={23} color={c.mutedForeground} />
        </Pressable>
        <View style={styles.bell}>
          <NotificationsBell color={c.mutedForeground} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero(es) — the role's primary working surface(s). */}
        {heroes.map((h) => (
          <Pressable
            key={h.key}
            onPress={() => router.navigate(h.href as never)}
            style={({ pressed }) => [
              styles.hero,
              { backgroundColor: `${h.color}1A`, borderColor: c.border, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={[styles.heroChip, { backgroundColor: h.color }]}>
              <Ionicons name={h.icon} size={22} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.heroTitle, { color: c.foreground }]}>{h.label}</Text>
              <Text style={[styles.heroSub, { color: c.mutedForeground }]}>{h.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.mutedForeground} />
          </Pressable>
        ))}

        {/* Section grid. */}
        <View style={styles.grid}>
          {tiles.map((it) => (
            <Pressable
              key={it.key}
              onPress={() => router.navigate(it.href as never)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.chip, { backgroundColor: `${it.color}22` }]}>
                <Ionicons name={it.icon} size={20} color={it.color} />
              </View>
              <Text style={[styles.tileLabel, { color: c.foreground }]} numberOfLines={1}>
                {it.label}
              </Text>
              {it.badge && it.badge > 0 ? (
                <View style={[styles.badge, { backgroundColor: c.destructive }]}>
                  <Text style={styles.badgeText}>{it.badge > 99 ? '99+' : it.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Manager card — pinned at the bottom (status / settings / logout). */}
      <ManagerCard insetsBottom={insets.bottom} />
    </View>
  );
}

function ManagerCard({ insetsBottom }: { insetsBottom: number }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const user = useUser();

  const status = resolveDisplayStatus(user, true);
  const statusLabels: Record<string, string> = {
    ONLINE: t('status.ONLINE', 'онлайн'),
    BUSY: t('status.BUSY', 'зайнятий'),
    AWAY: t('status.AWAY', 'відійшов'),
    SLEEP: t('status.SLEEP', 'сон'),
    VACATION: t('status.VACATION', 'відпустка'),
    OFFLINE: t('status.OFFLINE', 'офлайн'),
  };

  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <View
      style={[
        styles.manager,
        {
          backgroundColor: c.card,
          borderTopColor: c.border,
          paddingBottom: Math.max(insetsBottom, Spacing.md),
        },
      ]}
    >
      {/* Tap the card body → change status (like the web sidebar footer). */}
      <Pressable style={styles.managerMain} onPress={() => setStatusOpen(true)}>
        <View style={styles.avatarWrap}>
          <ChatAvatar user={user} size={44} />
          <View style={[styles.statusDot, { backgroundColor: STATUS_HEX[status], borderColor: c.card }]} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.mgrName, { color: c.foreground }]} numberOfLines={1}>
            {fullName(user) || '—'}
          </Text>
          <Text style={[styles.mgrSub, { color: c.mutedForeground }]} numberOfLines={1}>
            {(user?.role ?? '') + ' · ' + statusLabels[status]}
          </Text>
        </View>
      </Pressable>

      {/* Gear → account / settings. */}
      <Pressable
        onPress={() => router.navigate('/(manager)/account' as never)}
        hitSlop={12}
        style={({ pressed }) => [styles.gearBtn, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="settings-outline" size={22} color={c.mutedForeground} />
      </Pressable>

      <PresenceStatusSheet open={statusOpen} onClose={() => setStatusOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  bell: { padding: 4 },
  scroll: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.md },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 17, fontWeight: '700' },
  heroSub: { fontSize: 13, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    minHeight: 78,
    position: 'relative',
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 14, fontWeight: '500', marginTop: Spacing.sm },
  badge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  manager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  managerMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  gearBtn: { padding: 4 },
  avatarWrap: { width: 44, height: 44 },
  statusDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  mgrName: { fontSize: 15, fontWeight: '600' },
  mgrSub: { fontSize: 12, marginTop: 1, textTransform: 'capitalize' },
});
