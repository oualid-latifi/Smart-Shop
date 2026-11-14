import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { SupplierPrice } from '../api/types';
import { formatDate, formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';
import { Badge } from './ui';

/** Comparatif des prix d'achat d'un produit chez chaque fournisseur (le moins cher en premier). */
export default function SupplierPrices({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SupplierPrice[] | null>(null);

  useEffect(() => {
    api<SupplierPrice[]>(`/api/stock/supplier-prices/${productId}`).then(setRows).catch(() => setRows([]));
  }, [productId]);

  if (rows === null) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('supplierPrices.title')}</Text>
      {rows.length === 0 ? <Text style={styles.muted}>{t('supplierPrices.none')}</Text> : rows.map((r) => (
        <View key={r.supplierId ?? 'none'} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.name}>{r.supplierName}</Text>
            <Text style={styles.muted}>
              {t('supplierPrices.min')} {formatMoney(r.minPrice)} · {t('supplierPrices.avg')} {formatMoney(r.averagePrice)} · {formatDate(r.lastPurchaseDate)}
            </Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.price}>{formatMoney(r.lastPrice)}</Text>
            {r.cheapest && rows.length > 1 ? <Badge label={t('supplierPrices.cheapest')} tone="success" /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.md },
  title: { color: colors.text, fontWeight: '800', marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  name: { color: colors.text, fontWeight: '700' },
  price: { color: colors.text, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12 },
});
