
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { Permission } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { IconTile, type Tone } from '../components/ui';

// Couleurs alternées des icônes du menu
const TILE_TONES: Tone[] = ['primary', 'success', 'warning', 'violet', 'danger'];
import { colors, radius, spacing } from '../theme';

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

export default function MoreScreen({ navigation }: Props) {
  const { i18n, t } = useTranslation();
  const isAr = (i18n.language || '').startsWith('ar');

  const { can } = useAuth();

  // Chaque entrée n'apparaît que si le compte a au moins un des droits indiqués
  const all: { title: string; subtitle: string; icon: React.ComponentProps<typeof Ionicons>['name']; screen: string; anyOf: Permission[] }[] = [
    { title: t('tabs.customers'), subtitle: isAr ? 'الزبناء والديون' : 'Fiches clients et crédit', icon: 'people-outline', screen: 'Customers', anyOf: ['CUSTOMERS', 'PAYMENTS'] },
    { title: t('quotes.title'), subtitle: t('quotes.subtitle'), icon: 'document-text-outline', screen: 'Quotes', anyOf: ['SALES'] },
    { title: t('targets.title'), subtitle: t('targets.subtitle'), icon: 'trophy-outline', screen: 'Targets', anyOf: ['SALES', 'USERS'] },
    { title: t('aging.title'), subtitle: t('aging.subtitle'), icon: 'hourglass-outline', screen: 'Aging', anyOf: ['PAYMENTS'] },
    { title: t('checks.title'), subtitle: t('checks.subtitle'), icon: 'document-outline', screen: 'Checks', anyOf: ['PAYMENTS'] },
    { title: t('cash.title'), subtitle: t('cash.subtitle'), icon: 'cash-outline', screen: 'Cash', anyOf: ['CASH'] },
    { title: isAr ? 'المشتريات' : 'Achats', subtitle: isAr ? 'تدبير المشتريات والموردين' : 'Gérer les achats et les fournisseurs', icon: 'bag-handle-outline', screen: 'Purchases', anyOf: ['PURCHASES'] },
    { title: t('orders.title'), subtitle: t('orders.subtitle'), icon: 'clipboard-outline', screen: 'PurchaseOrders', anyOf: ['PURCHASES', 'STOCK'] },
    { title: t('inventory.title'), subtitle: t('inventory.subtitle'), icon: 'list-outline', screen: 'Inventories', anyOf: ['STOCK'] },
    { title: t('warehouses.title'), subtitle: t('warehouses.subtitle'), icon: 'business-outline', screen: 'Warehouses', anyOf: ['STOCK'] },
    { title: isAr ? 'التقارير والمصاريف' : 'Rapports et dépenses', subtitle: isAr ? 'ملخص النشاط والمصاريف' : 'Consulter les rapports et les dépenses', icon: 'bar-chart-outline', screen: 'Reports', anyOf: ['REPORTS'] },
    { title: t('users.title'), subtitle: t('users.subtitle'), icon: 'people-circle-outline', screen: 'Users', anyOf: ['USERS'] },
    { title: t('activity.title'), subtitle: t('activity.subtitle'), icon: 'pulse-outline', screen: 'Activity', anyOf: ['USERS'] },
    { title: t('import.title'), subtitle: t('import.subtitle'), icon: 'cloud-upload-outline', screen: 'Import', anyOf: ['SETTINGS'] },
    { title: t('shop.title'), subtitle: t('shop.subtitle'), icon: 'storefront-outline', screen: 'ShopSettings', anyOf: ['SETTINGS'] },
  ];
  const items = all.filter((item) => item.anyOf.some(can));

  return (
    <ScrollView
      style={styles.safe}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>
        {isAr ? 'المزيد' : 'Plus'}
      </Text>

      <Text style={styles.subtitle}>
        {isAr
          ? 'الأدوات والإعدادات الإضافية'
          : 'Autres fonctionnalités de gestion'}
      </Text>

      {items.map((item, index) => (
        <Pressable
          key={item.screen}
          onPress={() => navigation.navigate(item.screen)}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <IconTile name={item.icon} tone={TILE_TONES[index % TILE_TONES.length]} size={44} />

          <View style={styles.copy}>
            <Text style={styles.title}>
              {item.title}
            </Text>

            <Text style={styles.description}>
              {item.subtitle}
            </Text>
          </View>

          <Ionicons
            name={isAr ? 'chevron-back' : 'chevron-forward'}
            size={20}
            color={colors.muted}
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heading: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'left',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  card: {
    minHeight: 78,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    color: colors.muted,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});
