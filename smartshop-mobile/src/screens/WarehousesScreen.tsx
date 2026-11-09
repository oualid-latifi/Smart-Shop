import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Product, ProductLocations, Warehouse, WarehouseStockLine } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';

/** Dépôts : liste, création, contenu d'un dépôt et transfert de stock (boutique ⇄ dépôts). */
export default function WarehousesScreen() {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Contenu du dépôt ouvert
  const [openId, setOpenId] = useState<string | null>(null);
  const [stock, setStock] = useState<WarehouseStockLine[]>([]);

  // Création
  const [newName, setNewName] = useState('');
  const [newQuarantine, setNewQuarantine] = useState(false);

  // Transfert (null = boutique)
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [locations, setLocations] = useState<ProductLocations | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, p] = await Promise.all([api<Warehouse[]>('/api/warehouses'), api<Product[]>('/api/products')]);
      setWarehouses(w.filter((x) => x.active));
      setProducts(p.filter((x) => x.active));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load().finally(() => setLoading(false)); }, [load]));

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)).slice(0, 6);
  }, [products, search]);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setStock(await api<WarehouseStockLine[]>(`/api/warehouses/${id}/stock`).catch(() => []));
  }

  async function create() {
    if (!newName.trim()) return;
    try {
      await api('/api/warehouses', { method: 'POST', body: { name: newName.trim(), type: newQuarantine ? 'QUARANTINE' : 'STORAGE' } });
      setNewName('');
      setNewQuarantine(false);
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  async function pick(p: Product) {
    setProduct(p);
    setSearch('');
    setLocations(await api<ProductLocations>(`/api/warehouses/locations/${p.id}`).catch(() => null));
  }

  const available = from === null ? locations?.shopQuantity ?? 0 : locations?.warehouses.find((w) => w.warehouseId === from)?.quantity ?? 0;
  const qty = Number.parseInt(quantity, 10);
  const canTransfer = product && from !== to && Number.isFinite(qty) && qty > 0 && qty <= available;

  async function transfer() {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      const loc = await api<ProductLocations>('/api/warehouses/transfers', {
        method: 'POST',
        body: { productId: product.id, fromWarehouseId: from, toWarehouseId: to, quantity: qty },
      });
      setLocations(loc);
      setQuantity('');
      setInfo(t('warehouses.done'));
      await load();
      if (openId) setStock(await api<WarehouseStockLine[]>(`/api/warehouses/${openId}/stock`));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  const places: { id: string | null; name: string }[] = [{ id: null, name: t('warehouses.shop') }, ...warehouses.map((w) => ({ id: w.id, name: w.name }))];

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <Screen>
      <Text style={styles.muted}>{t('warehouses.subtitle')}</Text>
      {warehouses.length === 0 ? <Text style={styles.empty}>{t('warehouses.empty')}</Text> : null}
      {warehouses.map((w) => (
        <View key={w.id} style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: openId === w.id }} onPress={() => void toggle(w.id)} style={styles.cardHead}>
            <Ionicons name={w.type === 'QUARANTINE' ? 'warning-outline' : 'business-outline'} size={22} color={w.type === 'QUARANTINE' ? colors.danger : colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.name}>{w.name}</Text>
              <Text style={styles.muted}>{t(`warehouses.${w.type}`)} · {t('warehouses.units', { n: w.totalUnits })}</Text>
            </View>
            <Text style={styles.value}>{formatMoney(w.value)}</Text>
            <Ionicons name={openId === w.id ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
          </Pressable>
          {openId === w.id ? (
            stock.length === 0 ? <Text style={styles.muted}>{t('warehouses.stockEmpty')}</Text> : stock.map((s) => (
              <View key={s.productId} style={styles.stockRow}>
                <Text style={styles.flex} numberOfLines={1}>{s.productName}</Text>
                <Text style={styles.qty}>{s.quantity}</Text>
              </View>
            ))
          ) : null}
        </View>
      ))}

      <Text style={styles.section}>{t('warehouses.new')}</Text>
      <TextField label={t('warehouses.name')} value={newName} onChangeText={setNewName} />
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t('warehouses.quarantine')}</Text>
        <Switch value={newQuarantine} onValueChange={setNewQuarantine} trackColor={{ true: colors.danger, false: colors.border }} accessibilityLabel={t('warehouses.quarantine')} />
      </View>
      <PrimaryButton icon="add" title={t('warehouses.new')} variant="outline" onPress={create} disabled={!newName.trim()} />

      <Text style={styles.section}>{t('warehouses.transfer')}</Text>
      {product ? (
        <Pressable accessibilityRole="button" onPress={() => { setProduct(null); setLocations(null); }} style={styles.selected}>
          <Text style={styles.name}>{product.name}</Text>
          <Ionicons name="close-circle" size={20} color={colors.muted} />
        </Pressable>
      ) : (
        <>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={17} color={colors.muted} />
            <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder={t('warehouses.product')} placeholderTextColor={colors.muted} accessibilityLabel={t('warehouses.product')} />
          </View>
          {matches.map((p) => (
            <Pressable key={p.id} accessibilityRole="button" onPress={() => void pick(p)} style={styles.match}>
              <Text style={styles.flex} numberOfLines={1}>{p.name}</Text>
              <Ionicons name="add-circle" size={20} color={colors.primary} />
            </Pressable>
          ))}
        </>
      )}

      {product ? (
        <>
          <Text style={styles.label}>{t('warehouses.from')}</Text>
          <View style={styles.chips}>
            {places.map((p) => (
              <Pressable key={`f-${p.id}`} accessibilityRole="radio" accessibilityState={{ checked: from === p.id }} onPress={() => setFrom(p.id)} style={[styles.chip, from === p.id && styles.chipActive]}>
                <Text style={[styles.chipText, from === p.id && styles.chipTextActive]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>{t('warehouses.to')}</Text>
          <View style={styles.chips}>
            {places.filter((p) => p.id !== from).map((p) => (
              <Pressable key={`t-${p.id}`} accessibilityRole="radio" accessibilityState={{ checked: to === p.id }} onPress={() => setTo(p.id)} style={[styles.chip, to === p.id && styles.chipActive]}>
                <Text style={[styles.chipText, to === p.id && styles.chipTextActive]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          <TextField label={t('warehouses.quantity')} hint={t('warehouses.available', { n: available })} value={quantity}
            onChangeText={(v) => setQuantity(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" />
          <PrimaryButton icon="swap-horizontal" title={t('warehouses.transfer')} onPress={transfer} loading={saving} disabled={!canTransfer} />
        </>
      ) : null}

      {info ? <Text style={styles.info}>{info}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 13 },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm, gap: spacing.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  flex: { flex: 1, color: colors.text },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  value: { color: colors.text, fontWeight: '700' },
  stockRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  qty: { color: colors.text, fontWeight: '800' },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  search: { flex: 1, paddingVertical: 12, color: colors.text },
  match: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  selected: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.card, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  info: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md, fontWeight: '700' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
});
