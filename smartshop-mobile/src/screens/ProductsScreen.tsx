import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Product } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import PrimaryButton from '../components/PrimaryButton';
import { Badge, ProductThumb } from '../components/ui';
import { formatMoney } from '../format';
import type { ProductsStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductsList'>;

export default function ProductsScreen({ navigation }: Props) {
  const { can } = useAuth();
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<Product[]>('/api/products');
      setProducts(data);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  // Recharge la liste chaque fois qu'on revient sur cet écran
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(query) || p.reference.toLowerCase().includes(query),
    );
  }, [products, search]);

  function renderItem({ item }: { item: Product }) {
    const tone = !item.active ? 'neutral' : item.stockQuantity <= 0 ? 'danger' : item.lowStock ? 'warning' : 'success';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatMoney(item.salePrice)}, ${t('products.stock')} ${item.stockQuantity}`}
        onPress={() => navigation.navigate('ProductForm', { product: item })}
        style={({ pressed }) => [styles.row, !item.active && styles.cardInactive, pressed && styles.pressed]}
      >
        <ProductThumb uri={item.imageUrl} size={54} />
        <View style={styles.rowInfo}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.price}>{formatMoney(item.salePrice)}</Text>
          <Text style={styles.reference} numberOfLines={1}>
            {[item.reference, item.capacity, item.color].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Badge label={!item.active ? t('products.inactive') : `${t('products.stock')}: ${item.stockQuantity}`} tone={tone} />
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.top}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder={t('products.search')}
              placeholderTextColor={colors.muted}
              accessibilityLabel={t('products.search')}
              autoCorrect={false}
            />
          </View>
          {can('PRODUCTS_WRITE') ? (
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('ProductForm')} style={styles.addButton}>
              <Ionicons name="add" size={18} color={colors.onPrimary} />
              <Text style={styles.addText}>{t('common.add')}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.count}>{filtered.length} {t('sales.productsAvailable')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <PrimaryButton title={t('common.retry')} onPress={() => void load()} variant="outline" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {products.length === 0 ? t('products.empty') : t('products.noResult')}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: { padding: spacing.md, paddingBottom: 0, gap: spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, borderRadius: 14, backgroundColor: colors.primary },
  addText: { color: colors.onPrimary, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.sm + 4 },
  rowInfo: { flex: 1, gap: 2 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headingIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 }, pageTitle: { fontSize: 21, fontWeight: '900', color: colors.text }, pageSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  searchWrap: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  search: { flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  loader: { marginTop: spacing.xl },
  center: { padding: spacing.lg },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  list: { padding: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardInactive: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  productMark: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  productImage: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.neutralBg },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  price: { fontSize: 15, fontWeight: '700', color: colors.primary },
  reference: { marginTop: 2, color: colors.muted, fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  stock: { color: colors.text, fontSize: 14 },
  badgeLow: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeOff: {
    color: colors.muted,
    backgroundColor: colors.neutralBg,
    fontSize: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
});