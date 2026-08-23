import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompanyUsers } from '@/hooks/use-company-users';
import {
  StopFormData,
  useCreateTrip,
  useReassignTrip,
  useUpdateTripInfo,
} from '@/hooks/use-trips';
import { deriveTripTitle, fullName } from '@/lib/format';
import { StopType, Trip } from '@/lib/types';

const STOP_COLOR: Record<StopType, string> = {
  LOADING: '#10B981',
  UNLOADING: '#EF4444',
  WAYPOINT: '#F59E0B',
};
const STOP_ICON: Record<StopType, keyof typeof Ionicons.glyphMap> = {
  LOADING: 'ellipse-outline',
  UNLOADING: 'location',
  WAYPOINT: 'flag-outline',
};
const STOP_TYPES: StopType[] = ['LOADING', 'UNLOADING', 'WAYPOINT'];
const WAYPOINT_PRESETS = ['customs', 'parking', 'fuel'] as const;

type StopRowData = {
  type: StopType;
  name: string;
  address: string;
  ref: string;
  coords: string;
  windowDate: string;
  windowStart: string;
  windowEnd: string;
};
const emptyStop = (type: StopType = 'LOADING'): StopRowData => ({
  type,
  name: '',
  address: '',
  ref: '',
  coords: '',
  windowDate: '',
  windowStart: '',
  windowEnd: '',
});

const stopTypeLabel = (type: StopType, t: TFunction) => {
  if (type === 'LOADING') return t('trip.stops.loading', 'Завантаження');
  if (type === 'UNLOADING') return t('trip.stops.unloading', 'Розвантаження');
  return t('trip.stops.waypoint', 'Додаткова зупинка');
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseDate = (s: string) => (s ? new Date(`${s}T00:00:00`) : new Date());
const parseTime = (s: string) => {
  const d = new Date();
  if (s) {
    const [h, m] = s.split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  return d;
};

export function TripForm({
  truckId,
  trip,
  defaultDriverId,
  visible,
  onClose,
  onSaved,
}: {
  truckId: string;
  trip?: Trip | null;
  defaultDriverId?: string | null;
  visible: boolean;
  onClose: () => void;
  onSaved?: (trip: Trip) => void;
}) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const isEdit = !!trip;

  const { data: companyUsers } = useCompanyUsers();
  const drivers = useMemo(
    () => (companyUsers ?? []).filter((u) => u.role === 'DRIVER' && u.isActive),
    [companyUsers],
  );

  const createTrip = useCreateTrip();
  const updateInfo = useUpdateTripInfo(truckId);
  const reassign = useReassignTrip(truckId);

  const [driverId, setDriverId] = useState('');
  const [tripName, setTripName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [stops, setStops] = useState<StopRowData[]>([emptyStop('LOADING'), emptyStop('UNLOADING')]);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<{ idx: number; kind: 'date' | 'start' | 'end' } | null>(null);
  const [typeMenu, setTypeMenu] = useState<{ mode: 'insert' | 'change'; idx: number } | null>(null);
  // назва редагована вручну → не перезаписуємо автоматично з адрес
  const isNameEdited = useRef(false);

  // (Re)seed state when opening.
  useEffect(() => {
    if (!visible) return;
    if (trip) {
      setDriverId(trip.driver?.id ?? '');
      setOrderNumber(trip.orderNumber ?? '');
      setNotes(trip.notes ?? '');
      const toRow = (s: Trip['stops'][number]): StopRowData => ({
        type: s.type,
        name: s.name ?? '',
        address: s.address ?? '', ref: s.ref ?? '', coords: s.coords ?? '',
        windowDate: s.windowDate ?? '', windowStart: s.windowStart ?? '', windowEnd: s.windowEnd ?? '',
      });
      // stops приходять із бекенду вже відсортовані за order (єдиний маршрут).
      const rows = (trip.stops ?? []).map(toRow);
      const seeded = rows.length ? rows : [emptyStop('LOADING'), emptyStop('UNLOADING')];
      setStops(seeded);
      setTripName(trip.title ?? '');
      // якщо назва збігається з автогенерованою — вважаємо авто (оновлюємо з адрес),
      // інакше це ручна назва — зберігаємо як є.
      isNameEdited.current = !!trip.title && trip.title !== deriveTripTitle(seeded);
    } else {
      setDriverId(defaultDriverId ?? '');
      setTripName('');
      setOrderNumber('');
      setNotes('');
      setStops([emptyStop('LOADING'), emptyStop('UNLOADING')]);
      isNameEdited.current = false;
    }
  }, [visible, trip, defaultDriverId]);

  // автозаповнення назви з адрес поки користувач не редагував її вручну
  useEffect(() => {
    if (!visible || isNameEdited.current) return;
    setTripName(deriveTripTitle(stops));
  }, [stops, visible]);

  const driverName = fullName(drivers.find((d) => d.id === driverId)) || '';

  const setStop = (idx: number, patch: Partial<StopRowData>) => {
    setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const insertStop = (idx: number, type: StopType) => {
    setStops((prev) => {
      const next = [...prev];
      next.splice(idx, 0, emptyStop(type));
      return next;
    });
  };
  const removeStop = (idx: number) => {
    setStops((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };
  const moveStop = (idx: number, dir: -1 | 1) => {
    setStops((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const buildStops = (): StopFormData[] =>
    stops.map((s, i) => ({
      type: s.type,
      order: i,
      name: s.type === 'WAYPOINT' ? s.name || undefined : undefined,
      address: s.address || undefined, ref: s.ref || undefined, coords: s.coords || undefined,
      windowDate: s.windowDate || undefined, windowStart: s.windowStart || undefined, windowEnd: s.windowEnd || undefined,
    }));

  const handleSave = async () => {
    if (!driverId) {
      Alert.alert(t('truckPanel.newTrip.selectDriver', 'Оберіть водія'));
      return;
    }
    setSaving(true);
    try {
      const built = buildStops();
      let result: Trip;
      if (isEdit && trip) {
        result = await updateInfo.mutateAsync({
          id: trip.id,
          title: tripName.trim() || undefined,
          notes: notes || null,
          orderNumber: orderNumber || null,
          stops: built,
        });
        if (trip.driver?.id !== driverId) {
          result = await reassign.mutateAsync({ id: trip.id, driverId });
        }
      } else {
        const title = tripName.trim() || t('truckPanel.newTrip.tripFallbackName', 'Новий рейс');
        result = await createTrip.mutateAsync({
          title, driverId, truckId,
          notes: notes || undefined, orderNumber: orderNumber || undefined, stops: built,
        });
      }
      onClose();
      onSaved?.(result);
    } catch (e) {
      Alert.alert(t('common.error', 'Помилка'), (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onPickerChange = (_: unknown, date?: Date) => {
    const cur = picker;
    setPicker(null);
    if (!date || !cur) return;
    if (cur.kind === 'date') setStop(cur.idx, { windowDate: fmtDate(date) });
    else if (cur.kind === 'start') setStop(cur.idx, { windowStart: fmtTime(date) });
    else setStop(cur.idx, { windowEnd: fmtTime(date) });
  };

  const pickerValue = () => {
    if (!picker) return new Date();
    const s = stops[picker.idx];
    if (!s) return new Date();
    if (picker.kind === 'date') return parseDate(s.windowDate);
    if (picker.kind === 'start') return parseTime(s.windowStart);
    return parseTime(s.windowEnd);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + Spacing.xs }]}>
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={c.foreground} />
          </Pressable>
          <Text style={[styles.headerText, { color: c.foreground }]}>
            {isEdit ? t('truckPanel.newTrip.editTitle', 'Редагувати рейс') : t('truckPanel.newTrip.title', 'Новий рейс')}
          </Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={10} style={{ padding: 4 }}>
            {saving ? <ActivityIndicator color={c.primary} /> : <Text style={[styles.save, { color: c.primary }]}>{t('common.save', 'Зберегти')}</Text>}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + Spacing.xl, gap: Spacing.lg }} keyboardShouldPersistTaps="handled">
          {/* Driver */}
          <Field label={t('truckPanel.newTrip.driverLabel', 'Водій')} c={c}>
            <Pressable onPress={() => setDriverPickerOpen(true)} style={[styles.input, styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="person-outline" size={16} color={c.mutedForeground} />
              <Text style={{ flex: 1, color: driverName ? c.foreground : c.mutedForeground, fontSize: 15 }}>
                {driverName || t('truckPanel.newTrip.selectDriver', 'Оберіть водія')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={c.mutedForeground} />
            </Pressable>
          </Field>

          {/* Trip name — автозаповнення з адрес, можна редагувати вручну */}
          <Field label={t('truckPanel.newTrip.tripNameLabel', 'Назва рейсу')} c={c}>
            <TextInput
              value={tripName}
              onChangeText={(v) => { isNameEdited.current = true; setTripName(v); }}
              placeholder={t('truckPanel.newTrip.tripNamePlaceholder', 'Напр. Львів → Краків')}
              placeholderTextColor={c.mutedForeground}
              style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
            />
          </Field>

          {/* Order number */}
          <Field label={t('truckPanel.newTrip.orderLabel', '№ замовлення')} c={c}>
            <TextInput value={orderNumber} onChangeText={setOrderNumber} placeholder="#" placeholderTextColor={c.mutedForeground} style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
          </Field>

          {/* Route — упорядкований список стопів; «+» вставляє між пунктами */}
          <View style={{ gap: Spacing.sm }}>
            <Text style={[styles.label, { color: c.mutedForeground }]}>{t('trip.stops.route', 'Маршрут')}</Text>
            {stops.map((s, i) => (
              <View key={i} style={{ gap: Spacing.sm }}>
                <InsertRow c={c} onPress={() => setTypeMenu({ mode: 'insert', idx: i })} />
                <StopCard
                  c={c} t={t}
                  stop={s} index={i} count={stops.length}
                  setStop={setStop} removeStop={removeStop} moveStop={moveStop}
                  openPicker={(kind) => setPicker({ idx: i, kind })}
                  onChangeType={() => setTypeMenu({ mode: 'change', idx: i })}
                />
              </View>
            ))}
            <InsertRow c={c} onPress={() => setTypeMenu({ mode: 'insert', idx: stops.length })} />
          </View>

          {/* Notes */}
          <Field label={t('truckPanel.newTrip.notesLabel', 'Нотатки')} c={c}>
            <TextInput value={notes} onChangeText={setNotes} placeholder="…" placeholderTextColor={c.mutedForeground} multiline style={[styles.input, { minHeight: 70, textAlignVertical: 'top', backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Driver picker */}
      <Modal transparent visible={driverPickerOpen} animationType="fade" onRequestClose={() => setDriverPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDriverPickerOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card, paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>{t('truckPanel.newTrip.selectDriver', 'Оберіть водія')}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {drivers.map((d) => {
                const selected = d.id === driverId;
                return (
                  <Pressable key={d.id} onPress={() => { setDriverId(d.id); setDriverPickerOpen(false); }} style={({ pressed }) => [styles.sheetItem, { backgroundColor: selected || pressed ? c.muted : 'transparent' }]}>
                    <Text style={{ flex: 1, color: c.foreground, fontSize: 15 }}>{fullName(d) || d.phone || d.id}</Text>
                    {selected && <Ionicons name="checkmark" size={20} color={c.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Stop-type picker (insert new / change existing) */}
      <Modal transparent visible={typeMenu !== null} animationType="fade" onRequestClose={() => setTypeMenu(null)}>
        <Pressable style={styles.backdrop} onPress={() => setTypeMenu(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card, paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>
              {typeMenu?.mode === 'change' ? t('stopRow.changeType', 'Змінити тип') : t('truckPanel.newTrip.addStop', 'Додати стоп')}
            </Text>
            {STOP_TYPES.map((tp) => (
              <Pressable
                key={tp}
                onPress={() => {
                  if (typeMenu) {
                    if (typeMenu.mode === 'insert') insertStop(typeMenu.idx, tp);
                    else setStop(typeMenu.idx, { type: tp });
                  }
                  setTypeMenu(null);
                }}
                style={({ pressed }) => [styles.sheetItem, { backgroundColor: pressed ? c.muted : 'transparent' }]}
              >
                <Ionicons name={STOP_ICON[tp]} size={18} color={STOP_COLOR[tp]} />
                <Text style={{ flex: 1, color: c.foreground, fontSize: 15 }}>{stopTypeLabel(tp, t)}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {picker && (
        <DateTimePicker
          value={pickerValue()}
          mode={picker.kind === 'date' ? 'date' : 'time'}
          is24Hour
          onChange={onPickerChange}
        />
      )}
    </Modal>
  );
}

function Field({ label, c, children }: { label: string; c: (typeof Colors)['light']; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text style={[styles.label, { color: c.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

function InsertRow({ c, onPress }: { c: (typeof Colors)['light']; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.insertRow}>
      <View style={[styles.insertLine, { backgroundColor: c.border }]} />
      <View style={[styles.insertBtn, { borderColor: c.border, backgroundColor: c.card }]}>
        <Ionicons name="add" size={16} color={c.mutedForeground} />
      </View>
      <View style={[styles.insertLine, { backgroundColor: c.border }]} />
    </Pressable>
  );
}

function StopCard({
  c, t, stop, index, count, setStop, removeStop, moveStop, openPicker, onChangeType,
}: {
  c: (typeof Colors)['light']; t: TFunction;
  stop: StopRowData; index: number; count: number;
  setStop: (i: number, p: Partial<StopRowData>) => void;
  removeStop: (i: number) => void;
  moveStop: (i: number, dir: -1 | 1) => void;
  openPicker: (kind: 'date' | 'start' | 'end') => void;
  onChangeType: () => void;
}) {
  const color = STOP_COLOR[stop.type];
  const label = stop.type === 'WAYPOINT' ? stop.name || stopTypeLabel('WAYPOINT', t) : stopTypeLabel(stop.type, t);
  return (
    <View style={[styles.stopCard, { backgroundColor: `${color}14`, borderColor: `${color}40` }]}>
      {/* Header: type label (tap to change type) + reorder + delete */}
      <View style={styles.stopTop}>
        <Pressable onPress={onChangeType} hitSlop={6} style={styles.stopHeaderLabel}>
          <Ionicons name={STOP_ICON[stop.type]} size={14} color={color} />
          <Text style={{ fontSize: 12, fontWeight: '700', color }} numberOfLines={1}>
            {index + 1}. {label}
          </Text>
          <Ionicons name="chevron-down" size={13} color={color} style={{ opacity: 0.6 }} />
        </Pressable>
        <View style={styles.stopActions}>
          <Pressable onPress={() => moveStop(index, -1)} disabled={index === 0} hitSlop={6} style={{ padding: 2, opacity: index === 0 ? 0.3 : 1 }}>
            <Ionicons name="chevron-up" size={18} color={c.mutedForeground} />
          </Pressable>
          <Pressable onPress={() => moveStop(index, 1)} disabled={index === count - 1} hitSlop={6} style={{ padding: 2, opacity: index === count - 1 ? 0.3 : 1 }}>
            <Ionicons name="chevron-down" size={18} color={c.mutedForeground} />
          </Pressable>
          {count > 1 && (
            <Pressable onPress={() => removeStop(index)} hitSlop={6} style={{ padding: 2 }}>
              <Ionicons name="trash-outline" size={16} color={c.destructive} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Waypoint name + presets */}
      {stop.type === 'WAYPOINT' && (
        <View style={{ gap: Spacing.xs }}>
          <TextInput
            value={stop.name}
            onChangeText={(v) => setStop(index, { name: v })}
            placeholder={t('stopRow.name', 'Назва точки (напр. Кастомс)')}
            placeholderTextColor={c.mutedForeground}
            style={[styles.stopInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
          />
          <View style={styles.presetRow}>
            {WAYPOINT_PRESETS.map((key) => {
              const label = t(`trip.waypointPreset.${key}`, key === 'customs' ? 'Кастомс' : key === 'parking' ? 'Паркінг' : 'Заправка');
              return (
                <Pressable key={key} onPress={() => setStop(index, { name: label })} style={[styles.presetChip, { borderColor: c.border, backgroundColor: c.card }]}>
                  <Text style={{ fontSize: 12, color: c.foreground }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <TextInput value={stop.address} onChangeText={(v) => setStop(index, { address: v })} placeholder={t('stopRow.address', 'Адреса')} placeholderTextColor={c.mutedForeground} multiline style={[styles.stopInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
      <View style={styles.stopRowInputs}>
        <TextInput value={stop.ref} onChangeText={(v) => setStop(index, { ref: v })} placeholder="ref #" placeholderTextColor={c.mutedForeground} style={[styles.stopInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
        <TextInput value={stop.coords} onChangeText={(v) => setStop(index, { coords: v })} placeholder={t('stopRow.coords', 'Коорд.')} placeholderTextColor={c.mutedForeground} style={[styles.stopInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
      </View>
      <View style={styles.stopRowInputs}>
        <DateChip label={stop.windowDate || t('stopRow.date', 'Дата')} onPress={() => openPicker('date')} c={c} filled={!!stop.windowDate} />
        <DateChip label={stop.windowStart || t('stopRow.from', 'з')} onPress={() => openPicker('start')} c={c} filled={!!stop.windowStart} />
        <DateChip label={stop.windowEnd || t('stopRow.to', 'до')} onPress={() => openPicker('end')} c={c} filled={!!stop.windowEnd} />
      </View>
    </View>
  );
}

function DateChip({ label, onPress, c, filled }: { label: string; onPress: () => void; c: (typeof Colors)['light']; filled: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.dateChip, { backgroundColor: c.card, borderColor: c.border }]}>
      <Ionicons name="time-outline" size={13} color={c.mutedForeground} />
      <Text style={{ fontSize: 12, color: filled ? c.foreground : c.mutedForeground }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { fontSize: 16, fontWeight: '700' },
  save: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stopCard: { borderWidth: 1, borderRadius: 12, padding: Spacing.sm, gap: Spacing.sm },
  stopTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  stopHeaderLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stopInput: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 7, fontSize: 14 },
  stopRowInputs: { flexDirection: 'row', gap: Spacing.sm },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  dateChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 8 },
  insertRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 2 },
  insertLine: { flex: 1, height: StyleSheet.hairlineWidth },
  insertBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md },
  sheetTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: Radius.sm },
});
