import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChatAvatar } from '@/components/chat-avatar';
import { SectionHeader } from '@/components/section-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  useBugReports,
  useUpdateBugStatus,
  type BugReport,
  type BugStatus,
} from '@/hooks/use-admin';
import { fullName } from '@/lib/format';
import { getSocket } from '@/lib/socket';

type Filter = 'all' | BugStatus;

const ROLE_COLOR: Record<string, string> = {
  DRIVER: '#10B981',
  MANAGER: '#0EA5E9',
  TEAMLEAD: '#8B5CF6',
  ADMIN: '#64748B',
};

export default function AdminBugReportsScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('NEW');
  const status = filter === 'all' ? undefined : filter;
  const { data: reports, isLoading, isError } = useBugReports(status);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t('admin.bugReports.filters.all', 'Усі') },
    { key: 'NEW', label: t('admin.bugReports.filters.new', 'Нові') },
    { key: 'TRIAGED', label: t('admin.bugReports.filters.triaged', 'В роботі') },
    { key: 'RESOLVED', label: t('admin.bugReports.filters.resolved', 'Вирішені') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader title={t('admin.bugReports.title', 'Баг-репорти')} />

      <View style={styles.tabs}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.tab,
                { backgroundColor: active ? c.primary : c.muted },
              ]}
            >
              <Text style={{ color: active ? c.primaryForeground : c.mutedForeground, fontSize: 13, fontWeight: '600' }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: c.destructive }}>{t('admin.bugReports.error', 'Помилка завантаження')}</Text>
        </View>
      ) : (reports?.length ?? 0) === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: c.mutedForeground }}>{t('admin.bugReports.empty', 'Немає репортів')}</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ReportCard report={item} onOpenImage={setLightbox} />}
        />
      )}

      {/* Lightbox */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <Pressable style={styles.lightbox} onPress={() => setLightbox(null)}>
          {lightbox && <Image source={{ uri: lightbox }} style={styles.lightboxImg} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

function ReportCard({
  report: r,
  onOpenImage,
}: {
  report: BugReport;
  onOpenImage: (url: string) => void;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t, i18n } = useTranslation();
  const { mutate, isPending } = useUpdateBugStatus();
  const [replyOpen, setReplyOpen] = useState(false);

  const resolved = r.status === 'RESOLVED';
  const name = fullName(r.reporter) || r.reporter.role;
  const when = new Date(r.createdAt).toLocaleString(i18n.language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const meta = [
    r.appName && r.appVersion ? `${r.appName} ${r.appVersion}` : r.appName,
    r.platform,
    r.route,
    r.company?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, opacity: resolved ? 0.6 : 1 }]}>
      <View style={styles.cardTop}>
        <ChatAvatar user={r.reporter} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, { color: c.foreground, textDecorationLine: resolved ? 'line-through' : 'none' }]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <View style={[styles.roleTag, { backgroundColor: `${ROLE_COLOR[r.reporter.role] ?? c.mutedForeground}22` }]}>
              <Text style={{ color: ROLE_COLOR[r.reporter.role] ?? c.mutedForeground, fontSize: 10, fontWeight: '700' }}>
                {r.reporter.role}
              </Text>
            </View>
          </View>
          <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{when}</Text>
        </View>
        {resolved && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
      </View>

      <Text style={[styles.desc, { color: c.foreground }]}>{r.description}</Text>

      {r.screenshots.length > 0 && (
        <View style={styles.shots}>
          {r.screenshots.map((url, i) => (
            <Pressable key={`${r.id}-${i}`} onPress={() => onOpenImage(url)} style={[styles.shot, { borderColor: c.border }]}>
              <Image source={{ uri: url }} style={styles.shotImg} resizeMode="cover" />
            </Pressable>
          ))}
        </View>
      )}

      {meta ? (
        <Text style={[styles.meta, { color: c.mutedForeground, borderTopColor: c.border }]}>{meta}</Text>
      ) : null}

      <View style={styles.actions}>
        {resolved ? (
          <ActionBtn
            icon="refresh-outline"
            label={t('admin.bugReports.actions.reopen', 'Відкрити знову')}
            onPress={() => mutate({ id: r.id, status: 'NEW' })}
            disabled={isPending}
          />
        ) : (
          <>
            {r.status !== 'TRIAGED' && (
              <ActionBtn
                icon="time-outline"
                label={t('admin.bugReports.actions.triage', 'В роботу')}
                onPress={() => mutate({ id: r.id, status: 'TRIAGED' })}
                disabled={isPending}
              />
            )}
            <ActionBtn
              icon="checkmark-outline"
              label={t('admin.bugReports.actions.resolve', 'Вирішено')}
              color="#10B981"
              onPress={() => mutate({ id: r.id, status: 'RESOLVED' })}
              disabled={isPending}
            />
            <ActionBtn
              icon="chatbubble-outline"
              label={t('admin.bugReports.actions.message', 'Написати')}
              onPress={() => setReplyOpen(true)}
            />
          </>
        )}
      </View>

      <ReplyModal
        open={replyOpen}
        name={name}
        description={r.description}
        onClose={() => setReplyOpen(false)}
        onSend={(content) => {
          // Reuses the DM pipeline (realtime + push + translation) — no company
          // scoping, so admin → any reporter works without the dispatch chat UI.
          getSocket().emit('send_direct_message', { receiverId: r.reporterId, content });
          setReplyOpen(false);
        }}
      />
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  disabled,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const tint = color ?? c.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionBtn, { borderColor: c.border, opacity: disabled ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={14} color={tint} />
      <Text style={{ color: tint, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function ReplyModal({
  open,
  name,
  description,
  onClose,
  onSend,
}: {
  open: boolean;
  name: string;
  description: string;
  onClose: () => void;
  onSend: (content: string) => void;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const quote = description.length > 60 ? `${description.slice(0, 60)}…` : description;
  const [text, setText] = useState('');

  // Seed the quote when the modal opens.
  const seeded = open && text === '' ? `Re: «${quote}»\n\n` : text;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.sheetTitle, { color: c.foreground }]}>
            {t('admin.bugReports.reply.title', { name, defaultValue: 'Відповісти {{name}}' })}
          </Text>
          <TextInput
            value={seeded}
            onChangeText={setText}
            multiline
            style={[styles.replyField, { backgroundColor: c.muted, color: c.foreground }]}
            autoFocus
          />
          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} style={styles.btnGhost}>
              <Text style={{ color: c.mutedForeground, fontWeight: '600' }}>{t('common.cancel', 'Скасувати')}</Text>
            </Pressable>
            <Pressable
              onPress={() => seeded.trim() && onSend(seeded.trim())}
              disabled={!seeded.trim()}
              style={[styles.btnPrimary, { backgroundColor: c.primary }]}
            >
              <Text style={{ color: c.primaryForeground, fontWeight: '700' }}>
                {t('admin.bugReports.reply.send', 'Надіслати')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  tab: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 999 },
  list: { padding: Spacing.md, gap: Spacing.sm },

  card: { borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.md, gap: Spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  name: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  roleTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  desc: { fontSize: 14, lineHeight: 20 },

  shots: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  shot: { width: 64, height: 48, borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  shotImg: { width: '100%', height: '100%' },
  meta: { fontSize: 11, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.xs },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },

  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: '100%', height: '80%' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  replyField: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  btnGhost: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md },
  btnPrimary: { paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center' },
});
