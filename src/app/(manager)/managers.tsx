import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { SectionHeader } from '@/components/section-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ManagersScreen() {
  const c = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SectionHeader title={t('nav.items.managers', 'Менеджери')} />
      <ScreenPlaceholder icon="headset-outline" title={t('nav.items.managers', 'Менеджери')} subtitle={t('common.soon', 'Скоро')} />
    </View>
  );
}
