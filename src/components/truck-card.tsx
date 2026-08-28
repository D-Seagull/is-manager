import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatAvatar } from '@/components/chat-avatar';
import { StatusDot } from '@/components/status-dot';
import { TRIP_STATUS_COLORS } from '@/constants/trip-status';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type MyTruck, useUpdateTruck } from '@/hooks/use-my-trucks';
import { useTripUnread } from '@/hooks/use-notifications';
import { fullName } from '@/lib/format';
import { useUser } from '@/store/auth';

export function TruckCard({ truck, openTab }: { truck: MyTruck; openTab?: 'chat' | 'info' }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const me = useUser();
  const updateTruck = useUpdateTruck();
  // Взяти трак (стати його менеджером) / звільнити — доступно всім у застосунку
  // менеджера (MANAGER/TEAMLEAD/ADMIN), як у вебі.
  const mine = !!me && truck.managerId === me.id;
  const toggleTake = () =>
    updateTruck.mutate({ id: truck.id, data: { managerId: mine ? null : me?.id ?? null } });

  const activeTrip = truck.trips?.[0];
  const driver = truck.currentDriver;

  // Unread trip-chat messages for this truck (active trip) → red marker.
  const { data: tripUnread } = useTripUnread();
  const unread =
    tripUnread?.items.find((i) => i.truckId === truck.id)?.activeTripUnread ?? 0;

  // Primary badge: active trip status if present (тільки /trucks/my), else the
  // truck's own status (загальний список /trucks).
  let badge: { label: string; bg: string; fg: string };
  if (activeTrip) {
    badge = {
      label: t(`tripStatus.${activeTrip.status}`, activeTrip.status),
      bg: TRIP_STATUS_COLORS[activeTrip.status].bg,
      fg: TRIP_STATUS_COLORS[activeTrip.status].fg,
    };
  } else {
    const s = truckStatusStyle(truck.status);
    badge = { label: t(s.key, s.fallback), bg: s.bg, fg: s.fg };
  }

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(manager)/truck/[truckId]',
          // Мої вантажівки → чат (дефолт), загальний список → інфо.
          params: { truckId: truck.id, plate: truck.plate, ...(openTab ? { tab: openTab } : {}) },
        } as never)
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? c.muted : c.card, borderColor: c.border },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.plate, { backgroundColor: c.muted }]}>
          <Text style={[styles.plateText, { color: c.foreground }]}>{truck.plate}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
        {unread > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: c.destructive }]}>
            <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
      </View>

      <View style={styles.driverRow}>
        {driver ? (
          <>
            <View style={styles.driverAvatar}>
              <ChatAvatar user={driver} size={34} />
              <View style={styles.dotWrap}>
                <StatusDot user={driver} size={9} ring={c.card} />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.driverName, { color: c.foreground }]} numberOfLines={1}>
                {fullName(driver)}
              </Text>
              {driver.phone ? (
                <Text style={[styles.driverSub, { color: c.mutedForeground }]} numberOfLines={1}>
                  {driver.phone}
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={[styles.noDriver, { backgroundColor: c.muted }]}>
              <Ionicons name="person-outline" size={18} color={c.mutedForeground} />
            </View>
            <Text style={[styles.driverSub, { color: c.mutedForeground }]}>
              {t('myTrucks.noDriver', 'Без водія')}
            </Text>
          </>
        )}
      </View>

      {truck.truckNotes && truck.truckNotes.length > 0 ? (
        <Text style={[styles.note, { color: c.destructive, paddingRight: 40 }]} numberOfLines={1}>
          {truck.truckNotes[0].content}
        </Text>
      ) : null}

      {/* Взяти / звільнити трак — правий нижній кут */}
      <Pressable
        onPress={toggleTake}
        disabled={updateTruck.isPending}
        hitSlop={8}
        style={({ pressed }) => [
          styles.takeBtn,
          { borderColor: c.border, backgroundColor: mine ? `${c.primary}1A` : c.background, opacity: pressed || updateTruck.isPending ? 0.5 : 1 },
        ]}
        accessibilityLabel={mine ? t('trucks.release', 'Звільнити трак') : t('trucks.take', 'Взяти трак')}
      >
        <Ionicons
          name={mine ? 'person-remove-outline' : 'person-add-outline'}
          size={18}
          color={mine ? c.primary : c.mutedForeground}
        />
      </Pressable>
    </Pressable>
  );
}

export function truckStatusStyle(
  status: MyTruck['status'],
): { key: string; fallback: string; bg: string; fg: string } {
  switch (status) {
    case 'ON_TRIP':
      return { key: 'truckStatus.ON_TRIP', fallback: 'У рейсі', bg: 'rgba(199,121,28,0.14)', fg: '#B26A17' };
    case 'REPAIR':
      return { key: 'truckStatus.REPAIR', fallback: 'Ремонт', bg: 'rgba(210,74,61,0.14)', fg: '#C0392B' };
    case 'AVAILABLE':
    default:
      return { key: 'truckStatus.AVAILABLE', fallback: 'Вільна', bg: 'rgba(31,158,107,0.14)', fg: '#1B8C60' };
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  plate: { borderRadius: 8, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
  plateText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  badge: { marginLeft: 'auto', borderRadius: 8, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  takeBtn: { position: 'absolute', right: Spacing.md, bottom: Spacing.md, width: 34, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  driverAvatar: { width: 34, height: 34 },
  dotWrap: { position: 'absolute', right: -2, bottom: -2 },
  noDriver: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: 14, fontWeight: '600' },
  driverSub: { fontSize: 12, marginTop: 1 },
  note: { fontSize: 12, fontStyle: 'italic' },
});
