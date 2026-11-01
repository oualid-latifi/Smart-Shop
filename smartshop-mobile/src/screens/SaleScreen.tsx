import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { createLocalSale, getCachedCustomers, getCachedProducts, saveCustomers, saveProducts } from '../database';
import { syncPendingOperations } from '../sync';
import { errorMessage } from '../api/errors';
import type { Customer, Product } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import TextField from '../components/TextField';
import { formatMoney, parseNumber } from '../format';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

interface CartLine {
  product: Product;
  quantity: number;
}

export default function SaleScreen() {
  const { t } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setCatalogError(null);

    // SQLite is the first source: the checkout catalogue is usable without a server.
    const [cachedProducts, cachedCustomers] = await Promise.all([
      getCachedProducts().catch(() => []),
      getCachedCustomers().catch(() => []),
    ]);
    if (cachedProducts.length > 0) {
      setProducts(shuffle(cachedProducts.filter((item) => item.active)));
    }
    if (cachedCustomers.length > 0) setCustomers(cachedCustomers);
    setLoading(false);

    const [productResult, customerResult] = await Promise.allSettled([
      api<Product[]>('/api/products'),
      api<Customer[]>('/api/customers'),
    ]);

    if (productResult.status === 'fulfilled') {
      await saveProducts(productResult.value);
      const refreshedLocalProducts = await getCachedProducts();
      const available = refreshedLocalProducts.filter((item) => item.active);
      setProducts(shuffle(available));
    } else if (cachedProducts.length === 0) {
      setCatalogError(errorMessage(productResult.reason, t));
    }

    if (customerResult.status === 'fulfilled') {
      await saveCustomers(customerResult.value);
      setCustomers(customerResult.value);
    } else if (cachedCustomers.length === 0) {
      // La vente comptant reste possible sans charger la liste des clients.
      setError(errorMessage(customerResult.reason, t));
    }
  }, [t]);

  // Recharge produits (stock à jour) et clients à chaque retour sur l'écran
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) =>
      [p.name, p.reference, p.brand ?? '', p.model ?? '']
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [products, search]);

  const subtotal = cart.reduce((sum, line) => sum + line.product.salePrice * line.quantity, 0);
  const discountValue = parseNumber(discount) ?? 0;
  const total = Math.max(0, subtotal - discountValue);
  const paidValue = parseNumber(paid);
  const remaining = paidValue === null ? 0 : Math.max(0, total - paidValue);

  function addProduct(product: Product) {
    if (product.stockQuantity <= 0) return;
    const existingLine = cart.find((line) => line.product.id === product.id);
    if (existingLine && existingLine.quantity >= product.stockQuantity) {
      setError(t('sales.stockLimit'));
      return;
    }
    setSuccess(false);
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
    setSearch('');
  }

  function changeQuantity(productId: string, delta: number) {
    if (delta > 0) {
      const line = cart.find((item) => item.product.id === productId);
      if (line && line.quantity >= line.product.stockQuantity) {
        setError(t('sales.stockLimit'));
        return;
      }
    }
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId ? { ...line, quantity: line.quantity + delta } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  async function submit() {
    if (cart.length === 0 || discountValue < 0 || discountValue > subtotal) {
      setError(t('sales.invalid'));
      return;
    }
    if (paid.trim() !== '' && (paidValue === null || paidValue < 0)) {
      setError(t('sales.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Commit locally first. A network outage must never discard a completed sale.
      await createLocalSale({
        customerId,
        discount: discountValue,
        amountPaid: paidValue,
        lines: cart.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          unitPrice: line.product.salePrice,
        })),
      });

      const soldQuantities = new Map<string, number>();
      for (const line of cart) {
        soldQuantities.set(
          line.product.id,
          (soldQuantities.get(line.product.id) ?? 0) + line.quantity,
        );
      }
      setProducts((current) => current.map((product) => {
        const stockQuantity = product.stockQuantity - (soldQuantities.get(product.id) ?? 0);
        return {
          ...product,
          stockQuantity,
          lowStock: stockQuantity <= product.alertThreshold,
        };
      }));
      setCart([]);
      setDiscount('');
      setPaid('');
      setCustomerId(null);
      setSearch('');
      setSuccess(true);

      // Retry in the background; the outbox survives app restarts.
      void syncPendingOperations().then((summary) => {
        if (summary.pending === 0 && summary.failed === 0 && summary.synced > 0) {
          void load();
        }
      }).catch(() => undefined);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
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
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder={t('sales.searchProduct')}
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />
          {search ? <Pressable onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable> : null}
        </View>

        <View style={styles.catalogHeading}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>{search.trim() ? t('sales.searchResults') : t('sales.catalog')}</Text>
            <Text style={styles.muted}>{matches.length} {t('sales.productsAvailable')}</Text>
          </View>
          <Ionicons name="grid-outline" size={21} color={colors.primary} />
        </View>
        {catalogError ? (
          <View style={styles.emptyCatalog}>
            <Text style={styles.error}>{catalogError}</Text>
            <PrimaryButton title={t('common.retry')} onPress={() => void load()} variant="outline" />
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.emptyCatalog}><Ionicons name="cube-outline" size={28} color={colors.muted} /><Text style={styles.muted}>{t('sales.noProducts')}</Text></View>
        ) : (
          <View style={styles.catalogGrid}>
            {matches.map((p) => (
              <Pressable key={p.id} style={({ pressed }) => [styles.productCard, pressed && styles.productPressed, p.stockQuantity <= 0 && styles.productUnavailable]} onPress={() => addProduct(p)} disabled={p.stockQuantity <= 0}>
                {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.productImage} resizeMode="cover" /> : <View style={styles.productIcon}><Ionicons name="phone-portrait-outline" size={23} color={colors.primary} /></View>}
                <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.productMeta} numberOfLines={1}>{[p.brand, p.model].filter(Boolean).join(' · ') || p.reference}</Text>
                <Text style={styles.productPrice}>{formatMoney(p.salePrice)}</Text>
                <View style={styles.stockBadge}><View style={[styles.stockDot, p.stockQuantity <= p.alertThreshold && styles.stockDotLow]} /><Text style={styles.stockText}>{p.stockQuantity > 0 ? `${t('products.stock')}: ${p.stockQuantity}` : t('sales.outOfStock')}</Text></View>
                <View style={styles.addProduct}><Ionicons name="add" size={17} color={colors.onPrimary} /><Text style={styles.addProductText}>{t('sales.addToCart')}</Text></View>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('sales.cart')}</Text>
        {cart.length === 0 ? (
          <Text style={styles.muted}>{t('sales.cartEmpty')}</Text>
        ) : (
          cart.map((line) => (
            <View key={line.product.id} style={styles.cartRow}>
              <View style={styles.flex}>
                <Text style={styles.name}>{line.product.name}</Text>
                <Text style={styles.muted}>
                  {formatMoney(line.product.salePrice)} × {line.quantity} ={' '}
                  {formatMoney(line.product.salePrice * line.quantity)}
                </Text>
              </View>
              <View style={styles.qty}>
                <Pressable style={styles.qtyButton} onPress={() => changeQuantity(line.product.id, -1)}>
                  <Text style={styles.qtyText}>−</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{line.quantity}</Text>
                <Pressable style={styles.qtyButton} onPress={() => changeQuantity(line.product.id, 1)} disabled={line.quantity >= line.product.stockQuantity}>
                  <Text style={styles.qtyText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {cart.length > 0 ? (
          <View style={styles.summary}>
            <TextField
              label={t('sales.discount')}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="decimal-pad"
            />

            <View style={styles.totalRow}>
              <Text style={styles.muted}>{t('sales.subtotal')}</Text>
              <Text style={styles.text}>{formatMoney(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('sales.total')}</Text>
              <Text style={styles.totalValue}>{formatMoney(total)}</Text>
            </View>

            <View style={styles.paidSection}>
              <Text style={styles.label}>{t('sales.amountPaid')}</Text>
              <View style={styles.paidInputRow}>
                <TextInput
                  style={styles.paidInput}
                  value={paid}
                  onChangeText={setPaid}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                />
                <Pressable
                  style={({ pressed }) => [styles.fullPaymentButton, pressed && styles.productPressed]}
                  onPress={() => setPaid(total.toFixed(2))}
                >
                  <Ionicons name="checkmark-circle-outline" size={17} color={colors.onPrimary} />
                  <Text style={styles.fullPaymentText}>{t('sales.allPaid')}</Text>
                </Pressable>
              </View>
              <Text style={styles.paidHint}>{t('sales.amountPaidHint')}</Text>
            </View>

            {remaining > 0 ? (
              <Text style={styles.kridi}>
                {t('sales.remaining')} : {formatMoney(remaining)}
              </Text>
            ) : null}

            <Text style={styles.label}>{t('sales.customer')}</Text>
            <View style={styles.chips}>
              <Chip
                label={t('sales.walkIn')}
                active={customerId === null}
                onPress={() => setCustomerId(null)}
              />
              {customers.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  active={customerId === c.id}
                  onPress={() => setCustomerId(c.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{t('sales.success')}</Text> : null}

        {cart.length > 0 ? (
          <PrimaryButton title={t('sales.save')} onPress={submit} loading={saving} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function shuffle<T,>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
  content: { padding: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 560, alignSelf: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius + 3, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  search: { flex: 1, paddingVertical: 13, fontSize: 15, color: colors.text },
  catalogHeading: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  catalogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  productCard: { width: '48%', flexGrow: 1, minWidth: 145, backgroundColor: colors.card, borderRadius: radius + 2, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: 2 },
  productPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  productUnavailable: { opacity: 0.48 },
  productIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  productImage: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.neutralBg, marginBottom: spacing.sm },
  productName: { color: colors.text, fontSize: 14, fontWeight: '700', minHeight: 36 },
  productMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  productPrice: { color: colors.primary, fontSize: 16, fontWeight: '800', marginTop: spacing.sm },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  stockDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  stockDotLow: { backgroundColor: colors.danger },
  stockText: { color: colors.muted, fontSize: 10 },
  addProduct: { backgroundColor: colors.primary, borderRadius: 9, paddingVertical: 7, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addProductText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
  emptyCatalog: { backgroundColor: colors.card, borderRadius: radius, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  price: { fontSize: 15, fontWeight: '700', color: colors.primary },
  text: { color: colors.text, fontSize: 15 },
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
  qtyValue: { fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center', color: colors.text },
  summary: { marginTop: spacing.md },
  paidSection: { marginBottom: spacing.md },
  paidInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  paidInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: 15, color: colors.text },
  fullPaymentButton: { minHeight: 48, borderRadius: radius, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.primary },
  fullPaymentText: { color: colors.onPrimary, fontWeight: '800', fontSize: 12 },
  paidHint: { color: colors.muted, fontSize: 12, marginTop: spacing.xs },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  totalLabel: { fontSize: 18, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  kridi: {
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
  success: {
    color: colors.success,
    backgroundColor: colors.successBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginVertical: spacing.md,
    fontWeight: '700',
  },
});