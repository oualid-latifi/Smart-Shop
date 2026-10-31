import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Product, Supplier } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import TextField from '../components/TextField';
import { formatMoney, parseNumber } from '../format';
import type { PurchasesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<PurchasesStackParamList, 'PurchaseForm'>;

interface CartLine {
  product: Product;
  quantity: number;
  unitPrice: string; // texte tapé par l'utilisateur
}

export default function PurchaseFormScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliersError, setSuppliersError] = useState(false);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [paid, setPaid] = useState('');
  const [note, setNote] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSuppliers = useCallback(async () => {
    setSuppliersError(false);
    try {
      setSuppliers(await api<Supplier[]>('/api/suppliers'));
    } catch {
      setSuppliersError(true);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await api<Product[]>('/api/products');
      setProducts(p.filter((item) => item.active));
      await loadSuppliers();
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [loadSuppliers, t]);

  // Recharge à chaque retour (par exemple après avoir créé un fournisseur)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(query) || p.reference.toLowerCase().includes(query))
      .slice(0, 6);
  }, [products, search]);

  const total = cart.reduce(
    (sum, line) => sum + (parseNumber(line.unitPrice) ?? 0) * line.quantity,
    0,
  );
  const paidValue = parseNumber(paid) ?? 0;
  const remaining = Math.max(0, total - paidValue);

  function addProduct(product: Product) {
    setError(null);
    setCart((current) => {
      if (current.some((line) => line.product.id === product.id)) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        { product, quantity: 1, unitPrice: String(product.averagePurchasePrice || '') },
      ];
    });
    setSearch('');
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function changePrice(productId: string, value: string) {
    setCart((current) =>
      current.map((line) => (line.product.id === productId ? { ...line, unitPrice: value } : line)),
    );
  }

  async function submit() {
    const invalidPrice = cart.some((line) => {
      const price = parseNumber(line.unitPrice);
      return price === null || price < 0;
    });
    if (cart.length === 0 || invalidPrice) {
      setError(t('purchases.invalid'));
      return;
    }
    if (paid.trim() !== '' && (parseNumber(paid) === null || paidValue < 0 || paidValue > total)) {
      setError(t('purchases.invalidPaid'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api('/api/purchases', {
        method: 'POST',
        body: {
          supplierId,
          amountPaid: paidValue,
          note: note.trim() || null,
          lines: cart.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            unitPrice: parseNumber(line.unitPrice) ?? 0,
          })),
        },
      });
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('purchases.searchProduct')}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
        />

        {search.trim() !== '' ? (
          <View style={styles.results}>
            {matches.length === 0 ? (
              <Text style={styles.muted}>{t('purchases.noProducts')}</Text>
            ) : (
              matches.map((p) => (
                <Pressable key={p.id} style={styles.resultRow} onPress={() => addProduct(p)}>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{p.name}</Text>
                    <Text style={styles.muted}>
                      {p.reference} · {t('products.stock')} : {p.stockQuantity}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t('purchases.items')}</Text>
        {cart.length === 0 ? (
          <Text style={styles.muted}>{t('purchases.itemsEmpty')}</Text>
        ) : (
          cart.map((line) => (
            <View key={line.product.id} style={styles.cartRow}>
              <Text style={styles.name}>{line.product.name}</Text>
              <View style={styles.cartControls}>
                <View style={styles.qty}>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => changeQuantity(line.product.id, -1)}
                  >
                    <Text style={styles.qtyText}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>{line.quantity}</Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => changeQuantity(line.product.id, 1)}
                  >
                    <Text style={styles.qtyText}>+</Text>
                  </Pressable>
                </View>
                <View style={styles.priceBox}>
                  <Text style={styles.muted}>{t('purchases.unitPrice')}</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={line.unitPrice}
                    onChangeText={(value) => changePrice(line.product.id, value)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          ))
        )}

        {cart.length > 0 ? (
          <View style={styles.summary}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('purchases.total')}</Text>
              <Text style={styles.totalValue}>{formatMoney(total)}</Text>
            </View>

            <TextField
              label={t('purchases.amountPaid')}
              hint={t('purchases.amountPaidHint')}
              value={paid}
              onChangeText={setPaid}
              keyboardType="decimal-pad"
            />
            <View style={styles.payAll}>
              <PrimaryButton
                title={t('purchases.payAll')}
                onPress={() => setPaid(total.toFixed(2))}
                variant="outline"
              />
            </View>

            {remaining > 0 ? (
              <Text style={styles.due}>
                {t('purchases.remaining')} : {formatMoney(remaining)}
              </Text>
            ) : null}

            <Text style={styles.label}>{t('purchases.supplier')}</Text>
            {suppliersError ? (
              <View style={styles.supplierError}>
                <Text style={styles.error}>{t('purchases.supplierLoadError', { defaultValue: 'Impossible de charger les fournisseurs. Vous pouvez continuer sans fournisseur.' })}</Text>
                <PrimaryButton title={t('common.retry')} onPress={() => void loadSuppliers()} variant="outline" />
              </View>
            ) : null}
            <View style={styles.chips}>
              <Chip
                label={t('purchases.noSupplier')}
                active={supplierId === null}
                onPress={() => setSupplierId(null)}
              />
              {suppliers.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  active={supplierId === s.id}
                  onPress={() => setSupplierId(s.id)}
                />
              ))}
            </View>

            <TextField label={t('purchases.note')} value={note} onChangeText={setNote} />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {cart.length > 0 ? (
          <PrimaryButton title={t('purchases.save')} onPress={submit} loading={saving} />
        ) : null}
      </ScrollView>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loader: { marginTop: spacing.xl },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  results: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cartRow: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cartControls: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { fontSize: 20, color: colors.primary, fontWeight: '700' },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
    color: colors.text,
  },
  priceBox: { width: 130 },
  priceInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.text,
  },
  summary: { marginTop: spacing.md },
  supplierError: { gap: spacing.xs, marginBottom: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  totalLabel: { fontSize: 18, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  payAll: { marginBottom: spacing.md },
  due: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginVertical: spacing.md,
  },
});