import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Aging } from '../api/types';
import { openWhatsApp } from '../documents';
import { formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';

/** Créances clients par ancienneté, avec rappel WhatsApp en un geste. */
export default function AgingScreen() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Aging[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shopName, setShopName] = useState('SmartShop');

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await api<Aging[]>('/api/customers/aging'));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load().finally(() => setLoading(false)); }, [load]));

  useEffect(() => {
    api<{ shopName: string | null }>('/api/settings').then((s) => s.shopName && setShopName(s.shopName)).catch(() => undefined);
  }, []);

  const total = rows.reduce((sum, r) => sum + r.total, 0);

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.customerId}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[colors.primary]} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.subtitle}>{t('aging.subtitle')}</Text>
            {rows.length > 0 ? <Text style={styles.total}>{formatMoney(total)}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t('aging.empty')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.head}>
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={[styles.muted, item.oldestDays > 60 && styles.late]}>{t('aging.oldest', { days: item.oldestDays })}</Text>
              </View>
              <Text style={styles.amount}>{formatMoney(item.total)}</Text>
            </View>
            <View style={styles.buckets}>
              {([['b0', item.days0to30], ['b1', item.days31to60], ['b2', item.days61to90], ['b3', item.over90]] as const).map(([key, value], i) => (
                <View key={key} style={[styles.bucket, value > 0 && i >= 2 && styles.bucketLate]}>
                  <Text style={styles.bucketLabel}>{t(`aging.${key}`)}</Text>
                  <Text style={[styles.bucketValue, value === 0 && styles.zero]}>{value > 0 ? formatMoney(value) : '—'}</Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void openWhatsApp(t('statement.reminderMessage', { name: item.name, shop: shopName, amount: formatMoney(item.total) }), item.phone)}
              style={({ pressed }) => [styles.reminder, pressed && styles.pressed]}
            >
              <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
              <Text style={styles.reminderText}>{t('statement.reminder')}</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xl },
  content: { padding: spacing.md, gap: spacing.sm, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { marginBottom: spacing.sm },
  subtitle: { color: colors.muted },
  total: { color: colors.danger, fontSize: 26, fontWeight: '900', marginTop: spacing.xs },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  head: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  late: { color: colors.danger, fontWeight: '700' },
  amount: { color: colors.danger, fontWeight: '800', fontSize: 16 },
  buckets: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  bucket: { flex: 1, backgroundColor: colors.neutralBg, borderRadius: 8, padding: 6, alignItems: 'center' },
  bucketLate: { backgroundColor: colors.dangerBg },
  bucketLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  bucketValue: { color: colors.text, fontSize: 11, fontWeight: '700', marginTop: 2 },
  zero: { color: colors.muted },
  reminder: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: spacing.sm, borderRadius: radius, borderWidth: 1, borderColor: colors.success },
  reminderText: { color: colors.success, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.sm },
});
