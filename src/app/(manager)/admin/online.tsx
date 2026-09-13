import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChatAvatar } from '@/components/chat-avatar';
import { SectionHeader } from '@/components/section-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnlineUsers } from '@/hooks/use-admin';
import { roleBadgeIcon } from '@/lib/roles';

export default function AdminOnlineUsersScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useOnlineUsers();
  const [search, setSearch] = useState('');

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) void refetch();
  }, [isFocused, refetch]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((u) =>
      `${u.firstName} ${u.lastName ?? ''} ${u.company?.name ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [data, search]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader
        title={`${t('admin.dashboard.onlineNowTitle', 'Зараз онлайн')}${
          data ? ` (${data.length})` : ''
        }`}
      />

      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: c.muted }]}>
          <Ionicons name="search" size={15} color={c.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('admin.dashboard.onlineSearchPlaceholder', 'Пошук користувача…')}
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
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: c.mutedForeground, textAlign: 'center', paddingHorizontal: Spacing.lg }}>
            {search
              ? t('admin.dashboard.onlineNoResults', { query: search, defaultValue: 'Нічого не знайдено' })
              : t('admin.dashboard.onlineNowEmpty', 'Зараз нікого немає онлайн')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: u }) => (
            <View style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
              <View>
                <ChatAvatar user={u} size={38} />
                <View style={[styles.avatarDot, { borderColor: c.card }]} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
                  {u.firstName} {u.lastName ?? ''}
                </Text>
                {u.company?.name ? (
                  <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>
                    {u.company.name}
                  </Text>
                ) : null}
              </View>
              <Ionicons name={roleBadgeIcon(u.role)} size={18} color={c.mutedForeground} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  searchWrap: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
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
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  avatarDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
  },
});
