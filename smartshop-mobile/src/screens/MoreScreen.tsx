
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';
import { getOutboxStatusSummary, retryFailedOutboxOperations } from '../database';
import { syncPendingOperations } from '../sync';

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

export default function MoreScreen({ navigation }: Props) {
  const { i18n, t } = useTranslation();
  const isAr = (i18n.language || '').startsWith('ar');
  const [syncCounts, setSyncCounts] = useState({ pending: 0, failed: 0 });
  const [retrying, setRetrying] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const refreshSyncStatus = useCallback(async () => {
    try {
      setSyncCounts(await getOutboxStatusSummary());
    } catch {
      // Keep the More screen usable if local storage is temporarily unavailable.
    }
  }, []);

  useEffect(() => { void refreshSyncStatus(); }, [refreshSyncStatus]);

  async function retryFailed() {
    setRetrying(true);
    setSyncMessage('');
    try {
      const count = await retryFailedOutboxOperations();
      const result = await syncPendingOperations();
      await refreshSyncStatus();
      setSyncMessage(isAr
        ? `تمت إعادة المحاولة: ${result.synced} ناجحة، ${result.pending} معلقة، ${result.failed} فاشلة.`
        : `Nouvelle tentative : ${result.synced} réussie(s), ${result.pending} en attente, ${result.failed} en échec.`);
    } catch {
      setSyncMessage(isAr ? 'تعذرت إعادة المزامنة. تحقق من الاتصال بالخادم.' : 'Synchronisation impossible. Vérifiez la connexion au serveur.');
    } finally {
      setRetrying(false);
    }
  }

  const items = [
    {
      title: isAr ? 'الفئات' : 'Catégories',
      subtitle: isAr ? 'إضافة وتعديل وتنظيم فئات المنتجات' : 'Créer, modifier et organiser les catégories',
      icon: 'albums-outline' as const,
      screen: 'Categories',
    },
    {
      title: isAr ? 'المشتريات' : 'Achats',
      subtitle: isAr
        ? 'تدبير المشتريات والموردين'
        : 'Gérer les achats et les fournisseurs',
      icon: 'bag-handle-outline' as const,
      screen: 'Purchases',
    },
    {
      title: isAr ? 'التقارير والمصاريف' : 'Rapports et dépenses',
      subtitle: isAr
        ? 'ملخص النشاط والمصاريف'
        : 'Consulter les rapports et les dépenses',
      icon: 'bar-chart-outline' as const,
      screen: 'Reports',
    },
  ];

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

      <View style={styles.syncCard}>
        <View style={styles.syncHeader}>
          <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
          <Text style={styles.title}>{isAr ? 'مزامنة البيانات' : 'Synchronisation des données'}</Text>
        </View>
        <Text style={styles.description}>
          {isAr
            ? `في الانتظار: ${syncCounts.pending} · فشلت: ${syncCounts.failed}`
            : `En attente : ${syncCounts.pending} · En échec : ${syncCounts.failed}`}
        </Text>
        {syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}
        <Pressable
          onPress={retryFailed}
          disabled={retrying || syncCounts.failed === 0}
          style={({ pressed }) => [styles.retryButton, (pressed || retrying || syncCounts.failed === 0) && styles.retryDisabled]}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>
            {retrying
              ? (isAr ? 'جاري إعادة المحاولة...' : 'Nouvelle tentative...')
              : (isAr ? 'إعادة محاولة العمليات الفاشلة' : 'Réessayer les opérations en échec')}
          </Text>
        </Pressable>
      </View>

      {items.map((item) => (
        <Pressable
          key={item.screen}
          onPress={() => navigation.navigate(item.screen)}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <View style={styles.iconWrap}>
            <Ionicons
              name={item.icon}
              size={23}
              color={colors.primary}
            />
          </View>

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
  syncCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  syncHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  syncMessage: { color: colors.muted, fontSize: 12 },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius,
  },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  retryDisabled: { opacity: 0.45 },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});
