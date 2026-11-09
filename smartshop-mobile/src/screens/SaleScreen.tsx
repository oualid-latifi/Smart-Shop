import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SalesStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Customer, Product, Sale } from '../api/types';
import BarcodeScanner from '../components/BarcodeScanner';
import PaymentMethodPicker, { EMPTY_PAYMENT, paymentBody, paymentError, type PaymentValue } from '../components/PaymentMethodPicker';
import PrimaryButton from '../components/PrimaryButton';
import TextField from '../components/TextField';
import { confirmAction } from '../confirm';
import { formatMoney, parseNumber } from '../format';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

interface CartLine {
  product: Product;
  quantity: number;
  price: string; // prix négociable (d'une unité, ou d'un carton si packs), saisi en texte
  packs: boolean; // true = la quantité compte des cartons
}

// Nombre d'unités retirées du stock par cette ligne
function unitsOf(line: CartLine): number {
  return line.packs && line.product.unitsPerPack ? line.quantity * line.product.unitsPerPack : line.quantity;
}

// Unités ajoutées par un appui sur "+"
function stepOf(line: CartLine): number {
  return line.packs && line.product.unitsPerPack ? line.product.unitsPerPack : 1;
}

function catalogPrice(line: CartLine): number {
  return line.packs && line.product.packPrice != null ? line.product.packPrice : line.product.salePrice;
}

type Props = NativeStackScreenProps<SalesStackParamList, 'SaleNew'>;

// Prix retenu pour une ligne : le prix négocié s'il est valide, sinon le prix catalogue
function unitPrice(line: CartLine): number {
  const value = parseNumber(line.price);
  return value !== null && value >= 0 ? value : catalogPrice(line);
}

export default function SaleScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const success = lastSale !== null;
  const [discountMode, setDiscountMode] = useState<'DH' | '%'>('DH');
  const [payment, setPayment] = useState<PaymentValue>(EMPTY_PAYMENT);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const scrollRef = useRef<ScrollViewInstance>(null);
  const [cartY, setCartY] = useState(0);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        api<Product[]>('/api/products'),
        api<Customer[]>('/api/customers'),
      ]);
      const available = p.filter((item) => item.active);
      // Mélange l'ordre du catalogue à chaque ouverture/actualisation de l'écran.
      setProducts(shuffle(available));
      setCustomers(c.filter((customer) => customer.active));
    } catch (e) {
      setError(errorMessage(e, t));
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
      [p.name, p.reference, p.brand ?? '', p.model ?? '', p.barcode ?? '']
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [products, search]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(query) || (c.phone ?? '').includes(query));
  }, [customers, customerSearch]);

  const quantityInCart = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((line) => map.set(line.product.id, unitsOf(line)));
    return map;
  }, [cart]);

  const itemCount = cart.reduce((sum, line) => sum + unitsOf(line), 0);
  const subtotal = cart.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);
  const discountInput = parseNumber(discount) ?? 0;
  const discountValue = discountMode === '%' ? Math.round(subtotal * discountInput) / 100 : discountInput;
  const total = Math.max(0, subtotal - discountValue);
  const paidValue = parseNumber(paid);
  const remaining = paidValue === null ? 0 : Math.max(0, total - paidValue);
  const change = paidValue !== null && paidValue > total ? paidValue - total : 0;

  // Erreurs détectées pendant la saisie, avant même d'envoyer la vente
  const discountError =
    discount.trim() !== '' && (parseNumber(discount) === null || discountValue < 0)
      ? t('form.invalidNumber')
      : discountValue > subtotal || (discountMode === '%' && discountInput > 100)
        ? t('sales.discountTooHigh')
        : null;
  const paidError = paid.trim() !== '' && (paidValue === null || paidValue < 0) ? t('sales.paidInvalid') : null;
  const creditWithoutCustomer = remaining > 0 && customerId === null;
  const checkWithoutCustomer = payment.method === 'CHECK' && customerId === null;
  const paymentProblem = paymentError(payment, t);
  const canSubmit = cart.length > 0 && !discountError && !paidError && !creditWithoutCustomer && !checkWithoutCustomer && !paymentProblem;

  // Le message de succès disparaît tout seul
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setLastSale(null), 10000);
    return () => clearTimeout(timer);
  }, [success]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function clearCart() {
    confirmAction(
      t('sales.clearCartConfirm'),
      () => {
        setCart([]);
        setDiscount('');
        setPaid('');
        setError(null);
      },
      t('common.cancel'),
      t('sales.clearCart'),
    );
  }

  // Code lu par la caméra : le produit est ajouté directement au panier
  async function onScanned(code: string) {
    setScanning(false);
    let product = products.find((p) => p.barcode === code);
    if (!product) {
      try {
        product = await api<Product>(`/api/products/barcode/${encodeURIComponent(code)}`);
      } catch {
        setError(t('scanner.notFound', { code }));
        return;
      }
    }
    addProduct(product);
  }

  function scrollToCart() {
    scrollRef.current?.scrollTo({ y: Math.max(0, cartY - spacing.md), animated: true });
  }

  function addProduct(product: Product) {
    if (product.stockQuantity <= 0) return;
    const existingLine = cart.find((line) => line.product.id === product.id);
    if (existingLine && unitsOf(existingLine) + stepOf(existingLine) > product.stockQuantity) {
      setError(t('sales.stockLimit'));
      return;
    }
    setLastSale(null);
    setError(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [...current, { product, quantity: 1, price: String(product.salePrice), packs: false }];
    });
    setSearch('');
  }

  function changeQuantity(productId: string, delta: number) {
    if (delta > 0) {
      const line = cart.find((item) => item.product.id === productId);
      if (line && unitsOf(line) + stepOf(line) > line.product.stockQuantity) {
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
    if (!canSubmit) {
      setError(creditWithoutCustomer ? t('sales.creditNeedsCustomer') : checkWithoutCustomer ? t('payments.checkNeedsCustomer') : paymentProblem ?? t('sales.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await api<Sale>('/api/sales', {
        method: 'POST',
        body: {
          customerId,
          discount: discountMode === 'DH' ? discountValue : null,
          discountPercent: discountMode === '%' && discount.trim() !== '' ? discountInput : null,
          amountPaid: paidValue,
          paymentMethod: paymentBody(payment).method,
          check: paymentBody(payment).check,
          lines: cart.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            packs: line.packs,
            unitPrice: unitPrice(line),
          })),
        },
      });
      setCart([]);
      setDiscount('');
      setPaid('');
      setCustomerId(null);
      setPayment(EMPTY_PAYMENT);
      setCustomerSearch('');
      setSearch('');
      setLastSale(created);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      await load();
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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, cart.length > 0 && styles.contentWithBar]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {success ? (
          <View style={styles.success} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <View style={styles.flex}>
              <Text style={styles.successText}>{t('sales.success')}</Text>
              <Text style={styles.muted}>{lastSale?.number} · {formatMoney(lastSale?.total)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => lastSale && navigation.navigate('SaleDetail', { sale: lastSale })}
              style={styles.printButton}
              hitSlop={6}
            >
              <Ionicons name="print-outline" size={16} color={colors.onPrimary} />
              <Text style={styles.printText}>{t('sales.printSale')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder={t('sales.searchProduct')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('sales.searchProduct')}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={() => setSearch('')} hitSlop={12}>
              <Ionicons name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('scanner.title')} onPress={() => setScanning(true)} style={styles.scanButton}>
            <Ionicons name="barcode-outline" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
        <BarcodeScanner visible={scanning} onClose={() => setScanning(false)} onScanned={(code) => void onScanned(code)} />

        <View style={styles.catalogHeading}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>{search.trim() ? t('sales.searchResults') : t('sales.catalog')}</Text>
            <Text style={styles.muted}>{matches.length} {t('sales.productsAvailable')}</Text>
          </View>
          <Ionicons name="grid-outline" size={21} color={colors.primary} />
        </View>
        {matches.length === 0 ? (
          <View style={styles.emptyCatalog}><Ionicons name="cube-outline" size={28} color={colors.muted} /><Text style={styles.muted}>{t('sales.noProducts')}</Text></View>
        ) : (
          <View style={styles.catalogGrid}>
            {matches.map((p) => {
              const inCart = quantityInCart.get(p.id) ?? 0;
              const unavailable = p.stockQuantity <= 0;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}, ${formatMoney(p.salePrice)}, ${unavailable ? t('sales.outOfStock') : `${t('products.stock')} ${p.stockQuantity}`}${inCart ? `, ${inCart} ${t('sales.inCart')}` : ''}`}
                  accessibilityHint={unavailable ? undefined : t('sales.addToCart')}
                  accessibilityState={{ disabled: unavailable }}
                  key={p.id}
                  style={({ pressed }) => [styles.productCard, inCart > 0 && styles.productInCart, pressed && styles.productPressed, unavailable && styles.productUnavailable]}
                  onPress={() => addProduct(p)}
                  disabled={unavailable}
                >
                  {inCart > 0 ? <View style={styles.inCartBadge}><Text style={styles.inCartText}>{inCart}</Text></View> : null}
                  {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.productImage} resizeMode="cover" /> : <View style={styles.productIcon}><Ionicons name="phone-portrait-outline" size={23} color={colors.primary} /></View>}
                  <Text style={styles.productName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.productMeta} numberOfLines={1}>{[p.brand, p.model].filter(Boolean).join(' · ') || p.reference}</Text>
                  <Text style={styles.productPrice}>{formatMoney(p.salePrice)}</Text>
                  <View style={styles.stockBadge}><View style={[styles.stockDot, p.stockQuantity <= p.alertThreshold && styles.stockDotLow]} /><Text style={styles.stockText}>{unavailable ? t('sales.outOfStock') : `${t('products.stock')}: ${p.stockQuantity}`}</Text></View>
                  <View style={[styles.addProduct, unavailable && styles.addProductDisabled]}><Ionicons name="add" size={17} color={colors.onPrimary} /><Text style={styles.addProductText}>{t('sales.addToCart')}</Text></View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.cartHeading} onLayout={(e) => setCartY(e.nativeEvent.layout.y)}>
          <Text style={[styles.sectionTitle, styles.flex]}>
            {t('sales.cart')}{itemCount > 0 ? ` · ${t('sales.cartCount', { count: itemCount })}` : ''}
          </Text>
          {cart.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={clearCart} hitSlop={10} style={styles.clearCart}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.clearCartText}>{t('sales.clearCart')}</Text>
            </Pressable>
          ) : null}
        </View>
        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Ionicons name="cart-outline" size={28} color={colors.muted} />
            <Text style={[styles.muted, styles.center]}>{t('sales.cartEmpty')}</Text>
          </View>
        ) : (
          cart.map((line) => (
            <View key={line.product.id} style={styles.cartRow}>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={2}>{line.product.name}</Text>
                {line.product.unitsPerPack ? (
                  <View style={styles.packToggle} accessibilityRole="radiogroup">
                    {[false, true].map((packs) => (
                      <Pressable
                        key={String(packs)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: line.packs === packs }}
                        onPress={() => setCart((current) => current.map((l) => (l.product.id === line.product.id && l.packs !== packs
                          ? { ...l, packs, quantity: 1, price: String(packs ? l.product.packPrice ?? l.product.salePrice * (l.product.unitsPerPack ?? 1) : l.product.salePrice) }
                          : l)))}
                        style={[styles.packOption, line.packs === packs && styles.packOptionActive]}
                      >
                        <Text style={[styles.packText, line.packs === packs && styles.packTextActive]}>
                          {packs ? t('sales.pack', { n: line.product.unitsPerPack }) : t('sales.unit')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.priceRow}>
                  <TextInput
                    style={[styles.priceInput, parseNumber(line.price) === null && styles.priceInputError]}
                    value={line.price}
                    onChangeText={(value) => setCart((current) => current.map((l) => (l.product.id === line.product.id ? { ...l, price: value } : l)))}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    accessibilityLabel={`${t('sales.negotiatedPrice')} ${line.product.name}`}
                  />
                  <Text style={styles.muted}>× {line.quantity} = {formatMoney(unitPrice(line) * line.quantity)}</Text>
                </View>
                {unitPrice(line) !== catalogPrice(line) ? (
                  <Text style={styles.catalogPrice}>{formatMoney(catalogPrice(line))}</Text>
                ) : null}
              </View>
              <View style={styles.qty}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={line.quantity === 1 ? t('sales.remove') : t('sales.decrease')}
                  style={({ pressed }) => [styles.qtyButton, line.quantity === 1 && styles.qtyButtonDanger, pressed && styles.productPressed]}
                  onPress={() => changeQuantity(line.product.id, -1)}
                >
                  {line.quantity === 1
                    ? <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    : <Text style={styles.qtyText}>−</Text>}
                </Pressable>
                <Text style={styles.qtyValue}>{line.quantity}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('sales.increase')}
                  accessibilityState={{ disabled: unitsOf(line) + stepOf(line) > line.product.stockQuantity }}
                  style={({ pressed }) => [styles.qtyButton, unitsOf(line) + stepOf(line) > line.product.stockQuantity && styles.qtyButtonDisabled, pressed && styles.productPressed]}
                  onPress={() => changeQuantity(line.product.id, 1)}
                  disabled={unitsOf(line) + stepOf(line) > line.product.stockQuantity}
                >
                  <Text style={styles.qtyText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {cart.length > 0 ? (
          <View style={styles.summary}>
            <View style={styles.paidRow}>
              <View style={styles.paidField}>
                <TextField
                  label={discountMode === '%' ? t('sales.discount').replace('DH', '%') : t('sales.discount')}
                  value={discount}
                  onChangeText={setDiscount}
                  keyboardType="decimal-pad"
                  error={discountError}
                  hint={discountMode === '%' && discountValue > 0 ? `= ${formatMoney(discountValue)}` : undefined}
                />
              </View>
              <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={t('sales.discountMode')}>
                {(['DH', '%'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: discountMode === mode }}
                    onPress={() => setDiscountMode(mode)}
                    style={[styles.segmentItem, discountMode === mode && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, discountMode === mode && styles.segmentTextActive]}>{mode}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.muted}>{t('sales.subtotal')}</Text>
              <Text style={styles.text}>{formatMoney(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('sales.total')}</Text>
              <Text style={styles.totalValue}>{formatMoney(total)}</Text>
            </View>

            <View style={styles.paidRow}>
              <View style={styles.paidField}>
                <TextField
                  label={t('sales.amountPaid')}
                  hint={t('sales.amountPaidHint')}
                  value={paid}
                  onChangeText={setPaid}
                  keyboardType="decimal-pad"
                  error={paidError}
                />
              </View>
              <Pressable accessibilityRole="button" style={styles.fullPaymentButton} onPress={() => setPaid(total.toFixed(2))}>
                <Text style={styles.fullPaymentText}>{t('sales.allPaid')}</Text>
              </Pressable>
            </View>

            {remaining > 0 ? (
              <Text style={styles.kridi}>
                {t('sales.remaining')} : {formatMoney(remaining)}
              </Text>
            ) : null}
            {change > 0 ? (
              <Text style={styles.change}>
                {t('sales.change')} : {formatMoney(change)}
              </Text>
            ) : null}

            <PaymentMethodPicker value={payment} onChange={setPayment} />

            <Text style={styles.label}>{t('sales.customer')}</Text>
            {checkWithoutCustomer ? (
              <Text style={styles.warning} accessibilityLiveRegion="polite">{t('payments.checkNeedsCustomer')}</Text>
            ) : null}
            {creditWithoutCustomer ? (
              <Text style={styles.warning} accessibilityLiveRegion="polite">{t('sales.creditNeedsCustomer')}</Text>
            ) : null}
            {customers.length > 6 ? (
              <View style={[styles.searchWrap, styles.customerSearch]}>
                <Ionicons name="person-outline" size={17} color={colors.muted} />
                <TextInput
                  style={styles.search}
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  placeholder={t('sales.searchCustomer')}
                  placeholderTextColor={colors.muted}
                  accessibilityLabel={t('sales.searchCustomer')}
                  autoCorrect={false}
                />
              </View>
            ) : null}
            <View style={styles.chips}>
              <Chip
                label={t('sales.walkIn')}
                active={customerId === null}
                onPress={() => setCustomerId(null)}
              />
              {filteredCustomers.slice(0, 30).map((c) => (
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

        {error ? <Text style={styles.error} accessibilityLiveRegion="assertive">{error}</Text> : null}

        {cart.length > 0 ? (
          <PrimaryButton icon="checkmark-done" title={`${t('sales.save')} · ${formatMoney(total)}`} onPress={submit} loading={saving} disabled={!canSubmit} />
        ) : null}
      </ScrollView>

      {cart.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('sales.viewCart')}, ${t('sales.cartCount', { count: itemCount })}, ${t('sales.total')} ${formatMoney(total)}`}
          onPress={scrollToCart}
          style={({ pressed }) => [styles.checkoutBar, pressed && styles.productPressed]}
        >
          <View style={styles.checkoutCount}><Ionicons name="cart" size={18} color={colors.onPrimary} /><Text style={styles.checkoutCountText}>{itemCount}</Text></View>
          <Text style={styles.checkoutLabel}>{t('sales.viewCart')}</Text>
          <Text style={styles.checkoutTotal}>{formatMoney(total)}</Text>
        </Pressable>
      ) : null}
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
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loader: { marginTop: spacing.xl },
  content: { padding: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 560, alignSelf: 'center' },
  contentWithBar: { paddingBottom: 96 },
  scanButton: { width: 44, height: 44, borderRadius: radius, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  printButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success, borderRadius: radius, paddingHorizontal: spacing.sm, minHeight: 40 },
  printText: { color: colors.onPrimary, fontWeight: '800', fontSize: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  priceInput: { minWidth: 84, minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, color: colors.text, fontWeight: '700', backgroundColor: colors.background },
  priceInputError: { borderColor: colors.danger },
  packToggle: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.primary, borderRadius: 8, overflow: 'hidden', marginTop: 4 },
  packOption: { minHeight: 32, paddingHorizontal: 10, justifyContent: 'center' },
  packOptionActive: { backgroundColor: colors.primary },
  packText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  packTextActive: { color: colors.onPrimary },
  catalogPrice: { color: colors.muted, fontSize: 11, textDecorationLine: 'line-through', marginTop: 2 },
  segment: { flexDirection: 'row', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primary, borderRadius: radius, overflow: 'hidden' },
  segmentItem: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.primary, fontWeight: '800' },
  segmentTextActive: { color: colors.onPrimary },
  center: { textAlign: 'center' },
  customerSearch: { marginBottom: spacing.sm },
  productInCart: { borderColor: colors.primary, borderWidth: 2 },
  inCartBadge: { position: 'absolute', top: 8, right: 8, minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  inCartText: { color: colors.onPrimary, fontSize: 12, fontWeight: '800' },
  addProductDisabled: { backgroundColor: colors.muted },
  cartHeading: { flexDirection: 'row', alignItems: 'center' },
  clearCart: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.lg, minHeight: 44, paddingHorizontal: spacing.sm },
  clearCartText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  emptyCart: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  qtyButtonDanger: { borderColor: colors.danger },
  qtyButtonDisabled: { opacity: 0.35 },
  change: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md, fontWeight: '700' },
  warning: { color: colors.danger, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  successText: { color: colors.success, fontWeight: '700', flex: 1 },
  checkoutBar: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, maxWidth: 528, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.md, borderRadius: radius + 4, backgroundColor: colors.primary, elevation: 6, shadowColor: '#0f172a', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  checkoutCount: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  checkoutCountText: { color: colors.onPrimary, fontWeight: '800' },
  checkoutLabel: { flex: 1, color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  checkoutTotal: { color: colors.onPrimary, fontWeight: '900', fontSize: 16 },
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
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { fontSize: 20, color: colors.primary, fontWeight: '700' },
  qtyValue: { fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center', color: colors.text },
  summary: { marginTop: spacing.md },
  paidRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  paidField: { flex: 1 },
  fullPaymentButton: { marginBottom: spacing.md, borderRadius: radius, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.neutralBg },
  fullPaymentText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
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
    minHeight: 40,
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    padding: spacing.md,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
});