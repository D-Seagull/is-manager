import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import type { TFunction } from 'i18next';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChatAvatar } from '@/components/chat-avatar';
import { SectionHeader } from '@/components/section-header';
import { StatusDot } from '@/components/status-dot';
import { TRIP_STATUS_COLORS } from '@/constants/trip-status';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTrips } from '@/hooks/use-trips';
import { fullName } from '@/lib/format';
import { Trip } from '@/lib/types';

/** Планова дата завантаження — windowDate першого LOADING-стопу. */
function loadingDate(trip: Trip): string | null {
  return trip.stops.find((s) => s.type === 'LOADING' && s.windowDate)?.windowDate ?? null;
}
const fmtDate = (iso: string) => {
  const [, m, d] = iso.split('-');
  return m && d ? `${d}.${m}` : iso;
};

export default function TripsScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const { data: trips, isLoading, refetch } = useTrips();
  const [search, setSearch] = useState('');

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) void refetch();
  }, [isFocused, refetch]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trips ?? [];
    return (trips ?? []).filter((tr) => {
      if ((tr.orderNumber ?? '').toLowerCase().includes(q)) return true;
      if (tr.title.toLowerCase().includes(q)) return true;
      if ((tr.truck?.plate ?? '').toLowerCase().includes(q)) return true;
      if (fullName(tr.driver).toLowerCase().includes(q)) return true;
      if (fullName(tr.manager).toLowerCase().includes(q)) return true;
      if (tr.stops.some((s) => (s.address ?? '').toLowerCase().includes(q))) return true;
      if (tr.createdAt.slice(0, 10).includes(q)) return true;
      if (tr.stops.some((s) => (s.windowDate ?? '').includes(q))) return true;
      return false;
    });
  }, [trips, search]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader title={t('nav.items.trips', 'Рейси')} />

      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: c.muted }]}>
          <Ionicons name="search" size={15} color={c.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('trips.searchPlaceholder', 'Пошук: № замовлення, трак, водій…')}
            placeholderTextColor={c.mutedForeground}
            style={[styles.searchInput, { color: c.foreground }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: c.mutedForeground }}>
            {search ? t('common.noMatches', 'Нічого не знайдено') : t('common.empty', 'Порожньо')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(tr) => tr.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <TripRow trip={item} c={c} t={t} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}
    </View>
  );
}

function TripRow({ trip, c, t }: { trip: Trip; c: (typeof Colors)['light']; t: TFunction }) {
  const badge = TRIP_STATUS_COLORS[trip.status];
  const date = loadingDate(trip);
  const from = trip.stops.find((s) => s.type === 'LOADING')?.address;
  const to = [...trip.stops].reverse().find((s) => s.type === 'UNLOADING')?.address;

  return (
    <Pressable
      onPress={() => trip.truck && router.push({ pathname: '/(manager)/truck/[truckId]', params: { truckId: trip.truck.id, plate: trip.truck.plate } } as never)}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.muted : c.card, borderColor: c.border }]}
    >
      <View style={styles.top}>
        <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
          {trip.title}
          {trip.orderNumber ? <Text style={{ color: c.mutedForeground, fontWeight: '400' }}>{`  ·  #${trip.orderNumber}`}</Text> : null}
        </Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]} numberOfLines={1}>{t(`tripStatus.${trip.status}`, trip.status)}</Text>
        </View>
      </View>

      {from || to ? (
        <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 3 }} numberOfLines={1}>
          {[from, to].filter(Boolean).join('  →  ')}
        </Text>
      ) : null}

      <View style={styles.meta}>
        {trip.truck ? (
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={13} color={c.mutedForeground} />
            <Text style={{ fontSize: 12, color: c.mutedForeground }} numberOfLines={1}>{trip.truck.plate}</Text>
          </View>
        ) : null}
        {trip.driver ? (
          <View style={styles.metaItem}>
            <View style={{ width: 16, height: 16 }}>
              <ChatAvatar user={trip.driver} size={16} />
              <View style={{ position: 'absolute', right: -2, bottom: -2 }}>
                <StatusDot user={trip.driver} size={7} ring={c.card} />
              </View>
            </View>
            <Text style={{ fontSize: 12, color: c.mutedForeground }} numberOfLines={1}>{fullName(trip.driver)}</Text>
          </View>
        ) : null}
        {date ? (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={c.mutedForeground} />
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>{fmtDate(date)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: Spacing.md },
  searchWrap: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: Spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, fontSize: 14, fontWeight: '600' },
  badge: { borderRadius: 8, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '60%' },
});
