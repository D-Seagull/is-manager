import { Ionicons } from '@expo/vector-icons';
import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusDot } from '@/components/status-dot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTrucks } from '@/hooks/use-my-trucks';
import {
  useAssignTruck,
  type TargetTruckBusy,
  type TruckConflictStrategy,
} from '@/hooks/use-trips';
import { fullName } from '@/lib/format';
import { Trip } from '@/lib/types';

/** Витягує 409-тіло з axios-помилки, якщо це саме конфлікт зайнятої машини. */
function readConflict(error: unknown): TargetTruckBusy | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const data = error.response.data as Partial<TargetTruckBusy> | undefined;
  return data?.code === 'TARGET_TRUCK_BUSY' ? (data as TargetTruckBusy) : null;
}

function readMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback;
  const message = (error.response?.data as { message?: unknown })?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return fallback;
}

/**
 * Перепризначення рейсу на іншу вантажівку. Водій їде разом з машиною,
 * менеджер лишається той самий і зберігає всю переписку; попередній водій
 * втрачає рейс повністю.
 *
 * Якщо цільова машина вже в рейсі, бекенд відмовляє з 409 — модалка показує
 * другим кроком зустрічний рейс і два виходи замість того, щоб мовчки
 * переписати чужу роботу. Дзеркалить веб (`reassign-truck-dialog.tsx`).
 */
export function ReassignTruckModal({
  trip,
  visible,
  onClose,
}: {
  trip: Trip;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const { data: trucks = [], isLoading } = useTrucks();
  const assignTruck = useAssignTruck();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<TargetTruckBusy | null>(null);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trucks
      .filter((truck) => truck.id !== trip.truck?.id)
      .filter((truck) => {
        if (!q) return true;
        return (
          truck.plate.toLowerCase().includes(q) ||
          fullName(truck.currentDriver).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.plate.localeCompare(b.plate));
  }, [trucks, search, trip.truck?.id]);

  const selectedPlate = trucks.find((x) => x.id === selectedId)?.plate ?? '';

  function close() {
    setSearch('');
    setSelectedId(null);
    setConflict(null);
    onClose();
  }

  async function submit(onConflict?: TruckConflictStrategy) {
    if (!selectedId) return;
    try {
      await assignTruck.mutateAsync({
        id: trip.id,
        targetTruckId: selectedId,
        onConflict,
      });
      close();
    } catch (error) {
      const busy = readConflict(error);
      if (busy) {
        setConflict(busy);
        return;
      }
      Alert.alert(
        t('trip.reassign.error', 'Не вдалося перепризначити рейс'),
        readMessage(error, t('trip.reassign.error', 'Не вдалося перепризначити рейс')),
      );
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View
          style={[
            styles.header,
            { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + Spacing.xs },
          ]}
        >
          {conflict ? (
            <Pressable onPress={() => setConflict(null)} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={c.foreground} />
            </Pressable>
          ) : (
            <Pressable onPress={close} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={c.foreground} />
            </Pressable>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
              {conflict
                ? t('trip.reassign.conflictTitle', '{{plate}} вже в рейсі', { plate: selectedPlate })
                : t('trip.reassign.title', 'Перепризначити вантажівку')}
            </Text>
            <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>
              {conflict
                ? t('trip.reassign.conflictBody', 'Оберіть, що зробити із зустрічним рейсом.')
                : t('trip.reassign.subtitle', '{{trip}} · зараз {{plate}}', {
                    trip: trip.title,
                    plate: trip.truck?.plate ?? '—',
                  })}
            </Text>
          </View>
        </View>

        {conflict ? (
          <View style={{ padding: Spacing.md, gap: Spacing.sm }}>
            <View style={[styles.conflictCard, { backgroundColor: c.muted }]}>
              <Text style={{ fontSize: 14, color: c.foreground }} numberOfLines={2}>
                {conflict.trip.title}
                {conflict.trip.orderNumber ? (
                  <Text style={{ color: c.mutedForeground }}>{`  ·  #${conflict.trip.orderNumber}`}</Text>
                ) : null}
              </Text>
              <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                {`${conflict.trip.driverName || '—'} · ${t(`tripStatus.${conflict.trip.status}`, conflict.trip.status)}`}
              </Text>
            </View>

            <Pressable
              disabled={assignTruck.isPending}
              onPress={() => submit('SWAP')}
              style={({ pressed }) => [
                styles.choice,
                { borderColor: c.border, backgroundColor: pressed ? c.muted : c.card },
              ]}
            >
              <Ionicons name="swap-horizontal" size={18} color={c.foreground} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, color: c.foreground }}>
                  {t('trip.reassign.swap', 'Замінити рейси')}
                </Text>
                <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                  {t('trip.reassign.swapHint', 'Зустрічний рейс переїде на {{plate}}', {
                    plate: trip.truck?.plate ?? '',
                  })}
                </Text>
              </View>
            </Pressable>

            <Pressable
              disabled={assignTruck.isPending}
              onPress={() => submit('COMPLETE_OTHER')}
              style={({ pressed }) => [
                styles.choice,
                { borderColor: c.border, backgroundColor: pressed ? c.muted : c.card },
              ]}
            >
              <Ionicons name="checkmark-done" size={18} color={c.foreground} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, color: c.foreground }}>
                  {t('trip.reassign.completeOther', 'Завершити той рейс')}
                </Text>
                <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2 }}>
                  {t('trip.reassign.completeOtherHint', 'Стане доставленим, машина звільниться')}
                </Text>
              </View>
            </Pressable>

            {assignTruck.isPending ? (
              <ActivityIndicator color={c.primary} style={{ marginTop: Spacing.sm }} />
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.searchWrap}>
              <View style={[styles.searchBox, { backgroundColor: c.muted }]}>
                <Ionicons name="search" size={15} color={c.mutedForeground} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('trip.reassign.searchPlaceholder', 'Номер або водій')}
                  placeholderTextColor={c.mutedForeground}
                  style={[styles.searchInput, { color: c.foreground }]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>

            {isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={c.primary} />
              </View>
            ) : candidates.length === 0 ? (
              <View style={styles.center}>
                <Text style={{ color: c.mutedForeground }}>
                  {t('trip.reassign.noTrucks', 'Немає інших вантажівок')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={candidates}
                keyExtractor={(truck) => truck.id}
                contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
                renderItem={({ item: truck }) => {
                  // Без водія бекенд усе одно відмовить — рядок неактивний.
                  const noDriver = !truck.currentDriver;
                  const busy = (truck.trips?.length ?? 0) > 0;
                  const selected = selectedId === truck.id;
                  return (
                    <Pressable
                      disabled={noDriver}
                      onPress={() => setSelectedId(truck.id)}
                      style={[
                        styles.row,
                        {
                          borderColor: selected ? c.primary : c.border,
                          backgroundColor: selected ? `${c.primary}14` : c.card,
                          opacity: noDriver ? 0.5 : 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: c.foreground }}>
                          {truck.plate}
                        </Text>
                        <View style={styles.driverLine}>
                          {truck.currentDriver ? (
                            <>
                              <StatusDot user={truck.currentDriver} size={8} ring={c.card} />
                              <Text style={{ fontSize: 12, color: c.mutedForeground }} numberOfLines={1}>
                                {fullName(truck.currentDriver)}
                              </Text>
                            </>
                          ) : (
                            <Text style={{ fontSize: 12, color: c.mutedForeground }}>
                              {t('trip.reassign.noDriver', 'без водія')}
                            </Text>
                          )}
                        </View>
                      </View>
                      {busy ? (
                        <View style={[styles.busyPill, { borderColor: '#F59E0B66', backgroundColor: '#F59E0B1A' }]}>
                          <Text style={{ fontSize: 10, color: '#BA7517' }}>
                            {t('trip.reassign.busy', 'зайнята')}
                          </Text>
                        </View>
                      ) : null}
                      {selected ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
                    </Pressable>
                  );
                }}
              />
            )}

            <View
              style={[
                styles.footer,
                { borderTopColor: c.border, backgroundColor: c.card, paddingBottom: insets.bottom + Spacing.sm },
              ]}
            >
              <Pressable
                disabled={!selectedId || assignTruck.isPending}
                onPress={() => submit()}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: c.primary, opacity: !selectedId || assignTruck.isPending ? 0.5 : 1 },
                ]}
              >
                {assignTruck.isPending ? (
                  <ActivityIndicator color={c.primaryForeground} size="small" />
                ) : (
                  <Text style={{ color: c.primaryForeground, fontSize: 15, fontWeight: '600' }}>
                    {t('trip.reassign.confirm', 'Перепризначити')}
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  searchWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  driverLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  busyPill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  footer: { padding: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  primaryBtn: { height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  conflictCard: { borderRadius: 12, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
});
