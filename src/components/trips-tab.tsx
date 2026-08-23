import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusDot } from '@/components/status-dot';
import { TRIP_STATUSES, TRIP_STATUS_COLORS, type TripStatus } from '@/constants/trip-status';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTripsByTruck, useUpdateTripStatus } from '@/hooks/use-trips';
import { formatDate } from '@/lib/format-date';
import { fullName } from '@/lib/format';
import { Trip } from '@/lib/types';

const IN_PROGRESS: TripStatus[] = ['ON_WAY', 'ON_SITE', 'LOADED'];
type Variant = 'active' | 'queued' | 'done';

function tripLoadingDate(trip: Trip): string | null {
  const load = trip.stops.find((s) => s.type === 'LOADING' && s.windowDate);
  return load?.windowDate ?? null;
}

export function TripsTab({
  truckId,
  onOpenTrip,
  onNewTrip,
}: {
  truckId: string;
  onOpenTrip: (tripId: string) => void;
  onNewTrip: () => void;
}) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const { data: trips, isLoading } = useTripsByTruck(truckId);
  const [search, setSearch] = useState('');

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (trips ?? []).filter(
      (tr) =>
        !q ||
        tr.title.toLowerCase().includes(q) ||
        (tr.orderNumber ?? '').toLowerCase().includes(q) ||
        (fullName(tr.driver) || '').toLowerCase().includes(q),
    );
    const active: Trip[] = [];
    const queued: Trip[] = [];
    const done: Trip[] = [];
    for (const tr of filtered) {
      if (tr.status === 'DELIVERED') done.push(tr);
      else if (IN_PROGRESS.includes(tr.status)) active.push(tr);
      else queued.push(tr);
    }
    return [
      { key: 'active', label: t('truckPanel.trips.sectionActive', 'Актуальні'), list: active, variant: 'active' as Variant },
      { key: 'queued', label: t('truckPanel.trips.sectionQueued', 'В черзі'), list: queued, variant: 'queued' as Variant },
      { key: 'done', label: t('truckPanel.trips.sectionDone', 'Зроблені'), list: done, variant: 'done' as Variant },
    ].filter((s) => s.list.length > 0);
  }, [trips, search, t]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: c.muted }]}>
          <Ionicons name="search" size={15} color={c.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('truckPanel.trips.searchPlaceholder', 'Пошук рейсу…')}
            placeholderTextColor={c.mutedForeground}
            style={[styles.searchInput, { color: c.foreground }]}
            autoCapitalize="none"
          />
        </View>
        <Pressable onPress={onNewTrip} style={[styles.newBtn, { backgroundColor: c.primary }]}>
          <Ionicons name="add" size={16} color={c.primaryForeground} />
          <Text style={[styles.newText, { color: c.primaryForeground }]}>{t('truckPanel.newTrip.button', 'Новий')}</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: c.mutedForeground }}>
            {search ? t('common.noMatches', 'Нічого не знайдено') : t('truckPanel.trips.empty', 'Рейсів ще немає')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg }}>
          {sections.map((s) => (
            <View key={s.key} style={{ gap: Spacing.sm }}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>{s.label}</Text>
                <Text style={[styles.sectionCount, { color: c.mutedForeground }]}>{s.list.length}</Text>
              </View>
              {s.list.map((tr) => (
                <TripRow key={tr.id} trip={tr} truckId={truckId} variant={s.variant} onOpen={() => onOpenTrip(tr.id)} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TripRow({ trip, truckId, variant, onOpen }: { trip: Trip; truckId: string; variant: Variant; onOpen: () => void }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const updateStatus = useUpdateTripStatus(truckId);
  const [stopsOpen, setStopsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const dotColor = variant === 'active' ? '#10B981' : variant === 'queued' ? '#F59E0B' : c.mutedForeground;
  const statusCol = TRIP_STATUS_COLORS[trip.status];
  const dateStr = (() => {
    const d = tripLoadingDate(trip);
    return d ? formatDate(`${d}T00:00:00`) : formatDate(trip.createdAt);
  })();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: variant === 'active' ? 'rgba(16,185,129,0.06)' : c.card,
          borderColor: variant === 'active' ? 'rgba(16,185,129,0.4)' : c.border,
          opacity: variant === 'done' ? 0.65 : 1,
        },
      ]}
    >
      <Pressable onPress={onOpen} style={styles.cardMain}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
            {trip.title}
            {trip.orderNumber ? <Text style={{ color: c.mutedForeground, fontWeight: '400' }}> · #{trip.orderNumber}</Text> : null}
          </Text>
          <View style={styles.metaRow}>
            {trip.driver ? <StatusDot user={trip.driver} size={8} ring={c.card} /> : null}
            <Text style={[styles.meta, { color: c.mutedForeground }]} numberOfLines={1}>
              {[fullName(trip.driver), dateStr].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable onPress={() => setStopsOpen((v) => !v)} hitSlop={6} style={styles.actBtn}>
          <Ionicons name="location-outline" size={16} color={stopsOpen ? c.primary : c.mutedForeground} />
          {trip.stops.length > 0 && <Text style={[styles.actCount, { color: c.mutedForeground }]}>{trip.stops.length}</Text>}
        </Pressable>
        <Pressable onPress={() => setStatusOpen(true)} style={[styles.statusPill, { backgroundColor: statusCol.bg, borderColor: statusCol.border }]}>
          <Text style={[styles.statusText, { color: statusCol.fg }]} numberOfLines={1}>{t(`tripStatus.${trip.status}`, trip.status)}</Text>
          <Ionicons name="chevron-down" size={11} color={statusCol.fg} />
        </Pressable>
      </View>

      {stopsOpen && (
        <View style={[styles.stops, { borderTopColor: c.border }]}>
          {trip.stops.length === 0 ? (
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>{t('truckPanel.trips.noStops', 'Немає стопів')}</Text>
          ) : (
            trip.stops.map((s) => (
              <View key={s.id} style={styles.stopLine}>
                <Ionicons name="location" size={12} color={s.type === 'LOADING' ? '#10B981' : '#EF4444'} />
                <Text style={{ fontSize: 12, color: c.mutedForeground, flex: 1 }} numberOfLines={1}>{s.address || '—'}</Text>
              </View>
            ))
          )}
        </View>
      )}

      <Modal transparent visible={statusOpen} animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setStatusOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>{t('tripStatus.pick', 'Статус рейсу')}</Text>
            {TRIP_STATUSES.map((st) => {
              const col = TRIP_STATUS_COLORS[st];
              const selected = st === trip.status;
              return (
                <Pressable key={st} onPress={() => { if (st !== trip.status) updateStatus.mutate({ id: trip.id, status: st }); setStatusOpen(false); }} style={({ pressed }) => [styles.sheetItem, { backgroundColor: selected || pressed ? c.muted : 'transparent' }]}>
                  <View style={[styles.sheetDot, { backgroundColor: col.fg }]} />
                  <Text style={{ flex: 1, color: c.foreground, fontSize: 15 }}>{t(`tripStatus.${st}`, st)}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={c.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, height: 36, borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 36, borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  newText: { fontSize: 13, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: 11 },
  card: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm + 2, paddingBottom: Spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 14, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  meta: { fontSize: 12, flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 2 },
  actCount: { fontSize: 11 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto', borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  stops: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 4 },
  stopLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md, paddingBottom: Spacing.xl },
  sheetTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: Radius.sm },
  sheetDot: { width: 10, height: 10, borderRadius: 5 },
});
