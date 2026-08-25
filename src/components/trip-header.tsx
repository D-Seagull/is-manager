import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { TripForm } from '@/components/trip-form';
import { TRIP_STATUSES, TRIP_STATUS_COLORS } from '@/constants/trip-status';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTrip } from '@/hooks/use-trip';
import { useUpdateTripStatus } from '@/hooks/use-trips';
import { formatStopWindow } from '@/lib/format';
import { TripStop } from '@/lib/types';

const LOAD_COLOR = '#10B981';
const UNLOAD_COLOR = '#EF4444';
const WAYPOINT_COLOR = '#F59E0B';

function stopMeta(
  s: TripStop,
  t: TFunction,
): { color: string; icon: keyof typeof Ionicons.glyphMap; label: string } {
  if (s.type === 'LOADING')
    return { color: LOAD_COLOR, icon: 'ellipse-outline', label: t('trip.stops.loading', 'Завантаження') };
  if (s.type === 'UNLOADING')
    return { color: UNLOAD_COLOR, icon: 'location', label: t('trip.stops.unloading', 'Розвантаження') };
  return { color: WAYPOINT_COLOR, icon: 'flag-outline', label: s.name || t('trip.stops.waypoint', 'Додаткова зупинка') };
}

async function copyToClipboard(value: string) {
  try {
    await Clipboard.setStringAsync(value);
  } catch {
    /* copy is nice-to-have */
  }
}

function openInMaps(coords: string) {
  const trimmed = coords.trim();
  if (!trimmed) return;
  Linking.openURL(`https://www.google.com/maps?q=${encodeURIComponent(trimmed)}`).catch(() => {});
}

/**
 * Collapsible trip card at the top of the trip chat. Loading / unloading stops
 * sit in tinted blocks (green / red) so the two are impossible to confuse.
 */
export function TripHeader({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const { data: trip } = useTrip(tripId);
  const [collapsed, setCollapsed] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const updateStatus = useUpdateTripStatus(trip?.truck?.id ?? '');

  if (!trip) return null;

  const statusCol = TRIP_STATUS_COLORS[trip.status];

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      <View style={styles.cardHeader}>
        <Pressable onPress={() => setCollapsed((v) => !v)} style={styles.titleWrap}>
          <Text style={[styles.cardTitle, { color: c.foreground }]} numberOfLines={collapsed ? 1 : 2}>
            {trip.title}
          </Text>
          {trip.orderNumber ? (
            <Text style={[styles.cardSub, { color: c.mutedForeground }]} numberOfLines={1}>
              #{trip.orderNumber}
            </Text>
          ) : null}
        </Pressable>
        <Pressable onPress={() => setEditOpen(true)} hitSlop={8} style={styles.editBtn}>
          <Ionicons name="pencil" size={16} color={c.mutedForeground} />
        </Pressable>
        <Pressable onPress={() => setStatusOpen(true)} style={[styles.statusPill, { backgroundColor: statusCol.bg, borderColor: statusCol.border }]}>
          <Text style={[styles.statusText, { color: statusCol.fg }]} numberOfLines={1}>
            {t(`tripStatus.${trip.status}`, trip.status)}
          </Text>
          <Ionicons name="chevron-down" size={12} color={statusCol.fg} />
        </Pressable>
        <Pressable onPress={() => setCollapsed((v) => !v)} style={[styles.collapseBtn, { backgroundColor: `${c.primary}1A`, borderColor: `${c.primary}40` }]}>
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={20} color={c.primary} />
        </Pressable>
      </View>

      {!collapsed && (
        <>
          {trip.stops.map((s, i) => (
            <StopBlock key={s.id} stop={s} index={i} count={trip.stops.length} t={t} />
          ))}
          {trip.notes ? (
            <View style={[styles.notes, { borderTopColor: c.border }]}>
              <Text style={[styles.notesText, { color: UNLOAD_COLOR }]}>{trip.notes}</Text>
            </View>
          ) : null}
        </>
      )}

      {/* Status picker */}
      <Modal transparent visible={statusOpen} animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setStatusOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>{t('tripStatus.pick', 'Статус рейсу')}</Text>
            {TRIP_STATUSES.map((st) => {
              const col = TRIP_STATUS_COLORS[st];
              const selected = st === trip.status;
              return (
                <Pressable
                  key={st}
                  onPress={() => {
                    if (st !== trip.status) updateStatus.mutate({ id: trip.id, status: st });
                    setStatusOpen(false);
                  }}
                  style={({ pressed }) => [styles.sheetItem, { backgroundColor: selected || pressed ? c.muted : 'transparent' }]}
                >
                  <View style={[styles.dot, { backgroundColor: col.fg }]} />
                  <Text style={{ flex: 1, color: c.foreground, fontSize: 15 }}>{t(`tripStatus.${st}`, st)}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={c.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <TripForm
        truckId={trip.truck?.id ?? ''}
        trip={trip}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </View>
  );
}

function StopBlock({
  stop: s,
  index,
  count,
  t,
}: {
  stop: TripStop;
  index: number;
  count: number;
  t: TFunction;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { color, icon, label } = stopMeta(s, t);
  const chipBorder = `${color}55`;
  return (
    <View style={[styles.block, { backgroundColor: `${color}18` }]}>
      <View style={styles.blockHeader}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[styles.blockLabel, { color }]}>
          {count > 1 ? `${index + 1}. ` : ''}
          {label}
        </Text>
      </View>

      <View style={styles.stop}>
        <Pressable onPress={() => s.address && copyToClipboard(s.address)} hitSlop={4}>
          <Text style={[styles.address, { color: c.foreground }]} numberOfLines={3}>
            {s.address ?? '—'}
          </Text>
        </Pressable>

        <View style={styles.chips}>
          {s.ref ? (
            <Pressable onPress={() => copyToClipboard(s.ref!)} style={[styles.chip, { borderColor: chipBorder }]} hitSlop={4}>
              <Text style={[styles.chipHash, { color }]}>#</Text>
              <Text style={[styles.chipText, { color: c.foreground }]} numberOfLines={1}>{s.ref}</Text>
            </Pressable>
          ) : null}
          {s.coords ? (
            <View style={[styles.chip, { borderColor: chipBorder }]}>
              <Ionicons name="navigate-outline" size={12} color={color} />
              <Text style={[styles.chipText, { color: c.foreground }]} numberOfLines={1}>{s.coords}</Text>
              <Pressable onPress={() => openInMaps(s.coords!)} hitSlop={8} style={{ paddingLeft: 2 }}>
                <Ionicons name="open-outline" size={14} color={color} />
              </Pressable>
            </View>
          ) : null}
          {formatStopWindow(s) ? (
            <View style={[styles.chip, { borderColor: chipBorder }]}>
              <Ionicons name="time-outline" size={12} color={color} />
              <Text style={[styles.chipText, { color: c.foreground }]}>{formatStopWindow(s)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  titleWrap: { flex: 1, minWidth: 0 },
  editBtn: { padding: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md, paddingBottom: Spacing.xl },
  sheetTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: Radius.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 1 },
  collapseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 6,
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  blockLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  stop: { gap: 5 },
  address: { fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  chipHash: { fontSize: 12, fontWeight: '700' },
  chipText: { fontSize: 12, flexShrink: 1 },
  notes: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm },
  notesText: { fontSize: 13, fontWeight: '500' },
});
