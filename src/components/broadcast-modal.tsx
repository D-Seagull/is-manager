import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
import {
  useBroadcastTemplates,
  useBroadcastToMyTrucks,
  type BroadcastTemplate,
} from '@/hooks/use-broadcast';

/**
 * Compose + send a broadcast to the drivers of all the manager's trucks.
 * Mirrors the web BroadcastDialog: subject + message + reusable templates.
 */
export function BroadcastModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const broadcast = useBroadcastToMyTrucks();
  const tpl = useBroadcastTemplates();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      void tpl.load();
      setTemplatesOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const canSend = text.trim().length > 0 && !broadcast.isPending;

  async function handleSend() {
    if (!canSend) return;
    const content = title.trim() ? `${title.trim()}\n\n${text.trim()}` : text.trim();
    try {
      const res = await broadcast.mutateAsync(content);
      setTitle('');
      setText('');
      onClose();
      Alert.alert(
        t('broadcast.sentTitle', 'Надіслано'),
        t('broadcast.sentBody', { defaultValue: 'Повідомлення отримали {{count}} водіїв.', count: res.sent }),
      );
    } catch {
      Alert.alert(t('common.error', 'Помилка'), t('broadcast.sendError', 'Не вдалося надіслати розсилку.'));
    }
  }

  async function handleSaveTemplate() {
    if (!text.trim()) return;
    try {
      await tpl.save(title.trim() || t('broadcast.defaultTemplateName', 'Шаблон'), text.trim());
    } catch {
      Alert.alert(t('common.error', 'Помилка'), t('broadcast.templateError', 'Не вдалося зберегти шаблон.'));
    }
  }

  function applyTemplate(item: BroadcastTemplate) {
    setTitle(item.title);
    setText(item.content);
    setTemplatesOpen(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: c.card, borderBottomColor: c.border, paddingTop: insets.top + Spacing.xs }]}>
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={c.foreground} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Ionicons name="megaphone-outline" size={18} color={c.primary} />
            <Text style={[styles.headerText, { color: c.foreground }]}>
              {t('broadcast.title', 'Розсилка водіям')}
            </Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
            {t('broadcast.subtitle', 'Повідомлення отримають водії всіх ваших машин.')}
          </Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('broadcast.subjectPlaceholder', 'Тема (необов’язково)')}
            placeholderTextColor={c.mutedForeground}
            style={[styles.subject, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
          />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('broadcast.messagePlaceholder', 'Текст повідомлення…')}
            placeholderTextColor={c.mutedForeground}
            multiline
            style={[styles.message, { backgroundColor: c.card, borderColor: c.border, color: c.foreground }]}
          />

          {/* Templates */}
          <View style={styles.tplRow}>
            <Pressable
              onPress={() => setTemplatesOpen((v) => !v)}
              style={({ pressed }) => [styles.tplBtn, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="documents-outline" size={15} color={c.foreground} />
              <Text style={[styles.tplBtnText, { color: c.foreground }]}>
                {t('broadcast.templates', 'Шаблони')}
              </Text>
              <Ionicons name={templatesOpen ? 'chevron-up' : 'chevron-down'} size={14} color={c.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={handleSaveTemplate}
              disabled={!text.trim()}
              style={({ pressed }) => [styles.tplSave, { opacity: !text.trim() ? 0.4 : pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="bookmark-outline" size={15} color={c.primary} />
              <Text style={[styles.tplSaveText, { color: c.primary }]}>
                {t('broadcast.saveTemplate', 'Зберегти шаблон')}
              </Text>
            </Pressable>
          </View>

          {templatesOpen && (
            <View style={[styles.tplList, { borderColor: c.border }]}>
              {tpl.loading ? (
                <View style={{ padding: Spacing.md, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={c.mutedForeground} />
                </View>
              ) : tpl.templates.length === 0 ? (
                <Text style={[styles.tplEmpty, { color: c.mutedForeground }]}>
                  {t('broadcast.noTemplates', 'Немає збережених шаблонів')}
                </Text>
              ) : (
                tpl.templates.map((item) => (
                  <View key={item.id} style={[styles.tplItem, { borderTopColor: c.border }]}>
                    <Pressable style={{ flex: 1 }} onPress={() => applyTemplate(item)}>
                      <Text style={[styles.tplItemTitle, { color: c.foreground }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[styles.tplItemBody, { color: c.mutedForeground }]} numberOfLines={1}>
                        {item.content}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => tpl.remove(item.id)} hitSlop={8} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={16} color={c.destructive} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>

        {/* Send */}
        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [styles.sendBtn, { backgroundColor: c.primary, opacity: canSend ? (pressed ? 0.85 : 1) : 0.45 }]}
          >
            {broadcast.isPending ? (
              <ActivityIndicator color={c.primaryForeground} />
            ) : (
              <>
                <Ionicons name="megaphone-outline" size={18} color={c.primaryForeground} />
                <Text style={[styles.sendText, { color: c.primaryForeground }]}>
                  {t('broadcast.sendButton', 'Надіслати')}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerText: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  subject: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    fontWeight: '600',
  },
  message: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  tplRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tplBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  tplBtnText: { fontSize: 13, fontWeight: '600' },
  tplSave: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', paddingVertical: 8 },
  tplSaveText: { fontSize: 13, fontWeight: '600' },
  tplList: { borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  tplEmpty: { fontSize: 13, padding: Spacing.md, textAlign: 'center' },
  tplItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tplItemTitle: { fontSize: 14, fontWeight: '600' },
  tplItemBody: { fontSize: 12, marginTop: 1 },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radius.md,
  },
  sendText: { fontSize: 15, fontWeight: '700' },
});
