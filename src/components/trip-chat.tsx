import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmojiPicker from 'rn-emoji-keyboard';

import { ChatBackground } from '@/components/chat-background';
import { MessageActionsSheet, type MessageActions } from '@/components/message-actions-sheet';
import { MessageQuote } from '@/components/message-quote';
import { MessageReactionsCluster } from '@/components/message-reactions';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { TripHeader } from '@/components/trip-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTripDocuments, useUploadDocuments } from '@/hooks/use-documents';
import { useTrip } from '@/hooks/use-trip';
import { ChatMessage, useTripChat } from '@/hooks/use-trip-chat';
import { DriverDocument } from '@/lib/documents-api';
import { fullName } from '@/lib/format';
import { formatTime } from '@/lib/format-date';
import { useUser } from '@/store/auth';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

type ReplyTarget = {
  id: string;
  targetType: 'msg' | 'doc';
  senderName: string | null;
  content: string;
  isDeleted: boolean;
};
type EditingState = { id: string; original: string };
type TimelineItem =
  | { kind: 'msg'; data: ChatMessage; ts: number }
  | { kind: 'doc'; data: DriverDocument; ts: number };

export function TripChat({ tripId, isFocused }: { tripId: string | null; isFocused: boolean }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const me = useUser();
  const myId = me?.id ?? '';

  const nearBottomRef = useRef(true);
  const chat = useTripChat(tripId, { isFocused, nearBottomRef });
  const { data: trip } = useTrip(tripId);
  const { data: documents = [] } = useTripDocuments(tripId);

  // Писати в тріп-чат може лише ПОТОЧНИЙ менеджер/водій рейсу. Якщо менеджера
  // змінили — цей чат стає лише для перегляду (як у вебі: isActiveParticipant).
  const isActiveParticipant = !!trip && (trip.manager?.id === myId || trip.driver?.id === myId);
  const uploadDocs = useUploadDocuments();

  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<ChatMessage | null>(null);
  const [docSheetFor, setDocSheetFor] = useState<DriverDocument | null>(null);

  const data = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...chat.messages.map((m) => ({ kind: 'msg' as const, data: m, ts: new Date(m.createdAt).getTime() })),
      ...documents.map((d) => ({ kind: 'doc' as const, data: d, ts: new Date(d.createdAt).getTime() })),
    ];
    return items.sort((a, b) => b.ts - a.ts);
  }, [chat.messages, documents]);

  if (!tripId) {
    return (
      <ScreenPlaceholder
        icon="chatbubbles-outline"
        title={t('tripChat.noTrip.title', 'Немає активного рейсу')}
        subtitle={t('tripChat.noTrip.subtitle', 'Чат з’явиться, коли машині призначать рейс.')}
      />
    );
  }

  const pickAndUpload = async (source: 'camera' | 'gallery' | 'document') => {
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
      await uploadDocs.mutateAsync({ tripId, files });
    } catch (e) {
      Alert.alert(t('documents.uploadFailed', 'Помилка завантаження'), (e as Error).message);
    }
  };

  const showAttachSheet = () => {
    Alert.alert(t('trip.attachSheet.title', 'Вкладення'), t('documents.uploadSheet.subtitle', 'Оберіть джерело'), [
      { text: t('documents.uploadSheet.camera', 'Камера'), onPress: () => pickAndUpload('camera') },
      { text: t('documents.uploadSheet.gallery', 'Галерея'), onPress: () => pickAndUpload('gallery') },
      { text: t('documents.uploadSheet.file', 'Файл'), onPress: () => pickAndUpload('document') },
      { text: t('common.cancel', 'Скасувати'), style: 'cancel' },
    ]);
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

  const handleSend = () => {
    if (!isActiveParticipant) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (editing) {
      if (trimmed !== editing.original.trim()) void chat.editMessage(editing.id, trimmed);
      setEditing(null);
      setText('');
      return;
    }
    chat.sendMessage(trimmed, {
      replyToId: replyingTo?.targetType === 'msg' ? replyingTo.id : null,
      replyToDocumentId: replyingTo?.targetType === 'doc' ? replyingTo.id : null,
    });
    setText('');
    setReplyingTo(null);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Inverted list → newest sits at offset 0; "near bottom" = small offset.
    const nb = e.nativeEvent.contentOffset.y < 80;
    if (nb !== nearBottomRef.current) nearBottomRef.current = nb;
    if (nb) chat.markReadNow();
  };

  const typing = [...chat.typers.values()];

  return (
    <View style={styles.root}>
      <ChatBackground />
      <TripHeader tripId={tripId} />
      {chat.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => `${it.kind}:${it.data.id}`}
          inverted
          contentContainerStyle={{ paddingVertical: Spacing.sm }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={onScroll}
          scrollEventThrottle={80}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (chat.hasMore && !chat.loadingOlder) void chat.loadOlder();
          }}
          ListFooterComponent={
            chat.loadingOlder ? (
              <View style={{ paddingVertical: Spacing.md }}>
                <ActivityIndicator size="small" color={c.mutedForeground} />
              </View>
            ) : null
          }
          renderItem={({ item }) =>
            item.kind === 'msg' ? (
              <MsgBubble
                msg={item.data}
                isOwn={item.data.senderId === myId}
                myId={myId}
                onLongPress={() => setSheetFor(item.data)}
              />
            ) : (
              <DocBubble
                doc={item.data}
                isOwn={item.data.uploadedBy === myId}
                onOpen={() => openDoc(item.data)}
                onLongPress={() => setDocSheetFor(item.data)}
              />
            )
          }
        />
      )}

      {typing.length > 0 && (
        <Text style={[styles.typing, { color: c.mutedForeground }]}>
          {t('chat.typing', { defaultValue: '{{name}} друкує…', name: typing[0] })}
        </Text>
      )}

      {replyingTo && !editing && <Banner kind="reply" target={replyingTo} onCancel={() => setReplyingTo(null)} />}
      {editing && (
        <Banner
          kind="edit"
          target={{ id: editing.id, targetType: 'msg', senderName: fullName(me) || null, content: editing.original, isDeleted: false }}
          onCancel={() => {
            setEditing(null);
            setText('');
          }}
        />
      )}

      {trip && !isActiveParticipant ? (
        <View style={[styles.inactiveBar, { paddingBottom: Math.max(insets.bottom, Spacing.sm), borderTopColor: c.border }]}>
          <Ionicons name="lock-closed-outline" size={15} color={c.mutedForeground} />
          <Text style={{ color: c.mutedForeground, fontSize: 13, flex: 1 }}>
            {t('tripChat.inactive', 'Ви більше не менеджер цього рейсу — чат лише для перегляду')}
          </Text>
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
          {!editing && (
            <Pressable onPress={showAttachSheet} disabled={uploadDocs.isPending} hitSlop={6} style={({ pressed }) => [styles.iconBtn, { opacity: pressed || uploadDocs.isPending ? 0.5 : 1 }]}>
              {uploadDocs.isPending ? <ActivityIndicator size="small" color={c.mutedForeground} /> : <Ionicons name="attach" size={24} color={c.mutedForeground} />}
            </Pressable>
          )}
          <Pressable onPress={() => { Keyboard.dismiss(); setEmojiOpen(true); }} hitSlop={6} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="happy-outline" size={24} color={c.mutedForeground} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={(v) => { setText(v); chat.notifyTyping(); }}
            onBlur={() => chat.notifyStopTyping()}
            placeholder={editing ? t('chat.editPlaceholder', 'Редагувати…') : t('chat.messagePlaceholder', 'Повідомлення…')}
            placeholderTextColor={c.mutedForeground}
            style={[styles.input, { color: c.foreground, backgroundColor: c.muted }]}
            multiline
          />
          <Pressable onPress={handleSend} disabled={!text.trim()} style={({ pressed }) => [styles.sendBtn, { backgroundColor: c.primary, opacity: pressed ? 0.7 : text.trim() ? 1 : 0.4 }]}>
            <Ionicons name={editing ? 'checkmark' : 'send'} size={18} color={c.primaryForeground} />
          </Pressable>
        </View>
      )}

      <EmojiPicker open={emojiOpen} onClose={() => setEmojiOpen(false)} onEmojiSelected={(e) => setText((prev) => prev + e.emoji)} />

      <MessageActionsSheet
        visible={!!sheetFor}
        onClose={() => setSheetFor(null)}
        actions={buildActions({
          msg: sheetFor,
          isOwn: sheetFor?.senderId === myId,
          onReply: (m) => { setReplyingTo({ id: m.id, targetType: 'msg', senderName: fullName(m.sender) || null, content: m.content, isDeleted: !!m.deletedAt }); setEditing(null); },
          onCopy: (m) => Clipboard.setStringAsync(m.content),
          onEdit: (m) => { setEditing({ id: m.id, original: m.content }); setText(m.content); setReplyingTo(null); },
          onDelete: (m) => chat.deleteMessage(m.id),
        })}
      />

      <MessageActionsSheet
        visible={!!docSheetFor}
        onClose={() => setDocSheetFor(null)}
        actions={{
          onReply: docSheetFor ? () => { const d = docSheetFor; setReplyingTo({ id: d.id, targetType: 'doc', senderName: fullName(d.uploader) || null, content: d.fileName, isDeleted: false }); setEditing(null); } : undefined,
          onDelete: docSheetFor && docSheetFor.uploadedBy === myId ? () => chat.removeDocument(docSheetFor.id) : undefined,
        }}
      />

      <Modal visible={!!viewerUri} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUri(null)}>
          {viewerUri && <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />}
          <Pressable onPress={() => setViewerUri(null)} hitSlop={10} style={[styles.viewerClose, { top: insets.top + Spacing.md }]}>
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function buildActions(opts: {
  msg: ChatMessage | null;
  isOwn: boolean;
  onReply: (m: ChatMessage) => void;
  onCopy: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
}): MessageActions {
  const m = opts.msg;
  if (!m) return { onCopy: () => {} };
  const isDeleted = !!m.deletedAt;
  const canEdit = opts.isOwn && !isDeleted && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS;
  return {
    onCopy: () => opts.onCopy(m),
    onReply: isDeleted ? undefined : () => opts.onReply(m),
    onEdit: canEdit ? () => opts.onEdit(m) : undefined,
    onDelete: opts.isOwn && !isDeleted ? () => opts.onDelete(m) : undefined,
  };
}

function Banner({ kind, target, onCancel }: { kind: 'reply' | 'edit'; target: ReplyTarget; onCancel: () => void }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  return (
    <View style={[styles.banner, { backgroundColor: c.card, borderTopColor: c.border }]}>
      <View style={[styles.bannerQuote, { borderLeftColor: c.primary, backgroundColor: `${c.primary}14` }]}>
        <View style={styles.bannerTitleRow}>
          <Ionicons name={kind === 'edit' ? 'create-outline' : 'arrow-undo-outline'} size={12} color={c.primary} />
          <Text style={[styles.bannerTitle, { color: c.primary }]}>
            {kind === 'edit' ? t('chat.editingMessage', 'Редагування') : t('chat.replyTo', { defaultValue: 'Відповідь {{name}}', name: target.senderName ?? t('chat.unknownSender', 'невідомо') })}
          </Text>
        </View>
        <Text style={[styles.bannerPreview, { color: c.mutedForeground }]} numberOfLines={1}>
          {target.isDeleted ? t('common.messageDeleted', 'Повідомлення видалено') : target.content}
        </Text>
      </View>
      <Pressable onPress={onCancel} hitSlop={6} style={{ padding: 4 }}>
        <Ionicons name="close" size={18} color={c.mutedForeground} />
      </Pressable>
    </View>
  );
}

function MsgBubble({ msg, isOwn, myId, onLongPress }: { msg: ChatMessage; isOwn: boolean; myId: string; onLongPress: () => void }) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const isDeleted = !!msg.deletedAt;
  const time = formatTime(msg.createdAt, { hour: '2-digit', minute: '2-digit' });

  if (msg.isSystem) {
    return (
      <View style={styles.systemRow}>
        <Text style={[styles.systemText, { color: c.mutedForeground }]}>{msg.content}</Text>
      </View>
    );
  }

  const senderName = fullName(msg.sender) || msg.sender?.role || '';
  const sidekick = isDeleted ? null : (
    <MessageReactionsCluster type="TRIP" targetId={msg.id} reactions={msg.reactions ?? []} currentUserId={myId} />
  );

  return (
    <View style={[styles.outerCol, isOwn && styles.outerColOwn]}>
      {!isOwn && !isDeleted && <Text style={[styles.senderName, { color: c.primary }]} numberOfLines={1}>{senderName}</Text>}
      <View style={styles.bubbleRow}>
        {isOwn && sidekick}
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={400}
          style={[styles.bubble, isDeleted ? styles.bubbleDeleted : isOwn ? { backgroundColor: c.primary } : { backgroundColor: c.muted }]}
        >
          {!isDeleted && msg.replyTo && (
            <MessageQuote senderName={fullName(msg.replyTo.sender)} content={msg.replyTo.content} isDeleted={!!msg.replyTo.deletedAt} variant={isOwn ? 'onPrimary' : 'default'} />
          )}
          {!isDeleted && msg.replyToDocument && (
            <MessageQuote kind="doc" senderName={fullName(msg.replyToDocument.uploader)} fileName={msg.replyToDocument.fileName} content="" isDeleted={!!msg.replyToDocument.deletedAt} variant={isOwn ? 'onPrimary' : 'default'} />
          )}
          <Text style={[styles.bubbleText, { color: isDeleted ? c.mutedForeground : isOwn ? c.primaryForeground : c.foreground, fontStyle: isDeleted ? 'italic' : 'normal', fontSize: isDeleted ? 12 : 14 }]}>
            {isDeleted ? t('common.messageDeleted', 'Повідомлення видалено') : msg.content}
          </Text>
        </Pressable>
        {!isOwn && sidekick}
      </View>
      <View style={[styles.meta, isOwn && styles.metaOwn]}>
        {msg.editedAt && !isDeleted && <Text style={[styles.metaText, { color: c.mutedForeground, fontStyle: 'italic' }]}>{t('chat.editedShort', 'ред.')}</Text>}
        <Text style={[styles.metaText, { color: c.mutedForeground }]}>{time}</Text>
        {isOwn && !isDeleted && <Text style={[styles.metaText, { color: msg.isRead ? c.primary : c.mutedForeground }]}>{msg.isRead ? '✓✓' : '✓'}</Text>}
      </View>
    </View>
  );
}

function DocBubble({ doc, isOwn, onOpen, onLongPress }: { doc: DriverDocument; isOwn: boolean; onOpen: () => void; onLongPress: () => void }) {
  const c = Colors[useColorScheme() ?? 'light'];
  const isPhoto = doc.fileType === 'PHOTO';
  const time = formatTime(doc.createdAt, { hour: '2-digit', minute: '2-digit' });
  const senderName = fullName(doc.uploader) || doc.uploader?.role || '';

  return (
    <View style={[styles.outerCol, isOwn && styles.outerColOwn]}>
      {!isOwn && <Text style={[styles.senderName, { color: c.primary }]} numberOfLines={1}>{senderName}</Text>}
      <Pressable onPress={onOpen} onLongPress={onLongPress} delayLongPress={400} style={[styles.docBubble, { backgroundColor: isOwn ? c.primary : c.muted }]}>
        {isPhoto ? (
          <Image source={{ uri: doc.signedUrl }} style={styles.docThumb} />
        ) : (
          <View style={styles.docFileRow}>
            <Ionicons name="document-text" size={22} color={isOwn ? c.primaryForeground : c.foreground} />
            <Text style={[styles.docFileName, { color: isOwn ? c.primaryForeground : c.foreground }]} numberOfLines={2}>{doc.fileName}</Text>
          </View>
        )}
      </Pressable>
      <View style={[styles.meta, isOwn && styles.metaOwn]}>
        <Text style={[styles.metaText, { color: c.mutedForeground }]}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  typing: { fontSize: 11, paddingHorizontal: Spacing.md, paddingBottom: 2 },
  outerCol: { paddingHorizontal: Spacing.md, paddingVertical: 3, maxWidth: '92%', alignSelf: 'flex-start' },
  outerColOwn: { alignSelf: 'flex-end' },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 2, marginLeft: 4 },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bubble: { borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  bubbleDeleted: { backgroundColor: 'rgba(128,128,128,0.15)', paddingHorizontal: 10, paddingVertical: 4 },
  bubbleText: { lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, marginTop: 2 },
  metaOwn: { flexDirection: 'row-reverse' },
  metaText: { fontSize: 10 },
  systemRow: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: Spacing.lg },
  systemText: { fontSize: 11, textAlign: 'center' },
  docBubble: { borderRadius: Radius.lg, padding: 4, maxWidth: '100%', overflow: 'hidden' },
  docThumb: { width: 200, height: 200, borderRadius: Radius.md },
  docFileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 8, paddingVertical: 8, maxWidth: 240 },
  docFileName: { flex: 1, fontSize: 13, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.sm },
  bannerQuote: { flex: 1, borderLeftWidth: 2, paddingLeft: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  bannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bannerTitle: { fontSize: 11, fontWeight: '600' },
  bannerPreview: { fontSize: 11, marginTop: 1 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm, gap: Spacing.sm },
  inactiveBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 38, maxHeight: 120, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 8, fontSize: 15 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', right: Spacing.lg },
});
