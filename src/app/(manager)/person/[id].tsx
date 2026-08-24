import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatAvatar } from '@/components/chat-avatar';
import { StatusDot } from '@/components/status-dot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PersonDetail, useRateDriver, useSetUserActive, useUserDetail, useUserRatings } from '@/hooks/use-people';
import { fullName } from '@/lib/format';
import { useUser } from '@/store/auth';

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

          {/* Ratings */}
          <RatingsSection person={person} c={c} />

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

const STAR_COLOR = '#F59E0B';

function Stars({ value, size, muted }: { value: number; size: number; muted: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? STAR_COLOR : muted} />
      ))}
    </View>
  );
}

function StarPicker({ value, onChange, muted, size = 26 }: { value: number; onChange: (v: number) => void; muted: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? STAR_COLOR : muted} />
        </Pressable>
      ))}
    </View>
  );
}

function RatingsSection({ person, c }: { person: PersonDetail; c: (typeof Colors)['light'] }) {
  const { t } = useTranslation();
  const me = useUser();
  const isDriver = person.role === 'DRIVER';
  const { data, isLoading } = useUserRatings(person.id, isDriver ? 'driver' : 'manager');
  const rate = useRateDriver(person.id);
  const [showAll, setShowAll] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const ratings = data?.ratings ?? [];
  const avg = data?.averageRating ?? null;
  const count = data?.ratingCount ?? 0;
  const mine = ratings.find((r) => r.ratedBy?.id === me?.id);

  const openForm = () => {
    setScore(mine?.score ?? 0);
    setComment(mine?.comment ?? '');
    setAnonymous(mine?.anonymous ?? false);
    setFormOpen(true);
  };

  const submit = async () => {
    if (score === 0) return;
    await rate.mutateAsync({ score, comment: comment.trim() || undefined, anonymous });
    setFormOpen(false);
  };

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, gap: Spacing.sm }]}>
      {/* Summary row: title + ★ avg (count), tappable to expand list */}
      <Pressable
        onPress={() => count > 0 && setShowAll((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}
      >
        <Text style={[styles.sectionTitle, { color: c.foreground }]}>{t('people.ratings.title', 'Рейтинг')}</Text>
        <View style={{ flex: 1 }} />
        {isLoading ? (
          <ActivityIndicator color={c.primary} size="small" />
        ) : avg !== null ? (
          <>
            <Ionicons name="star" size={15} color={STAR_COLOR} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.foreground }}>{avg.toFixed(1)}</Text>
            <Text style={{ fontSize: 13, color: c.mutedForeground }}>({count})</Text>
            <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color={c.mutedForeground} />
          </>
        ) : (
          <Text style={{ fontSize: 13, color: c.mutedForeground }}>{t('people.ratings.none', 'Немає оцінок')}</Text>
        )}
      </Pressable>

      {/* Expanded list */}
      {showAll && ratings.length > 0 ? (
        <View style={{ gap: 6, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm }}>
          {ratings.map((r) => (
            <View key={r.id} style={[styles.ratingItem, { backgroundColor: c.muted }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Stars value={r.score} size={12} muted={c.mutedForeground} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.foreground, flex: 1 }} numberOfLines={1}>
                  {r.anonymous ? t('people.ratings.anonymous', 'Анонімно') : fullName(r.ratedBy) || t('people.ratings.unknown', '—')}
                </Text>
                <Text style={{ fontSize: 10, color: c.mutedForeground }}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
              {r.comment ? <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 1 }}>{`“${r.comment}”`}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Driver — compact rate control (form collapsed by default) */}
      {isDriver ? (
        !formOpen ? (
          <Pressable
            onPress={openForm}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm }}
            hitSlop={4}
          >
            <Ionicons name={mine ? 'create-outline' : 'star-outline'} size={16} color={c.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>
              {mine ? `${t('people.ratings.current', 'Ваша оцінка')}: ${mine.score}/5` : t('people.ratings.rateTitle', 'Оцінити водія')}
            </Text>
          </Pressable>
        ) : (
          <View style={{ gap: Spacing.sm, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <StarPicker value={score} onChange={setScore} muted={c.mutedForeground} />
              <Pressable onPress={() => setFormOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color={c.mutedForeground} />
              </Pressable>
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t('people.ratings.commentPlaceholder', 'Коментар (необов’язково)')}
              placeholderTextColor={c.mutedForeground}
              style={[styles.commentInput, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={() => setAnonymous((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} hitSlop={6}>
                <Ionicons name={anonymous ? 'checkbox' : 'square-outline'} size={18} color={anonymous ? c.primary : c.mutedForeground} />
                <Text style={{ fontSize: 13, color: c.foreground }}>{t('people.ratings.anonymous', 'Анонімно')}</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={score === 0 || rate.isPending}
                style={[styles.submitBtn, { backgroundColor: c.primary, opacity: score === 0 || rate.isPending ? 0.5 : 1 }]}
              >
                {rate.isPending ? (
                  <ActivityIndicator color={c.primaryForeground} size="small" />
                ) : (
                  <Text style={{ color: c.primaryForeground, fontWeight: '700', fontSize: 13 }}>
                    {mine ? t('people.ratings.update', 'Оновити') : t('people.ratings.submit', 'Надіслати')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )
      ) : null}
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
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  ratingItem: { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  commentInput: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 7, fontSize: 14 },
  submitBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: Radius.md, minWidth: 96 },
});
