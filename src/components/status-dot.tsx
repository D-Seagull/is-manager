import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { UserStatus } from '@/lib/auth-api';
import {
  resolveDisplayStatus,
  STATUS_HEX,
  type DisplayStatus,
} from '@/lib/status';
import { useUserPresence } from '@/hooks/use-presence';

interface StatusDotProps {
  user:
    | {
        id?: string;
        status?: UserStatus | null;
        statusUntil?: string | null;
      }
    | null
    | undefined;
  /** Override for the live presence lookup. Omit for the common case
   *  where we read from the shared presence store. */
  isOnline?: boolean;
  size?: number;
  /** Background colour for the outer ring — pass the parent surface so the
   *  dot looks like it sits on top with a hairline gap. */
  ring?: string;
}

/**
 * Tiny presence dot for native lists. SLEEP renders with a moon glyph
 * inside; the rest are solid fills. Pure-RN so we can drop it on any
 * existing Image / Text avatar without touching layout.
 */
export function StatusDot({ user, isOnline, size = 10, ring = '#000' }: StatusDotProps) {
  const presence = useUserPresence(user?.id);
  // An explicit `isOnline` override (e.g. self) skips the away tier entirely.
  const effectiveOnline = isOnline ?? presence === 'online';
  const effectiveAway = isOnline == null && presence === 'away';
  const status: DisplayStatus = resolveDisplayStatus(user, effectiveOnline, effectiveAway);
  const inner = size;
  const outer = inner + 4;
  return (
    <View
      style={[
        styles.outer,
        {
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          backgroundColor: ring,
        },
      ]}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: STATUS_HEX[status],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {status === 'SLEEP' && (
          <Ionicons
            name="moon"
            size={Math.max(6, Math.floor(inner * 0.7))}
            color="#fff"
          />
        )}
        {status === 'VACATION' && (
          // Lucide-style palm tree isn't in Ionicons; emoji renders crisply
          // on both iOS and Android at this size and keeps us from having
          // to ship a second icon font just for one glyph.
          <Text style={{ fontSize: Math.max(6, Math.floor(inner * 0.8)) }}>
            🌴
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * The list version of the dot: green while the person is in the app and
 * available, a moon / palm when they set Sleep / Vacation (shown even with
 * the app closed), nothing otherwise — the caller shows "last seen" instead.
 * Same rule as the web's My Trucks.
 */
export function ListStatusDot({ user, size = 10, ring = '#000' }: Omit<StatusDotProps, 'isOnline'>) {
  const presence = useUserPresence(user?.id);
  // An expired Sleep / Vacation timer resolves to ONLINE, so it isn't "resting".
  const resolved = resolveDisplayStatus(user, true);
  const resting = resolved === 'SLEEP' || resolved === 'VACATION';
  const available = presence === 'online' && resolved === 'ONLINE';
  if (!resting && !available) return null;
  // `isOnline` pins the resting statuses — they show with the app closed too.
  return <StatusDot user={user} isOnline size={size} ring={ring} />;
}
