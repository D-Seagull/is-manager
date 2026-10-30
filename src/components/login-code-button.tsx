import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useIssueDriverLoginCode } from '@/hooks/use-people';
import { formatTime } from '@/lib/format-date';

/**
 * «Код входу» для закріпленого менеджера водія (дзеркало вебу): коли SMS не
 * доходить (UA-номери в роумінгу DE/AT), менеджер створює одноразовий код і
 * диктує його. Водій вводить його на звичайному екрані коду.
 */
export function LoginCodeButton({ driverId, c }: { driverId: string; c: (typeof Colors)['light'] }) {
  const { t } = useTranslation();
  const issue = useIssueDriverLoginCode();
  const [open, setOpen] = useState(false);

  const generate = async () => {
    try {
      await issue.mutateAsync(driverId);
      setOpen(true);
    } catch (e) {
      Alert.alert(t('common.error', 'Помилка'), (e as Error).message || t('people.loginCodeError', 'Не вдалося створити код входу'));
    }
  };

  const data = issue.data;

  return (
    <>
      <Pressable onPress={generate} disabled={issue.isPending} style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
        {issue.isPending ? <ActivityIndicator color={c.primary} /> : <Ionicons name="key-outline" size={17} color={c.primary} />}
        <Text style={{ color: c.primary, fontSize: 14, fontWeight: '600' }}>{t('people.loginCode', 'Код входу')}</Text>
      </Pressable>

      <Modal visible={open && !!data} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={() => {}}>
            <Text style={[styles.title, { color: c.foreground }]}>{t('people.loginCodeTitle', 'Код входу для водія')}</Text>
            <Text style={[styles.desc, { color: c.mutedForeground }]}>{t('people.loginCodeDesc')}</Text>
            <Text selectable style={[styles.code, { color: c.foreground }]}>{data?.code}</Text>
            <Text style={[styles.desc, { color: c.mutedForeground, textAlign: 'center' }]}>
              {t('people.loginCodeExpires', { time: data ? formatTime(data.expiresAt, { hour: '2-digit', minute: '2-digit' }) : '' })}
            </Text>
            <View style={styles.btns}>
              <Pressable
                onPress={() => {
                  if (!data) return;
                  Clipboard.setStringAsync(data.code);
                  Alert.alert(t('people.loginCodeCopied', 'Код скопійовано'));
                }}
                style={[styles.btn, { borderColor: c.border }]}
              >
                <Ionicons name="copy-outline" size={16} color={c.foreground} />
                <Text style={[styles.btnText, { color: c.foreground }]}>{t('people.loginCodeCopy', 'Копіювати')}</Text>
              </Pressable>
              <Pressable onPress={generate} disabled={issue.isPending} style={[styles.btn, { borderColor: c.border }]}>
                <Text style={[styles.btnText, { color: c.foreground }]}>{t('people.loginCodeNew', 'Новий код')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: Spacing.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  sheet: { width: '100%', maxWidth: 360, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  title: { fontSize: 17, fontWeight: '700' },
  desc: { fontSize: 13 },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 8, textAlign: 'center', paddingVertical: Spacing.sm, fontVariant: ['tabular-nums'] },
  btns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1 },
  btnText: { fontSize: 14, fontWeight: '600' },
});
