import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSaveTripFinance, useTripFinance, useTripOrder } from '@/hooks/use-order-import';
import { openRemoteFile } from '@/lib/open-file';
import {
  emptyFinance,
  financePayload,
  financeSummaryParts,
  financeToForm,
  serverMessage,
  type FinanceFormData,
} from '@/lib/order-import';

type C = (typeof Colors)['light'];

/** Freight / km / tolls inputs, with the "managers only" mark. */
export function FinanceFields({
  c,
  value,
  onChange,
}: {
  c: C;
  value: FinanceFormData;
  onChange: (v: FinanceFormData) => void;
}) {
  const { t } = useTranslation();
  const set = (key: keyof FinanceFormData) => (v: string) => onChange({ ...value, [key]: v });
  const input = [styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }];
  const small = (label: string, key: keyof FinanceFormData, kb: 'decimal-pad' | 'number-pad') => (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[styles.small, { color: c.mutedForeground }]} numberOfLines={1}>{label}</Text>
      <TextInput value={value[key]} onChangeText={set(key)} keyboardType={kb} style={input} />
    </View>
  );
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: c.mutedForeground }]}>{t('orderImport.finance.title', 'Фінанси')}</Text>
        <Ionicons name="lock-closed-outline" size={12} color={c.mutedForeground} />
        <Text style={[styles.small, { color: c.mutedForeground }]}>
          {t('orderImport.finance.managersOnly', 'бачать лише менеджери')}
        </Text>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 2, gap: 4 }}>
          <Text style={[styles.small, { color: c.mutedForeground }]}>{t('orderImport.finance.freightRate', 'Ставка')}</Text>
          <TextInput value={value.freightRate} onChangeText={set('freightRate')} keyboardType="decimal-pad" placeholder="1451.30" placeholderTextColor={c.mutedForeground} style={input} />
        </View>
        <View style={{ width: 72, gap: 4 }}>
          <Text style={[styles.small, { color: c.mutedForeground }]}>{t('orderImport.finance.currency', 'Валюта')}</Text>
          <TextInput value={value.currency} onChangeText={(v) => set('currency')(v.toUpperCase())} autoCapitalize="characters" maxLength={3} style={input} />
        </View>
      </View>
      <View style={styles.row}>
        {small(t('orderImport.finance.loadedKm', 'Км з вантажем'), 'loadedKm', 'number-pad')}
        {small(t('orderImport.finance.emptyKm', 'Км порожнього пробігу'), 'emptyKm', 'number-pad')}
        {small(t('orderImport.finance.tolls', 'Платні дороги'), 'tolls', 'decimal-pad')}
      </View>
    </View>
  );
}

/**
 * The trip header's managers-only line: the order file (if any) and the
 * money — "1 451,30 EUR · 1264 km + 240 km empty · tolls 368,42" — with edit.
 */
export function TripFinanceLine({ c, tripId }: { c: C; tripId: string }) {
  const { t, i18n } = useTranslation();
  const { data: finance, isLoading } = useTripFinance(tripId);
  const { data: order } = useTripOrder(tripId);
  const save = useSaveTripFinance(tripId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FinanceFormData>(emptyFinance());

  if (isLoading) return null;

  const p = finance ? financeSummaryParts(finance, i18n.language) : null;
  const parts: string[] = [];
  if (p?.rate) parts.push(p.rate);
  const km = [
    p?.loadedKm != null ? t('orderImport.finance.kmLoaded', '{{km}} км', { km: p.loadedKm }) : null,
    p?.emptyKm != null ? t('orderImport.finance.kmEmpty', '{{km}} км порожнього пробігу', { km: p.emptyKm }) : null,
  ].filter(Boolean);
  if (km.length) parts.push(km.join(' + '));
  if (p?.tolls) parts.push(t('orderImport.finance.tollsValue', 'дороги {{value}}', { value: p.tolls }));
  const line = parts.join(' · ');

  const openOrder = async () => {
    if (!order?.url) return;
    try {
      await openRemoteFile({ id: order.id, signedUrl: order.url, fileName: order.fileName });
    } catch (e) {
      Alert.alert(t('common.error', 'Помилка'), serverMessage(e) ?? undefined);
    }
  };

  return (
    <View style={[styles.line, { borderTopColor: c.border }]}>
      <Ionicons name="lock-closed-outline" size={13} color={c.mutedForeground} />
      <Text style={{ flex: 1, fontSize: 12, color: c.mutedForeground }}>
        {line || t('orderImport.finance.none', 'Фінанси не вказані')}
      </Text>
      {order?.url ? (
        <Pressable onPress={() => void openOrder()} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="document-text-outline" size={17} color={c.primary} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => {
          setForm(financeToForm(finance));
          setEditing(true);
        }}
        hitSlop={8}
        style={styles.iconBtn}
      >
        <Ionicons name={line ? 'pencil' : 'add'} size={16} color={c.mutedForeground} />
      </Pressable>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
            <FinanceFields c={c} value={form} onChange={setForm} />
            <View style={[styles.row, { justifyContent: 'flex-end' }]}>
              <Pressable onPress={() => setEditing(false)} hitSlop={6} style={styles.textBtn}>
                <Text style={{ color: c.mutedForeground, fontWeight: '600' }}>{t('common.cancel', 'Скасувати')}</Text>
              </Pressable>
              <Pressable
                disabled={save.isPending}
                onPress={async () => {
                  try {
                    await save.mutateAsync(financePayload(form));
                    setEditing(false);
                  } catch (e) {
                    Alert.alert(t('orderImport.finance.saveFailed', 'Не вдалося зберегти фінанси'), serverMessage(e) ?? undefined);
                  }
                }}
                style={styles.textBtn}
              >
                {save.isPending ? (
                  <ActivityIndicator color={c.primary} />
                ) : (
                  <Text style={{ color: c.primary, fontWeight: '700' }}>{t('common.save', 'Зберегти')}</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontSize: 13, fontWeight: '600' },
  small: { fontSize: 11 },
  input: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 7, fontSize: 14 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  iconBtn: { padding: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  sheet: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.md },
  textBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 6, minWidth: 64, alignItems: 'center' },
});
