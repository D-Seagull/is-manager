import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  MyTruck,
  useCreateTruckNote,
  useDeleteTruckNote,
  useTruckNotes,
  useUpdateTruck,
} from '@/hooks/use-my-trucks';
import { useReassignTrip } from '@/hooks/use-trips';
import { fullName } from '@/lib/format';
import { formatDateTime } from '@/lib/format-date';
import { useUser } from '@/store/auth';

export function InfoTab({ truck, activeTripId }: { truck: MyTruck; activeTripId?: string | null }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const user = useUser();

  const { data: companyUsers = [] } = useCompanyUsers();
  const drivers = useMemo(() => companyUsers.filter((u) => u.role === 'DRIVER' && u.isActive), [companyUsers]);
  const managers = useMemo(() => companyUsers.filter((u) => (u.role === 'MANAGER' || u.role === 'TEAMLEAD') && u.isActive), [companyUsers]);

  const updateTruck = useUpdateTruck();
  const reassign = useReassignTrip(truck.id);
  const { data: notes = [], isLoading: notesLoading } = useTruckNotes(truck.id);
  const createNote = useCreateTruckNote(truck.id);
  const deleteNote = useDeleteTruckNote(truck.id);

  const [noteText, setNoteText] = useState('');
  const [picker, setPicker] = useState<'driver' | 'manager' | null>(null);

  const setDriver = (driverId: string | null) => {
    setPicker(null);
    updateTruck.mutate({ id: truck.id, data: { currentDriverId: driverId } });
    // Keep the active trip's driver in sync with the truck's driver.
    if (activeTripId && driverId) reassign.mutate({ id: activeTripId, driverId });
  };
  const setManager = (managerId: string | null) => {
    setPicker(null);
    updateTruck.mutate({ id: truck.id, data: { managerId } });
  };

  const addNote = () => {
    const v = noteText.trim();
    if (!v) return;
    createNote.mutate(v, { onSuccess: () => setNoteText('') });
  };
  const confirmDeleteNote = (id: string) => {
    Alert.alert(t('info.deleteNote', 'Видалити нотатку?'), undefined, [
      { text: t('common.cancel', 'Скасувати'), style: 'cancel' },
      { text: t('common.delete', 'Видалити'), style: 'destructive', onPress: () => deleteNote.mutate(id) },
    ]);
  };

  const driverName = fullName(truck.currentDriver) || t('info.noDriver', 'Без водія');
  const managerName = fullName(truck.manager) || t('info.noManager', 'Без менеджера');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }} keyboardShouldPersistTaps="handled">
      {/* Assignments */}
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Row label={t('info.driver', 'Водій')} c={c}>
          <Pressable onPress={() => setPicker('driver')} style={[styles.select, { borderColor: c.border }]}>
            <Ionicons name="person-outline" size={15} color={c.mutedForeground} />
            <Text style={{ flex: 1, color: truck.currentDriver ? c.foreground : c.mutedForeground, fontSize: 14 }} numberOfLines={1}>{driverName}</Text>
            <Ionicons name="chevron-down" size={15} color={c.mutedForeground} />
          </Pressable>
          {truck.currentDriver?.phone ? <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: 4 }}>{truck.currentDriver.phone}</Text> : null}
        </Row>
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        <Row label={t('info.manager', 'Менеджер')} c={c}>
          <Pressable onPress={() => setPicker('manager')} style={[styles.select, { borderColor: c.border }]}>
            <Ionicons name="headset-outline" size={15} color={c.mutedForeground} />
            <Text style={{ flex: 1, color: truck.manager ? c.foreground : c.mutedForeground, fontSize: 14 }} numberOfLines={1}>{managerName}</Text>
            <Ionicons name="chevron-down" size={15} color={c.mutedForeground} />
          </Pressable>
        </Row>
      </View>

      {/* Notes */}
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.notesLabel, { color: c.mutedForeground }]}>{t('info.notes', 'Нотатки')}</Text>
        <View style={styles.addRow}>
          <TextInput
            value={noteText}
            onChangeText={setNoteText}
            placeholder={t('info.addNotePlaceholder', 'Додати нотатку…')}
            placeholderTextColor={c.mutedForeground}
            multiline
            style={[styles.noteInput, { backgroundColor: c.background, borderColor: c.border, color: c.foreground }]}
          />
          <Pressable onPress={addNote} disabled={!noteText.trim() || createNote.isPending} style={[styles.addBtn, { backgroundColor: c.primary, opacity: !noteText.trim() || createNote.isPending ? 0.5 : 1 }]}>
            {createNote.isPending ? <ActivityIndicator size="small" color={c.primaryForeground} /> : <Ionicons name="add" size={20} color={c.primaryForeground} />}
          </Pressable>
        </View>

        {notesLoading ? (
          <ActivityIndicator color={c.mutedForeground} style={{ marginTop: Spacing.sm }} />
        ) : notes.length === 0 ? (
          <Text style={{ fontSize: 12, color: c.mutedForeground, marginTop: Spacing.sm }}>{t('info.noNotes', 'Нотаток немає')}</Text>
        ) : (
          <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
            {notes.map((n) => {
              const canDelete = n.user.id === user?.id;
              return (
                <View key={n.id} style={[styles.note, { borderTopColor: c.border }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, color: c.foreground }}>{n.content}</Text>
                    <Text style={{ fontSize: 11, color: c.mutedForeground, marginTop: 2 }}>
                      {[fullName(n.user), formatDateTime(n.createdAt, { dateStyle: 'short', timeStyle: 'short' })].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {canDelete && (
                    <Pressable onPress={() => confirmDeleteNote(n.id)} hitSlop={6} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={16} color={c.destructive} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Driver / manager picker */}
      <PickerModal
        visible={picker === 'driver'}
        title={t('info.driver', 'Водій')}
        onClose={() => setPicker(null)}
        selectedId={truck.currentDriver?.id ?? 'none'}
        options={[{ id: 'none', label: t('info.noDriver', 'Без водія') }, ...drivers.map((d) => ({ id: d.id, label: (fullName(d) || d.phone || d.id) + (d.currentTruck && d.currentTruck.id !== truck.id ? ` · ${d.currentTruck.plate}` : '') }))]}
        onSelect={(id) => setDriver(id === 'none' ? null : id)}
      />
      <PickerModal
        visible={picker === 'manager'}
        title={t('info.manager', 'Менеджер')}
        onClose={() => setPicker(null)}
        selectedId={truck.managerId ?? 'none'}
        options={[{ id: 'none', label: t('info.noManager', 'Без менеджера') }, ...managers.map((m) => ({ id: m.id, label: fullName(m) || m.phone || m.id }))]}
        onSelect={(id) => setManager(id === 'none' ? null : id)}
      />
    </ScrollView>
  );
}

function Row({ label, c, children }: { label: string; c: (typeof Colors)['light']; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: c.mutedForeground }]}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function PickerModal({ visible, title, options, selectedId, onSelect, onClose }: { visible: boolean; title: string; options: { id: string; label: string }[]; selectedId: string | null; onSelect: (id: string) => void; onClose: () => void }) {
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.card, paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing.lg }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.sheetTitle, { color: c.foreground }]}>{title}</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {options.map((o) => {
              const selected = o.id === selectedId;
              return (
                <Pressable key={o.id} onPress={() => onSelect(o.id)} style={({ pressed }) => [styles.sheetItem, { backgroundColor: selected || pressed ? c.muted : 'transparent' }]}>
                  <Text style={{ flex: 1, color: c.foreground, fontSize: 15 }} numberOfLines={1}>{o.label}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={c.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  rowLabel: { width: 72, fontSize: 13, paddingTop: 9 },
  select: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, height: 38 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
  notesLabel: { fontSize: 12, fontWeight: '700', marginBottom: Spacing.sm },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  noteInput: { flex: 1, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8, fontSize: 14, minHeight: 40, maxHeight: 100, textAlignVertical: 'top' },
  addBtn: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md },
  sheetTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: Radius.sm },
});
