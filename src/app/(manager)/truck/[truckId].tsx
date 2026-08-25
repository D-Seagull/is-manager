import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlarmTab } from '@/components/alarm-tab';
import { DocumentsTab } from '@/components/documents-tab';
import { InfoTab } from '@/components/info-tab';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { TripChat } from '@/components/trip-chat';
import { TripForm } from '@/components/trip-form';
import { TripsTab } from '@/components/trips-tab';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTruck } from '@/hooks/use-my-trucks';
import { fullName } from '@/lib/format';

type Tab = 'chat' | 'trips' | 'documents' | 'alarm' | 'info';

const TABS: { key: Tab; labelKey: string; fallback: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'chat', labelKey: 'truck.tabs.chat', fallback: 'Чат', icon: 'chatbubbles-outline' },
  { key: 'trips', labelKey: 'truck.tabs.trips', fallback: 'Рейси', icon: 'map-outline' },
  { key: 'documents', labelKey: 'truck.tabs.documents', fallback: 'Документи', icon: 'document-text-outline' },
  { key: 'alarm', labelKey: 'truck.tabs.alarm', fallback: 'Будильник', icon: 'alarm-outline' },
  { key: 'info', labelKey: 'truck.tabs.info', fallback: 'Інфо', icon: 'information-circle-outline' },
];

export default function TruckDetailScreen() {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const { truckId, plate, tab: tabParam } = useLocalSearchParams<{
    truckId: string;
    plate?: string;
    tab?: string;
  }>();

  const [tab, setTab] = useState<Tab>(
    TABS.some((x) => x.key === tabParam) ? (tabParam as Tab) : 'chat',
  );

  // Трак тягнемо по id (GET /trucks/:id) — працює для будь-якого трака компанії
  // (не лише «моїх») і повертає manager + активний рейс.
  const { data: truck } = useTruck(truckId);
  const activeTripId = truck?.trips?.[0]?.id ?? null;
  const driverName = fullName(truck?.currentDriver);
  const [newTripOpen, setNewTripOpen] = useState(false);
  // A trip picked from the Trips tab opens its chat; falls back to the active trip.
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header — back to My Trucks + plate. */}
      <View
        style={[
          styles.header,
          { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + Spacing.xs },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.plate, { color: c.foreground }]} numberOfLines={1}>
            {plate || t('nav.items.trucks', 'Вантажівка')}
          </Text>
          {driverName ? (
            <Text style={[styles.driverSub, { color: c.mutedForeground }]} numberOfLines={1}>
              {t('truck.driverLabel', 'Водій')}: {driverName}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setNewTripOpen(true)}
          hitSlop={10}
          style={[styles.newTripBtn, { backgroundColor: c.primary }]}
          accessibilityLabel={t('truckPanel.newTrip.button', 'Новий рейс')}
        >
          <Ionicons name="add" size={22} color={c.primaryForeground} />
        </Pressable>
      </View>

      {/* Tab panel — at the top, under the header (like the web). */}
      <View style={[styles.tabbar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {TABS.map((x) => {
          const active = x.key === tab;
          const color = active ? c.primary : c.mutedForeground;
          return (
            <Pressable key={x.key} onPress={() => setTab(x.key)} style={styles.tabBtn}>
              <Ionicons name={x.icon} size={22} color={color} />
              <Text style={[styles.tabLabel, { color, fontWeight: active ? '700' : '500' }]}>
                {t(x.labelKey, x.fallback)}
              </Text>
              <View style={[styles.tabUnderline, { backgroundColor: active ? c.primary : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>

      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0} style={styles.fill}>
        <View style={styles.content}>
          {tab === 'chat' ? (
            <TripChat tripId={selectedTripId ?? activeTripId} isFocused={tab === 'chat'} />
          ) : tab === 'trips' ? (
            <TripsTab
              truckId={truckId ?? ''}
              onOpenTrip={(id) => {
                setSelectedTripId(id);
                setTab('chat');
              }}
              onNewTrip={() => setNewTripOpen(true)}
            />
          ) : tab === 'documents' ? (
            <DocumentsTab truckId={truckId ?? ''} />
          ) : tab === 'alarm' && truck ? (
            <AlarmTab truck={truck} activeTripId={activeTripId} />
          ) : tab === 'info' && truck ? (
            <InfoTab truck={truck} activeTripId={activeTripId} />
          ) : (
            <TabContent tab={tab} />
          )}
        </View>
      </KeyboardAvoidingView>

      <TripForm
        truckId={truckId ?? ''}
        trip={null}
        defaultDriverId={truck?.currentDriver?.id}
        visible={newTripOpen}
        onClose={() => setNewTripOpen(false)}
      />
    </View>
  );
}

function TabContent({ tab }: { tab: Tab }) {
  const { t } = useTranslation();
  const meta = TABS.find((x) => x.key === tab)!;
  return (
    <ScreenPlaceholder
      icon={meta.icon}
      title={t(meta.labelKey, meta.fallback)}
      subtitle={t('common.soon', 'Скоро')}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  backBtn: { padding: 4 },
  plate: { fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  driverSub: { fontSize: 12, marginTop: 1 },
  newTripBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  content: { flex: 1 },
  tabbar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 2 },
  tabLabel: { fontSize: 10 },
  tabUnderline: { height: 2, width: '70%', marginTop: 4, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});
