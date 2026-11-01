import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Purchase } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { formatDate, formatMoney } from '../format';
import type { PurchasesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<PurchasesStackParamList, 'PurchasesList'>;

export default function PurchasesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<Purchase[]>(unpaidOnly ? '/api/purchases/unpaid' : '/api/purchases');
      setPurchases(data);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t, unpaidOnly]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const totalDue = purchases.reduce((sum, p) => sum + Math.max(0, p.remaining), 0);

  function renderItem({ item }: { item: Purchase }) {
    const due = item.remaining > 0;
    return (
      <Pressable
        onPress={() => navigation.navigate('PurchaseDetail', { purchase: item })}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.purchaseIcon}><Ionicons name="receipt-outline" size={20} color={colors.primary} /></View>
        <View style={styles.flex}>
          <Text style={styles.name}>{item.supplierName ?? t('purchases.noSupplier')}</Text>
          <Text style={styles.muted}>{formatDate(item.purchaseDate)}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.total}>{formatMoney(item.total)}</Text>
          {due ? (
            <Text style={styles.badgeDue}>
              {t('purchases.due')} {formatMoney(item.remaining)}
            </Text>
          ) : (
            <Text style={styles.badgePaid}>{t('purchases.paid')}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.muted} />
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.top}>
        <View style={styles.pageHeading}>
          <View style={styles.headingIcon}><Ionicons name="bag-handle" size={22} color={colors.primary} /></View>
          <View style={styles.headingCopy}>
            <Text style={styles.pageTitle}>{t('tabs.purchases', { defaultValue: 'Achats' })}</Text>
            <Text style={styles.pageSubtitle}>{t('purchases.subtitle')}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]} onPress={() => navigation.navigate('PurchaseForm')}>
            <Ionicons name="add-circle-outline" size={19} color="#fff" />
            <Text style={styles.actionPrimaryText}>{t('purchases.add')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]} onPress={() => navigation.navigate('SupplierForm')}>
            <Ionicons name="person-add-outline" size={18} color={colors.primary} />
            <Text style={styles.actionSecondaryText}>{t('purchases.addSupplier')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]} onPress={() => navigation.navigate('SuppliersList')}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <Text style={styles.actionSecondaryText}>{t('purchases.suppliersList')}</Text>
          </Pressable>
        </View>

        <View style={styles.totalBox}>
          <View style={styles.totalIcon}><Ionicons name="wallet-outline" size={20} color={colors.danger} /></View>
          <View style={styles.totalCopy}><Text style={styles.muted}>{t('purchases.totalDue')}</Text><Text style={styles.totalCaption}>{t('purchases.unpaid')}</Text></View>
          <Text style={styles.totalValue}>{formatMoney(totalDue)}</Text>
        </View>

        <View style={styles.filters}>
          <Text style={styles.filterTitle}>{t('purchases.all')}</Text>
          <View style={styles.chips}>
            <Chip label={t('purchases.all')} active={!unpaidOnly} onPress={() => setUnpaidOnly(false)} />
            <Chip label={t('purchases.unpaid')} active={unpaidOnly} onPress={() => setUnpaidOnly(true)} />
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <PrimaryButton title={t('common.retry')} onPress={() => void load()} variant="outline" />
        </View>
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('purchases.empty')}</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  top: { padding: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headingIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 },
  pageTitle: { fontSize: 21, fontWeight: '900', color: colors.text },
  pageSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionPrimary: { flexBasis: '100%', minHeight: 46, borderRadius: 13, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10 },
  actionPrimaryText: { color: '#fff', fontSize: 12, fontWeight: '800', flexShrink: 1 },
  actionSecondary: { flexGrow: 1, flexBasis: '48%', minWidth: 0, minHeight: 46, borderRadius: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  actionSecondaryText: { color: colors.primary, fontSize: 11, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  pressed: { opacity: 0.78 },
  totalBox: { backgroundColor: colors.card, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  totalIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' },
  totalCopy: { flex: 1 },
  totalCaption: { color: colors.muted, fontSize: 10, marginTop: 2 },
  totalValue: { fontSize: 17, fontWeight: '900', color: colors.danger },
  filters: { gap: 7 },
  filterTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: { paddingVertical: 7, paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.onPrimary, fontWeight: '800' },
  loader: { marginTop: spacing.xl },
  center: { padding: spacing.lg },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
  list: { padding: spacing.md, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: spacing.xl },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  purchaseIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end', gap: 4 },
  name: { fontSize: 14, fontWeight: '800', color: colors.text },
  muted: { color: colors.muted, fontSize: 11 },
  total: { fontSize: 14, fontWeight: '900', color: colors.text },
  badgeDue: { color: colors.danger, backgroundColor: colors.dangerBg, fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  badgePaid: { color: colors.success, backgroundColor: colors.successBg, fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
});
