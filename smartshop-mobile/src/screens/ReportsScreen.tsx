import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { cachePaymentHistory, cacheReportSummary, getCachedReportSummary, getOfflineReportSummary, getOutboxStatusSummary, markReportDatasetSnapshotComplete, markReportDatasetSnapshotIncomplete, saveCustomers, saveExpenses, saveProducts, savePurchases, saveSaleRefunds, saveSales, saveSuppliers } from '../database';
import { syncPendingOperations } from '../sync';
import type { Customer, Expense, PaymentHistory, Product, Purchase, ReportSummary, Sale, SaleRefund, Supplier } from '../api/types';
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
  const [showingCachedReport, setShowingCachedReport] = useState(false);
  const [showingOfflineCalculated, setShowingOfflineCalculated] = useState(false);
  const [detail, setDetail] = useState<{ title: string; formula: string; inputs: string[]; result: string; note?: string } | null>(null);
  const openMetricDetail = (key: string) => {
    if (!report) return;
    const values: Record<string, { title: string; formula: string; inputs: string[]; result: string; note?: string }> = {
      revenue: { title: t('reports.revenue'), formula: 'Ventes validées − remboursements', inputs: ['Ventes brutes : détail des sources disponible avec le snapshot local', 'Remboursements : déduits du chiffre d’affaires'], result: formatMoney(report.revenue) },
      gross: { title: t('reports.grossProfit'), formula: 'Chiffre d’affaires − coût des marchandises vendues', inputs: ['Chiffre d’affaires : ' + formatMoney(report.revenue), 'Coût des marchandises : ' + formatMoney(report.costOfGoodsSold)], result: formatMoney(report.grossProfit) },
      expenses: { title: t('reports.expenses'), formula: 'Somme des dépenses enregistrées pendant la période', inputs: ['Dépenses : ' + formatMoney(report.expenses)], result: formatMoney(report.expenses) },
      net: { title: t('reports.netProfit'), formula: 'Bénéfice brut − dépenses', inputs: ['Bénéfice brut : ' + formatMoney(report.grossProfit), 'Dépenses : ' + formatMoney(report.expenses)], result: formatMoney(report.netProfit) },
      cash: { title: t('reports.cashCollected'), formula: 'Règlements clients + ventes comptant − remboursements cash', inputs: ['Encaissements calculés par le rapport : ' + formatMoney(report.cashCollected)], result: formatMoney(report.cashCollected) },
      supplierPaid: { title: t('reports.paidToSuppliers'), formula: 'Somme des paiements fournisseurs pendant la période', inputs: ['Paiements réellement effectués : ' + formatMoney(report.paidToSuppliers)], result: formatMoney(report.paidToSuppliers), note: 'Ce montant est différent du total des achats.' },
      purchases: { title: t('reports.purchasesTotal'), formula: 'Somme du total des achats enregistrés pendant la période', inputs: ['Achats enregistrés : ' + formatMoney(report.purchasesTotal)], result: formatMoney(report.purchasesTotal), note: 'Indépendant du montant déjà payé.' },
      flow: { title: t('reports.netCashFlow'), formula: 'Encaissements − paiements fournisseurs − dépenses', inputs: ['Encaissements : ' + formatMoney(report.cashCollected), 'Paiements fournisseurs : ' + formatMoney(report.paidToSuppliers), 'Dépenses : ' + formatMoney(report.expenses)], result: formatMoney(report.netCashFlow) },
      customerDebt: { title: t('reports.customerDebt'), formula: 'Somme des restes à payer des ventes validées', inputs: ['Dette clients : ' + formatMoney(report.totalCustomerDebt)], result: formatMoney(report.totalCustomerDebt), note: 'Solde actuel global, pas seulement la période.' },
      supplierDebt: { title: t('reports.supplierDebt'), formula: 'Somme des restes à payer des achats', inputs: ['Dette fournisseurs : ' + formatMoney(report.totalSupplierDebt)], result: formatMoney(report.totalSupplierDebt), note: 'Solde actuel global, pas seulement la période.' },
      stock: { title: t('reports.stockValue'), formula: 'Somme (quantité en stock × coût moyen d’achat) des produits actifs', inputs: ['Valeur du stock : ' + formatMoney(report.stockValue)], result: formatMoney(report.stockValue), note: 'Valorisation au coût moyen d’achat, pas au prix de vente.' },
      lowStock: { title: t('reports.lowStock'), formula: 'Nombre de produits actifs dont le stock ≤ seuil d’alerte', inputs: ['Produits sous le seuil : ' + String(report.lowStockCount)], result: String(report.lowStockCount), note: 'Compteur du stock actuel.' },
    };
    setDetail(values[key] ?? null);
  };

  const load = useCallback(async () => {
    try {
      setError(null);

      // Send offline-created operations before asking the server for totals.
      // Otherwise the online report can be older than the data already visible
      // in the local SQLite database.
      const queued = await getOutboxStatusSummary().catch(() => ({ pending: 0, failed: 0 }));
      if (queued.pending > 0) {
        await syncPendingOperations().catch(() => undefined);
      }

      // If some local operations still cannot be synchronized, prefer the
      // complete local calculation so those operations are not hidden.
      const remaining = await getOutboxStatusSummary().catch(() => ({ pending: 0, failed: 0 }));
      if (remaining.pending > 0 || remaining.failed > 0) {
        const localReport = await getOfflineReportSummary(period).catch(() => null);
        if (localReport) {
          setReport(localReport);
          setShowingOfflineCalculated(true);
          setShowingCachedReport(false);
          setError(null);
          return;
        }
      }

      const data = await api<ReportSummary>(ENDPOINTS[period]);
      setReport(data);
      setShowingCachedReport(false);
      setShowingOfflineCalculated(false);
      void cacheReportSummary(period, data).catch(() => undefined);
      // A complete snapshot is recorded only after every report source is downloaded.
      void Promise.all([
        api<Sale[]>('/api/sales'), api<Purchase[]>('/api/purchases'),
        api<Expense[]>('/api/expenses'), api<Product[]>('/api/products'),
        api<Customer[]>('/api/customers'), api<Supplier[]>('/api/suppliers'),
        api<PaymentHistory>('/api/reports/payment-history'),
        api<SaleRefund[]>('/api/reports/refund-history'),
      ]).then(async ([sales,purchases,expenses,products,customers,suppliers,payments,refunds]) => {
        await markReportDatasetSnapshotIncomplete();
        await Promise.all([saveSales(sales),savePurchases(purchases),saveExpenses(expenses),saveProducts(products),saveCustomers(customers),saveSuppliers(suppliers),cachePaymentHistory(payments),saveSaleRefunds(refunds)]);
        await markReportDatasetSnapshotComplete();
      }).catch(() => undefined);
    } catch (e) {
      const localReport = await getOfflineReportSummary(period).catch(() => null);
      if (localReport) {
        setReport(localReport);
        setShowingOfflineCalculated(true);
        setShowingCachedReport(false);
        setError(null);
      } else {
        const cached = await getCachedReportSummary(period);
        if (cached) {
          setReport(cached);
          setShowingCachedReport(true);
          setShowingOfflineCalculated(false);
          setError(null);
        } else {
          setError(errorMessage(e, t));
        }
      }
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
          onPress={() => navigation.navigate('Expenses')}
        >
          <View style={styles.expensesIcon}><Ionicons name="bag-handle-outline" size={19} color={colors.primary} /></View>
          <Text style={styles.expensesActionText}>{t('reports.expenses')}</Text>
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
            {showingOfflineCalculated ? (
              <Text style={styles.cachedNotice}>Rapport calculé localement à partir des données synchronisées et des opérations hors ligne.</Text>
            ) : showingCachedReport ? (
              <Text style={styles.cachedNotice}>Rapport en cache — dernière synchronisation disponible (hors ligne).</Text>
            ) : null}

            <View style={styles.grid}>
              <Kpi icon="cash-outline" label={t('reports.revenue')} value={formatMoney(report.revenue)} onPress={() => openMetricDetail('revenue')} />
              <Kpi icon="trending-up-outline" label={t('reports.grossProfit')} value={formatMoney(report.grossProfit)} onPress={() => openMetricDetail('gross')} />
              <Kpi icon="receipt-outline" label={t('reports.expenses')} value={formatMoney(report.expenses)} tone="bad" onPress={() => openMetricDetail('expenses')} />
              <Kpi
                icon="wallet-outline"
                label={t('reports.netProfit')}
                value={formatMoney(report.netProfit)}
                tone={report.netProfit >= 0 ? 'good' : 'bad'}
                strong
                onPress={() => openMetricDetail('net')}
              />
            </View>

            <Text style={styles.section}>{t('reports.cash')}</Text>
            <View style={styles.grid}>
              <Kpi icon="cash-outline" label={t('reports.cashCollected')} value={formatMoney(report.cashCollected)} onPress={() => openMetricDetail('cash')} />
              <Kpi icon="business-outline" label={t('reports.paidToSuppliers')} value={formatMoney(report.paidToSuppliers)} onPress={() => openMetricDetail('supplierPaid')} />
              <Kpi icon="bag-handle-outline" label={t('reports.purchasesTotal')} value={formatMoney(report.purchasesTotal)} onPress={() => openMetricDetail('purchases')} />
              <Kpi
                icon="swap-horizontal-outline"
                label={t('reports.netCashFlow')}
                value={formatMoney(report.netCashFlow)}
                tone={report.netCashFlow >= 0 ? 'good' : 'bad'}
                onPress={() => openMetricDetail('flow')}
              />
            </View>

            <Text style={styles.section}>{t('reports.topProducts')}</Text>
            <View style={styles.card}>
              {report.topProducts.length === 0 ? (
                <Text style={styles.muted}>{t('reports.noTop')}</Text>
              ) : (
                report.topProducts.map((p, index) => (
                  <Pressable key={p.productId} style={styles.topRow} onPress={() => setDetail({ title: p.name, formula: 'Somme des lignes de vente de ce produit', inputs: ['Quantité vendue : ' + String(p.quantitySold), 'Chiffre d’affaires : ' + formatMoney(p.revenue), 'Prix moyen réalisé : ' + formatMoney(p.quantitySold > 0 ? p.revenue / p.quantitySold : 0)], result: formatMoney(p.revenue), note: 'Classé par quantité vendue pendant la période affichée.' })}>
                    <Text style={styles.rank}>{index + 1}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.name}>{p.name}</Text>
                      <Text style={styles.muted}>
                        {p.quantitySold} {t('reports.sold')}
                      </Text>
                    </View>
                    <Text style={styles.value}>{formatMoney(p.revenue)}</Text>
                  </Pressable>
                ))
              )}
            </View>

            <Text style={styles.section}>{t('reports.now')}</Text>
            <View style={styles.grid}>
              <Kpi
                label={t('reports.customerDebt')}
                value={formatMoney(report.totalCustomerDebt)}
                tone={report.totalCustomerDebt > 0 ? 'bad' : undefined}
                onPress={() => openMetricDetail('customerDebt')}
              />
              <Kpi
                label={t('reports.supplierDebt')}
                value={formatMoney(report.totalSupplierDebt)}
                tone={report.totalSupplierDebt > 0 ? 'bad' : undefined}
                onPress={() => openMetricDetail('supplierDebt')}
              />
              <Kpi label={t('reports.stockValue')} value={formatMoney(report.stockValue)} onPress={() => openMetricDetail('stock')} />
              <Kpi
                label={t('reports.lowStock')}
                value={String(report.lowStockCount)}
                tone={report.lowStockCount > 0 ? 'bad' : undefined}
                onPress={() => openMetricDetail('lowStock')}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
      <Modal visible={detail !== null} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismissArea} onPress={() => setDetail(null)} />
          <View style={styles.detailSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{detail?.title}</Text>
              <Pressable onPress={() => setDetail(null)} hitSlop={12}><Ionicons name="close-circle" size={26} color={colors.muted} /></Pressable>
            </View>
            <Text style={styles.detailCaption}>Formule de calcul</Text>
            <Text style={styles.detailFormula}>{detail?.formula}</Text>
            <Text style={styles.detailCaption}>Valeurs utilisées</Text>
            {detail?.inputs.map((line, index) => <Text key={index} style={styles.detailLine}>{line}</Text>)}
            {detail?.note ? <Text style={styles.detailNote}>{detail.note}</Text> : null}
            <View style={styles.detailResult}>
              <Text style={styles.detailCaption}>Résultat</Text>
              <Text style={styles.detailResultValue}>{detail?.result}</Text>
            </View>
          </View>
        </View>
      </Modal>
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
  onPress,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  tone?: 'good' | 'bad';
  strong?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.kpi, strong && styles.kpiStrong, pressed && styles.pressed]}>
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
    </Pressable>
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
  cachedNotice: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  section: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: { flexGrow: 1, flexBasis: '45%', minHeight: 116, backgroundColor: colors.card, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  modalDismissArea: { flex: 1 },
  detailSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  modalHandle: { width: 42, height: 4, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  detailTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' },
  detailCaption: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: spacing.sm },
  detailFormula: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  detailLine: { color: colors.text, fontSize: 13, lineHeight: 20 },
  detailNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  detailResult: { backgroundColor: colors.neutralBg, borderRadius: 14, padding: spacing.md, marginTop: spacing.sm },
  detailResultValue: { color: colors.primary, fontSize: 22, fontWeight: '900', marginTop: 4 },
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