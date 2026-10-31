import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
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
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Category, Product } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { formatMoney } from '../format';
import type { ProductsStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductsList'>;

export default function ProductsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, categoryData] = await Promise.all([
        api<Product[]>('/api/products/all'),
        api<Category[]>('/api/categories'),
      ]);
      setProducts(data);
      setCategories(categoryData);
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
    return products.filter((p) =>
      (statusFilter === 'all' || (statusFilter === 'active' ? p.active : !p.active))
      && (p.name.toLowerCase().includes(query) || p.reference.toLowerCase().includes(query)
        || (p.brand ?? '').toLowerCase().includes(query)
        || (p.model ?? '').toLowerCase().includes(query))
      && (!selectedCategory || p.categoryId === selectedCategory),
    );
  }, [products, search, selectedCategory, statusFilter]);

  async function reactivateProduct(product: Product) {
    try {
      setError(null);
      await api<Product>(`/api/products/${product.id}/activate`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  function renderItem({ item }: { item: Product }) {
    return (
      <Pressable
        onPress={() => navigation.navigate('ProductForm', { product: item })}
        style={({ pressed }) => [
          styles.card,
          !item.active && styles.cardInactive,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.cardHeader}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.productMark}><Ionicons name="hardware-chip-outline" size={19} color={colors.primary} /></View>
          )}
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.price}>{formatMoney(item.salePrice)}</Text>
        </View>
        <Text style={styles.reference}>
          {item.reference}
          {item.categoryName ? `  ·  ${item.categoryName}` : ''}
        </Text>
        {[item.brand, item.model, item.color, item.capacity].filter(Boolean).length > 0 ? (
          <Text style={styles.reference} numberOfLines={1}>{[item.brand, item.model, item.color, item.capacity].filter(Boolean).join(' · ')}</Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={styles.stock}>
            {t('products.stock')} : {item.stockQuantity}
          </Text>
          {item.lowStock ? <Text style={styles.badgeLow}>{t('products.lowStock')}</Text> : null}
          {!item.active ? <Text style={styles.badgeOff}>{t('products.inactive')}</Text> : null}
          {!item.active ? (
            <Pressable onPress={() => void reactivateProduct(item)} style={styles.restoreButton}>
              <Text style={styles.restoreText}>{t('products.reactivate', { defaultValue: 'Reactivate' })}</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.top}>
        <View style={styles.pageHeading}>
          <View style={styles.headingIcon}><Ionicons name="cube" size={22} color={colors.primary} /></View>
          <View style={styles.headingCopy}><Text style={styles.pageTitle}>{t('tabs.products')}</Text><Text style={styles.pageSubtitle}>{t('products.catalogSubtitle')}</Text></View>
        </View>
        <PrimaryButton icon="add-circle-outline" title={t('products.add')} onPress={() => navigation.navigate('ProductForm')} />
        <View style={styles.searchWrap}><Ionicons name="search-outline" size={18} color={colors.muted} /><TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('products.search')}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
        /></View>
        <View style={styles.statusRow}>
          {(['active', 'inactive', 'all'] as const).map((status) => (
            <Pressable key={status} onPress={() => setStatusFilter(status)}
              style={[styles.categoryChip, statusFilter === status && styles.categoryChipActive]}>
              <Text style={[styles.categoryText, statusFilter === status && styles.categoryTextActive]}>
                {status === 'active' ? (t('products.active', { defaultValue: 'Active' }))
                  : status === 'inactive' ? (t('products.inactive', { defaultValue: 'Inactive' }))
                  : (t('common.all', { defaultValue: 'All' }))}
              </Text>
            </Pressable>
          ))}
        </View>
        {categories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            <Pressable
              onPress={() => setSelectedCategory(null)}
              style={[styles.categoryChip, selectedCategory === null && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryText, selectedCategory === null && styles.categoryTextActive]}>
                {t('common.all', { defaultValue: 'All' })}
              </Text>
            </Pressable>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setSelectedCategory(category.id === selectedCategory ? null : category.id)}
                style={[styles.categoryChip, selectedCategory === category.id && styles.categoryChipActive]}
              >
                <Text style={[styles.categoryText, selectedCategory === category.id && styles.categoryTextActive]}>
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
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
  top: { padding: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headingIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 }, pageTitle: { fontSize: 21, fontWeight: '900', color: colors.text }, pageSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  categoryRow: { gap: spacing.sm, paddingTop: spacing.xs },
  categoryChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.card },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  categoryTextActive: { color: '#FFFFFF' },
  searchWrap: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: spacing.md },
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
  restoreButton: { marginLeft: 'auto', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 9, backgroundColor: colors.neutralBg },
  restoreText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
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