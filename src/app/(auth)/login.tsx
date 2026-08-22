import { AxiosError } from 'axios';
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
import { useAuthStore } from '@/store/auth';

export default function LoginScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(manager)' as never);
    } catch (err) {
      const ax = err as AxiosError<{ message?: string }>;
      const status = ax?.response?.status;
      if (status === 401 || status === 400) {
        setError(t('login.invalidCredentials', 'Невірний email або пароль'));
      } else if (ax?.code === 'ECONNABORTED' || !ax?.response) {
        setError(t('login.networkError', 'Немає зв’язку із сервером. Спробуйте ще раз.'));
      } else {
        setError(ax?.response?.data?.message ?? t('login.genericError', 'Помилка входу'));
      }
    } finally {
      setSubmitting(false);
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
              {t('login.title', 'IS Fleet · Менеджер')}
            </Text>
            <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
              {t('login.subtitle', 'Увійдіть у свій акаунт')}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>
                {t('login.email', 'Email')}
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                placeholder="you@company.com"
                placeholderTextColor={c.mutedForeground}
                editable={!submitting}
                style={[
                  styles.input,
                  { backgroundColor: c.card, borderColor: c.border, color: c.foreground },
                ]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>
                {t('login.password', 'Пароль')}
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
                placeholder="••••••••"
                placeholderTextColor={c.mutedForeground}
                editable={!submitting}
                onSubmitEditing={onSubmit}
                returnKeyType="go"
                style={[
                  styles.input,
                  { backgroundColor: c.card, borderColor: c.border, color: c.foreground },
                ]}
              />
            </View>

            {error ? (
              <Text style={[styles.error, { color: c.destructive }]}>{error}</Text>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              style={[
                styles.button,
                { backgroundColor: c.primary, opacity: canSubmit ? 1 : 0.5 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={c.primaryForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: c.primaryForeground }]}>
                  {t('login.submit', 'Увійти')}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.linkWrap}
            >
              <Text style={[styles.link, { color: c.primary }]}>
                {t('login.forgot', 'Забули пароль?')}
              </Text>
            </Pressable>
          </View>
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
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15 },
  form: { gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  error: { fontSize: 14, textAlign: 'center' },
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
