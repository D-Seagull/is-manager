import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SectionHeader } from '@/components/section-header';
import { TruckCard } from '@/components/truck-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTrucks } from '@/hooks/use-my-trucks';
import { fullName } from '@/lib/format';

export default function TrucksScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const { data: trucks, isLoading, refetch } = useTrucks();
  const [search, setSearch] = useState('');

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

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader title={t('nav.items.trucks', 'Вантажівки')} />

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
        <FlatList
          data={list}
          keyExtractor={(tr) => tr.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <TruckCard truck={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  searchWrap: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
});
