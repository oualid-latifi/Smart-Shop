import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Insights } from '../api/types';
import Screen from '../components/Screen';
import { Card, SectionHeader } from '../components/ui';
import { formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';
import { ProgressBar } from './TargetsScreen';

const WEEKDAYS = { fr: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], ar: ['إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد'] };

function Change({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <View style={[styles.change, { backgroundColor: up ? colors.successBg : colors.dangerBg }]}>
      <Ionicons name={up ? 'trending-up' : 'trending-down'} size={13} color={up ? colors.success : colors.danger} />
      <Text style={[styles.changeText, { color: up ? colors.success : colors.danger }]}>{up ? '+' : ''}{value}%</Text>
    </View>
  );
}

/** Analyses : comparaison mensuelle, prévision, jours et heures forts, marge par marque. */
export default function InsightsScreen() {
  const { t, i18n } = useTranslation();
  const isAr = !!i18n.language && i18n.language.startsWith('ar');
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    api<Insights>(`/api/reports/insights?days=${days}`).then(setData).catch((e) => setError(errorMessage(e, t)));
  }, [days, t]);

  if (!data) {
    return <Screen>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}</Screen>;
  }

  const maxDay = Math.max(1, ...data.byWeekday.map((d) => d.revenue));
  const openHours = data.byHour.filter((h) => h.index >= 8 && h.index <= 23);
  const maxHour = Math.max(1, ...openHours.map((h) => h.revenue));
  const forecastPct = data.forecast.projectedRevenue > 0 ? Math.round((data.forecast.revenueSoFar / data.forecast.projectedRevenue) * 100) : 0;

  return (
    <Screen>
      <Text style={styles.muted}>{t('insights.subtitle')}</Text>

      <SectionHeader title={t('insights.thisMonth')} />
      <View style={styles.tiles}>
        <Card style={styles.tile}>
          <Text style={styles.muted}>{t('insights.revenue')}</Text>
          <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(data.month.current.revenue)}</Text>
          <Change value={data.month.revenueChangePercent} />
        </Card>
        <Card style={styles.tile}>
          <Text style={styles.muted}>{t('insights.profit')}</Text>
          <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(data.month.current.profit)}</Text>
          <Change value={data.month.profitChangePercent} />
        </Card>
      </View>
      <Text style={styles.hint}>{t('insights.vsLast')}</Text>

      <Card style={styles.block}>
        <Text style={styles.cardTitle}>{t('insights.forecast')}</Text>
        <Text style={styles.forecast}>{formatMoney(data.forecast.projectedRevenue)}</Text>
        <ProgressBar percent={forecastPct} />
        <Text style={styles.muted}>{t('insights.forecastHint', { days: data.forecast.daysElapsed, total: data.forecast.daysInMonth })}</Text>
      </Card>

      <View style={styles.filters}>
        {[30, 90, 180].map((d) => (
          <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: days === d }} onPress={() => setDays(d)} style={[styles.chip, days === d && styles.chipOn]}>
            <Text style={[styles.chipText, days === d && styles.chipTextOn]}>{t('insights.period', { n: d })}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.block}>
        <Text style={styles.cardTitle}>{t('insights.weekdays')}</Text>
        <View style={styles.chart} accessible accessibilityLabel={data.byWeekday.map((d, i) => `${(isAr ? WEEKDAYS.ar : WEEKDAYS.fr)[i]} ${formatMoney(d.revenue)}`).join(', ')}>
          {data.byWeekday.map((d, i) => (
            <View key={d.index} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.max(4, (d.revenue / maxDay) * 100)}%` }, d.revenue === maxDay && styles.barTop]} />
              </View>
              <Text style={styles.barLabel}>{(isAr ? WEEKDAYS.ar : WEEKDAYS.fr)[i]}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.cardTitle}>{t('insights.hours')}</Text>
        <View style={styles.heat} accessible accessibilityLabel={openHours.map((h) => `${h.index}h ${formatMoney(h.revenue)}`).join(', ')}>
          {openHours.map((h) => (
            <View key={h.index} style={styles.heatCell}>
              <View style={[styles.heatBox, { opacity: 0.15 + 0.85 * (h.revenue / maxHour) }]} />
              <Text style={styles.heatLabel}>{h.index}h</Text>
            </View>
          ))}
        </View>
      </Card>

      <SectionHeader title={t('insights.brands')} />
      {data.byBrand.map((b) => (
        <View key={b.brand} style={styles.brandRow}>
          <View style={styles.flex}>
            <Text style={styles.name}>{b.brand}</Text>
            <Text style={styles.muted}>{formatMoney(b.revenue)} · {t('insights.units', { n: b.units })}</Text>
          </View>
          <View style={styles.right}>
            <Text style={[styles.margin, b.margin < 0 && styles.negative]}>{formatMoney(b.margin)}</Text>
            <Text style={styles.muted}>{b.marginPercent} %</Text>
          </View>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 11, marginTop: 4 },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, gap: 4 },
  big: { color: colors.text, fontSize: 18, fontWeight: '900' },
  change: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  changeText: { fontSize: 11, fontWeight: '800' },
  block: { marginTop: spacing.md, gap: spacing.sm },
  cardTitle: { color: colors.text, fontWeight: '800' },
  forecast: { color: colors.primary, fontSize: 24, fontWeight: '900' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  chipTextOn: { color: colors.onPrimary },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 120 },
  barCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6, backgroundColor: colors.primarySoft },
  barTop: { backgroundColor: colors.primary },
  barLabel: { color: colors.muted, fontSize: 10 },
  heat: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heatCell: { width: '10.5%', alignItems: 'center', gap: 2 },
  heatBox: { width: '100%', aspectRatio: 1, borderRadius: 6, backgroundColor: colors.primary },
  heatLabel: { color: colors.muted, fontSize: 9 },
  brandRow: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  name: { color: colors.text, fontWeight: '700' },
  margin: { color: colors.success, fontWeight: '800' },
  negative: { color: colors.danger },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
});
