import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useParseOrder } from '@/hooks/use-order-import';
import { compressPhotos, PICKER_QUALITY } from '@/lib/compress-photo';
import { readableFileName } from '@/lib/open-file';
import {
  screenshotName,
  serverMessage,
  type OrderDraft,
  type OrderLocalFile,
  type OrderSourceInput,
} from '@/lib/order-import';

type C = (typeof Colors)['light'];

/** A copied screenshot / photo from the clipboard, saved as a JPEG in the cache. */
async function clipboardImage(): Promise<OrderLocalFile | null> {
  if (!(await Clipboard.hasImageAsync())) return null;
  const img = await Clipboard.getImageAsync({ format: 'jpeg', jpegQuality: 0.85 });
  if (!img?.data) return null;
  const base64 = img.data.replace(/^data:[^,]*,/, '');
  const name = screenshotName();
  const file = new File(Paths.cache, `order-${name}`);
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });
  return { uri: file.uri, name, mimeType: 'image/jpeg' };
}

/**
 * "Fill from order" on the phone: camera (paper order), gallery, a file
 * (PDF / Word / Excel), or paste — a copied screenshot or the order's text.
 * Locked until a driver is picked: the notes come back in their language.
 */
export function OrderImportBox({
  c,
  driverId,
  onDraft,
}: {
  c: C;
  driverId?: string;
  onDraft: (draft: OrderDraft, source: OrderSourceInput) => void;
}) {
  const { t, i18n } = useTranslation();
  const parse = useParseOrder();
  const [textOpen, setTextOpen] = useState(false);
  const [text, setText] = useState('');
  const noDriver = !driverId;

  async function run(source: OrderSourceInput) {
    try {
      const draft = await parse.mutateAsync({
        ...('file' in source ? { file: source.file } : { text: source.text }),
        locale: i18n.language,
        driverId: driverId || undefined,
      });
      onDraft(draft, source);
      setTextOpen(false);
      setText('');
    } catch (e) {
      Alert.alert(
        t('orderImport.failed', 'Не вдалося прочитати заявку'),
        serverMessage(e) ?? undefined,
      );
    }
  }

  async function pick(kind: 'camera' | 'gallery' | 'file' | 'paste') {
    try {
      if (kind === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const r = await ImagePicker.launchCameraAsync({ quality: PICKER_QUALITY });
        if (r.canceled) return;
        const [file] = await compressPhotos(r.assets.slice(0, 1));
        if (file) await run({ file });
      } else if (kind === 'gallery') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: PICKER_QUALITY });
        if (r.canceled) return;
        const [file] = await compressPhotos(r.assets.slice(0, 1));
        if (file) await run({ file });
      } else if (kind === 'file') {
        const r = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          type: [
            'application/pdf',
            'image/*',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
          ],
        });
        if (r.canceled || !r.assets[0]) return;
        const a = r.assets[0];
        await run({
          file: { uri: a.uri, name: readableFileName(a.name), mimeType: a.mimeType ?? 'application/octet-stream' },
        });
      } else {
        // A copied screenshot first; otherwise the copied text of the order.
        const image = await clipboardImage();
        if (image) {
          await run({ file: image });
          return;
        }
        const copied = (await Clipboard.getStringAsync()).trim();
        if (copied) {
          setText(copied);
          setTextOpen(true);
        } else {
          Alert.alert(t('orderImport.clipboardEmpty', 'У буфері немає ні картинки, ні тексту'));
        }
      }
    } catch (e) {
      Alert.alert(t('orderImport.failed', 'Не вдалося прочитати заявку'), serverMessage(e) ?? undefined);
    }
  }

  if (parse.isPending) {
    return (
      <View style={[styles.box, { borderColor: `${c.primary}66`, backgroundColor: `${c.primary}0D` }]}>
        <View style={styles.row}>
          <ActivityIndicator color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: c.foreground }]}>{t('orderImport.reading', 'Читаю заявку…')}</Text>
            <Text style={[styles.hint, { color: c.mutedForeground }]}>
              {t('orderImport.readingHint', 'Зазвичай це займає до хвилини')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const buttons: { kind: 'camera' | 'gallery' | 'file' | 'paste'; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { kind: 'camera', icon: 'camera-outline', label: t('orderImport.camera', 'Камера') },
    { kind: 'gallery', icon: 'images-outline', label: t('orderImport.gallery', 'Галерея') },
    { kind: 'file', icon: 'document-text-outline', label: t('orderImport.file', 'Файл') },
    { kind: 'paste', icon: 'clipboard-outline', label: t('orderImport.paste', 'Вставити') },
  ];

  return (
    <View style={[styles.box, { borderColor: c.border }]}>
      <View style={styles.row}>
        <Ionicons name="sparkles-outline" size={20} color={c.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.foreground }]}>{t('orderImport.title', 'Заповнити з заявки')}</Text>
          <Text style={[styles.hint, { color: noDriver ? '#B45309' : c.mutedForeground }]}>
            {noDriver
              ? t('orderImport.pickDriverFirst', 'Спершу виберіть водія: нотатки будуть його мовою')
              : t('orderImport.hint', 'Фото, скрін, PDF, Word, Excel або текст з листа')}
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        {buttons.map((b) => (
          <Pressable
            key={b.kind}
            disabled={noDriver}
            onPress={() => void pick(b.kind)}
            style={({ pressed }) => [
              styles.button,
              { borderColor: c.border, backgroundColor: pressed ? c.muted : c.card, opacity: noDriver ? 0.4 : 1 },
            ]}
          >
            <Ionicons name={b.icon} size={18} color={c.primary} />
            <Text style={{ fontSize: 12, color: c.foreground }} numberOfLines={1}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable disabled={noDriver} onPress={() => setTextOpen(true)} hitSlop={6}>
        <Text style={[styles.link, { color: c.primary, opacity: noDriver ? 0.4 : 1 }]}>
          {t('orderImport.typeText', 'Вставити текст заявки вручну')}
        </Text>
      </Pressable>

      <Modal visible={textOpen} transparent animationType="fade" onRequestClose={() => setTextOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setTextOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.title, { color: c.foreground }]}>{t('orderImport.textTitle', 'Текст заявки')}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              placeholder={t('orderImport.pastePlaceholder', 'Вставте текст заявки з листа…')}
              placeholderTextColor={c.mutedForeground}
              style={[styles.textArea, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]}
            />
            <Pressable
              disabled={!text.trim()}
              onPress={() => void run({ text: text.trim() })}
              style={[styles.primaryBtn, { backgroundColor: c.primary, opacity: text.trim() ? 1 : 0.4 }]}
            >
              <Text style={{ color: c.primaryForeground ?? '#fff', fontWeight: '700' }}>{t('orderImport.readText', 'Розпізнати')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const IMG = /^image\/(png|jpe?g|webp|gif)$/i;

/** Shown once a draft is in the form: source, warnings, open / another order. */
export function OrderDraftNotice({
  c,
  source,
  warnings,
  onReset,
}: {
  c: C;
  source: OrderSourceInput;
  warnings: string[];
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [viewing, setViewing] = useState(false);
  const file = 'file' in source ? source.file : null;
  const name = file ? file.name : t('orderImport.pastedText', 'вставленого тексту');

  const open = async () => {
    if (!file) {
      setViewing(true);
      return;
    }
    if (IMG.test(file.mimeType)) {
      setViewing(true);
      return;
    }
    // PDF / Word / Excel: hand the local copy to the system viewer.
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: file.mimeType, dialogTitle: file.name });
    }
  };

  return (
    <View style={[styles.notice, { backgroundColor: `${c.primary}0D` }]}>
      <View style={styles.row}>
        <Ionicons name="sparkles-outline" size={16} color={c.primary} />
        <Text style={{ flex: 1, color: c.foreground, fontSize: 13 }}>
          {t('orderImport.filledFrom', 'Заповнено з «{{name}}»', { name })}
          <Text style={{ color: c.mutedForeground }}> · {t('orderImport.checkBeforeCreate', 'перевірте дані перед створенням')}</Text>
        </Text>
      </View>
      {warnings.map((w, i) => (
        <View key={i} style={styles.row}>
          <Ionicons name="warning-outline" size={15} color="#B45309" />
          <Text style={{ flex: 1, color: '#B45309', fontSize: 13 }}>{w}</Text>
        </View>
      ))}
      <View style={[styles.row, { justifyContent: 'flex-end' }]}>
        <Pressable onPress={() => void open()} hitSlop={6}>
          <Text style={[styles.link, { color: c.primary }]}>{t('orderImport.openOrder', 'Відкрити заявку')}</Text>
        </Pressable>
        <Pressable onPress={onReset} hitSlop={6}>
          <Text style={[styles.link, { color: c.mutedForeground }]}>{t('orderImport.otherOrder', 'Інша заявка')}</Text>
        </Pressable>
      </View>

      <Modal visible={viewing} animationType="fade" onRequestClose={() => setViewing(false)}>
        <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
          <Pressable onPress={() => setViewing(false)} hitSlop={10} style={{ alignSelf: 'flex-end', padding: Spacing.md }}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          {file ? (
            <Image source={{ uri: file.uri }} style={{ flex: 1 }} contentFit="contain" />
          ) : (
            <Text style={{ color: '#fff', padding: Spacing.md }} selectable>
              {'text' in source ? source.text : ''}
            </Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

/** A stop the model was unsure about: why (and on which PDF page). */
export function StopReviewNote({
  c,
  note,
  page,
  onDismiss,
}: {
  c: C;
  note: string | null;
  page: number | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.review, { backgroundColor: '#F59E0B1F' }]}>
      <Ionicons name="warning-outline" size={14} color="#B45309" />
      <Text style={{ flex: 1, fontSize: 12, color: '#92400E' }}>
        {note || t('orderImport.reviewStop', 'Перевірте цю точку')}
        {page ? ` · ${t('orderImport.page', 'стор. {{page}}', { page })}` : ''}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={14} color="#92400E" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 12, marginTop: 2 },
  buttons: { flexDirection: 'row', gap: Spacing.xs },
  button: { flex: 1, alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 10 },
  link: { fontSize: 13, fontWeight: '600', paddingVertical: 2 },
  notice: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  review: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.md },
  sheet: { borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  textArea: { borderWidth: 1, borderRadius: Radius.sm, minHeight: 180, maxHeight: 360, padding: Spacing.sm, textAlignVertical: 'top', fontSize: 14 },
  primaryBtn: { borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
});
