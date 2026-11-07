import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Channel = 'phone' | 'viber' | 'whatsapp';

/** Digits only, no leading "+" / "00" — what wa.me expects. */
function digits(phone: string) {
  return phone.replace(/\D/g, '').replace(/^00/, '');
}

function urlFor(channel: Channel, phone: string) {
  const d = digits(phone);
  switch (channel) {
    case 'phone':
      return `tel:+${d}`;
    case 'viber':
      return `viber://chat?number=%2B${d}`;
    case 'whatsapp':
      return `https://wa.me/${d}`;
  }
}

/** Bottom sheet: choose how to reach the driver — phone call, Viber or WhatsApp. */
export function CallSheet({
  visible,
  phone,
  name,
  onClose,
}: {
  visible: boolean;
  phone: string;
  name?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();

  const open = async (channel: Channel) => {
    onClose();
    try {
      await Linking.openURL(urlFor(channel, phone));
    } catch {
      Alert.alert(
        channel === 'phone'
          ? t('call.failedPhone', 'Не вдалося здійснити дзвінок')
          : t('call.failedApp', 'Застосунок не встановлено'),
      );
    }
  };

  const options: { key: Channel; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
    { key: 'phone', icon: 'call', label: t('call.phone', 'Телефон'), color: '#1B8C60' },
    { key: 'viber', icon: 'chatbubble-ellipses', label: 'Viber', color: '#7360F2' },
    { key: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25D366' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: c.card, paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.sm }]}
        >
          <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
            {name || t('call.title', 'Зв’язатися')}
          </Text>
          <Text style={[styles.phone, { color: c.mutedForeground }]}>{phone}</Text>
          {options.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => void open(o.key)}
              style={({ pressed }) => [
                styles.row,
                { borderColor: c.border, backgroundColor: pressed ? c.muted : c.background },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: o.color }]}>
                <Ionicons name={o.icon} size={18} color="#fff" />
              </View>
              <Text style={[styles.label, { color: c.foreground }]}>{o.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  phone: { fontSize: 13, textAlign: 'center', marginBottom: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
});
