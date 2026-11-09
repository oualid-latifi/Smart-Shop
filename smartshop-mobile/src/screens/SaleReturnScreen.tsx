import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Sale } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { formatMoney } from '../format';
import type { SalesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<SalesStackParamList, 'SaleReturn'>;

interface Choice {
  quantity: number;
  restock: boolean;
}

/** Retour d'articles d'une vente : quantités, état (remis en stock ou abîmé), motif. */
export default function SaleReturnScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const sale = route.params.sale;
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Une même référence peut figurer sur plusieurs lignes : on regroupe par produit
  const products = useMemo(() => {
    const map = new Map<string, { productId: string; name: string; sold: number; returned: number; unitPrice: number }>();
    sale.lines.forEach((l) => {
      const current = map.get(l.productId);
      if (current) current.sold += l.quantity;
      else map.set(l.productId, { productId: l.productId, name: l.productName, sold: l.quantity, returned: l.returnedQuantity, unitPrice: l.unitPrice });
    });
    return [...map.values()];
  }, [sale]);

  // Estimation affichée (le serveur fait le calcul exact, remise répartie au prorata)
  const ratio = sale.total + sale.discount > 0 ? sale.total / (sale.total + sale.discount) : 1;
  const credit = products.reduce((sum, p) => sum + (choices[p.productId]?.quantity ?? 0) * p.unitPrice * ratio, 0);
  const refund = Math.max(0, credit - Math.max(0, sale.remaining));

  function setQuantity(productId: string, quantity: number, max: number) {
    const q = Math.min(Math.max(0, quantity), max);
    setChoices((c) => ({ ...c, [productId]: { quantity: q, restock: c[productId]?.restock ?? true } }));
  }

  async function save() {
    const lines = Object.entries(choices)
      .filter(([, c]) => c.quantity > 0)
      .map(([productId, c]) => ({ productId, quantity: c.quantity, restock: c.restock }));
    if (lines.length === 0) {
      setError(t('returns.none'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Sale>(`/api/sales/${sale.id}/returns`, {
        method: 'POST',
        body: { lines, reason: reason.trim() || null, refundMethod: 'CASH' },
      });
      navigation.navigate('SaleDetail', { sale: updated });
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.number}>{sale.number}</Text>
      {products.map((p) => {
        const max = p.sold - p.returned;
        const choice = choices[p.productId] ?? { quantity: 0, restock: true };
        return (
          <View key={p.productId} style={[styles.card, max === 0 && styles.disabled]}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.muted}>{t('returns.returnable', { n: max })} · {formatMoney(p.unitPrice)}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>{t('returns.quantity')}</Text>
              <View style={styles.qty}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('sales.decrease')} style={styles.qtyButton} onPress={() => setQuantity(p.productId, choice.quantity - 1, max)} disabled={max === 0}>
                  <Text style={styles.qtyText}>−</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{choice.quantity}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('sales.increase')} style={styles.qtyButton} onPress={() => setQuantity(p.productId, choice.quantity + 1, max)} disabled={choice.quantity >= max}>
                  <Text style={styles.qtyText}>+</Text>
                </Pressable>
              </View>
            </View>
            {choice.quantity > 0 ? (
              <View style={styles.row}>
                <Text style={styles.label}>{choice.restock ? t('returns.restock') : t('returns.damaged')}</Text>
                <Switch
                  value={choice.restock}
                  onValueChange={(restock) => setChoices((c) => ({ ...c, [p.productId]: { ...choice, restock } }))}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  accessibilityLabel={t('returns.restock')}
                />
              </View>
            ) : null}
          </View>
        );
      })}

      <TextField label={t('returns.reason')} value={reason} onChangeText={setReason} />

      {credit > 0 ? (
        <View style={styles.summary}>
          <View style={styles.sumRow}><Text style={styles.muted}>{t('returns.credit')}</Text><Text style={styles.value}>{formatMoney(credit)}</Text></View>
          {credit - refund > 0 ? (
            <View style={styles.sumRow}><Text style={styles.muted}>{t('returns.debtReduced')}</Text><Text style={styles.value}>{formatMoney(credit - refund)}</Text></View>
          ) : null}
          {refund > 0 ? (
            <View style={styles.sumRow}><Text style={styles.refundLabel}>{t('returns.refund')}</Text><Text style={styles.refund}>{formatMoney(refund)}</Text></View>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <PrimaryButton icon="return-down-back-outline" title={t('returns.save')} onPress={save} loading={saving} disabled={credit === 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  number: { color: colors.primary, fontWeight: '800', marginBottom: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  disabled: { opacity: 0.5 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  label: { color: colors.text, fontSize: 14 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 20, color: colors.primary, fontWeight: '700' },
  qtyValue: { fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center', color: colors.text },
  summary: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, gap: spacing.xs },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { color: colors.text, fontWeight: '700' },
  refundLabel: { color: colors.danger, fontWeight: '700' },
  refund: { color: colors.danger, fontWeight: '800', fontSize: 16 },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
});
