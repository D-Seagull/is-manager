import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SectionHeader } from '@/components/section-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAdminStats } from '@/hooks/use-admin';

export default function AdminDashboardScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useAdminStats();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader title={t('admin.dashboard.title', 'Адмінка')} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {isError && (
          <Text style={{ color: c.destructive }}>
            {t('admin.dashboard.errorStats', 'Не вдалося завантажити статистику')}
          </Text>
        )}

        {/* KPI grid */}
        <View style={styles.grid}>
          <KpiCard
            title={t('admin.dashboard.kpiCompanies', 'Компанії')}
            icon="business-outline"
            color="#3B6EE0"
            value={data?.companies.total}
            sub={
              data
                ? t('admin.dashboard.kpiCompaniesSub', {
                    active: data.companies.active,
                    deactivated: data.companies.deactivated,
                    defaultValue: '{{active}} активних · {{deactivated}} вимкнено',
                  })
                : undefined
            }
            loading={isLoading}
            onPress={() => router.navigate('/(manager)/admin/companies' as never)}
          />
          <KpiCard
            title={t('admin.dashboard.kpiUsers', 'Користувачі')}
            icon="people-outline"
            color="#1F93A4"
            value={data?.users.total}
            sub={
              data
                ? t('admin.dashboard.kpiUsersSub', {
                    drivers: data.users.byRole.DRIVER,
                    managers: data.users.byRole.MANAGER,
                    defaultValue: '{{drivers}} водіїв · {{managers}} менеджерів',
                  })
                : undefined
            }
            loading={isLoading}
          />
          <KpiCard
            title={t('admin.dashboard.kpiOnline', 'Онлайн')}
            icon="wifi-outline"
            color="#10B981"
            value={data ? data.onlineNow.drivers + data.onlineNow.managers : undefined}
            sub={
              data
                ? t('admin.dashboard.kpiOnlineSub', {
                    drivers: data.onlineNow.drivers,
                    managers: data.onlineNow.managers,
                    defaultValue: '{{drivers}} водіїв · {{managers}} менеджерів',
                  })
                : undefined
            }
            loading={isLoading}
            onPress={() => router.navigate('/(manager)/admin/online' as never)}
          />
          <KpiCard
            title={t('admin.dashboard.kpiActiveTrips', 'Активні рейси')}
            icon="map-outline"
            color="#1F9E6B"
            value={data?.activeTrips}
            sub={t('admin.dashboard.kpiActiveTripsSub', 'Зараз у роботі')}
            loading={isLoading}
          />
        </View>

        {/* Recent companies */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.cardHead}>
            <Ionicons name="time-outline" size={16} color={c.foreground} />
            <Text style={[styles.cardTitle, { color: c.foreground }]}>
              {t('admin.dashboard.recentTitle', 'Останні компанії')}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : data && data.recentCompanies.length > 0 ? (
            data.recentCompanies.map((rc, i) => (
              <Pressable
                key={rc.id}
                onPress={() => router.navigate(`/(manager)/admin/company/${rc.id}` as never)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: `${c.primary}1A` }]}>
                  <Ionicons name="business" size={16} color={c.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowTitle, { color: c.foreground }]} numberOfLines={1}>
                    {rc.name}
                  </Text>
                  <Text style={[styles.rowSub, { color: c.mutedForeground }]} numberOfLines={1}>
                    {new Date(rc.createdAt).toLocaleDateString(i18n.language)}
                    {' · '}
                    {t('admin.dashboard.usersCount', {
                      count: rc.usersCount,
                      defaultValue: '{{count}} користувачів',
                    })}
                  </Text>
                </View>
                <CompanyStatusBadge
                  isActive={rc.isActive}
                  awaitingInvite={rc.awaitingInvite}
                />
              </Pressable>
            ))
          ) : (
            <Text style={[styles.empty, { color: c.mutedForeground }]}>
              {t('admin.dashboard.empty', 'Компаній ще немає')}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

export function KpiCard({
  title,
  icon,
  color,
  value,
  sub,
  loading,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: number | undefined;
  sub?: string;
  loading: boolean;
  /** When set, the card links to a detail screen (e.g. the online list). */
  onPress?: () => void;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      style={[styles.kpi, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <View style={styles.kpiHead}>
        <Text style={[styles.kpiTitle, { color: c.mutedForeground }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.kpiHeadIcons}>
          <Ionicons name={icon} size={16} color={color} />
          {onPress ? (
            <Ionicons name="chevron-forward" size={14} color={c.mutedForeground} />
          ) : null}
        </View>
      </View>
      {loading || value === undefined ? (
        <View style={[styles.kpiSkeleton, { backgroundColor: c.muted }]} />
      ) : (
        <Text style={[styles.kpiValue, { color: c.foreground }]}>{value}</Text>
      )}
      {sub ? (
        <Text style={[styles.kpiSub, { color: c.mutedForeground }]} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </Wrap>
  );
}

export function CompanyStatusBadge({
  isActive,
  awaitingInvite,
}: {
  isActive: boolean;
  awaitingInvite?: boolean;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();

  if (awaitingInvite) {
    return (
      <Badge color={c.mutedForeground} icon="mail-unread-outline">
        {t('admin.dashboard.awaitingTeamlead', 'Очікує тімліда')}
      </Badge>
    );
  }
  return isActive ? (
    <Badge color="#10B981" icon="checkmark-circle-outline">
      {t('admin.dashboard.statusActive', 'Активна')}
    </Badge>
  ) : (
    <Badge color={c.destructive} icon="close-circle-outline">
      {t('admin.dashboard.statusDeactivated', 'Деактивована')}
    </Badge>
  );
}

function Badge({
  color,
  icon,
  children,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md },
  center: { paddingVertical: Spacing.xl, alignItems: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kpi: {
    width: '48%',
    flexGrow: 1,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    minHeight: 92,
  },
  kpiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiHeadIcons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  kpiTitle: { fontSize: 13, fontWeight: '500', flex: 1, marginRight: Spacing.xs },
  kpiValue: { fontSize: 26, fontWeight: '700', marginTop: Spacing.xs },
  kpiSkeleton: { height: 28, width: 48, borderRadius: Radius.sm, marginTop: Spacing.sm },
  kpiSub: { fontSize: 11, marginTop: 2 },

  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: Spacing.lg },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 1 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: 130,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
});
