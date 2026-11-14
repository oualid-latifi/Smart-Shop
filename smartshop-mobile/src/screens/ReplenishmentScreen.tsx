import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Replenishment, Supplier } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { Badge } from '../components/ui';
import { formatMoney } from '../format';
import type { MoreStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'Replenishment'>;

interface Choice {
  selected: boolean;
  quantity: string;
  supplierId: string | null;
}

/** Suggestions de commande d'après le rythme des ventes, transformées en bons de commande. */
export default function ReplenishmentScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [cover, setCover] = useState(15);
  const [rows, setRows] = useState<Replenishment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api<Replenishment[]>(`/api/stock/replenishment?days=${days}&coverDays=${cover}`),
        api<Supplier[]>('/api/suppliers'),
      ]);
      setRows(r);
      setSuppliers(s);
      setChoices(Object.fromEntries(r.map((x) => [x.productId, { selected: true, quantity: String(x.suggestedQuantity), supplierId: x.lastSupplierId }])));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setLoading(false);
    }
  }, [days, cover, t]);

  useEffect(() => { void load(); }, [load]);

  const selected = rows.filter((r) => choices[r.productId]?.selected && Number(choices[r.productId]?.quantity) > 0);
  const missingSupplier = selected.some((r) => !choices[r.productId]?.supplierId);
  const total = useMemo(() => selected.reduce((s, r) => s + Number(choices[r.productId].quantity) * r.lastPurchasePrice, 0), [selected, choices]);

  function update(id: string, patch: Partial<Choice>) {
    setChoices((c) => ({ ...c, [id]: { ...c[id], ...patch } }));
  }

  // Un bon de commande par fournisseur
  async function createOrders() {
    setSaving(true);
    setError(null);
    try {
      const bySupplier = new Map<string, Replenishment[]>();
      selected.forEach((r) => {
        const sid = choices[r.productId].supplierId as string;
        bySupplier.set(sid, [...(bySupplier.get(sid) ?? []), r]);
      });
      for (const [supplierId, lines] of bySupplier) {
        await api('/api/purchase-orders', {
          method: 'POST',
          body: { supplierId, lines: lines.map((r) => ({ productId: r.productId, quantity: Number(choices[r.productId].quantity), unitPrice: r.lastPurchasePrice })) },
        });
      }
      setInfo(t('replenish.created', { n: bySupplier.size }));
      navigation.navigate('PurchaseOrders');
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.muted}>{t('replenish.subtitle')}</Text>
      <View style={styles.filters}>
        {[15, 30, 90].map((d) => (
          <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: days === d }} onPress={() => setDays(d)} style={[styles.chip, days === d && styles.chipOn]}>
            <Text style={[styles.chipText, days === d && styles.chipTextOn]}>{t('replenish.period', { n: d })}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.filters}>
        {[7, 15, 30].map((d) => (
          <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: cover === d }} onPress={() => setCover(d)} style={[styles.chip, cover === d && styles.chipOn]}>
            <Text style={[styles.chipText, cover === d && styles.chipTextOn]}>{t('replenish.cover', { n: d })}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator color={colors.primary} /> : rows.length === 0 ? <Text style={styles.empty}>{t('replenish.empty')}</Text> : null}

      {!loading && rows.map((r) => {
        const c = choices[r.productId];
        if (!c) return null;
        return (
          <View key={r.productId} style={[styles.card, !c.selected && styles.off]}>
            <View style={styles.head}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: c.selected }} onPress={() => update(r.productId, { selected: !c.selected })} hitSlop={8}>
                <Ionicons name={c.selected ? 'checkbox' : 'square-outline'} size={24} color={colors.primary} />
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.muted}>{t('replenish.stock', { n: r.stock })} · {t('replenish.sold', { n: r.soldInPeriod })}</Text>
              </View>
              {r.daysOfCover !== null ? <Badge label={t('replenish.daysLeft', { n: r.daysOfCover })} tone={r.daysOfCover <= 3 ? 'danger' : 'warning'} /> : null}
            </View>
            <View style={styles.qtyRow}>
              <Text style={styles.label}>{t('replenish.toOrder')}</Text>
              <TextInput style={styles.qty} value={c.quantity} onChangeText={(v) => update(r.productId, { quantity: v.replace(/[^\d]/g, '') })} keyboardType="number-pad" accessibilityLabel={`${t('replenish.toOrder')} ${r.name}`} />
              <Text style={styles.muted}>× {formatMoney(r.lastPurchasePrice)}</Text>
            </View>
            <View style={styles.filters}>
              {suppliers.map((s) => (
                <Pressable key={s.id} accessibilityRole="radio" accessibilityState={{ checked: c.supplierId === s.id }} onPress={() => update(r.productId, { supplierId: s.id })} style={[styles.smallChip, c.supplierId === s.id && styles.chipOn]}>
                  <Text style={[styles.smallText, c.supplierId === s.id && styles.chipTextOn]}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}

      {selected.length > 0 ? (
        <View style={styles.footer}>
          <Text style={styles.total}>{formatMoney(total)}</Text>
          {missingSupplier ? <Text style={styles.warning}>{t('replenish.noSupplier')}</Text> : null}
          <PrimaryButton icon="clipboard-outline" title={t('replenish.create')} onPress={createOrders} loading={saving} disabled={missingSupplier} />
        </View>
      ) : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  chipTextOn: { color: colors.onPrimary },
  smallChip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  smallText: { color: colors.muted, fontSize: 12 },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  off: { opacity: 0.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  label: { color: colors.text, fontWeight: '600' },
  qty: { width: 70, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt, color: colors.text, textAlign: 'center', fontWeight: '800' },
  footer: { marginTop: spacing.lg, gap: spacing.sm },
  total: { color: colors.text, fontWeight: '900', fontSize: 20, textAlign: 'right' },
  warning: { color: colors.warning, fontWeight: '600' },
  info: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md, fontWeight: '700' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
});
