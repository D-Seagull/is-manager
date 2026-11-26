import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  // eslint-disable-next-line no-restricted-imports -- height-capped picker inside a sheet
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { bottomBarPadding } from '@/lib/insets';
import { CallSheet } from '@/components/call-sheet';
import { InsetScrollView } from '@/components/inset-list';
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

  // Driver picker: free drivers first, then drivers already on a truck (plate
  // as a hint; this truck's own driver heads that section). Mirrors the web
  // PersonPicker (is-fleet-frontend/src/components/person-picker.tsx).
  const driverSections = useMemo<PickerSection[]>(() => {
    const byName = (a: PickerOption, b: PickerOption) => a.label.localeCompare(b.label);
    const free: PickerOption[] = [];
    const busy: (PickerOption & { own: boolean })[] = [];
    for (const d of drivers) {
      const opt = { id: d.id, label: fullName(d) || d.phone || d.id, searchText: d.phone ?? '' };
      if (d.currentTruck) busy.push({ ...opt, hint: d.currentTruck.plate, own: d.currentTruck.id === truck.id });
      else free.push(opt);
    }
    busy.sort((a, b) => Number(b.own) - Number(a.own) || byName(a, b));
    return [
      { title: t('info.freeDrivers', 'Вільні водії'), options: free.sort(byName) },
      { title: t('info.driversOnTrucks', 'На вантажівках'), options: busy },
    ];
  }, [drivers, truck.id, t]);
  const managerSections = useMemo<PickerSection[]>(
    () => [{ options: managers.map((m) => ({ id: m.id, label: fullName(m) || m.phone || m.id, searchText: m.phone ?? '' })) }],
    [managers],
  );

  const updateTruck = useUpdateTruck();
  const reassign = useReassignTrip(truck.id);
  const { data: notes = [], isLoading: notesLoading } = useTruckNotes(truck.id);
  const createNote = useCreateTruckNote(truck.id);
  const deleteNote = useDeleteTruckNote(truck.id);

  const [callOpen, setCallOpen] = useState(false);
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
    <InsetScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }} keyboardShouldPersistTaps="handled">
      {/* Assignments */}
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Row label={t('info.driver', 'Водій')} c={c}>
          <Pressable onPress={() => setPicker('driver')} style={[styles.select, { borderColor: c.border }]}>
            <Ionicons name="person-outline" size={15} color={c.mutedForeground} />
            <Text style={{ flex: 1, color: truck.currentDriver ? c.foreground : c.mutedForeground, fontSize: 14 }} numberOfLines={1}>{driverName}</Text>
            <Ionicons name="chevron-down" size={15} color={c.mutedForeground} />
          </Pressable>
          {truck.currentDriver?.phone ? (
            <>
              <Pressable onPress={() => setCallOpen(true)} hitSlop={8} style={styles.phoneRow}>
                <Ionicons name="call-outline" size={14} color={c.primary} />
                <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>{truck.currentDriver.phone}</Text>
              </Pressable>
              <CallSheet
                visible={callOpen}
                phone={truck.currentDriver.phone}
                name={fullName(truck.currentDriver)}
                onClose={() => setCallOpen(false)}
              />
            </>
          ) : null}
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
              // Anyone in the company can delete a truck note, not just its author.
              const canDelete = !!user;
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
        selectedId={truck.currentDriver?.id ?? null}
        noneLabel={t('info.noDriver', 'Без водія')}
        sections={driverSections}
        onSelect={setDriver}
      />
      <PickerModal
        visible={picker === 'manager'}
        title={t('info.manager', 'Менеджер')}
        onClose={() => setPicker(null)}
        selectedId={truck.managerId ?? null}
        noneLabel={t('info.noManager', 'Без менеджера')}
        sections={managerSections}
        onSelect={setManager}
      />
    </InsetScrollView>
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

type PickerOption = { id: string; label: string; hint?: string; searchText?: string };
type PickerSection = { title?: string; options: PickerOption[] };

// Bottom-sheet single-select with a search box (name / phone / plate) and
// optional section headers. `selectedId === null` = the "none" row.
function PickerModal({ visible, title, noneLabel, sections, selectedId, onSelect, onClose }: { visible: boolean; title: string; noneLabel: string; sections: PickerSection[]; selectedId: string | null; onSelect: (id: string | null) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      sections
        .map((s) => ({
          ...s,
          options: q ? s.options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.searchText ?? ''}`.toLowerCase().includes(q)) : s.options,
        }))
        .filter((s) => s.options.length > 0),
    [sections, q],
  );
  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (id: string | null) => {
    setQuery('');
    onSelect(id);
  };
  const renderRow = (id: string | null, label: string, hint?: string, muted?: boolean) => {
    const selected = id === selectedId;
    return (
      <Pressable key={id ?? '__none__'} onPress={() => pick(id)} style={({ pressed }) => [styles.sheetItem, { backgroundColor: selected || pressed ? c.muted : 'transparent' }]}>
        <Text style={{ flex: 1, color: muted ? c.mutedForeground : c.foreground, fontSize: 15 }} numberOfLines={1}>{label}</Text>
        {hint ? <Text style={{ color: c.mutedForeground, fontSize: 13, marginLeft: Spacing.sm }} numberOfLines={1}>{hint}</Text> : null}
        <Ionicons name="checkmark" size={20} color={c.primary} style={{ marginLeft: Spacing.sm, opacity: selected ? 1 : 0 }} />
      </Pressable>
    );
  };
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card, paddingBottom: bottomBarPadding(insets, Spacing.sm) + Spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.foreground }]}>{title}</Text>
            <View style={[styles.searchBox, { borderColor: c.border, backgroundColor: c.background }]}>
              <Ionicons name="search-outline" size={16} color={c.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('common.search', 'Пошук…')}
                placeholderTextColor={c.mutedForeground}
                style={[styles.searchInput, { color: c.foreground }]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={c.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              {!q && renderRow(null, noneLabel, undefined, true)}
              {filtered.map((s, si) => (
                <View key={s.title ?? si}>
                  {s.title ? <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>{s.title}</Text> : null}
                  {s.options.map((o) => renderRow(o.id, o.label, o.hint))}
                </View>
              ))}
              {q && filtered.length === 0 ? (
                <Text style={{ color: c.mutedForeground, textAlign: 'center', paddingVertical: Spacing.lg }}>{t('common.noMatches', 'Нічого не знайдено')}</Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, alignSelf: 'flex-start' },
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
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, height: 40, marginBottom: Spacing.sm },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: Radius.sm },
});
