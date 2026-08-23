import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Alarm,
  AlarmRecurrence,
  useAlarmsByTruck,
  useCreateAlarm,
  useDeleteAlarm,
  useUpdateAlarm,
} from '@/hooks/use-alarms';
import { formatDateTime } from '@/lib/format-date';
import { fullName } from '@/lib/format';
import { MyTruck } from '@/hooks/use-my-trucks';
import { useUser } from '@/store/auth';

const QUICK_OFFSETS = [5, 15, 30, 60, 120];
const pad = (n: number) => String(n).padStart(2, '0');
const toWallClock = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const offsetDate = (min: number) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + min, 0, 0);
  return d;
};

export function AlarmTab({ truck, activeTripId }: { truck: MyTruck; activeTripId?: string | null }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const user = useUser();

  const { data: alarms = [], isLoading } = useAlarmsByTruck(truck.id);
  const createAlarm = useCreateAlarm(truck.id);
  const updateAlarm = useUpdateAlarm(truck.id);
  const deleteAlarm = useDeleteAlarm(truck.id);

  const [showForm, setShowForm] = useState(false);
  const [target, setTarget] = useState<'self' | 'driver'>('self');
  const [title, setTitle] = useState(truck.plate ?? '');
  const [note, setNote] = useState('');
  const [time, setTime] = useState<Date>(() => offsetDate(15));
  const [recurrence, setRecurrence] = useState<AlarmRecurrence>('NONE');
  const [linkToTrip, setLinkToTrip] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  const reset = () => {
    setTitle(truck.plate ?? '');
    setNote('');
    setTime(offsetDate(15));
    setRecurrence('NONE');
    setTarget('self');
    setLinkToTrip(false);
  };

  const recOptions: { key: AlarmRecurrence; label: string }[] = useMemo(
    () => [
      { key: 'NONE', label: t('alarm.recurrence.NONE', 'Без') },
      { key: 'DAILY', label: t('alarm.recurrence.DAILY', 'Щодня') },
      { key: 'WEEKLY', label: t('alarm.recurrence.WEEKLY', 'Щотижня') },
    ],
    [t],
  );

  const onPickerChange = (_: unknown, d?: Date) => {
    const mode = pickerMode;
    setPickerMode(null);
    if (!d || !mode) return;
    if (mode === 'date') {
      const next = new Date(time);
      next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      setTime(next);
      setPickerMode('time');
    } else {
      const next = new Date(time);
      next.setHours(d.getHours(), d.getMinutes(), 0, 0);
      setTime(next);
    }
  };

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    let targetUserId: string | undefined;
    if (target === 'self') targetUserId = user.id;
    else {
      targetUserId = truck.currentDriver?.id;
      if (!targetUserId) {
        Alert.alert(t('alarm.noDriverAlert', 'У машини немає водія'));
        return;
      }
    }
    if (!targetUserId) return;
    try {
      await createAlarm.mutateAsync({
        targetUserId,
        title: title.trim(),
        note: note.trim() || undefined,
        time: toWallClock(time),
        recurrence,
        tripId: linkToTrip && activeTripId ? activeTripId : undefined,
      });
      reset();
      setShowForm(false);
    } catch (e) {
      Alert.alert(t('common.error', 'Помилка'), (e as Error).message);
    }
  };

  const reuse = (a: Alarm) => {
    Alert.alert(t('alarm.restartIn', 'Перезапустити через'), undefined, [
      ...QUICK_OFFSETS.map((m) => ({
        text: t(`alarm.offsets.off${m}`, `${m} хв`),
        onPress: () => updateAlarm.mutate({ id: a.id, patch: { time: offsetDate(m).toISOString() } }),
      })),
      { text: t('common.cancel', 'Скасувати'), style: 'cancel' as const },
    ]);
  };

  const confirmDelete = (a: Alarm) => {
    Alert.alert(t('alarm.deleteConfirm', 'Видалити будильник?'), a.title, [
      { text: t('common.cancel', 'Скасувати'), style: 'cancel' },
      { text: t('common.delete', 'Видалити'), style: 'destructive', onPress: () => deleteAlarm.mutate(a.id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="alarm-outline" size={18} color={c.foreground} />
          <Text style={[styles.headerTitle, { color: c.foreground }]}>{t('alarm.title', 'Будильники')}</Text>
          <Text style={{ color: c.mutedForeground }}>({alarms.length})</Text>
        </View>
        <Pressable onPress={() => setShowForm((v) => !v)} style={[styles.newBtn, { backgroundColor: showForm ? c.muted : c.primary }]}>
          <Ionicons name={showForm ? 'close' : 'add'} size={16} color={showForm ? c.foreground : c.primaryForeground} />
          <Text style={[styles.newText, { color: showForm ? c.foreground : c.primaryForeground }]}>
            {showForm ? t('common.cancel', 'Скасувати') : t('alarm.new', 'Новий')}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }} keyboardShouldPersistTaps="handled">
        {showForm && (
          <View style={[styles.form, { backgroundColor: c.card, borderColor: c.border }]}>
            {/* Target */}
            <Segmented
              c={c}
              value={target}
              onChange={(v) => setTarget(v as 'self' | 'driver')}
              options={[
                { key: 'self', label: t('alarm.self', 'Собі') },
                { key: 'driver', label: fullName(truck.currentDriver) || t('alarm.driverNone', 'Водій'), disabled: !truck.currentDriver },
              ]}
            />
            {/* Recurrence */}
            <Segmented c={c} value={recurrence} onChange={(v) => setRecurrence(v as AlarmRecurrence)} options={recOptions} />

            <TextInput value={title} onChangeText={setTitle} placeholder={t('alarm.titlePlaceholder', 'Заголовок')} placeholderTextColor={c.mutedForeground} maxLength={120} style={[styles.input, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]} />
            <TextInput value={note} onChangeText={setNote} placeholder={t('alarm.notePlaceholder', 'Нотатка (необов’язково)')} placeholderTextColor={c.mutedForeground} multiline maxLength={500} style={[styles.input, { minHeight: 56, textAlignVertical: 'top', backgroundColor: c.background, borderColor: c.border, color: c.foreground }]} />

            {/* Time */}
            <Pressable onPress={() => setPickerMode('date')} style={[styles.input, styles.timeRow, { backgroundColor: c.background, borderColor: c.border }]}>
              <Ionicons name="time-outline" size={16} color={c.mutedForeground} />
              <Text style={{ flex: 1, color: c.foreground, fontSize: 14 }}>{formatDateTime(time, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
              <Ionicons name="chevron-forward" size={15} color={c.mutedForeground} />
            </Pressable>
            <View style={styles.chips}>
              {QUICK_OFFSETS.map((m) => (
                <Pressable key={m} onPress={() => setTime(offsetDate(m))} style={[styles.chip, { borderColor: c.border }]}>
                  <Text style={{ fontSize: 11, color: c.foreground }}>+{t(`alarm.offsets.off${m}`, `${m}хв`)}</Text>
                </Pressable>
              ))}
            </View>

            {activeTripId ? (
              <View style={styles.linkRow}>
                <Switch value={linkToTrip} onValueChange={setLinkToTrip} />
                <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{t('alarm.linkToTrip', 'Прив’язати до активного рейсу')}</Text>
              </View>
            ) : null}

            <Pressable onPress={handleCreate} disabled={createAlarm.isPending || !title.trim()} style={[styles.createBtn, { backgroundColor: c.primary, opacity: !title.trim() || createAlarm.isPending ? 0.5 : 1 }]}>
              {createAlarm.isPending ? <ActivityIndicator color={c.primaryForeground} /> : <Text style={[styles.createText, { color: c.primaryForeground }]}>{t('alarm.create', 'Створити')}</Text>}
            </Pressable>
          </View>
        )}

        {isLoading ? (
          <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}><ActivityIndicator color={c.primary} /></View>
        ) : alarms.length === 0 ? (
          <Text style={{ color: c.mutedForeground, textAlign: 'center', paddingVertical: Spacing.xl }}>{t('alarm.empty', 'Будильників немає')}</Text>
        ) : (
          alarms.map((a) => {
            const isMine = a.targetUserId === user?.id;
            const canEdit = user?.id === a.createdById;
            const canDelete = canEdit || isMine;
            const passed = a.isSent || new Date(a.time).getTime() < Date.now();
            return (
              <View key={a.id} style={[styles.alarmRow, { backgroundColor: c.card, borderColor: c.border, opacity: passed ? 0.5 : 1 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.alarmTitleRow}>
                    {isMine && (
                      <View style={[styles.mePill, { backgroundColor: `${c.primary}22` }]}>
                        <Text style={{ fontSize: 9, color: c.primary, fontWeight: '700' }}>{t('alarm.toMe', 'Мені')}</Text>
                      </View>
                    )}
                    <Text style={[styles.alarmTitle, { color: c.foreground }]} numberOfLines={1}>{a.title}</Text>
                  </View>
                  {a.note ? <Text style={{ fontSize: 12, color: c.mutedForeground }} numberOfLines={1}>{a.note}</Text> : null}
                  <View style={styles.alarmMeta}>
                    <Ionicons name="time-outline" size={11} color={c.mutedForeground} />
                    <Text style={{ fontSize: 11, color: c.mutedForeground }}>{formatDateTime(a.time, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                    {a.recurrence !== 'NONE' && (
                      <>
                        <Ionicons name="repeat" size={11} color={c.mutedForeground} />
                        <Text style={{ fontSize: 11, color: c.mutedForeground }}>{t(`alarm.recurrence.${a.recurrence}`, a.recurrence)}</Text>
                      </>
                    )}
                    {!isMine && <Text style={{ fontSize: 11, color: c.mutedForeground }}>· {fullName(a.target) || '—'}</Text>}
                  </View>
                </View>
                {canEdit && (
                  <Pressable onPress={() => reuse(a)} hitSlop={6} style={styles.alarmAct}>
                    <Ionicons name="repeat" size={16} color={c.mutedForeground} />
                  </Pressable>
                )}
                {canDelete && (
                  <Pressable onPress={() => confirmDelete(a)} hitSlop={6} style={styles.alarmAct}>
                    <Ionicons name="trash-outline" size={16} color={c.destructive} />
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {pickerMode && (
        <DateTimePicker value={time} mode={pickerMode} is24Hour onChange={onPickerChange} />
      )}
    </View>
  );
}

function Segmented({ c, value, onChange, options }: { c: (typeof Colors)['light']; value: string; onChange: (v: string) => void; options: { key: string; label: string; disabled?: boolean }[] }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} disabled={o.disabled} onPress={() => onChange(o.key)} style={[styles.segBtn, { borderColor: c.border, backgroundColor: active ? c.primary : 'transparent', opacity: o.disabled ? 0.4 : 1 }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: active ? c.primaryForeground : c.foreground }} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 32, borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  newText: { fontSize: 13, fontWeight: '700' },
  form: { borderWidth: 1, borderRadius: 12, padding: Spacing.md, gap: Spacing.sm },
  segment: { flexDirection: 'row', gap: 6 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 8, paddingHorizontal: 4 },
  input: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 9, fontSize: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 9, paddingVertical: 5 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  createBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: Radius.md },
  createText: { fontSize: 14, fontWeight: '700' },
  alarmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: Spacing.sm + 2 },
  alarmTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mePill: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  alarmTitle: { fontSize: 13, fontWeight: '600', flex: 1 },
  alarmMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  alarmAct: { padding: 4 },
});
