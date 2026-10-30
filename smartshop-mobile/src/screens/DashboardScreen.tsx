
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';

interface TopProductDto {
  productId: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

interface TodayReport {
  salesCount: number;
  revenue: number;
  grossProfit: number;
  netProfit: number;
  cashCollected: number;
  topProducts: TopProductDto[];
  totalCustomerDebt: number;
  stockValue: number;
  lowStockCount: number;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const isAr = !!i18n.language && i18n.language.startsWith('ar');

  const [report, setReport] = useState<TodayReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);

    try {
      setReport(await api<TodayReport>('/api/reports/today'));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const newSaleLabel = t('sales.new', {
    defaultValue: isAr ? 'عملية بيع جديدة' : 'Nouvelle vente',
  });

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Ionicons name="storefront" size={23} color="#fff" />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>SMARTSHOP</Text>

          <Text style={styles.hello} numberOfLines={1}>
            {t('home.welcome', { name: user?.name ?? '' })}
          </Text>

          <Text style={styles.subtitle}>
            {t('reports.today')}
          </Text>
        </View>

      
      </View>

      {/* New sale */}
      <Pressable
        style={({ pressed }) => [
          styles.saleHero,
          pressed && styles.pressed,
        ]}
        onPress={() => navigation.navigate('Sales')}
      >
        <View style={styles.saleIcon}>
          <Ionicons name="add" size={26} color={colors.primaryDark} />
        </View>

        <View style={styles.saleCopy}>
          <Text style={styles.saleEyebrow}>
            {isAr ? 'ابدأ عملية جديدة' : 'ACTION RAPIDE'}
          </Text>

          <Text style={styles.saleTitle}>
            {newSaleLabel}
          </Text>

          <Text style={styles.saleHint}>
            {isAr
              ? 'سجّل عملية بيع في ثوانٍ'
              : 'Enregistrer une vente en quelques secondes'}
          </Text>
        </View>

        <Ionicons
          name={isAr ? 'arrow-back' : 'arrow-forward'}
          size={20}
          color="#fff"
        />
      </Pressable>

      {/* Today's summary */}
      <View style={styles.sectionHeading}>
        <Text style={styles.section}>
          {isAr ? 'ملخص اليوم' : 'Résumé du jour'}
        </Text>

        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {isAr ? 'اليوم' : 'AUJOURD’HUI'}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          style={styles.loader}
          color={colors.primary}
        />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>

          <PrimaryButton
            title={t('common.retry')}
            onPress={() => void load()}
            variant="outline"
          />
        </View>
      ) : report ? (
        <>
          {/* Statistics */}
          <View style={styles.grid}>
            <StatCard
              icon="wallet-outline"
              label={t('reports.revenue')}
              value={formatMoney(report.revenue)}
              hint={t('reports.salesCount', { n: report.salesCount })}
              tone="teal"
            />

            <StatCard
              icon="trending-up-outline"
              label={t('reports.netProfit')}
              value={formatMoney(report.netProfit)}
              valueColor={
                report.netProfit < 0 ? colors.danger : colors.success
              }
              tone="green"
            />

            <StatCard
              icon="cash-outline"
              label={t('reports.cashCollected')}
              value={formatMoney(report.cashCollected)}
              tone="blue"
            />

            <StatCard
              icon="pie-chart-outline"
              label={t('reports.grossProfit')}
              value={formatMoney(report.grossProfit)}
              tone="violet"
            />
          </View>

          {/* Current information */}
          <Text style={styles.section}>
            {t('reports.now')}
          </Text>

          <View style={styles.card}>
            <Row
              icon="people-outline"
              label={t('reports.customerDebt')}
              value={formatMoney(report.totalCustomerDebt)}
              onPress={() => navigation.navigate('Customers')}
            />

            <View style={styles.divider} />

            <Row
              icon="alert-circle-outline"
              label={t('reports.lowStock')}
              value={String(report.lowStockCount)}
              valueColor={
                report.lowStockCount > 0 ? colors.danger : undefined
              }
              onPress={() => navigation.navigate('Products')}
            />

            <View style={styles.divider} />

            <Row
              icon="cube-outline"
              label={t('reports.stockValue')}
              value={formatMoney(report.stockValue)}
            />
          </View>

          {/* Top products and Reports navigation */}
          <View style={styles.sectionHeading}>
            <Text style={styles.section}>
              {t('reports.topProducts')}
            </Text>

            <Pressable
              onPress={() =>
                navigation.navigate('More', {
                  screen: 'Reports',
                  params: {
                    screen: 'Reports',
                  },
                })
              }
              accessibilityRole="button"
            >
              <Text style={styles.seeAll}>
                {isAr ? 'التقارير' : 'Voir rapports'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            {report.topProducts.length === 0 ? (
              <Text style={styles.empty}>
                {t('reports.noTop')}
              </Text>
            ) : (
              report.topProducts.slice(0, 3).map((p, i) => (
                <View key={p.productId}>
                  {i > 0 ? <View style={styles.divider} /> : null}

                  <View style={styles.topRow}>
                    <View style={styles.rank}>
                      <Text style={styles.rankText}>{i + 1}</Text>
                    </View>

                    <View style={styles.topInfo}>
                      <Text style={styles.topName} numberOfLines={1}>
                        {p.name}
                      </Text>

                      <Text style={styles.topSub}>
                        {p.quantitySold} {t('reports.sold')}
                      </Text>
                    </View>

                    <Text style={styles.topValue}>
                      {formatMoney(p.revenue)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  valueColor,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint?: string;
  valueColor?: string;
  tone: 'teal' | 'green' | 'blue' | 'violet';
}) {
  const toneStyle = {
    teal: styles.tone_teal,
    green: styles.tone_green,
    blue: styles.tone_blue,
    violet: styles.tone_violet,
  }[tone];

  const toneColor = {
    teal: '#0f766e',
    green: '#15803d',
    blue: '#1d4ed8',
    violet: '#6d28d9',
  }[tone];

  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, toneStyle]}>
        <Ionicons name={icon} size={19} color={toneColor} />
      </View>

      <Text style={styles.statLabel}>{label}</Text>

      <Text
        style={[
          styles.statValue,
          valueColor ? { color: valueColor } : null,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>

      {hint ? (
        <Text style={styles.statHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  valueColor,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  valueColor?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>

      <Text style={styles.rowLabel}>{label}</Text>

      <Text
        style={[
          styles.rowValue,
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>

      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.muted}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: { flex: 1 },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '900',
  },
  hello: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '600',
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },

  saleHero: {
    minHeight: 104,
    backgroundColor: colors.primaryDark,
    borderRadius: 22,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  saleIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#d7faf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleCopy: { flex: 1 },
  saleEyebrow: {
    color: '#b9eee4',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  saleTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 3,
  },
  saleHint: {
    color: '#d4f3ed',
    fontSize: 11,
    marginTop: 3,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  section: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: colors.successBg,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.success,
    fontSize: 9,
    fontWeight: '900',
  },

  seeAll: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  loader: { marginTop: spacing.xl },
  errorBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius,
    backgroundColor: colors.dangerBg,
    gap: spacing.md,
  },
  errorText: { color: colors.danger },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 126,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tone_teal: { backgroundColor: '#ccfbf1' },
  tone_green: { backgroundColor: '#dcfce7' },
  tone_blue: { backgroundColor: '#dbeafe' },
  tone_violet: { backgroundColor: '#ede9fe' },

  statLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  statValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  statHint: {
    marginTop: 3,
    fontSize: 11,
    color: colors.muted,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: colors.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },

  empty: {
    paddingVertical: spacing.md,
    color: colors.muted,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
  },
  topInfo: { flex: 1 },
  topName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  topSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  topValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
});
