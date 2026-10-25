import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  // eslint-disable-next-line no-restricted-imports -- the footer under the form owns the inset
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatAvatar } from '@/components/chat-avatar';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompanyUsers } from '@/hooks/use-company-users';
import { useCreateGroup } from '@/hooks/use-groups';
import { fullName } from '@/lib/format';
import { bottomBarPadding } from '@/lib/insets';
import { useUser } from '@/store/auth';

const MEMBER_ROLES = new Set(['MANAGER', 'TEAMLEAD', 'ADMIN']);

/**
 * New managers' group: a name plus at least one member. Mirrors the web's
 * "Create group" dialog (chat page) — same rules, same endpoints.
 */
export function CreateGroupModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const me = useUser();
  const { data: users, isLoading } = useCompanyUsers();
  const create = useCreateGroup();

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // Leave nothing behind for the next time it opens.
  const close = () => {
    setName('');
    setQuery('');
    setPicked(new Set());
    onClose();
  };

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => MEMBER_ROLES.has(u.role) && u.id !== me?.id && u.isActive !== false)
      .filter((u) => !q || fullName(u).toLowerCase().includes(q))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [users, me?.id, query]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canCreate = name.trim().length > 0 && picked.size > 0 && !create.isPending;

  async function handleCreate() {
    if (!canCreate) return;
    try {
      await create.mutateAsync({ name: name.trim(), memberIds: [...picked] });
      close();
    } catch {
      Alert.alert(t('common.error', 'Помилка'), t('groups.create.error'));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + Spacing.xs },
          ]}
        >
          <Pressable onPress={close} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={c.foreground} />
          </Pressable>
          <Text style={[styles.headerText, { color: c.foreground }]}>{t('groups.create.title')}</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>{t('groups.create.subtitle')}</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('groups.create.namePlaceholder')}
            placeholderTextColor={c.mutedForeground}
            maxLength={100}
            style={[styles.input, styles.name, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
          />

          <Text style={[styles.label, { color: c.foreground }]}>
            {t('groups.create.members', { count: picked.size })}
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('groups.create.searchPlaceholder')}
            placeholderTextColor={c.mutedForeground}
            style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
          />

          <View style={[styles.list, { borderColor: c.border, backgroundColor: c.card }]}>
            {isLoading ? (
              <View style={{ padding: Spacing.md, alignItems: 'center' }}>
                <ActivityIndicator color={c.mutedForeground} />
              </View>
            ) : candidates.length === 0 ? (
              <Text style={[styles.empty, { color: c.mutedForeground }]}>{t('groups.create.noPeople')}</Text>
            ) : (
              candidates.map((u, i) => {
                const on = picked.has(u.id);
                return (
                  <Pressable
                    key={u.id}
                    onPress={() => toggle(u.id)}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <ChatAvatar user={u} size={32} />
                    <Text style={[styles.rowText, { color: c.foreground }]} numberOfLines={1}>
                      {fullName(u)}
                    </Text>
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={on ? c.primary : c.mutedForeground}
                    />
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: bottomBarPadding(insets, Spacing.md) },
          ]}
        >
          <Pressable
            onPress={handleCreate}
            disabled={!canCreate}
            style={({ pressed }) => [
              styles.createBtn,
              { backgroundColor: c.primary, opacity: canCreate ? (pressed ? 0.85 : 1) : 0.45 },
            ]}
          >
            {create.isPending ? (
              <ActivityIndicator color={c.primaryForeground} />
            ) : (
              <Text style={[styles.createText, { color: c.primaryForeground }]}>
                {t('groups.create.submit')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
  },
  name: { fontWeight: '600' },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rowText: { flex: 1, fontSize: 15 },
  empty: { padding: Spacing.md, textAlign: 'center', fontSize: 13 },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  createBtn: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: { fontSize: 16, fontWeight: '700' },
});
