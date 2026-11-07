import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionHeader } from '@/components/section-header';
import { TruckCard, truckCopyLine } from '@/components/truck-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { InsetFlatList } from '@/components/inset-list';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useListBottomPadding } from '@/hooks/use-list-bottom-padding';
import { useCreateTruck, useTrucks, useUpdateTruck } from '@/hooks/use-my-trucks';
import { fullName } from '@/lib/format';
import { useUser } from '@/store/auth';

export default function TrucksScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const { data: trucks, isLoading, refetch } = useTrucks();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const me = useUser();
  const barBottom = useListBottomPadding(Spacing.sm, { ios: true });
  const updateTruck = useUpdateTruck();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const selectionMode = selected.size > 0;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });


  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) void refetch();
  }, [isFocused, refetch]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (trucks ?? [])
      .filter((tr) =>
        !q ||
        tr.plate.toLowerCase().includes(q) ||
        fullName(tr.currentDriver).toLowerCase().includes(q) ||
        (tr.currentDriver?.phone ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => a.plate.localeCompare(b.plate));
  }, [trucks, search]);

  const picked = list.filter((tr) => selected.has(tr.id));
  const takeSelected = async () => {
    if (!me?.id || busy) return;
    setBusy(true);
    try {
      await Promise.all(
        picked
          .filter((tr) => tr.managerId !== me.id)
          .map((tr) => updateTruck.mutateAsync({ id: tr.id, data: { managerId: me.id } })),
      );
      setSelected(new Set());
    } catch {
      Alert.alert(t('common.error', 'Помилка'));
    } finally {
      setBusy(false);
    }
  };
  const copySelected = async () => {
    try {
      await Clipboard.setStringAsync(picked.map(truckCopyLine).join('\n'));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      /* copy is nice-to-have */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader
        title={t('nav.items.trucks', 'Вантажівки')}
        right={
          <Pressable
            onPress={() => setCreateOpen(true)}
            hitSlop={10}
            style={[styles.addBtn, { backgroundColor: c.primary }]}
          >
            <Ionicons name="add" size={20} color={c.primaryForeground} />
          </Pressable>
        }
      />

      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: c.muted }]}>
          <Ionicons name="search" size={15} color={c.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('trucks.searchPlaceholder', 'Пошук за номером або водієм…')}
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
        <InsetFlatList
          data={list}
          keyExtractor={(tr) => tr.id}
          contentContainerStyle={styles.list}
          extraData={selected}
          renderItem={({ item }) => (
            <TruckCard
              truck={item}
              openTab="info"
              selectionMode={selectionMode}
              selected={selected.has(item.id)}
              onToggleSelect={() => toggle(item.id)}
              onStartSelect={() => toggle(item.id)}
            />
          )}
        />
      )}

      {selectionMode && (
        <View style={[styles.bulkBar, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: barBottom }]}>
          <Text style={{ color: c.foreground, fontWeight: '600', fontSize: 13 }}>
            {t('trucks.selectedCount', { count: selected.size, defaultValue: 'Вибрано: {{count}}' })}
          </Text>
          <View style={styles.bulkActions}>
            <Pressable
              onPress={takeSelected}
              disabled={busy}
              style={[styles.bulkBtn, { backgroundColor: c.primary, opacity: busy ? 0.5 : 1 }]}
            >
              {busy ? (
                <ActivityIndicator color={c.primaryForeground} size="small" />
              ) : (
                <Ionicons name="person-add-outline" size={16} color={c.primaryForeground} />
              )}
              <Text style={{ color: c.primaryForeground, fontWeight: '700', fontSize: 13 }}>
                {t('trucks.takeSelected', 'Взяти вибрані')}
              </Text>
            </Pressable>
            <Pressable
              onPress={copySelected}
              style={[styles.bulkBtn, { borderWidth: 1, borderColor: c.border }]}
            >
              <Ionicons name={copiedAll ? 'checkmark' : 'copy-outline'} size={16} color={c.foreground} />
              <Text style={{ color: c.foreground, fontWeight: '600', fontSize: 13 }}>
                {copiedAll ? t('trucks.copied', 'Скопійовано') : t('trucks.copySelected', 'Скопіювати вибрані')}
              </Text>
            </Pressable>
            <Pressable onPress={() => setSelected(new Set())} hitSlop={8} style={{ padding: 6 }}>
              <Ionicons name="close" size={20} color={c.mutedForeground} />
            </Pressable>
          </View>
        </View>
      )}

      <CreateTruckModal visible={createOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

function CreateTruckModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const createTruck = useCreateTruck();
  const [plate, setPlate] = useState('');
  const [saving, setSaving] = useState(false);
  const canSave = plate.trim().length >= 1 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createTruck.mutateAsync({ plate: plate.trim() });
      setPlate('');
      onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      Alert.alert(
        t('common.error', 'Помилка'),
        typeof msg === 'string'
          ? msg
          : t('trucks.createError', 'Не вдалося додати вантажівку'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.mHeader,
            {
              backgroundColor: c.card,
              borderBottomColor: c.border,
              paddingTop: insets.top + Spacing.xs,
            },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={c.foreground} />
          </Pressable>
          <Text style={[styles.mTitle, { color: c.foreground }]}>
            {t('trucks.addTruck', 'Нова вантажівка')}
          </Text>
          <Pressable onPress={handleSave} disabled={!canSave} hitSlop={10} style={{ padding: 4 }}>
            {saving ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <Text
                style={{
                  color: canSave ? c.primary : c.mutedForeground,
                  fontWeight: '700',
                  fontSize: 15,
                }}
              >
                {t('common.save', 'Зберегти')}
              </Text>
            )}
          </Pressable>
        </View>
        <View style={{ padding: Spacing.md, gap: Spacing.xs }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.mutedForeground }}>
            {t('trucks.plate', 'Номер')}
          </Text>
          <TextInput
            value={plate}
            onChangeText={setPlate}
            placeholder={t('trucks.platePlaceholder', 'Напр. BE 9130')}
            placeholderTextColor={c.mutedForeground}
            autoCapitalize="characters"
            autoFocus
            onSubmitEditing={handleSave}
            returnKeyType="done"
            style={[
              styles.input,
              { backgroundColor: c.card, borderColor: c.border, color: c.foreground },
            ]}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bulkBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.xs },
  bulkActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 9 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  mTitle: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 15 },
  list: { padding: Spacing.md, gap: Spacing.sm },
  searchWrap: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
});
