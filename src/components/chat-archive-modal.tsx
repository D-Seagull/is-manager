import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ChatArchiveSession,
  SessionEndReason,
  useArchivedSessionMessages,
  useTripChatArchive,
} from '@/hooks/use-trip-archive';
import { fullName } from '@/lib/format';
import { formatDateTime } from '@/lib/format-date';
import { systemMessageText } from '@/lib/system-message';

const REASON_FALLBACK: Record<SessionEndReason, string> = {
  DRIVER_CHANGED: 'Зміна водія',
  MANAGER_CHANGED: 'Зміна менеджера',
  TRIP_COMPLETED: 'Рейс завершено',
  LEGACY_RESET: 'Скидання',
};

const fmt = (iso: string | null) =>
  iso ? formatDateTime(iso, { dateStyle: 'short', timeStyle: 'short' }) : '?';

export function ChatArchiveModal({
  visible,
  onClose,
  tripId,
  myId,
}: {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  myId: string;
}) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<ChatArchiveSession | null>(null);
  const { data: sessions = [], isLoading } = useTripChatArchive(visible ? tripId : null);

  const close = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.header, { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + Spacing.xs }]}>
          {selected ? (
            <Pressable onPress={() => setSelected(null)} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={c.foreground} />
            </Pressable>
          ) : (
            <Pressable onPress={close} hitSlop={10} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={c.foreground} />
            </Pressable>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
              {selected ? t('chat.archive.titleSession', 'Архівна розмова') : t('chat.archive.title', 'Попередні чати')}
            </Text>
            {selected ? (
              <Text style={[styles.sub, { color: c.mutedForeground }]} numberOfLines={1}>
                {`${fullName(selected.driver) || '—'} ↔ ${fullName(selected.manager) || '—'} · ${fmt(selected.startedAt)}`}
              </Text>
            ) : null}
          </View>
        </View>

        {selected ? (
          <ArchivedMessages tripId={tripId} sessionId={selected.id} myId={myId} c={c} t={t} />
        ) : isLoading ? (
          <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
        ) : sessions.length === 0 ? (
          <View style={styles.center}><Text style={{ color: c.mutedForeground }}>{t('chat.archive.noSessions', 'Немає архівних розмов')}</Text></View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
            renderItem={({ item: s }) => (
              <Pressable
                onPress={() => setSelected(s)}
                style={({ pressed }) => [styles.sessionCard, { backgroundColor: pressed ? c.muted : c.card, borderColor: c.border }]}
              >
                <View style={styles.sessionTop}>
                  <Text style={{ flex: 1, color: c.foreground, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                    {fullName(s.driver) || '—'} <Text style={{ color: c.mutedForeground }}>↔</Text> {fullName(s.manager) || '—'}
                  </Text>
                  {s.endReason ? (
                    <View style={[styles.badge, { backgroundColor: c.muted }]}>
                      <Text style={{ fontSize: 10, color: c.mutedForeground }}>
                        {t(`chat.archive.reason.${s.endReason}`, REASON_FALLBACK[s.endReason])}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 3 }}>
                  {fmt(s.startedAt)}{s.endedAt ? ` – ${fmt(s.endedAt)}` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} style={styles.chevron} />
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

function ArchivedMessages({
  tripId,
  sessionId,
  myId,
  c,
  t,
}: {
  tripId: string;
  sessionId: string;
  myId: string;
  c: (typeof Colors)['light'];
  t: TFunction;
}) {
  const { data: messages = [], isLoading } = useArchivedSessionMessages(tripId, sessionId);

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={c.primary} /></View>;
  if (messages.length === 0)
    return <View style={styles.center}><Text style={{ color: c.mutedForeground }}>{t('chat.archive.noMessages', 'Повідомлень немає')}</Text></View>;

  return (
    <FlatList
      data={messages}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: Spacing.md, gap: 6 }}
      renderItem={({ item: m }) => {
        if (m.isSystem) {
          return (
            <View style={{ alignSelf: 'center', maxWidth: '90%', paddingVertical: 2 }}>
              <Text style={{ fontSize: 12, color: c.mutedForeground, textAlign: 'center' }}>
                {systemMessageText(m.content, t)}
              </Text>
            </View>
          );
        }
        const mine = m.senderId === myId;
        return (
          <View style={{ maxWidth: '82%', alignSelf: mine ? 'flex-end' : 'flex-start' }}>
            <View style={[styles.bubble, { backgroundColor: mine ? c.primary : c.muted }]}>
              <Text style={{ color: mine ? c.primaryForeground : c.foreground, fontSize: 14 }}>
                {m.deletedAt ? t('common.messageDeleted', 'Повідомлення видалено') : m.content}
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: c.mutedForeground, marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
              {`${fullName(m.sender) || '—'} · ${fmt(m.createdAt)}`}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  sessionCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: Spacing.md, paddingRight: 32 },
  sessionTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  chevron: { position: 'absolute', right: Spacing.sm, top: '50%', marginTop: -8 },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
});
