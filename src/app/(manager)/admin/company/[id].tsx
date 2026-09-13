import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChatAvatar } from '@/components/chat-avatar';
import { SectionHeader } from '@/components/section-header';
import { KpiCard, CompanyStatusBadge } from '@/app/(manager)/admin/index';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  useAdminCompany,
  useDeactivateCompany,
  useReactivateCompany,
  useResendCompanyInvite,
  type AdminCompanyDetail,
  type AdminCompanyUser,
} from '@/hooks/use-admin';
import { roleBadgeIcon } from '@/lib/roles';
import { resolveDisplayStatus, STATUS_HEX } from '@/lib/status';

export default function AdminCompanyDetailScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useAdminCompany(id);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader title={data?.name ?? t('admin.detail.title', 'Компанія')} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {isError && (
          <Text style={{ color: c.destructive }}>
            {t('admin.detail.errorLoad', 'Не вдалося завантажити компанію')}
          </Text>
        )}

        <CompanyHeader data={data} isLoading={isLoading} />

        {/* KPI grid */}
        <View style={styles.grid}>
          <KpiCard
            title={t('admin.detail.kpiUsers', 'Користувачі')}
            icon="people-outline"
            color="#1F93A4"
            value={data?.counts.usersTotal}
            sub={
              data
                ? t('admin.detail.kpiUsersSub', {
                    drivers: data.counts.usersByRole.DRIVER,
                    managers: data.counts.usersByRole.MANAGER,
                    teamleads: data.counts.usersByRole.TEAMLEAD,
                    defaultValue: '{{drivers}} вод. · {{managers}} мен. · {{teamleads}} тімл.',
                  })
                : undefined
            }
            loading={isLoading}
          />
          <KpiCard
            title={t('admin.detail.kpiOnline', 'Онлайн')}
            icon="wifi-outline"
            color="#10B981"
            value={data ? data.counts.onlineNow.drivers + data.counts.onlineNow.managers : undefined}
            sub={
              data
                ? t('admin.detail.kpiOnlineSub', {
                    drivers: data.counts.onlineNow.drivers,
                    managers: data.counts.onlineNow.managers,
                    defaultValue: '{{drivers}} водіїв · {{managers}} менеджерів',
                  })
                : undefined
            }
            loading={isLoading}
          />
          <KpiCard
            title={t('admin.detail.kpiTrucks', 'Вантажівки')}
            icon="bus-outline"
            color="#C7791C"
            value={data?.counts.trucks.total}
            sub={
              data
                ? t('admin.detail.kpiTrucksSub', {
                    active: data.counts.trucks.active,
                    defaultValue: '{{active}} активних',
                  })
                : undefined
            }
            loading={isLoading}
          />
          <KpiCard
            title={t('admin.detail.kpiTrips', 'Рейси')}
            icon="map-outline"
            color="#1F9E6B"
            value={data?.counts.trips.active}
            sub={
              data
                ? t('admin.detail.kpiTripsSub', {
                    count: data.counts.trips.thisMonth,
                    defaultValue: '{{count}} за місяць',
                  })
                : undefined
            }
            loading={isLoading}
          />
        </View>

        <ContactsCard data={data} isLoading={isLoading} />
        <PushCoverageCard data={data} isLoading={isLoading} />
        <UsersCard users={data?.users} isLoading={isLoading} />
      </ScrollView>
    </View>
  );
}

// ─── Header (avatar, name, status, actions) ─────────────────────────────────

function CompanyHeader({
  data,
  isLoading,
}: {
  data: AdminCompanyDetail | undefined;
  isLoading: boolean;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t, i18n } = useTranslation();
  const deactivate = useDeactivateCompany();
  const reactivate = useReactivateCompany();
  const resend = useResendCompanyInvite();
  const [resendOpen, setResendOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <View style={styles.headerRow}>
        <View style={[styles.avatarStub, { backgroundColor: c.muted }]} />
        <View style={{ flex: 1 }}>
          <View style={[styles.skelLine, { backgroundColor: c.muted, width: '60%' }]} />
          <View style={[styles.skelLine, { backgroundColor: c.muted, width: '40%', marginTop: 6 }]} />
        </View>
      </View>
    );
  }

  const confirmDeactivate = () => {
    Alert.alert(
      t('admin.detail.deactivateConfirmTitle', 'Деактивувати компанію?'),
      t('admin.detail.deactivateConfirmBody', {
        name: data.name,
        defaultValue: 'Компанія «{{name}}» втратить доступ.',
      }),
      [
        { text: t('common.cancel', 'Скасувати'), style: 'cancel' },
        {
          text: t('admin.detail.deactivate', 'Деактивувати'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivate.mutateAsync(data.id);
              Alert.alert(t('admin.detail.deactivateSuccess', 'Компанію деактивовано'));
            } catch {
              Alert.alert(t('admin.detail.deactivateError', 'Помилка'));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.headerRow}>
        <ChatAvatar user={{ avatar: data.logo, firstName: data.name }} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.companyName, { color: c.foreground }]} numberOfLines={1}>
              {data.name}
            </Text>
            <CompanyStatusBadge isActive={data.isActive} />
          </View>
          <Text style={[styles.registered, { color: c.mutedForeground }]}>
            {t('admin.detail.registered', {
              date: new Date(data.createdAt).toLocaleDateString(i18n.language, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
              defaultValue: 'Зареєстровано {{date}}',
            })}
          </Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        <Pressable
          onPress={() => setResendOpen(true)}
          style={[styles.actionBtn, { borderColor: c.border }]}
        >
          <Ionicons name="mail-outline" size={16} color={c.foreground} />
          <Text style={[styles.actionText, { color: c.foreground }]}>
            {t('admin.detail.resendInvite', 'Надіслати інвайт')}
          </Text>
        </Pressable>
        {data.isActive ? (
          <Pressable
            onPress={confirmDeactivate}
            disabled={deactivate.isPending}
            style={[styles.actionBtn, { borderColor: c.destructive }]}
          >
            <Ionicons name="power-outline" size={16} color={c.destructive} />
            <Text style={[styles.actionText, { color: c.destructive }]}>
              {t('admin.detail.deactivate', 'Деактивувати')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={async () => {
              try {
                await reactivate.mutateAsync(data.id);
                Alert.alert(t('admin.detail.reactivateSuccess', 'Компанію активовано'));
              } catch {
                Alert.alert(t('admin.detail.reactivateError', 'Не вдалося активувати'));
              }
            }}
            disabled={reactivate.isPending}
            style={[styles.actionBtn, { borderColor: '#10B981' }]}
          >
            <Ionicons name="power-outline" size={16} color="#10B981" />
            <Text style={[styles.actionText, { color: '#10B981' }]}>
              {t('admin.detail.reactivate', 'Активувати')}
            </Text>
          </Pressable>
        )}
      </View>

      <ResendInviteModal
        open={resendOpen}
        pending={resend.isPending}
        onClose={() => setResendOpen(false)}
        onSubmit={async (email) => {
          try {
            await resend.mutateAsync({ id: data.id, email });
            setResendOpen(false);
            Alert.alert(t('admin.detail.resendSuccess', 'Інвайт надіслано'), email);
          } catch {
            Alert.alert(t('admin.detail.resendFail', 'Не вдалося надіслати'));
          }
        }}
      />
    </View>
  );
}

function ResendInviteModal({
  open,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const [email, setEmail] = useState('');

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={pending ? undefined : onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.sheetTitle, { color: c.foreground }]}>
            {t('admin.detail.resendInvite', 'Надіслати інвайт')}
          </Text>
          <Text style={[styles.sheetDesc, { color: c.mutedForeground }]}>
            {t('admin.detail.resendPrompt', 'Email отримувача:')}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@company.com"
            placeholderTextColor={c.mutedForeground}
            editable={!pending}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={[styles.field, { backgroundColor: c.muted, color: c.foreground }]}
          />
          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} disabled={pending} style={styles.btnGhost}>
              <Text style={{ color: c.mutedForeground, fontWeight: '600' }}>
                {t('common.cancel', 'Скасувати')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => email.trim() && onSubmit(email.trim())}
              disabled={pending || !email.trim()}
              style={[styles.btnPrimary, { backgroundColor: c.primary, opacity: pending ? 0.7 : 1 }]}
            >
              {pending ? (
                <ActivityIndicator color={c.primaryForeground} size="small" />
              ) : (
                <Text style={{ color: c.primaryForeground, fontWeight: '700' }}>
                  {t('admin.detail.resendInvite', 'Надіслати')}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Contacts ───────────────────────────────────────────────────────────────

function ContactsCard({
  data,
  isLoading,
}: {
  data: AdminCompanyDetail | undefined;
  isLoading: boolean;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  return (
    <Card icon="mail-outline" title={t('admin.detail.contactsTitle', 'Контакти')}>
      {isLoading || !data ? (
        <ActivityIndicator color={c.primary} />
      ) : (
        <>
          <ContactRow label={t('admin.detail.contactDirector', 'Директор')} value={data.directorEmail} />
          <ContactRow label={t('admin.detail.contactAccounting', 'Бухгалтерія')} value={data.accountingEmail} />
          <ContactRow label={t('admin.detail.contactHr', 'HR')} value={data.hrEmail} />
        </>
      )}
    </Card>
  );
}

function ContactRow({ label, value }: { label: string; value: string | null }) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  return (
    <View style={styles.contactRow}>
      <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{label}</Text>
      {value ? (
        <Pressable onPress={() => Linking.openURL(`mailto:${value}`)} style={{ flexShrink: 1 }}>
          <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
            {value}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ color: c.mutedForeground, fontSize: 13, fontStyle: 'italic' }}>
          {t('admin.detail.notSpecified', 'не вказано')}
        </Text>
      )}
    </View>
  );
}

// ─── Push coverage ──────────────────────────────────────────────────────────

function PushCoverageCard({
  data,
  isLoading,
}: {
  data: AdminCompanyDetail | undefined;
  isLoading: boolean;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const pc = data?.counts.pushCoverage;
  const pct = pc && pc.outOf > 0 ? Math.round((pc.withToken / pc.outOf) * 100) : 0;

  return (
    <Card icon="notifications-outline" title={t('admin.detail.pushTitle', 'Push-покриття')}>
      {isLoading || !data || !pc ? (
        <ActivityIndicator color={c.primary} />
      ) : (
        <>
          <View style={styles.pushHead}>
            <Text style={[styles.pushPct, { color: c.foreground }]}>
              {pc.outOf === 0 ? '—' : `${pct}%`}
            </Text>
            <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
              {t('admin.detail.pushOutOf', {
                withToken: pc.withToken,
                outOf: pc.outOf,
                defaultValue: '{{withToken}} з {{outOf}}',
              })}
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: c.muted }]}>
            <View style={[styles.progressFill, { backgroundColor: c.primary, width: `${pct}%` }]} />
          </View>
          <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: Spacing.xs }}>
            {t('admin.detail.pushCaption', 'Користувачі з увімкненими сповіщеннями')}
          </Text>
        </>
      )}
    </Card>
  );
}

// ─── Users ──────────────────────────────────────────────────────────────────

function UsersCard({
  users,
  isLoading,
}: {
  users: AdminCompanyUser[] | undefined;
  isLoading: boolean;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  return (
    <Card
      icon="people-outline"
      title={`${t('admin.detail.usersTitle', 'Користувачі')}${users ? ` (${users.length})` : ''}`}
    >
      {isLoading || !users ? (
        <ActivityIndicator color={c.primary} />
      ) : users.length === 0 ? (
        <Text style={{ color: c.mutedForeground, fontSize: 13, textAlign: 'center', paddingVertical: Spacing.md }}>
          {t('admin.detail.usersEmpty', 'Немає користувачів')}
        </Text>
      ) : (
        users.map((u, i) => {
          const status = resolveDisplayStatus(u, u.status === 'ONLINE');
          return (
            <View
              key={u.id}
              style={[
                styles.userRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
              ]}
            >
              <ChatAvatar user={u} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.userName, { color: c.foreground }]} numberOfLines={1}>
                  {u.firstName} {u.lastName ?? ''}
                </Text>
                <Text style={{ color: c.mutedForeground, fontSize: 12 }} numberOfLines={1}>
                  {u.email ?? u.phone ?? '—'}
                </Text>
              </View>
              <Ionicons name={roleBadgeIcon(u.role)} size={16} color={c.mutedForeground} />
              <View style={[styles.statusDot, { backgroundColor: STATUS_HEX[status] }]} />
            </View>
          );
        })
      )}
    </Card>
  );
}

// ─── Shared card wrapper ────────────────────────────────────────────────────

function Card({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.cardHead}>
        <Ionicons name={icon} size={16} color={c.foreground} />
        <Text style={[styles.cardTitle, { color: c.foreground }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarStub: { width: 56, height: 56, borderRadius: 28 },
  skelLine: { height: 14, borderRadius: Radius.sm },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  companyName: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  registered: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  actionText: { fontSize: 13, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardTitle: { fontSize: 15, fontWeight: '700' },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: 4,
  },

  pushHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  pushPct: { fontSize: 24, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: Spacing.xs },
  progressFill: { height: '100%', borderRadius: 4 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  userName: { fontSize: 14, fontWeight: '600' },
  statusDot: { width: 9, height: 9, borderRadius: 5 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: { borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetDesc: { fontSize: 13, marginTop: 2, marginBottom: Spacing.md },
  field: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.lg },
  btnGhost: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.md },
  btnPrimary: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
    minWidth: 100,
    alignItems: 'center',
  },
});
