import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { useDeleteDocument, useTruckDocuments, useUploadDocuments } from '@/hooks/use-documents';
import { useTripsByTruck } from '@/hooks/use-trips';
import { DriverDocument } from '@/lib/documents-api';
import { fullName } from '@/lib/format';
import { formatDate } from '@/lib/format-date';

export function DocumentsTab({ truckId }: { truckId: string }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];

  const { data: docs = [], isLoading } = useTruckDocuments(truckId);
  const { data: trips = [] } = useTripsByTruck(truckId);
  const upload = useUploadDocuments();
  const deleteDoc = useDeleteDocument();

  const [search, setSearch] = useState('');
  const [tripFilter, setTripFilter] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [uploadPickOpen, setUploadPickOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (tripFilter !== 'all' && d.tripId !== tripFilter) return false;
      if (!q) return true;
      return (
        d.fileName.toLowerCase().includes(q) ||
        (d.trip?.orderNumber ?? '').toLowerCase().includes(q) ||
        d.createdAt.slice(0, 10).includes(q)
      );
    });
  }, [docs, search, tripFilter]);

  const filterLabel =
    tripFilter === 'all'
      ? t('truckPanel.documents.allTrips', { defaultValue: 'Усі рейси ({{count}})', count: docs.length })
      : (() => {
          const tr = trips.find((x) => x.id === tripFilter);
          return tr ? (tr.orderNumber ? `#${tr.orderNumber}` : tr.title) : t('truckPanel.documents.allTrips', 'Усі рейси');
        })();

  async function pickAndUpload(source: 'camera' | 'gallery' | 'document', tripId: string) {
    let files: { uri: string; name: string; mimeType: string }[] = [];
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (r.canceled) return;
        files = r.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg' }));
      } else if (source === 'gallery') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
        if (r.canceled) return;
        files = r.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg' }));
      } else {
        const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
        if (r.canceled) return;
        files = r.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream' }));
      }
      if (files.length === 0) return;
      setUploading(true);
      await upload.mutateAsync({ tripId, files });
    } catch (e) {
      Alert.alert(t('documents.uploadFailed', 'Помилка завантаження'), (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const attachSheet = (tripId: string) => {
    Alert.alert(t('trip.attachSheet.title', 'Вкладення'), t('documents.uploadSheet.subtitle', 'Оберіть джерело'), [
      { text: t('documents.uploadSheet.camera', 'Камера'), onPress: () => pickAndUpload('camera', tripId) },
      { text: t('documents.uploadSheet.gallery', 'Галерея'), onPress: () => pickAndUpload('gallery', tripId) },
      { text: t('documents.uploadSheet.file', 'Файл'), onPress: () => pickAndUpload('document', tripId) },
      { text: t('common.cancel', 'Скасувати'), style: 'cancel' },
    ]);
  };

  const startUpload = () => {
    if (trips.length === 0) {
      Alert.alert(t('truckPanel.documents.noTrips', 'Спершу створіть рейс'));
      return;
    }
    if (trips.length === 1) attachSheet(trips[0].id);
    else setUploadPickOpen(true);
  };

  const openDoc = async (doc: DriverDocument) => {
    if (doc.fileType === 'PHOTO') {
      setViewerUri(doc.signedUrl);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(doc.signedUrl);
    } catch (e) {
      Alert.alert(t('documents.cannotOpen', 'Не вдалося відкрити'), (e as Error).message);
    }
  };

  const confirmDelete = (doc: DriverDocument) => {
    Alert.alert(
      t('common.delete', 'Видалити'),
      doc.fileName,
      [
        { text: t('common.cancel', 'Скасувати'), style: 'cancel' },
        { text: t('common.delete', 'Видалити'), style: 'destructive', onPress: () => deleteDoc.mutate(doc.id) },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* Search + upload */}
      <View style={styles.topRow}>
        <View style={[styles.searchBox, { backgroundColor: c.muted }]}>
          <Ionicons name="search" size={15} color={c.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('truckPanel.documents.searchPlaceholder', 'Пошук: назва, дата, №…')}
            placeholderTextColor={c.mutedForeground}
            style={[styles.searchInput, { color: c.foreground }]}
            autoCapitalize="none"
          />
        </View>
        <Pressable onPress={startUpload} disabled={uploading} style={[styles.uploadBtn, { backgroundColor: c.primary, opacity: uploading ? 0.6 : 1 }]}>
          {uploading ? <ActivityIndicator size="small" color={c.primaryForeground} /> : <Ionicons name="cloud-upload-outline" size={18} color={c.primaryForeground} />}
        </Pressable>
      </View>

      {/* Trip filter */}
      <Pressable onPress={() => setFilterOpen(true)} style={[styles.filter, { borderColor: c.border }]}>
        <Ionicons name="funnel-outline" size={14} color={c.mutedForeground} />
        <Text style={[styles.filterText, { color: c.foreground }]} numberOfLines={1}>{filterLabel}</Text>
        <Ionicons name="chevron-down" size={14} color={c.mutedForeground} />
      </Pressable>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={34} color={c.mutedForeground} style={{ opacity: 0.4 }} />
          <Text style={{ color: c.mutedForeground, marginTop: Spacing.sm }}>{t('truckPanel.documents.noAttachments', 'Немає документів')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm }}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
              <Pressable onPress={() => openDoc(item)} style={styles.rowMain}>
                {item.fileType === 'PHOTO' ? (
                  <Image source={{ uri: item.signedUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.fileThumb, { backgroundColor: c.muted }]}>
                    <Ionicons name="document-text-outline" size={22} color={c.mutedForeground} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.fileName, { color: c.foreground }]} numberOfLines={1}>{item.fileName}</Text>
                  <Text style={[styles.fileMeta, { color: c.mutedForeground }]} numberOfLines={1}>
                    {[formatDate(item.createdAt), item.trip?.orderNumber ? `#${item.trip.orderNumber}` : null, fullName(item.uploader) || null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => confirmDelete(item)} hitSlop={8} style={styles.delBtn}>
                <Ionicons name="trash-outline" size={17} color={c.destructive} />
              </Pressable>
            </View>
          )}
        />
      )}

      {/* Trip filter modal */}
      <PickerModal
        visible={filterOpen}
        title={t('truckPanel.documents.filterTitle', 'Фільтр за рейсом')}
        onClose={() => setFilterOpen(false)}
        options={[
          { id: 'all', label: t('truckPanel.documents.allTrips', { defaultValue: 'Усі рейси ({{count}})', count: docs.length }) },
          ...trips.map((tr) => ({ id: tr.id, label: (tr.orderNumber ? `#${tr.orderNumber} · ` : '') + tr.title })),
        ]}
        selectedId={tripFilter}
        onSelect={(id) => { setTripFilter(id); setFilterOpen(false); }}
      />

      {/* Upload-target trip modal */}
      <PickerModal
        visible={uploadPickOpen}
        title={t('truckPanel.documents.uploadTo', 'Завантажити в рейс')}
        onClose={() => setUploadPickOpen(false)}
        options={trips.map((tr) => ({ id: tr.id, label: (tr.orderNumber ? `#${tr.orderNumber} · ` : '') + tr.title }))}
        selectedId={null}
        onSelect={(id) => { setUploadPickOpen(false); attachSheet(id); }}
      />

      {/* Photo viewer */}
      <PhotoViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}

function PickerModal({
  visible, title, options, selectedId, onSelect, onClose,
}: {
  visible: boolean; title: string; options: { id: string; label: string }[];
  selectedId: string | null; onSelect: (id: string) => void; onClose: () => void;
}) {
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

function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.viewerBackdrop} onPress={onClose}>
        {uri && <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />}
        <Pressable onPress={onClose} hitSlop={10} style={[styles.viewerClose, { top: insets.top + Spacing.md }]}>
          <Ionicons name="close" size={30} color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, height: 36, borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  uploadBtn: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 34 },
  filterText: { flex: 1, fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingRight: Spacing.sm },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, minWidth: 0 },
  thumb: { width: 44, height: 44, borderRadius: Radius.sm },
  fileThumb: { alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 13, fontWeight: '600' },
  fileMeta: { fontSize: 11, marginTop: 2 },
  delBtn: { padding: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.md },
  sheetTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, textAlign: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: Radius.sm },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', right: Spacing.lg },
});
