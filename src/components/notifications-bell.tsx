import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useConversations } from '@/hooks/use-direct-messages';
import { useGroupUnread } from '@/hooks/use-groups';
import { useTripUnread } from '@/hooks/use-notifications';
import { fullName } from '@/lib/format';
import { systemMessageText } from '@/lib/system-message';

/**
 * Дзеркалить веб `UnreadBell`: агрегує непрочитане рейсів + DM + груп у бейдж,
 * а тап відкриває список, з якого можна перейти в потрібний чат.
 */
export function NotificationsBell({ color }: { color?: string }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const { data: tripUnread } = useTripUnread();
  const { data: conversations = [] } = useConversations();
  const { data: groupUnread } = useGroupUnread();

  const tripItems = tripUnread?.items ?? [];
  const dmItems = conversations.filter((cv) => cv.unreadCount > 0);
  const groupItems = groupUnread?.items ?? [];
  const dmTotal = dmItems.reduce((s, cv) => s + cv.unreadCount, 0);
  const total = (tripUnread?.total ?? 0) + dmTotal + (groupUnread?.total ?? 0);

  const go = (path: string) => {
    setOpen(false);
    router.push(path as never);
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} style={styles.bellBtn} accessibilityLabel={t('nav.notifications', 'Сповіщення')}>
        <Ionicons name="notifications-outline" size={22} color={color ?? c.mutedForeground} />
        {total > 0 ? (
          <View style={[styles.badge, { backgroundColor: c.destructive }]}>
            <Text style={styles.badgeText}>{total > 99 ? '99+' : total}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: c.card, marginTop: insets.top + 44, paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.head, { borderBottomColor: c.border }]}>
              <Text style={[styles.headText, { color: c.foreground }]}>
                {total > 0 ? t('notifications.unreadCount', { defaultValue: 'Непрочитані: {{count}}', count: total }) : t('notifications.allCaughtUp', 'Усе прочитано')}
              </Text>
            </View>

            {total === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="checkmark-done-outline" size={30} color={c.mutedForeground} style={{ opacity: 0.5, marginBottom: 6 }} />
                <Text style={{ color: c.mutedForeground }}>{t('notifications.noUnread', 'Немає непрочитаних')}</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {tripItems.map((it) => (
                  <Pressable key={`trip-${it.truckId}`} onPress={() => go(`/(manager)/truck/${it.truckId}`)} style={({ pressed }) => [styles.item, { borderBottomColor: c.border, backgroundColor: pressed ? c.muted : 'transparent' }]}>
                    <View style={styles.itemTop}>
                      <Ionicons name="cube-outline" size={15} color={c.mutedForeground} />
                      <Text style={[styles.itemTitle, { color: c.foreground }]} numberOfLines={1}>{it.plate}</Text>
                      <View style={[styles.count, { backgroundColor: it.activeTripUnread > 0 ? `${c.destructive}22` : c.muted }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: it.activeTripUnread > 0 ? c.destructive : c.mutedForeground }}>{it.totalUnread}</Text>
                      </View>
                    </View>
                    {it.latestMessage ? (
                      <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                        <Text style={{ color: c.foreground }}>{it.latestMessage.senderName}: </Text>{systemMessageText(it.latestMessage.content, t)}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}

                {dmItems.map((cv) => (
                  <Pressable key={`dm-${cv.user.id}`} onPress={() => go(`/(manager)/dm/${cv.user.id}`)} style={({ pressed }) => [styles.item, { borderBottomColor: c.border, backgroundColor: pressed ? c.muted : 'transparent' }]}>
                    <View style={styles.itemTop}>
                      <Ionicons name="chatbubble-outline" size={15} color={c.mutedForeground} />
                      <Text style={[styles.itemTitle, { color: c.foreground }]} numberOfLines={1}>{fullName(cv.user) || cv.user.role}</Text>
                      <View style={[styles.count, { backgroundColor: `${c.destructive}22` }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: c.destructive }}>{cv.unreadCount}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                      {cv.lastMessage.deletedAt ? t('common.messageDeleted', 'Повідомлення видалено') : cv.lastMessage.content || t('nav.fileAttachment', 'Вкладення')}
                    </Text>
                  </Pressable>
                ))}

                {groupItems.map((g) => (
                  <Pressable key={`group-${g.groupId}`} onPress={() => go(`/(manager)/group/${g.groupId}`)} style={({ pressed }) => [styles.item, { borderBottomColor: c.border, backgroundColor: pressed ? c.muted : 'transparent' }]}>
                    <View style={styles.itemTop}>
                      <Ionicons name="people-outline" size={15} color={c.mutedForeground} />
                      <Text style={[styles.itemTitle, { color: c.foreground }]} numberOfLines={1}>{g.name}</Text>
                      <View style={[styles.count, { backgroundColor: `${c.destructive}22` }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: c.destructive }}>{g.unreadCount}</Text>
                      </View>
                    </View>
                    {g.latestMessage ? (
                      <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                        <Text style={{ color: c.foreground }}>{g.latestMessage.senderName}: </Text>{g.latestMessage.content}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: { padding: 4 },
  badge: { position: 'absolute', top: -1, right: -1, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { marginHorizontal: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden', maxWidth: 420, alignSelf: 'flex-end', width: '92%' },
  head: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  headText: { fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl },
  item: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  count: { minWidth: 22, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
});
