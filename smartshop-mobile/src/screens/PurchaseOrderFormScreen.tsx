import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Product, PurchaseOrder, Supplier } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { formatMoney, parseNumber } from '../format';
import type { MoreStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { useUnsavedChanges } from '../useUnsavedChanges';

type Props = NativeStackScreenProps<MoreStackParamList, 'PurchaseOrderForm'>;

interface Line {
  product: Product;
  quantity: string;
  price: string;
}

export default function PurchaseOrderFormScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useUnsavedChanges(lines.length > 0 && !saving);

  useEffect(() => {
    Promise.all([api<Supplier[]>('/api/suppliers'), api<Product[]>('/api/products')])
      .then(([s, p]) => { setSuppliers(s); setProducts(p.filter((x) => x.active)); })
      .catch((e) => setError(errorMessage(e, t)));
  }, [t]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)).slice(0, 8);
  }, [products, search]);

  const total = lines.reduce((sum, l) => sum + (parseNumber(l.quantity) ?? 0) * (parseNumber(l.price) ?? 0), 0);
  const valid = supplierId && lines.length > 0 && lines.every((l) => (parseNumber(l.quantity) ?? 0) >= 1 && (parseNumber(l.price) ?? -1) >= 0);

  async function save() {
    if (!supplierId) {
      setError(t('orders.needSupplier'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const order = await api<PurchaseOrder>('/api/purchase-orders', {
        method: 'POST',
        body: {
          supplierId,
          note: note.trim() || null,
          lines: lines.map((l) => ({ productId: l.product.id, quantity: Math.round(parseNumber(l.quantity) ?? 0), unitPrice: parseNumber(l.price) })),
        },
      });
      setLines([]);
      navigation.replace('PurchaseOrderDetail', { order });
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.section}>{t('orders.supplier')}</Text>
      <View style={styles.chips}>
        {suppliers.map((s) => (
          <Pressable key={s.id} accessibilityRole="radio" accessibilityState={{ checked: supplierId === s.id }} onPress={() => setSupplierId(s.id)} style={[styles.chip, supplierId === s.id && styles.chipActive]}>
            <Text style={[styles.chipText, supplierId === s.id && styles.chipTextActive]}>{s.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>{t('quotes.lines')}</Text>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={colors.muted} />
        <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder={t('quotes.addProducts')} placeholderTextColor={colors.muted} accessibilityLabel={t('quotes.addProducts')} />
      </View>
      {matches.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" style={styles.match} onPress={() => {
          if (!lines.some((l) => l.product.id === p.id)) {
            setLines((c) => [...c, { product: p, quantity: '1', price: String(p.averagePurchasePrice || '') }]);
          }
          setSearch('');
        }}>
          <Text style={styles.matchName} numberOfLines={1}>{p.name}</Text>
          <Text style={styles.muted}>{p.stockQuantity}</Text>
          <Ionicons name="add-circle" size={22} color={colors.primary} />
        </Pressable>
      ))}

      {lines.map((line) => (
        <View key={line.product.id} style={styles.line}>
          <View style={styles.lineHead}>
            <Text style={styles.matchName} numberOfLines={2}>{line.product.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('sales.remove')} hitSlop={10} onPress={() => setLines((c) => c.filter((l) => l !== line))}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
          <View style={styles.twoCols}>
            <View style={styles.flex}>
              <TextField label={t('warehouses.quantity')} value={line.quantity} keyboardType="number-pad"
                onChangeText={(v) => setLines((c) => c.map((l) => (l === line ? { ...l, quantity: v } : l)))} />
            </View>
            <View style={styles.flex}>
              <TextField label={`${t('orders.unitCost')} (DH)`} value={line.price} keyboardType="decimal-pad"
                onChangeText={(v) => setLines((c) => c.map((l) => (l === line ? { ...l, price: v } : l)))} />
            </View>
          </View>
        </View>
      ))}

      {lines.length > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('sales.total')}</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>
      ) : null}

      <TextField label={t('quotes.note')} value={note} onChangeText={setNote} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton icon="checkmark" title={t('orders.save')} onPress={save} loading={saving} disabled={!valid} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.sm, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  match: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  matchName: { flex: 1, color: colors.text, fontWeight: '700' },
  muted: { color: colors.muted },
  line: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  twoCols: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md },
  totalLabel: { fontSize: 18, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
});
