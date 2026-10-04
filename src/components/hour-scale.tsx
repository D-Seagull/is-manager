import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Working hours a loading / unloading window usually falls in.
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6 … 20

const hourOf = (hhmm: string) => {
  const h = Number(hhmm.split(':')[0]);
  return hhmm && Number.isFinite(h) ? h : null;
};
const toHHmm = (h: number) => `${String(h).padStart(2, '0')}:00`;

/**
 * One row of hours (same behaviour as the web form): the first tap sets the
 * start, the second the end, and the range between them lights up. A tap at
 * or before the start begins a new range. Minutes go through the time chips.
 */
export function HourScale({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const c = Colors[useColorScheme() ?? 'light'];
  // Which end the next tap sets.
  const [next, setNext] = useState<'start' | 'end'>('start');
  const s = hourOf(start);
  const e = hourOf(end);
  const hasRange = s !== null && e !== null && e > s;

  const pick = (h: number) => {
    if (next === 'start' || s === null || h <= s) {
      onChange(toHHmm(h), e !== null && e > h ? end : '');
      setNext('end');
    } else {
      onChange(start, toHHmm(h));
      setNext('start');
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { borderColor: c.border }]}
      keyboardShouldPersistTaps="handled"
    >
      {HOURS.map((h) => {
        const isEdge = h === s || (hasRange && h === e);
        const inRange = hasRange && h > s! && h < e!;
        return (
          <Pressable
            key={h}
            onPress={() => pick(h)}
            hitSlop={4}
            style={[
              styles.cell,
              { borderColor: c.border },
              isEdge && { backgroundColor: c.primary },
              inRange && { backgroundColor: c.primary + '26' },
            ]}
          >
            <Text
              style={[
                styles.text,
                { color: isEdge ? c.primaryForeground : inRange ? c.foreground : c.mutedForeground },
                isEdge && { fontWeight: '700' },
              ]}
            >
              {h}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.sm, overflow: 'hidden' },
  cell: { width: 30, paddingVertical: 7, alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth },
  text: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
