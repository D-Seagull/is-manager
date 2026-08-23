import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
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
import { fullName } from '@/lib/format';
import { Trip } from '@/lib/types';

const LOAD_COLOR = '#10B981';
const UNLOAD_COLOR = '#EF4444';

type StopRowData = {
  address: string;
  ref: string;
  coords: string;
  windowDate: string;
  windowStart: string;
  windowEnd: string;
};
const emptyStop = (): StopRowData => ({ address: '', ref: '', coords: '', windowDate: '', windowStart: '', windowEnd: '' });

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
  const [loadingStops, setLoadingStops] = useState<StopRowData[]>([emptyStop()]);
  const [unloadingStops, setUnloadingStops] = useState<StopRowData[]>([emptyStop()]);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<{ list: 'load' | 'unload'; idx: number; kind: 'date' | 'start' | 'end' } | null>(null);

  // (Re)seed state when opening.
  useEffect(() => {
    if (!visible) return;
    if (trip) {
      setDriverId(trip.driver?.id ?? '');
      setTripName(trip.title ?? '');
      setOrderNumber(trip.orderNumber ?? '');
      setNotes(trip.notes ?? '');
      const toRow = (s: Trip['stops'][number]): StopRowData => ({
        address: s.address ?? '', ref: s.ref ?? '', coords: s.coords ?? '',
        windowDate: s.windowDate ?? '', windowStart: s.windowStart ?? '', windowEnd: s.windowEnd ?? '',
      });
      const load = trip.stops.filter((s) => s.type === 'LOADING').map(toRow);
      const unload = trip.stops.filter((s) => s.type === 'UNLOADING').map(toRow);
      setLoadingStops(load.length ? load : [emptyStop()]);
      setUnloadingStops(unload.length ? unload : [emptyStop()]);
    } else {
      setDriverId(defaultDriverId ?? '');
      setTripName('');
      setOrderNumber('');
      setNotes('');
      setLoadingStops([emptyStop()]);
      setUnloadingStops([emptyStop()]);
    }
  }, [visible, trip, defaultDriverId]);

  const driverName = fullName(drivers.find((d) => d.id === driverId)) || '';

  const setStop = (list: 'load' | 'unload', idx: number, patch: Partial<StopRowData>) => {
    const setter = list === 'load' ? setLoadingStops : setUnloadingStops;
    setter((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const addStop = (list: 'load' | 'unload') => {
    const setter = list === 'load' ? setLoadingStops : setUnloadingStops;
    setter((prev) => [...prev, emptyStop()]);
  };
  const removeStop = (list: 'load' | 'unload', idx: number) => {
    const setter = list === 'load' ? setLoadingStops : setUnloadingStops;
    setter((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const buildStops = (): StopFormData[] => [
    ...loadingStops.map((s, i) => ({
      type: 'LOADING' as const, order: i,
      address: s.address || undefined, ref: s.ref || undefined, coords: s.coords || undefined,
      windowDate: s.windowDate || undefined, windowStart: s.windowStart || undefined, windowEnd: s.windowEnd || undefined,
    })),
    ...unloadingStops.map((s, i) => ({
      type: 'UNLOADING' as const, order: i,
      address: s.address || undefined, ref: s.ref || undefined, coords: s.coords || undefined,
      windowDate: s.windowDate || undefined, windowStart: s.windowStart || undefined, windowEnd: s.windowEnd || undefined,
    })),
  ];

  const handleSave = async () => {
    if (!driverId) {
      Alert.alert(t('truckPanel.newTrip.selectDriver', 'Оберіть водія'));
      return;
    }
    setSaving(true);
    try {
      const stops = buildStops();
      let result: Trip;
      if (isEdit && trip) {
        result = await updateInfo.mutateAsync({
          id: trip.id,
          notes: notes || null,
          orderNumber: orderNumber || null,
          stops,
        });
        if (trip.driver?.id !== driverId) {
          result = await reassign.mutateAsync({ id: trip.id, driverId });
        }
      } else {
        const title = tripName.trim() || t('truckPanel.newTrip.tripFallbackName', 'Новий рейс');
        result = await createTrip.mutateAsync({
          title, driverId, truckId,
          notes: notes || undefined, orderNumber: orderNumber || undefined, stops,
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
    if (cur.kind === 'date') setStop(cur.list, cur.idx, { windowDate: fmtDate(date) });
    else if (cur.kind === 'start') setStop(cur.list, cur.idx, { windowStart: fmtTime(date) });
    else setStop(cur.list, cur.idx, { windowEnd: fmtTime(date) });
  };

  const pickerValue = () => {
    if (!picker) return new Date();
    const s = (picker.list === 'load' ? loadingStops : unloadingStops)[picker.idx];
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

          {/* Trip name (create only — title is derived server-side on edit) */}
          {!isEdit && (
            <Field label={t('truckPanel.newTrip.tripNameLabel', 'Назва рейсу')} c={c}>
              <TextInput value={tripName} onChangeText={setTripName} placeholder={t('truckPanel.newTrip.tripNamePlaceholder', 'Напр. Львів → Краків')} placeholderTextColor={c.mutedForeground} style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
            </Field>
          )}

          {/* Order number */}
          <Field label={t('truckPanel.newTrip.orderLabel', '№ замовлення')} c={c}>
            <TextInput value={orderNumber} onChangeText={setOrderNumber} placeholder="#" placeholderTextColor={c.mutedForeground} style={[styles.input, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
          </Field>

          {/* Loading stops */}
          <StopsSection
            title={t('trip.stops.loading', 'Завантаження')} color={LOAD_COLOR} c={c} list="load"
            stops={loadingStops} setStop={setStop} addStop={addStop} removeStop={removeStop} openPicker={setPicker} t={t}
          />
          {/* Unloading stops */}
          <StopsSection
            title={t('trip.stops.unloading', 'Розвантаження')} color={UNLOAD_COLOR} c={c} list="unload"
            stops={unloadingStops} setStop={setStop} addStop={addStop} removeStop={removeStop} openPicker={setPicker} t={t}
          />

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

function StopsSection({
  title, color, c, list, stops, setStop, addStop, removeStop, openPicker, t,
}: {
  title: string; color: string; c: (typeof Colors)['light']; list: 'load' | 'unload';
  stops: StopRowData[];
  setStop: (l: 'load' | 'unload', i: number, p: Partial<StopRowData>) => void;
  addStop: (l: 'load' | 'unload') => void;
  removeStop: (l: 'load' | 'unload', i: number) => void;
  openPicker: (p: { list: 'load' | 'unload'; idx: number; kind: 'date' | 'start' | 'end' }) => void;
  t: TFunction;
}) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.sectionHead}>
        <Ionicons name={list === 'load' ? 'ellipse-outline' : 'location'} size={14} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      </View>
      {stops.map((s, i) => (
        <View key={i} style={[styles.stopCard, { backgroundColor: `${color}14`, borderColor: `${color}40` }]}>
          <View style={styles.stopTop}>
            <Text style={[styles.stopNum, { color }]}>{i + 1}</Text>
            {stops.length > 1 && (
              <Pressable onPress={() => removeStop(list, i)} hitSlop={8} style={{ padding: 2 }}>
                <Ionicons name="trash-outline" size={16} color={c.destructive} />
              </Pressable>
            )}
          </View>
          <TextInput value={s.address} onChangeText={(v) => setStop(list, i, { address: v })} placeholder={t('stopRow.address', 'Адреса')} placeholderTextColor={c.mutedForeground} multiline style={[styles.stopInput, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
          <View style={styles.stopRowInputs}>
            <TextInput value={s.ref} onChangeText={(v) => setStop(list, i, { ref: v })} placeholder="ref #" placeholderTextColor={c.mutedForeground} style={[styles.stopInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
            <TextInput value={s.coords} onChangeText={(v) => setStop(list, i, { coords: v })} placeholder={t('stopRow.coords', 'Коорд.')} placeholderTextColor={c.mutedForeground} style={[styles.stopInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.foreground }]} />
          </View>
          <View style={styles.stopRowInputs}>
            <DateChip label={s.windowDate || t('stopRow.date', 'Дата')} onPress={() => openPicker({ list, idx: i, kind: 'date' })} c={c} filled={!!s.windowDate} />
            <DateChip label={s.windowStart || t('stopRow.from', 'з')} onPress={() => openPicker({ list, idx: i, kind: 'start' })} c={c} filled={!!s.windowStart} />
            <DateChip label={s.windowEnd || t('stopRow.to', 'до')} onPress={() => openPicker({ list, idx: i, kind: 'end' })} c={c} filled={!!s.windowEnd} />
          </View>
        </View>
      ))}
      <Pressable onPress={() => addStop(list)} style={({ pressed }) => [styles.addStop, { borderColor: color, opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons name="add" size={16} color={color} />
        <Text style={[styles.addStopText, { color }]}>{t('truckPanel.newTrip.addStop', 'Додати стоп')}</Text>
      </Pressable>
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
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  stopCard: { borderWidth: 1, borderRadius: 12, padding: Spacing.sm, gap: Spacing.sm },
  stopTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stopNum: { fontSize: 13, fontWeight: '700' },
  stopInput: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 7, fontSize: 14 },
  stopRowInputs: { flexDirection: 'row', gap: Spacing.sm },
  dateChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 8 },
  addStop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.md, paddingVertical: 9 },
  addStopText: { fontSize: 13, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md },
  sheetTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: Radius.sm },
});
