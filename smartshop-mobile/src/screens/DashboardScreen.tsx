import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Sale, TargetProgress } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import PrimaryButton from '../components/PrimaryButton';
import { Avatar, Badge, Card, IconTile, SectionHeader, StatTile } from '../components/ui';
import { formatMoney } from '../format';
import { colors, heroGradient, radius, spacing } from '../theme';
import { ProgressBar } from './TargetsScreen';

interface TodayReport {
  salesCount: number;
  revenue: number;
  grossProfit: number;
  totalCustomerDebt: number;
  lowStockCount: number;
}

interface DailyPoint {
  date: string;
  salesCount: number;
  revenue: number;
  grossProfit: number;
}

const DAYS = {
  fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  ar: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
};

/** Variation en % entre deux montants (null si pas de point de comparaison). */
function variation(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { user, can } = useAuth();
  const navigation = useNavigation<any>();
  const isAr = !!i18n.language && i18n.language.startsWith('ar');
  const canReports = can('REPORTS');
  const canSales = can('SALES');

  const [report, setReport] = useState<TodayReport | null>(null);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [recent, setRecent] = useState<Sale[]>([]);
  const [myTarget, setMyTarget] = useState<TargetProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const jobs: Promise<unknown>[] = [];
      if (canReports) {
        jobs.push(api<TodayReport>('/api/reports/today').then(setReport));
        jobs.push(api<DailyPoint[]>('/api/reports/daily?days=7').then(setDaily));
      } else {
        jobs.push(api<TargetProgress[]>('/api/targets').then((list) => setMyTarget(list.find((x) => x.name === user?.name) ?? null)));
      }
      if (canSales) jobs.push(api<Sale[]>('/api/sales?limit=4').then(setRecent));
      await Promise.all(jobs);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setLoading(false);
    }
  }, [t, canReports, canSales, user?.name]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const today = daily[daily.length - 1];
  const yesterday = daily[daily.length - 2];
  const dayChange = today && yesterday ? variation(today.revenue, yesterday.revenue) : null;
  const weekTotal = daily.reduce((s, d) => s + d.revenue, 0);
  const margin = report && report.revenue > 0 ? Math.round((report.grossProfit / report.revenue) * 100) : null;
  const maxDay = Math.max(1, ...daily.map((d) => d.revenue));
  const dayNames = isAr ? DAYS.ar : DAYS.fr;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.hello}>{isAr ? 'مرحبا 👋' : 'Bonjour 👋'}</Text>
            <Text style={styles.name} numberOfLines={1}>{user?.name ?? ''}</Text>
            <Text style={styles.muted}>{isAr ? 'يوم سعيد!' : 'Bonne journée !'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('tabs.more')} onPress={() => navigation.navigate('More')}>
            <Avatar name={user?.name ?? 'S'} size={46} />
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <PrimaryButton title={t('common.retry')} onPress={() => void load()} variant="outline" />
          </Card>
        ) : null}

        {/* Ventes du jour */}
        {report ? (
          <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.flex}>
              <Text style={styles.heroLabel}>{isAr ? 'مبيعات اليوم' : 'Ventes du jour'}</Text>
              <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(report.revenue)}</Text>
              {dayChange !== null ? (
                <View style={styles.heroChip}>
                  <Ionicons name={dayChange >= 0 ? 'trending-up' : 'trending-down'} size={13} color="#fff" />
                  <Text style={styles.heroChipText}>{dayChange >= 0 ? '+' : ''}{dayChange}% {isAr ? 'مقارنة بالأمس' : 'vs hier'}</Text>
                </View>
              ) : null}
            </View>
            {/* Mini courbe décorative à partir des 7 derniers jours */}
            <View style={styles.sparkline} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {daily.map((d) => (
                <View key={d.date} style={[styles.sparkBar, { height: 8 + (d.revenue / maxDay) * 46 }]} />
              ))}
            </View>
          </LinearGradient>
        ) : null}

        {report ? (
          <View style={styles.tiles}>
            <StatTile icon="receipt-outline" tone="primary" value={String(report.salesCount)} label={isAr ? 'عمليات' : 'Transactions'} />
            <StatTile icon="cash-outline" tone="warning" value={formatMoney(report.grossProfit).replace(' DH', '')} label={isAr ? 'الربح' : 'Bénéfice (DH)'} />
            <StatTile icon="pie-chart-outline" tone="violet" value={margin !== null ? `${margin}%` : '—'} label={isAr ? 'الهامش' : 'Marge'} />
          </View>
        ) : null}

        {/* Objectif (vendeurs sans accès aux rapports) */}
        {!canReports && myTarget ? (
          <Card style={styles.block}>
            <Text style={styles.muted}>{t('targets.mine')}</Text>
            <Text style={styles.targetValue}>{formatMoney(myTarget.achieved)}{myTarget.target !== null ? ` / ${formatMoney(myTarget.target)}` : ''}</Text>
            <ProgressBar percent={myTarget.percent} />
            <Text style={styles.muted}>{t('targets.sales', { n: myTarget.salesCount })}</Text>
          </Card>
        ) : null}

        {/* Évolution sur 7 jours */}
        {daily.length > 0 ? (
          <Card style={styles.block}>
            <View style={styles.chartHead}>
              <Text style={styles.cardTitle}>{isAr ? 'تطور المبيعات (7 أيام)' : 'Évolution des ventes (7 jours)'}</Text>
              <Text style={styles.chartTotal}>{formatMoney(weekTotal)}</Text>
            </View>
            <View
              style={styles.chart}
              accessible
              accessibilityLabel={daily.map((d) => `${dayNames[new Date(d.date).getDay()]} ${formatMoney(d.revenue)}`).join(', ')}
            >
              {daily.map((d, i) => {
                const isToday = i === daily.length - 1;
                return (
                  <View key={d.date} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: `${Math.max(4, (d.revenue / maxDay) * 100)}%` }, isToday && styles.barToday]} />
                    </View>
                    <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>{dayNames[new Date(d.date).getDay()]}</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {/* À surveiller */}
        {report && (report.lowStockCount > 0 || report.totalCustomerDebt > 0) ? (
          <View style={styles.alerts}>
            {report.lowStockCount > 0 ? (
              <Pressable accessibilityRole="button" style={styles.alert} onPress={() => navigation.navigate('Products')}>
                <IconTile name="alert-circle-outline" tone="danger" size={34} />
                <View style={styles.flex}>
                  <Text style={styles.alertValue}>{report.lowStockCount}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{t('reports.lowStock')}</Text>
                </View>
              </Pressable>
            ) : null}
            {report.totalCustomerDebt > 0 ? (
              <Pressable accessibilityRole="button" style={styles.alert} onPress={() => navigation.navigate('More', { screen: 'Aging' })}>
                <IconTile name="people-outline" tone="warning" size={34} />
                <View style={styles.flex}>
                  <Text style={styles.alertValue} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(report.totalCustomerDebt)}</Text>
                  <Text style={styles.muted} numberOfLines={1}>{t('reports.customerDebt')}</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Activité récente */}
        {canSales ? (
          <>
            <SectionHeader
              title={isAr ? 'النشاط الأخير' : 'Activité récente'}
              action={isAr ? 'عرض الكل' : 'Voir tout'}
              onAction={() => navigation.navigate('Sales', { screen: 'SalesHistory' })}
            />
            <Card style={styles.list}>
              {recent.length === 0 && !loading ? <Text style={styles.empty}>{t('history.empty')}</Text> : null}
              {recent.map((sale, i) => (
                <Pressable
                  key={sale.id}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('Sales', { screen: 'SaleDetail', params: { sale } })}
                  style={[styles.activity, i > 0 && styles.divider]}
                >
                  <IconTile name={sale.status === 'CANCELLED' ? 'close-circle-outline' : 'cart-outline'} tone={sale.status === 'CANCELLED' ? 'danger' : 'success'} size={36} />
                  <View style={styles.flex}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{isAr ? 'بيع' : 'Vente'} #{sale.number}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{timeOf(sale.saleDate)} · {sale.customerName ?? t('sales.walkIn')}</Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text style={styles.activityAmount}>{formatMoney(sale.total)}</Text>
                    {sale.remaining > 0 ? <Badge label={t('history.kridi')} tone="warning" /> : null}
                  </View>
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  flex: { flex: 1 },
  loader: { marginVertical: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  hello: { color: colors.text, fontSize: 15, fontWeight: '600' },
  name: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  muted: { color: colors.muted, fontSize: 12 },
  errorCard: { gap: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.danger },
  hero: { borderRadius: radius + 4, padding: spacing.md + 4, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, minHeight: 128 },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  heroValue: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 4 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: spacing.sm, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  heroChipText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  sparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 56 },
  sparkBar: { width: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  block: { marginTop: spacing.md, gap: spacing.sm },
  targetValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 14, flex: 1 },
  chartHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chartTotal: { color: colors.success, fontWeight: '800', fontSize: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 130, marginTop: spacing.sm },
  barCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, backgroundColor: colors.primarySoft },
  barToday: { backgroundColor: colors.primary },
  barLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  barLabelToday: { color: colors.text, fontWeight: '800' },
  alerts: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  alert: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.sm + 4 },
  alertValue: { color: colors.text, fontWeight: '900', fontSize: 15 },
  list: { paddingVertical: 4 },
  empty: { color: colors.muted, paddingVertical: spacing.md, textAlign: 'center' },
  activity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingVertical: spacing.sm + 4, minHeight: 56 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  activityTitle: { color: colors.text, fontWeight: '700' },
  activityRight: { alignItems: 'flex-end', gap: 4 },
  activityAmount: { color: colors.text, fontWeight: '800' },
});
