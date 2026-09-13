import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SectionHeader } from '@/components/section-header';
import { CompanyStatusBadge } from '@/app/(manager)/admin/index';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompanies, useCreateCompany } from '@/hooks/use-admin';

export default function AdminCompaniesScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t, i18n } = useTranslation();
  const { data: companies, isLoading, refetch } = useCompanies();
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) void refetch();
  }, [isFocused, refetch]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies ?? [];
    return (companies ?? []).filter((co) => co.name.toLowerCase().includes(q));
  }, [companies, search]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader
        title={t('admin.companies.title', 'Компанії')}
        right={
          <Pressable onPress={() => setNewOpen(true)} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="add-circle-outline" size={24} color={c.primary} />
          </Pressable>
        }
      />

      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: c.muted }]}>
          <Ionicons name="search" size={15} color={c.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('admin.companies.searchPlaceholder', 'Пошук компанії…')}
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
              ? t('admin.companies.noResults', { query: search, defaultValue: 'Нічого не знайдено' })
              : t('admin.companies.emptyHint', 'Компаній ще немає')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(co) => co.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.navigate(`/(manager)/admin/company/${item.id}` as never)}
              style={({ pressed }) => [
                styles.rowCard,
                { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>
                  {t('admin.companies.colUsers', 'Користувачів')}: {item._count?.users ?? 0}
                  {' · '}
                  {new Date(item.createdAt).toLocaleDateString(i18n.language)}
                </Text>
              </View>
              <CompanyStatusBadge isActive={item.isActive !== false} />
            </Pressable>
          )}
        />
      )}

      <NewCompanyModal open={newOpen} onClose={() => setNewOpen(false)} />
    </View>
  );
}

// ─── New company modal ──────────────────────────────────────────────────────

function NewCompanyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useCreateCompany();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setEmail('');
    setError('');
  };

  const submit = async () => {
    setError('');
    if (!name.trim() || !email.trim()) return;
    try {
      await mutateAsync({ name: name.trim(), email: email.trim() });
      reset();
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string | { message?: string } } } };
      const msg = e.response?.data?.message;
      setError(
        (typeof msg === 'string' ? msg : msg?.message) ??
          t('admin.newCompany.error', 'Не вдалося створити компанію'),
      );
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={isPending ? undefined : onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.sheetTitle, { color: c.foreground }]}>
            {t('admin.newCompany.dialogTitle', 'Нова компанія')}
          </Text>
          <Text style={[styles.sheetDesc, { color: c.mutedForeground }]}>
            {t('admin.newCompany.dialogDescription', 'На вказаний email прийде запрошення.')}
          </Text>

          <Text style={[styles.label, { color: c.foreground }]}>
            {t('admin.newCompany.companyLabel', 'Назва компанії')}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="IS Fleet"
            placeholderTextColor={c.mutedForeground}
            editable={!isPending}
            style={[styles.field, { backgroundColor: c.muted, color: c.foreground }]}
          />

          <Text style={[styles.label, { color: c.foreground }]}>
            {t('admin.newCompany.emailLabel', 'Email')}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@company.com"
            placeholderTextColor={c.mutedForeground}
            editable={!isPending}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.field, { backgroundColor: c.muted, color: c.foreground }]}
          />

          {error ? (
            <Text style={[styles.errorText, { color: c.destructive }]}>{error}</Text>
          ) : null}

          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} disabled={isPending} style={styles.btnGhost}>
              <Text style={{ color: c.mutedForeground, fontWeight: '600' }}>
                {t('common.cancel', 'Скасувати')}
              </Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={isPending || !name.trim() || !email.trim()}
              style={[styles.btnPrimary, { backgroundColor: c.primary, opacity: isPending ? 0.7 : 1 }]}
            >
              {isPending ? (
                <ActivityIndicator color={c.primaryForeground} size="small" />
              ) : (
                <Text style={{ color: c.primaryForeground, fontWeight: '700' }}>
                  {t('admin.newCompany.submit', 'Створити')}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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

  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: { borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetDesc: { fontSize: 13, marginTop: 2, marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs, marginTop: Spacing.sm },
  field: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  errorText: { fontSize: 13, marginTop: Spacing.sm },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.lg },
  btnGhost: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md },
  btnPrimary: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
    minWidth: 100,
    alignItems: 'center',
  },
});
