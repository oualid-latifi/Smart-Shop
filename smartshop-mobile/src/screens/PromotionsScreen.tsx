import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Product, Promotion, PromotionKind } from '../api/types';
import { parseFrenchDate } from '../components/PaymentMethodPicker';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { Badge, Card } from '../components/ui';
import { confirmAction } from '../confirm';
import { formatDate, formatMoney, parseNumber } from '../format';
import { colors, radius, spacing } from '../theme';

const KINDS: PromotionKind[] = ['PERCENT_OFF', 'SECOND_ITEM_PERCENT', 'FIXED_PRICE'];
type Target = 'all' | 'brand' | 'product';

function frenchDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Liste des promotions et formulaire de création / modification. */
export default function PromotionsScreen() {
  const { t } = useTranslation();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire (editingId null = création)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PromotionKind>('PERCENT_OFF');
  const [value, setValue] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [brand, setBrand] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [startsOn, setStartsOn] = useState(frenchDate(new Date()));
  const [endsOn, setEndsOn] = useState(frenchDate(new Date(Date.now() + 7 * 86400000)));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, list] = await Promise.all([api<Promotion[]>('/api/promotions'), api<Product[]>('/api/products')]);
      setPromos(p);
      setProducts(list);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load().finally(() => setLoading(false)); }, [load]));

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand?.trim()).filter((b): b is string => !!b))].sort(), [products]);
  const productMatches = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)).slice(0, 6) : [];
  }, [products, productSearch]);

  function reset() {
    setEditingId(null);
    setName('');
    setKind('PERCENT_OFF');
    setValue('');
    setTarget('all');
    setBrand('');
    setProductId(null);
    setProductSearch('');
    setStartsOn(frenchDate(new Date()));
    setEndsOn(frenchDate(new Date(Date.now() + 7 * 86400000)));
  }

  function edit(p: Promotion) {
    setEditingId(p.id);
    setName(p.name);
    setKind(p.kind);
    setValue(String(p.value));
    setTarget(p.productId ? 'product' : p.brand ? 'brand' : 'all');
    setBrand(p.brand ?? '');
    setProductId(p.productId);
    setProductSearch(p.productName ?? '');
    setStartsOn(frenchDate(new Date(p.startsOn)));
    setEndsOn(frenchDate(new Date(p.endsOn)));
  }

  const effectiveTarget: Target = kind === 'FIXED_PRICE' ? 'product' : target;
  const valid = name.trim() && (parseNumber(value) ?? 0) > 0 && parseFrenchDate(startsOn) && parseFrenchDate(endsOn)
    && (effectiveTarget !== 'brand' || brand) && (effectiveTarget !== 'product' || productId);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(editingId ? `/api/promotions/${editingId}` : '/api/promotions', {
        method: editingId ? 'PUT' : 'POST',
        body: {
          name: name.trim(), kind, value: parseNumber(value),
          productId: effectiveTarget === 'product' ? productId : null,
          brand: effectiveTarget === 'brand' ? brand : null,
          startsOn: parseFrenchDate(startsOn), endsOn: parseFrenchDate(endsOn), active: true,
        },
      });
      reset();
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  function remove(p: Promotion) {
    confirmAction(t('promos.deleteConfirm'), async () => {
      await api(`/api/promotions/${p.id}`, { method: 'DELETE' }).catch((e) => setError(errorMessage(e, t)));
      if (editingId === p.id) reset();
      await load();
    }, t('common.cancel'), t('promos.delete'));
  }

  function statusOf(p: Promotion) {
    const today = new Date().toISOString().slice(0, 10);
    if (p.running) return { label: t('promos.running'), tone: 'success' as const };
    if (p.startsOn > today) return { label: t('promos.upcoming'), tone: 'primary' as const };
    return { label: t('promos.ended'), tone: 'neutral' as const };
  }

  function describe(p: Promotion) {
    const what = p.kind === 'FIXED_PRICE' ? formatMoney(p.value) : `${p.value} %`;
    const on = p.productName ?? p.brand ?? t('promos.all');
    return `${t(`promos.${p.kind}`).replace('X', String(p.value)).replace(' X', '')} · ${p.kind === 'FIXED_PRICE' ? what : ''}${on}`;
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <Screen>
      <Text style={styles.muted}>{t('promos.subtitle')}</Text>
      {promos.length === 0 ? <Text style={styles.empty}>{t('promos.empty')}</Text> : null}
      {promos.map((p) => {
        const status = statusOf(p);
        return (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => edit(p)} style={[styles.promo, editingId === p.id && styles.promoActive]}>
            <View style={styles.flex}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.muted}>{describe(p)}</Text>
              <Text style={styles.muted}>{formatDate(p.startsOn)} → {formatDate(p.endsOn)}</Text>
            </View>
            <View style={styles.right}>
              <Badge label={status.label} tone={status.tone} />
              <Pressable accessibilityRole="button" accessibilityLabel={t('promos.delete')} onPress={() => remove(p)} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          </Pressable>
        );
      })}

      <Card style={styles.form}>
        <Text style={styles.section}>{editingId ? name : t('promos.new')}</Text>
        <TextField label={t('promos.name')} required value={name} onChangeText={setName} />
        <Text style={styles.label}>{t('promos.kind')}</Text>
        <View style={styles.chips}>
          {KINDS.map((k) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: kind === k }} onPress={() => setKind(k)} style={[styles.chip, kind === k && styles.chipOn]}>
              <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{t(`promos.${k}`)}</Text>
            </Pressable>
          ))}
        </View>
        <TextField label={kind === 'FIXED_PRICE' ? t('promos.valuePrice') : t('promos.valuePercent')} required value={value} onChangeText={setValue} keyboardType="decimal-pad" />

        <Text style={styles.label}>{t('promos.target')}</Text>
        <View style={styles.chips}>
          {(kind === 'FIXED_PRICE' ? (['product'] as Target[]) : (['all', 'brand', 'product'] as Target[])).map((tg) => (
            <Pressable key={tg} accessibilityRole="radio" accessibilityState={{ checked: effectiveTarget === tg }} onPress={() => setTarget(tg)} style={[styles.chip, effectiveTarget === tg && styles.chipOn]}>
              <Text style={[styles.chipText, effectiveTarget === tg && styles.chipTextOn]}>{t(`promos.${tg}`)}</Text>
            </Pressable>
          ))}
        </View>
        {effectiveTarget === 'brand' ? (
          <View style={styles.chips}>
            {brands.map((b) => (
              <Pressable key={b} accessibilityRole="radio" accessibilityState={{ checked: brand === b }} onPress={() => setBrand(b)} style={[styles.chip, brand === b && styles.chipOn]}>
                <Text style={[styles.chipText, brand === b && styles.chipTextOn]}>{b}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {effectiveTarget === 'product' ? (
          <>
            <TextInput style={styles.search} value={productSearch} onChangeText={(v) => { setProductSearch(v); setProductId(null); }}
              placeholder={t('quotes.addProducts')} placeholderTextColor={colors.muted} accessibilityLabel={t('promos.product')} />
            {productId ? null : productMatches.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" onPress={() => { setProductId(p.id); setProductSearch(p.name); }} style={styles.match}>
                <Text style={styles.flexText} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.muted}>{formatMoney(p.salePrice)}</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        <View style={styles.row}>
          <View style={styles.flex}><TextField label={t('promos.from')} value={startsOn} onChangeText={setStartsOn} keyboardType="numbers-and-punctuation" /></View>
          <View style={styles.flex}><TextField label={t('promos.to')} value={endsOn} onChangeText={setEndsOn} keyboardType="numbers-and-punctuation" /></View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton icon="pricetag-outline" title={t('promos.save')} onPress={save} loading={saving} disabled={!valid} />
        {editingId ? <View style={styles.spacer}><PrimaryButton title={t('common.cancel')} variant="outline" onPress={reset} /></View> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  promo: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  promoActive: { borderColor: colors.primary, borderWidth: 2 },
  flex: { flex: 1 },
  flexText: { flex: 1, color: colors.text },
  right: { alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.sm },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  form: { marginTop: spacing.lg },
  section: { color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: '600' },
  chipTextOn: { color: colors.onPrimary },
  search: { minHeight: 46, borderRadius: radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt, color: colors.text, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  match: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius, backgroundColor: colors.cardAlt, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  spacer: { marginTop: spacing.sm },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
});
