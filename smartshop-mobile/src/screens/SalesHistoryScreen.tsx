import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Sale } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { formatDateTime, formatMoney } from '../format';
import type { SalesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<SalesStackParamList, 'SalesHistory'>;

export default function SalesHistoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<Sale[]>('/api/sales');
      setSales([...data].sort((a, b) => b.saleDate.localeCompare(a.saleDate)));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

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

  function renderItem({ item }: { item: Sale }) {
    const cancelled = item.status === 'CANCELLED';
    return (
      <Pressable
        onPress={() => navigation.navigate('SaleDetail', { sale: item })}
        style={({ pressed }) => [styles.card, cancelled && styles.cancelled, pressed && styles.pressed]}
      >
        <View style={styles.flex}>
          <Text style={styles.name}>{item.customerName ?? t('sales.walkIn')}</Text>
          <Text style={styles.muted}>{formatDateTime(item.saleDate)}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.total}>{formatMoney(item.total)}</Text>
          {cancelled ? (
            <Text style={styles.badgeOff}>{t('history.cancelled')}</Text>
          ) : item.remaining > 0 ? (
            <Text style={styles.badgeDue}>
              {t('history.kridi')} {formatMoney(item.remaining)}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <PrimaryButton title={t('common.retry')} onPress={() => void load()} variant="outline" />
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('history.empty')}</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loader: { marginTop: spacing.xl },
  center: { padding: spacing.lg },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  list: { padding: spacing.md, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cancelled: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
  right: { alignItems: 'flex-end', gap: 4 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  total: { fontSize: 15, fontWeight: '700', color: colors.text },
  badgeDue: {
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
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
});