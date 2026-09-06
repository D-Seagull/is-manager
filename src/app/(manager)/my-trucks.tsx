import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { BroadcastModal } from '@/components/broadcast-modal';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { SectionHeader } from '@/components/section-header';
import { TruckCard } from '@/components/truck-card';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMyTrucks } from '@/hooks/use-my-trucks';
import { useTripUnread } from '@/hooks/use-notifications';

export default function MyTrucksScreen() {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const { data: trucks, isLoading, refetch } = useMyTrucks();
  const { data: tripUnread } = useTripUnread();
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) void refetch();
  }, [isFocused, refetch]);

  // Trucks whose trip chat has unread messages float to the top, so new
  // activity isn't lost in a long fleet — the rest keep their order.
  const unreadByTruck = new Map(
    (tripUnread?.items ?? []).map((i) => [i.truckId, i.totalUnread]),
  );
  const sortedTrucks = [...(trucks ?? [])].sort(
    (a, b) =>
      ((unreadByTruck.get(a.id) ?? 0) > 0 ? 0 : 1) -
      ((unreadByTruck.get(b.id) ?? 0) > 0 ? 0 : 1),
  );

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
          data={sortedTrucks}
          keyExtractor={(tr) => tr.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <TruckCard truck={item} />}
        />
      )}

      <BroadcastModal visible={broadcastOpen} onClose={() => setBroadcastOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
});
