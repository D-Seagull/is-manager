import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatAvatar } from '@/components/chat-avatar';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { SectionHeader } from '@/components/section-header';
import { StatusDot } from '@/components/status-dot';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompanyUsers, type CompanyUser } from '@/hooks/use-company-users';
import { useConversations, type Conversation } from '@/hooks/use-direct-messages';
import {
  useGroups,
  useGroupUnread,
  type ManagerGroup,
} from '@/hooks/use-groups';
import { type UserStatus } from '@/lib/auth-api';
import { fullName } from '@/lib/format';
import { roleBadgeIcon } from '@/lib/roles';
import { useUser } from '@/store/auth';

const DIR_PAGE = 20;
type Tab = 'managers' | 'groups' | 'drivers';

// Remember the last-opened tab for the session so returning from a DM (which
// remounts this screen) lands back on the tab you left — e.g. exit a driver
// chat → stay on "Drivers", not reset to "Managers".
let lastChatTab: Tab = 'managers';

export default function ChatScreen() {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [tab, setTabState] = useState<Tab>(lastChatTab);
  const setTab = (next: Tab) => {
    lastChatTab = next;
    setTabState(next);
  };

  const { data: conversations, refetch: refetchConvs } = useConversations();
  const { data: groups, refetch: refetchGroups } = useGroups();
  const { data: groupUnread, refetch: refetchGroupUnread } = useGroupUnread();

  const mgrUnread = (conversations ?? [])
    .filter((cv) => cv.user.role !== 'DRIVER')
    .reduce((s, cv) => s + cv.unreadCount, 0);
  const drvUnread = (conversations ?? [])
    .filter((cv) => cv.user.role === 'DRIVER')
    .reduce((s, cv) => s + cv.unreadCount, 0);
  const groupUnreadTotal = groupUnread?.total ?? 0;

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      void refetchConvs();
      void refetchGroups();
      void refetchGroupUnread();
    }
  }, [isFocused, refetchConvs, refetchGroups, refetchGroupUnread]);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <SectionHeader title={t('nav.items.chat', 'Чат')} />

      <View style={styles.content}>
        {tab === 'groups' ? (
          <GroupsTab groups={groups} unread={groupUnread} />
        ) : (
          <DmTab kind={tab === 'managers' ? 'manager' : 'driver'} />
        )}
      </View>

      {/* Contextual bottom buttons — sub-views of Chat. */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: c.card,
            borderTopColor: c.border,
            paddingBottom: Math.max(insets.bottom, Spacing.sm),
          },
        ]}
      >
        <BottomTab
          label={t('nav.items.managers', 'Менеджери')}
          icon="headset-outline"
          active={tab === 'managers'}
          badge={mgrUnread}
          onPress={() => setTab('managers')}
        />
        <BottomTab
          label={t('nav.groups', 'Групи')}
          icon="people-outline"
          active={tab === 'groups'}
          badge={groupUnreadTotal}
          onPress={() => setTab('groups')}
        />
        <BottomTab
          label={t('nav.items.drivers', 'Водії')}
          icon="car-outline"
          active={tab === 'drivers'}
          badge={drvUnread}
          onPress={() => setTab('drivers')}
        />
      </View>
    </View>
  );
}

function BottomTab({
  label,
  icon,
  active,
  badge,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  badge: number;
  onPress: () => void;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const color = active ? c.primary : c.mutedForeground;
  return (
    <Pressable onPress={onPress} style={styles.bottomTab}>
      <View>
        <Ionicons name={icon} size={22} color={color} />
        {badge > 0 && (
          <View style={[styles.badge, { backgroundColor: c.destructive }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.bottomTabLabel, { color, fontWeight: active ? '700' : '500' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Direct messages tab ───────────────────────────────────────────────────

function DmTab({ kind }: { kind: 'manager' | 'driver' }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const me = useUser();
  const myId = me?.id ?? '';
  const { data: conversations, isLoading } = useConversations();
  const { data: companyUsers } = useCompanyUsers();
  const [query, setQuery] = useState('');
  const [visibleDir, setVisibleDir] = useState(DIR_PAGE);

  const onQueryChange = (value: string) => {
    setQuery(value);
    setVisibleDir(DIR_PAGE);
  };

  const q = query.trim().toLowerCase();
  const matches = (name: string, phone: string, plate: string) =>
    !q || name.includes(q) || phone.includes(q) || plate.includes(q);

  // Розмежування вкладок: «Водії» → DRIVER; «Менеджери» → MANAGER/TEAMLEAD.
  const convInKind = (role: string) => (kind === 'driver' ? role === 'DRIVER' : role !== 'DRIVER');
  const dirInKind = (role: string) =>
    kind === 'driver' ? role === 'DRIVER' : role === 'MANAGER' || role === 'TEAMLEAD';

  const filteredConvs = [...(conversations ?? [])]
    .filter((cv) => convInKind(cv.user.role))
    .sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime(),
    )
    .filter((cv) =>
      matches(
        fullName(cv.user).toLowerCase(),
        (cv.user.phone ?? '').toLowerCase(),
        (cv.user.truckPlate ?? '').toLowerCase(),
      ),
    );

  const convIds = new Set((conversations ?? []).map((cv) => cv.user.id));
  const directory = (companyUsers ?? [])
    .filter(
      (u) => dirInKind(u.role) && u.isActive && u.id !== myId && !convIds.has(u.id),
    )
    .filter((u) =>
      matches(
        fullName(u).toLowerCase(),
        (u.phone ?? '').toLowerCase(),
        (u.currentTruck?.plate ?? '').toLowerCase(),
      ),
    )
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  const shownDir = directory.slice(0, visibleDir);

  const rows: ChatRow[] = [];
  filteredConvs.forEach((cv) => rows.push({ type: 'conv', conv: cv }));
  if (shownDir.length > 0) {
    rows.push({ type: 'header', key: 'contacts', title: t('chatDir.otherContacts') });
    shownDir.forEach((u) => rows.push({ type: 'dir', user: u }));
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: c.muted }]}>
          <Ionicons name="search" size={16} color={c.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder={t('chatDir.searchPlaceholder')}
            placeholderTextColor={c.mutedForeground}
            style={[styles.searchInput, { color: c.foreground }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => onQueryChange('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>
      {rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: c.mutedForeground }}>
            {q ? t('common.noMatches') : t('chatDir.noConversations')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) =>
            it.type === 'conv'
              ? `c:${it.conv.user.id}`
              : it.type === 'dir'
                ? `d:${it.user.id}`
                : `h:${it.key}`
          }
          renderItem={({ item }) =>
            item.type === 'conv' ? (
              <ConversationRow conv={item.conv} />
            ) : item.type === 'dir' ? (
              <DirectoryRow user={item.user} />
            ) : (
              <Text style={[styles.sectionHeader, { color: c.mutedForeground }]}>
                {item.title}
              </Text>
            )
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (visibleDir < directory.length) setVisibleDir((v) => v + DIR_PAGE);
          }}
        />
      )}
    </View>
  );
}

type ChatRow =
  | { type: 'conv'; conv: Conversation }
  | { type: 'dir'; user: CompanyUser }
  | { type: 'header'; key: string; title: string };

function DirectoryRow({ user }: { user: CompanyUser }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const isManagerTier = user.role !== 'DRIVER';
  const roleLabel = user.role === 'TEAMLEAD' ? t('chatDir.teamlead') : t('nav.manager');
  const subtitle = isManagerTier
    ? roleLabel
    : user.currentTruck?.plate || user.phone || t('nav.driverFallback');

  return (
    <Pressable
      onPress={() => router.push(`/(manager)/dm/${user.id}` as never)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? c.muted : 'transparent' },
      ]}
    >
      <View style={styles.avatarWrap}>
        <ChatAvatar user={user} size={44} />
        {isManagerTier && (
          <View style={[styles.managerBadge, { backgroundColor: c.primary }]}>
            <Ionicons name={roleBadgeIcon(user.role)} size={9} color={c.primaryForeground} />
          </View>
        )}
        <View style={styles.presenceDot}>
          <StatusDot
            user={{ id: user.id, status: user.status as UserStatus | null, statusUntil: user.statusUntil }}
            size={11}
            ring={c.background}
          />
        </View>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
          {fullName(user) || (isManagerTier ? t('nav.manager') : t('nav.driverFallback'))}
        </Text>
        <Text style={[styles.preview, { color: c.mutedForeground }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chatbubble-outline" size={16} color={c.mutedForeground} />
    </Pressable>
  );
}

function ConversationRow({ conv }: { conv: Conversation }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const hasUnread = conv.unreadCount > 0;
  const isManagerTier = conv.user.role !== 'DRIVER';

  return (
    <Pressable
      onPress={() => router.push(`/(manager)/dm/${conv.user.id}` as never)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? c.muted
            : hasUnread
              ? `${c.primary}14`
              : 'transparent',
        },
      ]}
    >
      <View style={styles.avatarWrap}>
        <ChatAvatar user={conv.user} size={44} />
        {isManagerTier && (
          <View style={[styles.managerBadge, { backgroundColor: c.primary }]}>
            <Ionicons name={roleBadgeIcon(conv.user.role)} size={9} color={c.primaryForeground} />
          </View>
        )}
        <View style={styles.presenceDot}>
          <StatusDot
            user={{ id: conv.user.id, status: conv.user.status as UserStatus | null, statusUntil: conv.user.statusUntil }}
            size={11}
            ring={c.background}
          />
        </View>
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTopLine}>
          <Text
            style={[
              styles.name,
              { color: c.foreground, fontWeight: hasUnread ? '700' : '500' },
            ]}
            numberOfLines={1}
          >
            {fullName(conv.user) || conv.user.role}
          </Text>
          {hasUnread && (
            <View style={[styles.pillBadge, { backgroundColor: c.primary }]}>
              <Text style={styles.badgeText}>
                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.preview, { color: c.mutedForeground }]} numberOfLines={1}>
          {conv.lastMessage.deletedAt
            ? t('common.messageDeleted')
            : conv.lastMessage.content || t('nav.fileAttachment')}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Groups tab ─────────────────────────────────────────────────────────────

function GroupsTab({
  groups,
  unread,
}: {
  groups: ManagerGroup[] | undefined;
  unread: ReturnType<typeof useGroupUnread>['data'];
}) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];

  const unreadByGroup = useMemo(() => {
    const map = new Map<string, number>();
    (unread?.items ?? []).forEach((r) => map.set(r.groupId, r.unreadCount));
    return map;
  }, [unread]);

  if (!groups) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <ScreenPlaceholder
        icon="people-outline"
        title={t('groups.empty.title')}
        subtitle={t('groups.empty.subtitle')}
      />
    );
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.id}
      renderItem={({ item }) => (
        <GroupRow group={item} unread={unreadByGroup.get(item.id) ?? 0} />
      )}
      ItemSeparatorComponent={() => (
        <View style={[styles.sep, { backgroundColor: c.border }]} />
      )}
    />
  );
}

function GroupRow({ group, unread }: { group: ManagerGroup; unread: number }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const hasUnread = unread > 0;
  const memberCount = group.managers?.length ?? 0;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(manager)/group/[groupId]',
          params: { groupId: group.id, name: group.name },
        } as never)
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? c.muted
            : hasUnread
              ? `${c.primary}14`
              : 'transparent',
        },
      ]}
    >
      <View style={[styles.groupAvatar, { backgroundColor: c.muted }]}>
        <Ionicons name="people" size={20} color={c.primary} />
      </View>
      <View style={styles.rowText}>
        <Text
          style={[styles.name, { color: c.foreground, fontWeight: hasUnread ? '700' : '600' }]}
          numberOfLines={1}
        >
          {group.name}
        </Text>
        <Text style={[styles.preview, { color: c.mutedForeground }]} numberOfLines={1}>
          {t('groups.memberCount', { count: memberCount })}
        </Text>
      </View>
      {hasUnread ? (
        <View style={[styles.pillBadge, { backgroundColor: c.primary }]}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
  },
  bottomTab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  bottomTabLabel: { fontSize: 11 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  searchWrap: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 38,
    borderRadius: Radius.md,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  sep: { height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  avatarWrap: { width: 44, height: 44 },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceDot: { position: 'absolute', right: -2, bottom: -2 },
  rowText: { flex: 1, minWidth: 0 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { flex: 1, fontSize: 15 },
  pillBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { fontSize: 13, marginTop: 2 },
});
