import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
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
import type { ReportSummary } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { formatDate, formatMoney } from '../format';
import type { ReportsStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<ReportsStackParamList, 'Reports'>;
type Period = 'today' | 'week' | 'month';

const ENDPOINTS: Record<Period, string> = {
  today: '/api/reports/today',
  week: '/api/reports/this-week',
  month: '/api/reports/this-month',
};

export default function ReportsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('today');
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<ReportSummary>(ENDPOINTS[period]);
      setReport(data);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [period, t]);

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

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.pageHeading}>
          <View style={styles.headingIcon}><Ionicons name="bar-chart" size={22} color={colors.primary} /></View>
          <View style={styles.headingCopy}>
            <Text style={styles.pageTitle}>{t('tabs.reports', { defaultValue: 'Rapports' })}</Text>
            <Text style={styles.pageSubtitle}>{period === 'today' ? t('reports.today') : period === 'week' ? t('reports.week') : t('reports.month')}</Text>
          </View>
        </View>

        <View style={styles.periodHeader}><Text style={styles.filterTitle}>{t('reports.periodLabel', { defaultValue: 'Période' })}</Text><View style={styles.chips}>
          <Chip label={t('reports.today')} active={period === 'today'} onPress={() => setPeriod('today')} />
          <Chip label={t('reports.week')} active={period === 'week'} onPress={() => setPeriod('week')} />
          <Chip label={t('reports.month')} active={period === 'month'} onPress={() => setPeriod('month')} />
        </View></View>

        <Pressable
          style={({ pressed }) => [styles.expensesAction, pressed && styles.pressed]}
          onPress={() => navigation.getParent()?.navigate('Purchases' as never)}
        >
          <View style={styles.expensesIcon}><Ionicons name="bag-handle-outline" size={19} color={colors.primary} /></View>
          <Text style={styles.expensesActionText}>{t('purchases.open')}</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.primary} />
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <View style={styles.block}>
            <Text style={styles.error}>{error}</Text>
            <PrimaryButton title={t('common.retry')} onPress={() => void load()} variant="outline" />
          </View>
        ) : report ? (
          <>
            <Text style={styles.range}>
              {formatDate(report.from)} → {formatDate(report.to)} ·{' '}
              {t('reports.salesCount', { n: report.salesCount })}
            </Text>

            <View style={styles.grid}>
              <Kpi icon="cash-outline" label={t('reports.revenue')} value={formatMoney(report.revenue)} />
              <Kpi icon="trending-up-outline" label={t('reports.grossProfit')} value={formatMoney(report.grossProfit)} />
              <Kpi icon="receipt-outline" label={t('reports.expenses')} value={formatMoney(report.expenses)} tone="bad" />
              <Kpi
                icon="wallet-outline"
                label={t('reports.netProfit')}
                value={formatMoney(report.netProfit)}
                tone={report.netProfit >= 0 ? 'good' : 'bad'}
                strong
              />
            </View>

            <Text style={styles.section}>{t('reports.cash')}</Text>
            <View style={styles.grid}>
              <Kpi icon="cash-outline" label={t('reports.cashCollected')} value={formatMoney(report.cashCollected)} />
              <Kpi icon="business-outline" label={t('reports.paidToSuppliers')} value={formatMoney(report.paidToSuppliers)} />
              <Kpi icon="bag-handle-outline" label={t('reports.purchasesTotal')} value={formatMoney(report.purchasesTotal)} />
              <Kpi
                icon="swap-horizontal-outline"
                label={t('reports.netCashFlow')}
                value={formatMoney(report.netCashFlow)}
                tone={report.netCashFlow >= 0 ? 'good' : 'bad'}
              />
            </View>

            <Text style={styles.section}>{t('reports.topProducts')}</Text>
            <View style={styles.card}>
              {report.topProducts.length === 0 ? (
                <Text style={styles.muted}>{t('reports.noTop')}</Text>
              ) : (
                report.topProducts.map((p, index) => (
                  <View key={p.productId} style={styles.topRow}>
                    <Text style={styles.rank}>{index + 1}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.name}>{p.name}</Text>
                      <Text style={styles.muted}>
                        {p.quantitySold} {t('reports.sold')}
                      </Text>
                    </View>
                    <Text style={styles.value}>{formatMoney(p.revenue)}</Text>
                  </View>
                ))
              )}
            </View>

            <Text style={styles.section}>{t('reports.now')}</Text>
            <View style={styles.grid}>
              <Kpi
                label={t('reports.customerDebt')}
                value={formatMoney(report.totalCustomerDebt)}
                tone={report.totalCustomerDebt > 0 ? 'bad' : undefined}
              />
              <Kpi
                label={t('reports.supplierDebt')}
                value={formatMoney(report.totalSupplierDebt)}
                tone={report.totalSupplierDebt > 0 ? 'bad' : undefined}
              />
              <Kpi label={t('reports.stockValue')} value={formatMoney(report.stockValue)} />
              <Kpi
                label={t('reports.lowStock')}
                value={String(report.lowStockCount)}
                tone={report.lowStockCount > 0 ? 'bad' : undefined}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
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

function Kpi({
  icon,
  label,
  value,
  tone,
  strong,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  tone?: 'good' | 'bad';
  strong?: boolean;
}) {
  return (
    <View style={[styles.kpi, strong && styles.kpiStrong]}>
      <View style={styles.kpiIcon}><Ionicons name={icon ?? 'analytics-outline'} size={17} color={tone === 'bad' ? colors.danger : tone === 'good' ? colors.success : colors.primary} /></View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text
        style={[
          styles.kpiValue,
          tone === 'good' && styles.good,
          tone === 'bad' && styles.bad,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 2 },
  headingIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 },
  pageTitle: { fontSize: 21, fontWeight: '900', color: colors.text },
  pageSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  periodHeader: { gap: 8 },
  filterTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  expensesAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: spacing.md },
  expensesIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  expensesActionText: { flex: 1, color: colors.primary, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  chip: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  loader: { marginTop: spacing.xl },
  block: { marginTop: spacing.md },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  range: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  section: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: { flexGrow: 1, flexBasis: '45%', minHeight: 116, backgroundColor: colors.card, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  kpiStrong: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.neutralBg },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  kpiValue: { marginTop: 5, fontSize: 17, fontWeight: '900', color: colors.text },
  good: { color: colors.success },
  bad: { color: colors.danger },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { width: 22, fontWeight: '800', color: colors.primary, fontSize: 16 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  value: { fontWeight: '700', color: colors.text },
});