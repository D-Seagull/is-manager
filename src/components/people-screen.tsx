import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatAvatar } from '@/components/chat-avatar';
import { SectionHeader } from '@/components/section-header';
import { StatusDot } from '@/components/status-dot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompanyUsers, type CompanyUser } from '@/hooks/use-company-users';
import { useCreateDriver, useCreateManager } from '@/hooks/use-people';
import { fullName } from '@/lib/format';
import { useUser } from '@/store/auth';

export function PeopleScreen({ kind }: { kind: 'driver' | 'manager' }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const me = useUser();
  const { data: users, isLoading, refetch } = useCompanyUsers();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  // Менеджери: перемикач «Моя команда» / «Усі». Для водіїв не показується.
  const [mode, setMode] = useState<'team' | 'all'>('team');

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) void refetch();
  }, [isFocused, refetch]);

  const roles = kind === 'driver' ? ['DRIVER'] : ['MANAGER', 'TEAMLEAD'];
  const title = kind === 'driver' ? t('nav.items.drivers', 'Водії') : t('nav.items.managers', 'Менеджери');

  // Тімлід моєї команди: TEAMLEAD → власний id; MANAGER → його teamleadId; ADMIN → null.
  const myTeamleadId = useMemo<string | null>(() => {
    if (kind !== 'manager' || !me) return null;
    if (me.role === 'TEAMLEAD') return me.id;
    if (me.role === 'MANAGER') return (users ?? []).find((u) => u.id === me.id)?.teamleadId ?? null;
    return null;
  }, [kind, me, users]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = (users ?? [])
      .filter((u) => roles.includes(u.role) && u.isActive)
      .filter((u) => u.id !== me?.id); // не показуємо власний акаунт
    if (kind === 'manager' && mode === 'team') {
      rows = rows.filter((u) => myTeamleadId && u.teamleadId === myTeamleadId);
    }
    return rows
      .filter((u) => !q || fullName(u).toLowerCase().includes(q) || (u.phone ?? '').toLowerCase().includes(q) || (u.currentTruck?.plate ?? '').toLowerCase().includes(q))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, search, kind, mode, myTeamleadId, me?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader
        title={title}
        right={
          <Pressable onPress={() => setCreateOpen(true)} hitSlop={10} style={[styles.addBtn, { backgroundColor: c.primary }]}>
            <Ionicons name="add" size={20} color={c.primaryForeground} />
          </Pressable>
        }
      />

      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: c.muted }]}>
          <Ionicons name="search" size={15} color={c.mutedForeground} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('common.search', 'Пошук…')} placeholderTextColor={c.mutedForeground} style={[styles.searchInput, { color: c.foreground }]} autoCapitalize="none" />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : list.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: c.mutedForeground, textAlign: 'center', paddingHorizontal: Spacing.lg }}>
            {search
              ? t('common.noMatches', 'Нічого не знайдено')
              : kind === 'manager' && mode === 'team'
                ? t('people.teamEmpty', 'У вашій команді немає інших менеджерів')
                : t('common.empty', 'Порожньо')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <PersonRow user={item} kind={kind} />}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: c.border }]} />}
        />
      )}

      {kind === 'manager' ? (
        <View style={[styles.segmentBar, { borderTopColor: c.border, backgroundColor: c.card, paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
          <SegBtn active={mode === 'team'} label={t('people.myTeam', 'Моя команда')} onPress={() => setMode('team')} c={c} />
          <SegBtn active={mode === 'all'} label={t('people.allManagers', 'Усі менеджери')} onPress={() => setMode('all')} c={c} />
        </View>
      ) : null}

      <CreateModal kind={kind} visible={createOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

function SegBtn({ active, label, onPress, c }: { active: boolean; label: string; onPress: () => void; c: (typeof Colors)['light'] }) {
  return (
    <Pressable onPress={onPress} style={[styles.segBtn, { backgroundColor: c.muted }, active && { backgroundColor: c.primary }]}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: active ? c.primaryForeground : c.mutedForeground }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function PersonRow({ user, kind }: { user: CompanyUser; kind: 'driver' | 'manager' }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const subtitle = kind === 'driver'
    ? user.currentTruck?.plate || user.phone || t('nav.driverFallback', 'Водій')
    : user.role === 'TEAMLEAD' ? t('chatDir.teamlead', 'Тімлід') : t('nav.manager', 'Менеджер');

  return (
    <Pressable
      onPress={() => router.push(`/(manager)/person/${user.id}` as never)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.muted : 'transparent' }]}
    >
      <View style={styles.avatarWrap}>
        <ChatAvatar user={user} size={44} />
        <View style={styles.dotWrap}><StatusDot user={user as React.ComponentProps<typeof StatusDot>['user']} size={9} ring={c.background} /></View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>{fullName(user) || '—'}</Text>
        <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>{subtitle}</Text>
      </View>
      {kind === 'manager' ? (
        <View style={styles.truckCount}>
          <MaterialCommunityIcons name="truck-outline" size={16} color={c.mutedForeground} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.mutedForeground }}>{user.truckCount ?? 0}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
    </Pressable>
  );
}

function CreateModal({ kind, visible, onClose }: { kind: 'driver' | 'manager'; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const createDriver = useCreateDriver();
  const createManager = useCreateManager();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setFirstName(''); setLastName(''); setPhone(''); setEmail(''); }
  }, [visible]);

  const canSave = kind === 'driver' ? firstName.trim() && phone.trim() : email.trim() && phone.trim();

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      if (kind === 'driver') {
        await createDriver.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim() || null, phone: phone.trim() });
      } else {
        await createManager.mutateAsync({ email: email.trim(), phone: phone.trim(), firstName: firstName.trim() || undefined, lastName: lastName.trim() || null });
      }
      onClose();
    } catch (e) {
      Alert.alert(t('common.error', 'Помилка'), (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.mHeader, { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + Spacing.xs }]}>
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}><Ionicons name="close" size={24} color={c.foreground} /></Pressable>
          <Text style={[styles.mTitle, { color: c.foreground }]}>
            {kind === 'driver' ? t('drivers.addDriver', 'Новий водій') : t('managers.addManager', 'Новий менеджер')}
          </Text>
          <Pressable onPress={handleSave} disabled={!canSave || saving} hitSlop={10} style={{ padding: 4 }}>
            {saving ? <ActivityIndicator color={c.primary} /> : <Text style={{ color: canSave ? c.primary : c.mutedForeground, fontWeight: '700', fontSize: 15 }}>{t('common.save', 'Зберегти')}</Text>}
          </Pressable>
        </View>
        <View style={{ padding: Spacing.md, gap: Spacing.md }}>
          {kind === 'manager' && (
            <Input label={t('login.email', 'Email')} value={email} onChangeText={setEmail} c={c} keyboardType="email-address" autoCapitalize="none" placeholder="you@company.com" />
          )}
          <Input label={t('settings.name.first', "Ім'я")} value={firstName} onChangeText={setFirstName} c={c} />
          <Input label={t('settings.name.last', 'Прізвище')} value={lastName} onChangeText={setLastName} c={c} />
          <Input label={t('login.phone', 'Телефон')} value={phone} onChangeText={setPhone} c={c} keyboardType="phone-pad" placeholder="+380…" />
          {kind === 'manager' ? (
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>{t('managers.inviteHint', 'Менеджер отримає лист із паролем на вказаний email.')}</Text>
          ) : (
            <Text style={{ fontSize: 12, color: c.mutedForeground }}>{t('drivers.inviteHint', 'Водій входитиме за номером телефону через код із SMS.')}</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Input({ label, c, ...props }: { label: string; c: (typeof Colors)['light'] } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: c.mutedForeground }}>{label}</Text>
      <TextInput placeholderTextColor={c.mutedForeground} style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, height: 38, borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  segmentBar: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: Radius.md },
  truckCount: { flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  avatarWrap: { width: 44, height: 44 },
  dotWrap: { position: 'absolute', right: -2, bottom: -2 },
  name: { fontSize: 15, fontWeight: '500' },
  sub: { fontSize: 13, marginTop: 2 },
  mHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  mTitle: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: 15 },
});
