import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { sendTestPush } from '@/lib/push-api';

const DELAY_SEC = 30;

/**
 * EXPERIMENT (Android, preview builds only): send yourself the same test push
 * through Expo and straight through FCM, 30 s from now — lock the phone and
 * compare when each banner shows up (the body says when it was sent).
 */
export function PushDeliveryTest({ colors: c }: { colors: ThemeColors }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'expo' | 'fcm' | null>(null);
  if (Platform.OS !== 'android' || !(__DEV__ || Updates.channel === 'preview')) return null;

  const run = async (via: 'expo' | 'fcm') => {
    setBusy(via);
    try {
      const r = await sendTestPush(via, DELAY_SEC);
      Alert.alert(
        '',
        r.scheduled
          ? t('settings.pushTest.scheduled', { sec: DELAY_SEC })
          : r.reason === 'FCM_NOT_CONFIGURED'
            ? t('settings.pushTest.fcmOff')
            : t('settings.pushTest.noTokens'),
      );
    } catch {
      Alert.alert('', t('settings.pushTest.error'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.buttons}>
        {(['expo', 'fcm'] as const).map((via) => (
          <Pressable
            key={via}
            disabled={busy !== null}
            onPress={() => void run(via)}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            {busy === via ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <Ionicons name="paper-plane-outline" size={16} color={c.foreground} />
            )}
            <Text style={[styles.text, { color: c.foreground }]}>
              {via === 'expo' ? t('settings.pushTest.expo') : t('settings.pushTest.fcm')}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.hint, { color: c.mutedForeground }]}>
        {t('settings.pushTest.hint', { sec: DELAY_SEC })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: Spacing.sm },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17, paddingHorizontal: Spacing.xs },
});
