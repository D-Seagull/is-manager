import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompany, useUpdateCompany } from '@/hooks/use-people';
import { useUser } from '@/store/auth';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const user = useUser();
  const elevated = user?.role === 'TEAMLEAD' || user?.role === 'ADMIN';

  const { data: company, isLoading } = useCompany();
  const updateCompany = useUpdateCompany();

  const [accountingEmail, setAccountingEmail] = useState('');
  const [hrEmail, setHrEmail] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    if (!company) return;
    setAccountingEmail(company.accountingEmail ?? '');
    setHrEmail(company.hrEmail ?? '');
    setDirectorEmail(company.directorEmail ?? '');
  }, [company]);

  const dirty =
    company &&
    (accountingEmail !== (company.accountingEmail ?? '') ||
      hrEmail !== (company.hrEmail ?? '') ||
      directorEmail !== (company.directorEmail ?? ''));

  const save = async () => {
    try {
      await updateCompany.mutateAsync({
        accountingEmail: accountingEmail.trim() || null,
        hrEmail: hrEmail.trim() || null,
        directorEmail: directorEmail.trim() || null,
      });
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 2000);
    } catch (e) {
      Alert.alert(t('common.error', 'Помилка'), (e as Error).message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + Spacing.xs }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={c.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>{t('nav.items.settings', 'Налаштування')}</Text>
      </View>

      {!elevated ? (
        <View style={styles.center}>
          <Ionicons name="shield-outline" size={34} color={c.mutedForeground} style={{ opacity: 0.4 }} />
          <Text style={{ color: c.mutedForeground, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl }}>
            {t('settings.accessDenied.description', 'Ці налаштування доступні лише тімліду / адміну.')}
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.lg }} keyboardShouldPersistTaps="handled">
            {company?.name ? (
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={{ fontSize: 12, color: c.mutedForeground }}>{t('settings.company.name', 'Компанія')}</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: c.foreground, marginTop: 2 }}>{company.name}</Text>
              </View>
            ) : null}

            <View style={{ gap: Spacing.md }}>
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>{t('settings.company.emails', 'Службові email')}</Text>
              <Field label={t('settings.company.accounting', 'Бухгалтерія')} value={accountingEmail} onChangeText={setAccountingEmail} c={c} />
              <Field label={t('settings.company.hr', 'Кадри (HR)')} value={hrEmail} onChangeText={setHrEmail} c={c} />
              <Field label={t('settings.company.director', 'Директор')} value={directorEmail} onChangeText={setDirectorEmail} c={c} />
            </View>

            <View style={{ gap: Spacing.xs }}>
              <Pressable onPress={save} disabled={!dirty || updateCompany.isPending} style={[styles.saveBtn, { backgroundColor: dirty ? c.primary : c.muted }]}>
                {updateCompany.isPending ? <ActivityIndicator color={c.primaryForeground} /> : <Text style={{ color: dirty ? c.primaryForeground : c.mutedForeground, fontWeight: '700', fontSize: 15 }}>{t('settings.saveChanges', 'Зберегти')}</Text>}
              </Pressable>
              {savedHint ? <Text style={{ color: c.primary, fontSize: 12, textAlign: 'center' }}>{t('settings.saved', 'Збережено')}</Text> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function Field({ label, value, onChangeText, c }: { label: string; value: string; onChangeText: (v: string) => void; c: (typeof Colors)['light'] }) {
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: c.mutedForeground }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="email@company.com"
        placeholderTextColor={c.mutedForeground}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: 15, backgroundColor: c.card, borderColor: c.border, color: c.foreground }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: Spacing.md },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  saveBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: Radius.md },
});
