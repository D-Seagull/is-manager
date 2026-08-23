import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BroadcastModal } from '@/components/broadcast-modal';
import { ChatAvatar } from '@/components/chat-avatar';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { SectionHeader } from '@/components/section-header';
import { StatusDot } from '@/components/status-dot';
import { TRIP_STATUS_COLORS } from '@/constants/trip-status';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMyTrucks, type MyTruck } from '@/hooks/use-my-trucks';
import { fullName } from '@/lib/format';

export default function MyTrucksScreen() {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const { data: trucks, isLoading, refetch } = useMyTrucks();
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) void refetch();
  }, [isFocused, refetch]);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <SectionHeader
        title={t('nav.items.myTrucks', 'Мої вантажівки')}
        right={
          <Pressable
            onPress={() => setBroadcastOpen(true)}
            hitSlop={10}
            style={{ padding: 4 }}
            accessibilityLabel={t('broadcast.title', 'Розсилка')}
          >
            <Ionicons name="megaphone-outline" size={22} color={c.primary} />
          </Pressable>
        }
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : !trucks || trucks.length === 0 ? (
        <ScreenPlaceholder
          icon="bus-outline"
          title={t('myTrucks.empty.title', 'Немає вантажівок')}
          subtitle={t('myTrucks.empty.subtitle', 'За вами ще не закріплено жодної машини.')}
        />
      ) : (
        <FlatList
          data={trucks}
          keyExtractor={(tr) => tr.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <TruckCard truck={item} />}
        />
      )}

      <BroadcastModal visible={broadcastOpen} onClose={() => setBroadcastOpen(false)} />
    </View>
  );
}

function TruckCard({ truck }: { truck: MyTruck }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];

  const activeTrip = truck.trips?.[0];
  const driver = truck.currentDriver;

  // Primary badge: active trip status if any, else the truck's own status.
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
          params: { truckId: truck.id, plate: truck.plate },
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
        <Text style={[styles.note, { color: c.destructive }]} numberOfLines={1}>
          {truck.truckNotes[0].content}
        </Text>
      ) : null}
    </Pressable>
  );
}

function truckStatusStyle(
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
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  plate: {
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  plateText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  badge: {
    marginLeft: 'auto',
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  driverAvatar: { width: 34, height: 34 },
  dotWrap: { position: 'absolute', right: -2, bottom: -2 },
  noDriver: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: { fontSize: 14, fontWeight: '600' },
  driverSub: { fontSize: 12, marginTop: 1 },
  note: { fontSize: 12, fontStyle: 'italic' },
});
