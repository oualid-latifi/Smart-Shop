import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Customer, Product, Quote } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { formatMoney, parseNumber } from '../format';
import type { QuotesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { useUnsavedChanges } from '../useUnsavedChanges';

type Props = NativeStackScreenProps<QuotesStackParamList, 'QuoteForm'>;

interface Line {
  product: Product;
  quantity: number;
  price: string;
}

export default function QuoteFormScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useUnsavedChanges(lines.length > 0 && !saving);

  useEffect(() => {
    Promise.all([api<Product[]>('/api/products'), api<Customer[]>('/api/customers')])
      .then(([p, c]) => {
        setProducts(p.filter((x) => x.active));
        setCustomers(c.filter((x) => x.active));
      })
      .catch((e) => setError(errorMessage(e, t)));
  }, [t]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => [p.name, p.reference, p.brand ?? '', p.model ?? ''].some((v) => v.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [products, search]);

  const customerMatches = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return (q ? customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)) : customers).slice(0, 12);
  }, [customers, customerSearch]);

  const priceOf = (line: Line) => {
    const v = parseNumber(line.price);
    return v !== null && v >= 0 ? v : line.product.salePrice;
  };
  const subtotal = lines.reduce((sum, l) => sum + priceOf(l) * l.quantity, 0);
  const discountValue = parseNumber(discount) ?? 0;
  const total = Math.max(0, subtotal - discountValue);

  function add(product: Product) {
    setLines((current) => {
      const existing = current.find((l) => l.product.id === product.id);
      if (existing) return current.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...current, { product, quantity: 1, price: String(product.salePrice) }];
    });
    setSearch('');
  }

  function change(productId: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((l) => (l.product.id === productId ? { ...l, ...patch } : l)).filter((l) => l.quantity > 0),
    );
  }

  async function save() {
    if (lines.length === 0) {
      setError(t('quotes.needLines'));
      return;
    }
    if (discountValue < 0 || discountValue > subtotal) {
      setError(t('sales.discountTooHigh'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const quote = await api<Quote>('/api/quotes', {
        method: 'POST',
        body: {
          customerId,
          customerName: customerId ? null : customerName.trim() || null,
          discount: discountValue,
          note: note.trim() || null,
          lines: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitPrice: priceOf(l) })),
        },
      });
      setLines([]);
      navigation.replace('QuoteDetail', { quote });
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.section}>{t('sales.customer')}</Text>
      <View style={styles.searchWrap}>
        <Ionicons name="person-outline" size={17} color={colors.muted} />
        <TextInput
          style={styles.search}
          value={customerSearch}
          onChangeText={setCustomerSearch}
          placeholder={t('sales.searchCustomer')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('sales.searchCustomer')}
        />
      </View>
      <View style={styles.chips}>
        {customerMatches.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: customerId === c.id }}
            onPress={() => setCustomerId(customerId === c.id ? null : c.id)}
            style={[styles.chip, customerId === c.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, customerId === c.id && styles.chipTextActive]}>{c.name}</Text>
          </Pressable>
        ))}
      </View>
      {!customerId ? (
        <TextField label={t('quotes.customerName')} value={customerName} onChangeText={setCustomerName} />
      ) : null}

      <Text style={styles.section}>{t('quotes.lines')}</Text>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={colors.muted} />
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('quotes.addProducts')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('quotes.addProducts')}
          autoCorrect={false}
        />
      </View>
      {matches.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" onPress={() => add(p)} style={({ pressed }) => [styles.match, pressed && styles.pressed]}>
          <Text style={styles.matchName} numberOfLines={1}>{p.name}</Text>
          <Text style={styles.muted}>{formatMoney(p.salePrice)}</Text>
          <Ionicons name="add-circle" size={22} color={colors.primary} />
        </Pressable>
      ))}

      {lines.map((line) => (
        <View key={line.product.id} style={styles.line}>
          <View style={styles.flex}>
            <Text style={styles.matchName} numberOfLines={2}>{line.product.name}</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                value={line.price}
                onChangeText={(price) => change(line.product.id, { price })}
                keyboardType="decimal-pad"
                selectTextOnFocus
                accessibilityLabel={`${t('sales.negotiatedPrice')} ${line.product.name}`}
              />
              <Text style={styles.muted}>= {formatMoney(priceOf(line) * line.quantity)}</Text>
            </View>
          </View>
          <View style={styles.qty}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('sales.decrease')} style={styles.qtyButton} onPress={() => change(line.product.id, { quantity: line.quantity - 1 })}>
              <Text style={styles.qtyText}>−</Text>
            </Pressable>
            <Text style={styles.qtyValue}>{line.quantity}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('sales.increase')} style={styles.qtyButton} onPress={() => change(line.product.id, { quantity: line.quantity + 1 })}>
              <Text style={styles.qtyText}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {lines.length > 0 ? (
        <>
          <TextField label={t('sales.discount')} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('sales.total')}</Text>
            <Text style={styles.totalValue}>{formatMoney(total)}</Text>
          </View>
        </>
      ) : null}

      <TextField label={t('quotes.note')} value={note} onChangeText={setNote} multiline />

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <PrimaryButton icon="checkmark" title={t('quotes.save')} onPress={save} loading={saving} disabled={lines.length === 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.sm, marginBottom: spacing.sm },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  muted: { color: colors.muted, fontSize: 13 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  match: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  matchName: { flex: 1, color: colors.text, fontWeight: '700' },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  priceInput: { minWidth: 84, minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, color: colors.text, fontWeight: '700', backgroundColor: colors.background },
  qty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 20, color: colors.primary, fontWeight: '700' },
  qtyValue: { fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center', color: colors.text },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  totalLabel: { fontSize: 18, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
});
