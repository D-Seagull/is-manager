import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChatAvatar } from '@/components/chat-avatar';
import { ListStatusDot } from '@/components/status-dot';
import { LastSeen } from '@/components/last-seen';
import { LicensePlate } from '@/components/license-plate';
import { TRIP_STATUS_COLORS } from '@/constants/trip-status';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type MyTruck, useUpdateTruck } from '@/hooks/use-my-trucks';
import { useTripUnread } from '@/hooks/use-notifications';
import { fullName } from '@/lib/format';
import { useUser } from '@/store/auth';

export function TruckCard({ truck, openTab }: { truck: MyTruck; openTab?: 'chat' | 'info' }) {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const me = useUser();
  const updateTruck = useUpdateTruck();
  // Взяти трак (стати його менеджером) / звільнити — доступно всім у застосунку
  // менеджера (MANAGER/TEAMLEAD/ADMIN), як у вебі.
  const mine = !!me && truck.managerId === me.id;
  const toggleTake = () =>
    updateTruck.mutate({ id: truck.id, data: { managerId: mine ? null : me?.id ?? null } });

  const activeTrip = truck.trips?.[0];
  const driver = truck.currentDriver;

  // Unread trip-chat messages on this truck — every trip, as on the web (the
  // list also sorts by this, so a truck that floats up always shows why).
  const { data: tripUnread } = useTripUnread();
  const unreadItem = tripUnread?.items.find((i) => i.truckId === truck.id);
  const unread = unreadItem?.totalUnread ?? 0;
  const hasUnread = unread > 0;
  const latest = hasUnread ? unreadItem?.latestMessage : null;
  // The driver's name is right above the preview — repeat it only when someone
  // else wrote (another manager), where it actually tells you something.
  const sameName = (a?: string | null, b?: string | null) =>
    (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
  const showSender = !!latest && !sameName(latest.senderName, fullName(driver));
  // Unread → the whole card tinted blue with a blue dot, like the web list.
  const tint = scheme === 'dark' ? '26' : '14';
  const tintPressed = scheme === 'dark' ? '3A' : '24';

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
        hasUnread
          ? {
              backgroundColor: `${c.primary}${pressed ? tintPressed : tint}`,
              borderColor: `${c.primary}59`,
            }
          : { backgroundColor: pressed ? c.muted : c.card, borderColor: c.border },
      ]}
    >
      <View style={styles.cardTop}>
        {hasUnread && <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />}
        <LicensePlate plate={truck.plate} />
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
                <ListStatusDot user={driver} size={9} ring={c.card} />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.driverName, { color: c.foreground }]} numberOfLines={1}>
                {fullName(driver)}
              </Text>
              {/* Unread → the latest message takes the phone's line, so the
                  card keeps its height. */}
              {latest ? (
                <Text style={[styles.driverSub, { color: c.mutedForeground, paddingRight: 40 }]} numberOfLines={1}>
                  {showSender ? (
                    <Text style={{ color: c.foreground, fontWeight: '600' }}>{latest.senderName}: </Text>
                  ) : null}
                  {latest.content}
                </Text>
              ) : driver.phone ? (
                <Text style={[styles.driverSub, { color: c.mutedForeground }]} numberOfLines={1}>
                  {driver.phone}
                </Text>
              ) : null}
              <LastSeen user={driver} always style={[styles.driverSub, { color: c.mutedForeground }]} />
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
        <View style={[styles.noteWrap, { paddingRight: 40 }]}>
          <View style={[styles.noteChip, { backgroundColor: scheme === 'dark' ? 'rgba(247,144,9,0.16)' : '#FFFAEB' }]}>
            <Ionicons name="build-outline" size={13} color={scheme === 'dark' ? '#FDB022' : '#B54708'} />
            <Text
              style={[styles.noteText, { color: scheme === 'dark' ? '#FDB022' : '#B54708' }]}
              numberOfLines={1}
            >
              {truck.truckNotes[0].content}
            </Text>
          </View>
        </View>
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
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
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
  noteWrap: { flexDirection: 'row' },
  noteChip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  noteText: { flexShrink: 1, fontSize: 12, fontWeight: '600' },
});
