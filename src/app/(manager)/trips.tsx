import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import type { TFunction } from 'i18next';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChatAvatar } from '@/components/chat-avatar';
import { SectionHeader } from '@/components/section-header';
import { StatusDot } from '@/components/status-dot';
import { TRIP_STATUS_COLORS } from '@/constants/trip-status';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTripDocuments } from '@/hooks/use-documents';
import { useTrips } from '@/hooks/use-trips';
import { fullName } from '@/lib/format';
import { StopType, Trip } from '@/lib/types';

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

const STOP_COLOR: Record<StopType, string> = { LOADING: '#10B981', UNLOADING: '#EF4444', WAYPOINT: '#F59E0B' };

function TripRow({ trip, c, t }: { trip: Trip; c: (typeof Colors)['light']; t: TFunction }) {
  const [expanded, setExpanded] = useState(false);
  const badge = TRIP_STATUS_COLORS[trip.status];
  const date = loadingDate(trip);
  // Документи тягнемо (зі signed URL) лише коли картку розгорнуто.
  const { data: docs = [], isLoading: docsLoading } = useTripDocuments(expanded ? trip.id : null);

  const stopLabel = (s: Trip['stops'][number]) => {
    if (s.type === 'WAYPOINT') return s.name || t('trip.stops.waypoint', 'Проміжна точка');
    return s.type === 'LOADING' ? t('trip.stops.loading', 'Завантаження') : t('trip.stops.unloading', 'Розвантаження');
  };

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
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
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.mutedForeground} />
      </View>

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
        {trip.documents.length > 0 ? (
          <View style={styles.metaItem}>
            <Ionicons name="attach-outline" size={14} color={c.mutedForeground} />
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>{trip.documents.length}</Text>
          </View>
        ) : null}
      </View>

      {expanded ? (
        <View style={[styles.expand, { borderTopColor: c.border }]}>
          {/* Адреси (стопи) */}
          <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>{t('trip.stops.route', 'Маршрут')}</Text>
          {trip.stops.length === 0 ? (
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>—</Text>
          ) : (
            trip.stops.map((s, i) => (
              <View key={s.id ?? i} style={styles.stopRow}>
                <Ionicons name="location" size={13} color={STOP_COLOR[s.type]} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: STOP_COLOR[s.type] }}>{stopLabel(s)}</Text>
                  <Text style={{ fontSize: 13, color: c.foreground }}>{s.address || '—'}</Text>
                </View>
              </View>
            ))
          )}

          {/* Документи */}
          <Text style={[styles.sectionLabel, { color: c.mutedForeground, marginTop: Spacing.md }]}>{t('truck.tabs.documents', 'Документи')}</Text>
          {docsLoading ? (
            <ActivityIndicator color={c.mutedForeground} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          ) : docs.length === 0 ? (
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>{t('documents.empty', 'Документів немає')}</Text>
          ) : (
            docs.map((d) => (
              <Pressable key={d.id} onPress={() => d.signedUrl && WebBrowser.openBrowserAsync(d.signedUrl)} style={styles.docRow}>
                <Ionicons name={d.fileType === 'PHOTO' ? 'image-outline' : 'document-text-outline'} size={16} color={c.primary} />
                <Text style={{ flex: 1, fontSize: 13, color: c.foreground }} numberOfLines={1}>{d.fileName}</Text>
                <Ionicons name="open-outline" size={15} color={c.mutedForeground} />
              </Pressable>
            ))
          )}

          {trip.truck ? (
            <Pressable
              onPress={() => trip.truck && router.push({ pathname: '/(manager)/truck/[truckId]', params: { truckId: trip.truck.id, plate: trip.truck.plate } } as never)}
              style={[styles.openTruck, { borderColor: c.border }]}
            >
              <Ionicons name="cube-outline" size={15} color={c.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>{`${t('nav.items.trucks', 'Вантажівка')}: ${trip.truck.plate}`}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  expand: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  stopRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 3 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  openTruck: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.md, paddingVertical: 9, borderRadius: Radius.md, borderWidth: 1 },
});
