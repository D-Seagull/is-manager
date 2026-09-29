import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TRIP_STATUS_COLORS, type TripStatus } from '@/constants/trip-status';
import { Radius, Spacing } from '@/constants/theme';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth';

/** Payload of the backend's `tripStatusNotice` socket event. */
interface TripStatusNotice {
  kind: 'STATUS' | 'NOT_DEPARTED';
  tripId: string;
  truckId: string;
  title: string;
  plate: string;
  driverName: string;
  status: TripStatus;
}

const SHOW_MS = 6000;
const NOT_DEPARTED_COLOR = '#DC2626';

/**
 * Top banner for a driver's trip-status change (accepted / on the way /
 * delivered …), colored like the status badge, with the trip's title. Also
 * warns when a driver didn't confirm setting off after 3 reminders.
 * Driven by the socket while the app is open — the push covers the closed app
 * (PushNoticeOverlay skips these pushes in the foreground). Tap → the truck.
 */
export function TripStatusBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const [queue, setQueue] = useState<TripStatusNotice[]>([]);
  const notice = queue[0] ?? null;
  // Stable Animated.Value without reading a ref during render.
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const onNotice = (n: TripStatusNotice) => setQueue((q) => [...q, n]);
    socket.on('tripStatusNotice', onNotice);
    return () => {
      socket.off('tripStatusNotice', onNotice);
    };
  }, [token]);

  // Slide in, hold, slide out, then move on to the next one.
  useEffect(() => {
    if (!notice) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setQueue((q) => q.slice(1)),
      );
    }, SHOW_MS);
    return () => clearTimeout(timer);
  }, [notice, anim]);

  if (!notice) return null;

  const color =
    notice.kind === 'NOT_DEPARTED'
      ? NOT_DEPARTED_COLOR
      : TRIP_STATUS_COLORS[notice.status]?.fg ?? '#2563EB';
  const line =
    notice.kind === 'NOT_DEPARTED'
      ? t('tripNotice.notDeparted', {
          name: notice.driverName,
          defaultValue: '{{name}}: виїзд не підтверджено після 3 нагадувань',
        })
      : `${notice.driverName ? `${notice.driverName}: ` : ''}${t(`tripStatus.${notice.status}`, notice.status)}`;

  const dismiss = () => setQueue((q) => q.slice(1));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + Spacing.sm,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        },
      ]}
    >
      <Pressable
        onPress={() => {
          dismiss();
          router.push(`/(manager)/truck/${notice.truckId}` as never);
        }}
        style={[styles.banner, { backgroundColor: color }]}
      >
        <Ionicons
          name={notice.kind === 'NOT_DEPARTED' ? 'alert-circle' : 'car-outline'}
          size={20}
          color="#fff"
        />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {notice.plate ? `${notice.plate} · ` : ''}
            {notice.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {line}
          </Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={10}>
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.9)" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.md, right: Spacing.md, zIndex: 1000, elevation: 10 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  text: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 14, fontWeight: '700' },
  body: { color: '#fff', fontSize: 13, marginTop: 1 },
});
