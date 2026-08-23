import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatAvatar } from '@/components/chat-avatar';
import { StatusDot } from '@/components/status-dot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSetUserActive, useUserDetail } from '@/hooks/use-people';
import { fullName } from '@/lib/format';

export default function PersonScreen() {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: person, isLoading } = useUserDetail(id);
  const setActive = useSetUserActive();

  const langLabels: Record<string, string> = { EN: 'English', UK: 'Українська', PL: 'Polski', LT: 'Lietuvių', RU: 'Русский' };

  const toggleActive = () => {
    if (!person) return;
    Alert.alert(
      person.isActive ? t('people.deactivate', 'Деактивувати?') : t('people.activate', 'Активувати?'),
      fullName(person),
      [
        { text: t('common.cancel', 'Скасувати'), style: 'cancel' },
        {
          text: person.isActive ? t('people.deactivate', 'Деактивувати') : t('people.activate', 'Активувати'),
          style: person.isActive ? 'destructive' : 'default',
          onPress: () => setActive.mutate({ id: person.id, active: !person.isActive }),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + Spacing.xs }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={c.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.foreground }]} numberOfLines={1}>{person ? fullName(person) : ''}</Text>
      </View>

      {isLoading || !person ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>
          {/* Profile */}
          <View style={[styles.card, styles.profile, { backgroundColor: c.card, borderColor: c.border }]}>
            <View>
              <ChatAvatar user={person} size={64} />
              <View style={styles.dotWrap}><StatusDot user={person} size={13} ring={c.card} /></View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>{fullName(person) || '—'}</Text>
              <Text style={[styles.role, { color: c.mutedForeground }]}>{person.role}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable onPress={() => router.push(`/(manager)/dm/${person.id}` as never)} style={[styles.actBtn, { backgroundColor: c.primary }]}>
              <Ionicons name="chatbubble-outline" size={17} color={c.primaryForeground} />
              <Text style={[styles.actText, { color: c.primaryForeground }]}>{t('people.message', 'Написати')}</Text>
            </Pressable>
            {person.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${person.phone}`)} style={[styles.actBtnOutline, { borderColor: c.border }]}>
                <Ionicons name="call-outline" size={17} color={c.foreground} />
                <Text style={[styles.actText, { color: c.foreground }]}>{t('people.call', 'Дзвінок')}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Info */}
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {person.phone ? <InfoRow icon="call-outline" label={t('login.phone', 'Телефон')} value={person.phone} c={c} onPress={() => Linking.openURL(`tel:${person.phone}`)} /> : null}
            {person.email ? <InfoRow icon="mail-outline" label={t('login.email', 'Email')} value={person.email} c={c} onPress={() => Linking.openURL(`mailto:${person.email}`)} /> : null}
            {person.language ? <InfoRow icon="language-outline" label={t('settings.language.title', 'Мова')} value={langLabels[person.language] ?? person.language} c={c} /> : null}
            {person.currentTruck ? <InfoRow icon="bus-outline" label={t('nav.items.trucks', 'Вантажівка')} value={person.currentTruck.plate} c={c} /> : null}
          </View>

          {/* Deactivate */}
          <Pressable onPress={toggleActive} style={[styles.card, styles.dangerRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name={person.isActive ? 'person-remove-outline' : 'person-add-outline'} size={17} color={person.isActive ? c.destructive : c.primary} />
            <Text style={{ color: person.isActive ? c.destructive : c.primary, fontSize: 14, fontWeight: '600' }}>
              {person.isActive ? t('people.deactivate', 'Деактивувати') : t('people.activate', 'Активувати')}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value, c, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; c: (typeof Colors)['light']; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={c.mutedForeground} />
      <Text style={{ color: c.mutedForeground, fontSize: 13, width: 84 }}>{label}</Text>
      <Text style={{ flex: 1, color: onPress ? c.primary : c.foreground, fontSize: 14 }} numberOfLines={1}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: Spacing.md },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dotWrap: { position: 'absolute', right: -2, bottom: -2 },
  name: { fontSize: 18, fontWeight: '700' },
  role: { fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.md },
  actBtnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1 },
  actText: { fontSize: 14, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 9 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
});
