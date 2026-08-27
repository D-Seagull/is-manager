import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PresenceStatusSheet } from '@/components/presence-status-sheet';
import { SectionHeader } from '@/components/section-header';
import { StatusDot } from '@/components/status-dot';
import { Colors, Radius, Spacing, ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeMode, type ThemeMode } from '@/hooks/use-theme';
import {
  AppLanguage,
  UILocale,
  UserStatus,
  deleteAvatar,
  updateMe,
  uploadAvatar,
} from '@/lib/auth-api';
import { fullName, initials } from '@/lib/format';
import { setAppLanguage } from '@/lib/i18n';
import { useAlertPrefs } from '@/store/alert-prefs';
import { useAuthStore, useUser } from '@/store/auth';

// Keyed by UILocale — the UI-language preference, the only enum with German.
const LANGUAGE_LABELS: Record<UILocale, string> = {
  EN: 'English',
  UK: 'Українська',
  PL: 'Polski',
  LT: 'Lietuvių',
  DE: 'Deutsch',
  RU: 'Русский',
};

// UILocale values that are also valid chat-translation `Language` values — so
// picking one keeps the manager's chat language in step. German is UI-only.
const CHAT_LANGS: AppLanguage[] = ['EN', 'UK', 'PL', 'LT', 'RU'];

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const user = useUser();
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  // Reflects the LIVE app language (device locale, or an explicit pick), not the
  // server value — the picker below applies + persists changes itself.
  const [uiLocale, setUiLocale] = useState<UILocale>(
    () => (i18n.language.toUpperCase() as UILocale),
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState<'upload' | 'delete' | null>(null);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);

  const currentStatus = (user?.status as UserStatus | undefined) ?? 'ONLINE';

  // Notification feedback toggles — persisted per device, applied instantly.
  const sound = useAlertPrefs((s) => s.sound);
  const vibration = useAlertPrefs((s) => s.vibration);
  const setSound = useAlertPrefs((s) => s.setSound);
  const setVibration = useAlertPrefs((s) => s.setVibration);
  // Teamleads/admins also get company-level settings here (managers: profile only).
  const elevated = user?.role === 'TEAMLEAD' || user?.role === 'ADMIN';

  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const THEME_OPTIONS: { key: ThemeMode; labelKey: string; fallback: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'system', labelKey: 'settings.theme.system', fallback: 'Система', icon: 'phone-portrait-outline' },
    { key: 'light', labelKey: 'settings.theme.light', fallback: 'Світла', icon: 'sunny-outline' },
    { key: 'dark', labelKey: 'settings.theme.dark', fallback: 'Темна', icon: 'moon-outline' },
  ];

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
  }, [user]);

  // Language is applied + persisted by the picker itself, so it is intentionally
  // NOT part of the profile save/dirty check.
  const isProfileDirty =
    firstName.trim() !== (user?.firstName ?? '') ||
    (lastName.trim() || null) !== (user?.lastName ?? null);
  const canSaveProfile =
    firstName.trim().length >= 1 && isProfileDirty && !savingProfile;

  // Apply an explicit language pick immediately (live UI + local persistence via
  // setAppLanguage) and persist it to the server for web/cross-device parity.
  // German is UI-only, so `language` (chat auto-translation) is kept in step
  // only for locales that are also valid chat languages.
  const handlePickLanguage = (value: UILocale) => {
    setUiLocale(value);
    setLangPickerOpen(false);
    setAppLanguage(value);
    void updateMe({
      uiLocale: value,
      ...(CHAT_LANGS.includes(value as AppLanguage)
        ? { language: value as AppLanguage }
        : {}),
    })
      .then(setUser)
      .catch((err) => console.warn('[account] language persist failed', err));
  };

  const handleSaveProfile = async () => {
    if (!canSaveProfile) return;
    setSavingProfile(true);
    try {
      const me = await updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
      });
      setUser(me);
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 2000);
    } catch (err) {
      Alert.alert(t('common.error', 'Помилка'), t('settings.errors.saveProfile', 'Не вдалося зберегти'));
      console.warn('[account] updateMe failed', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePickAvatar = async () => {
    if (avatarBusy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        t('settings.errors.photoPermTitle', 'Немає доступу'),
        t('settings.errors.photoPermBody', 'Дозвольте доступ до фото в налаштуваннях.'),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAvatarBusy('upload');
    try {
      const me = await uploadAvatar({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      setUser(me);
    } catch (err) {
      Alert.alert(t('common.error', 'Помилка'), t('settings.errors.uploadAvatar', 'Не вдалося завантажити фото'));
      console.warn('[account] uploadAvatar failed', err);
    } finally {
      setAvatarBusy(null);
    }
  };

  const handleRemoveAvatar = async () => {
    if (avatarBusy) return;
    setAvatarBusy('delete');
    try {
      const me = await deleteAvatar();
      setUser(me);
    } catch (err) {
      Alert.alert(t('common.error', 'Помилка'), t('settings.errors.deleteAvatar', 'Не вдалося видалити фото'));
      console.warn('[account] deleteAvatar failed', err);
    } finally {
      setAvatarBusy(null);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logoutConfirm.title', 'Вийти?'),
      t('settings.logoutConfirm.body', 'Ви впевнені, що хочете вийти?'),
      [
        { text: t('common.cancel', 'Скасувати'), style: 'cancel' },
        { text: t('settings.logout', 'Вийти'), style: 'destructive', onPress: logout },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <SectionHeader title={t('nav.items.account', 'Акаунт')} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          gap: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar + identity */}
        <SectionCard colors={c} title={t('settings.avatar.title', 'Фото')}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarWrap, { backgroundColor: c.muted }]}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={[styles.avatarText, { color: c.mutedForeground }]}>
                  {initials(user)}
                </Text>
              )}
              {avatarBusy && (
                <View style={styles.avatarBusy}>
                  <ActivityIndicator size="small" color={c.primary} />
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: Spacing.xs }}>
              <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
                {fullName(user) || t('settings.driverFallback', 'Менеджер')}
              </Text>
              <Text style={[styles.role, { color: c.mutedForeground }]} numberOfLines={1}>
                {user?.email ?? user?.role}
              </Text>
              <View style={styles.avatarButtons}>
                <Pressable
                  onPress={handlePickAvatar}
                  disabled={!!avatarBusy}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: c.primary, opacity: pressed || avatarBusy ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="camera-outline" size={14} color={c.primaryForeground} />
                  <Text style={[styles.actionText, { color: c.primaryForeground }]}>
                    {user?.avatar ? t('settings.avatar.change', 'Змінити') : t('common.upload', 'Завантажити')}
                  </Text>
                </Pressable>
                {user?.avatar && (
                  <Pressable
                    onPress={handleRemoveAvatar}
                    disabled={!!avatarBusy}
                    style={({ pressed }) => [
                      styles.actionBtnOutline,
                      { borderColor: c.border, opacity: pressed || avatarBusy ? 0.7 : 1 },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={14} color={c.foreground} />
                    <Text style={[styles.actionText, { color: c.foreground }]}>
                      {t('settings.avatar.remove', 'Прибрати')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </SectionCard>

        {/* Status */}
        <SectionCard colors={c} title={t('settings.status.title', 'Статус')}>
          <Pressable
            onPress={() => setStatusPickerOpen(true)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <StatusDot user={user} isOnline size={12} ring={c.card} />
            <Text style={[styles.rowText, { color: c.foreground }]}>
              {t(`status.${currentStatus}`, currentStatus)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
          </Pressable>
        </SectionCard>

        {/* Name */}
        <SectionCard colors={c} title={t('settings.name.title', "Ім'я")}>
          <View style={{ gap: Spacing.md }}>
            <FieldLabel colors={c}>{t('settings.name.first', "Ім'я")}</FieldLabel>
            <TextInput
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('settings.name.firstPlaceholder', "Ваше ім'я")}
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="words"
            />
            <FieldLabel colors={c}>{t('settings.name.last', 'Прізвище')}</FieldLabel>
            <TextInput
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('settings.name.lastPlaceholder', 'Ваше прізвище')}
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="words"
            />
          </View>
        </SectionCard>

        {/* Save — profile (name) changes; language saves itself on pick. */}
        <View style={{ gap: Spacing.xs }}>
          <Pressable
            onPress={handleSaveProfile}
            disabled={!canSaveProfile}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: canSaveProfile ? c.primary : c.muted, opacity: pressed && canSaveProfile ? 0.85 : 1 },
            ]}
          >
            {savingProfile ? (
              <ActivityIndicator color={c.primaryForeground} />
            ) : (
              <Text style={[styles.saveText, { color: canSaveProfile ? c.primaryForeground : c.mutedForeground }]}>
                {t('settings.saveChanges', 'Зберегти')}
              </Text>
            )}
          </Pressable>
          {savedHint && (
            <Text style={[styles.savedHint, { color: c.primary }]}>
              {t('settings.saved', 'Збережено')}
            </Text>
          )}
        </View>

        {/* Language */}
        <SectionCard colors={c} title={t('settings.language.title', 'Мова')}>
          <Pressable
            onPress={() => setLangPickerOpen(true)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="language-outline" size={18} color={c.foreground} />
            <Text style={[styles.rowText, { color: c.foreground }]}>
              {LANGUAGE_LABELS[uiLocale] ?? 'English'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
          </Pressable>
        </SectionCard>

        {/* Theme (day / night) */}
        <SectionCard colors={c} title={t('settings.theme.title', 'Тема')}>
          <View style={styles.segment}>
            {THEME_OPTIONS.map((opt) => {
              const active = opt.key === themeMode;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setThemeMode(opt.key)}
                  style={[
                    styles.segmentBtn,
                    { borderColor: c.border, backgroundColor: active ? c.primary : 'transparent' },
                  ]}
                >
                  <Ionicons name={opt.icon} size={16} color={active ? c.primaryForeground : c.mutedForeground} />
                  <Text style={[styles.segmentText, { color: active ? c.primaryForeground : c.foreground }]}>
                    {t(opt.labelKey, opt.fallback)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        {/* Notifications — sound / vibration on incoming messages. */}
        <SectionCard colors={c} title={t('settings.notifications.title', 'Сповіщення')}>
          <View style={{ gap: Spacing.sm }}>
            <View style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="volume-medium-outline" size={18} color={c.foreground} />
              <Text style={[styles.rowText, { color: c.foreground }]}>
                {t('settings.notifications.sound', 'Звук')}
              </Text>
              <Switch value={sound} onValueChange={setSound} trackColor={{ true: c.primary }} />
            </View>
            <View style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="phone-portrait-outline" size={18} color={c.foreground} />
              <Text style={[styles.rowText, { color: c.foreground }]}>
                {t('settings.notifications.vibration', 'Вібрація')}
              </Text>
              <Switch value={vibration} onValueChange={setVibration} trackColor={{ true: c.primary }} />
            </View>
          </View>
        </SectionCard>

        {/* Company settings — teamlead / admin only. */}
        {elevated && (
          <SectionCard colors={c} title={t('settings.company.title', 'Компанія')}>
            <Pressable
              onPress={() => router.navigate('/(manager)/settings' as never)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="business-outline" size={18} color={c.foreground} />
              <Text style={[styles.rowText, { color: c.foreground }]}>
                {t('settings.company.settings', 'Налаштування компанії')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
            </Pressable>
          </SectionCard>
        )}

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            { backgroundColor: c.card, borderColor: c.destructive, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={c.destructive} />
          <Text style={[styles.logoutText, { color: c.destructive }]}>
            {t('settings.logout', 'Вийти')}
          </Text>
        </Pressable>
      </ScrollView>

      <PresenceStatusSheet open={statusPickerOpen} onClose={() => setStatusPickerOpen(false)} />

      {/* Language picker */}
      <Modal
        transparent
        visible={langPickerOpen}
        animationType="fade"
        onRequestClose={() => setLangPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLangPickerOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: c.card, paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing.xl }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: c.foreground }]}>
              {t('settings.language.pick', 'Оберіть мову')}
            </Text>
            {(Object.entries(LANGUAGE_LABELS) as [UILocale, string][]).map(([value, label]) => {
              const selected = value === uiLocale;
              return (
                <Pressable
                  key={value}
                  onPress={() => handlePickLanguage(value)}
                  style={({ pressed }) => [
                    styles.modalItem,
                    { backgroundColor: selected || pressed ? c.muted : 'transparent' },
                  ]}
                >
                  <Text style={[styles.modalItemText, { color: c.foreground }]}>{label}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={c.primary} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SectionCard({
  title,
  children,
  colors: c,
}: {
  title: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionBody, { backgroundColor: c.card, borderColor: c.border }]}>
        {children}
      </View>
    </View>
  );
}

function FieldLabel({ children, colors: c }: { children: React.ReactNode; colors: ThemeColors }) {
  return <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  sectionBody: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.md },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarWrap: {
    width: Platform.OS === 'android' ? 60 : 72,
    height: Platform.OS === 'android' ? 60 : 72,
    borderRadius: Platform.OS === 'android' ? 30 : 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 24, fontWeight: '700' },
  avatarBusy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  name: { fontSize: 16, fontWeight: '700' },
  role: { fontSize: 13 },
  avatarButtons: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionText: { fontSize: 12, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  rowText: { flex: 1, fontSize: 15 },
  segment: { flexDirection: 'row', gap: Spacing.sm },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: 9,
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  saveBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: Radius.md },
  saveText: { fontSize: 15, fontWeight: '700' },
  savedHint: { fontSize: 12, textAlign: 'center' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md },
  modalTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.sm,
  },
  modalItemText: { fontSize: 15 },
});
