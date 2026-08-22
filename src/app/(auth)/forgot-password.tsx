import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { forgotPassword } from '@/lib/auth-api';

export default function ForgotPasswordScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim().length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Backend always resolves (no user enumeration) — show success either way.
      await forgotPassword(email.trim());
    } catch {
      /* swallow — still show the neutral confirmation */
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.foreground }]}>
              {t('forgot.title', 'Відновлення пароля')}
            </Text>
            <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
              {sent
                ? t('forgot.sent', 'Якщо такий email існує, ми надіслали лист із інструкціями.')
                : t('forgot.subtitle', 'Введіть email — надішлемо посилання для скидання пароля.')}
            </Text>
          </View>

          {!sent ? (
            <View style={styles.form}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@company.com"
                placeholderTextColor={c.mutedForeground}
                editable={!submitting}
                onSubmitEditing={onSubmit}
                returnKeyType="go"
                style={[
                  styles.input,
                  { backgroundColor: c.card, borderColor: c.border, color: c.foreground },
                ]}
              />
              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                style={[styles.button, { backgroundColor: c.primary, opacity: canSubmit ? 1 : 0.5 }]}
              >
                {submitting ? (
                  <ActivityIndicator color={c.primaryForeground} />
                ) : (
                  <Text style={[styles.buttonText, { color: c.primaryForeground }]}>
                    {t('forgot.submit', 'Надіслати')}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          <Pressable onPress={() => router.back()} style={styles.linkWrap}>
            <Text style={[styles.link, { color: c.primary }]}>
              {t('forgot.back', '← Назад до входу')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing['2xl'],
  },
  header: { gap: Spacing.xs, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 15, textAlign: 'center' },
  form: { gap: Spacing.lg },
  input: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  button: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  linkWrap: { alignItems: 'center', paddingVertical: Spacing.xs },
  link: { fontSize: 14, fontWeight: '600' },
});
