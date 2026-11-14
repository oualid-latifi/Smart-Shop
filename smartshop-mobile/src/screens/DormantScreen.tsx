import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { DormantProduct } from '../api/types';
import Screen from '../components/Screen';
import { Badge, Card } from '../components/ui';
import { formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';

/** Produits en stock qui ne se vendent plus : argent immobilisé à libérer (promotion, retour fournisseur…). */
export default function DormantScreen() {
  const { t } = useTranslation();
  const [days, setDays] = useState(60);
  const [rows, setRows] = useState<DormantProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api<DormantProduct[]>(`/api/stock/dormant?days=${days}`)
      .then(setRows)
      .catch((e) => setError(errorMessage(e, t)))
      .finally(() => setLoading(false));
  }, [days, t]);

  const total = rows.reduce((s, r) => s + r.stockValue, 0);

  return (
    <Screen>
      <Text style={styles.muted}>{t('dormant.subtitle')}</Text>
      <View style={styles.filters}>
        {[30, 60, 90, 180].map((d) => (
          <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: days === d }} onPress={() => setDays(d)} style={[styles.chip, days === d && styles.chipOn]}>
            <Text style={[styles.chipText, days === d && styles.chipTextOn]}>{t('dormant.days', { n: d })}</Text>
          </Pressable>
        ))}
      </View>
      {rows.length > 0 ? (
        <Card style={styles.total}>
          <Text style={styles.muted}>{t('dormant.value')}</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </Card>
      ) : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : rows.length === 0 ? <Text style={styles.empty}>{t('dormant.empty')}</Text> : null}
      {!loading && rows.map((r) => (
        <View key={r.productId} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
            <Text style={styles.muted}>{r.reference} · {t('replenish.stock', { n: r.stock })}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.value}>{formatMoney(r.stockValue)}</Text>
            <Badge label={r.daysWithoutSale === null ? t('dormant.never') : t('dormant.since', { n: r.daysWithoutSale })} tone={r.daysWithoutSale === null || r.daysWithoutSale > 90 ? 'danger' : 'warning'} />
          </View>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  chipTextOn: { color: colors.onPrimary },
  total: { marginBottom: spacing.sm },
  totalValue: { color: colors.warning, fontSize: 24, fontWeight: '900' },
  row: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  name: { color: colors.text, fontWeight: '700' },
  value: { color: colors.text, fontWeight: '800' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
});
