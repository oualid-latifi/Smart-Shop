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
import { deleteLocalExpense, getCachedExpenses, saveExpenses } from '../database';
import { syncPendingOperations } from '../sync';
import { errorMessage } from '../api/errors';
import type { Expense } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { confirmAction } from '../confirm';
import { formatDate, formatMoney } from '../format';
import type { ReportsStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<ReportsStackParamList, 'Expenses'>;

export default function ExpensesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const cached = await getCachedExpenses();
      setExpenses(cached);
    } catch {
      // Continue with the server request if the local cache is unavailable.
    }
    try {
      const data = await api<Expense[]>('/api/expenses');
      await saveExpenses(data);
      const refreshed = await getCachedExpenses();
      setExpenses(refreshed);
    } catch (e) {
      // Cached expenses remain visible when the PC is offline.
      const cached = await getCachedExpenses().catch(() => []);
      setExpenses(cached);
      if (cached.length === 0) setError(errorMessage(e, t));
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

  function remove(expense: Expense) {
    confirmAction(
      t('expenses.deleteConfirm'),
      async () => {
        try {
          await deleteLocalExpense(expense.id);
          await load();
          void syncPendingOperations();
        } catch (e) {
          setError(errorMessage(e, t));
        }
      },
      t('common.cancel'),
      t('common.confirm'),
    );
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  function renderItem({ item }: { item: Expense }) {
    return (
      <View style={styles.card}>
        <View style={styles.flex}>
          <Text style={styles.name}>{t(`expenses.cat.${item.category}`)}</Text>
          {item.note ? <Text style={styles.muted}>{item.note}</Text> : null}
          <Text style={styles.muted}>{formatDate(item.expenseDate)}</Text>
        </View>
        <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
        <Pressable onPress={() => remove(item)} hitSlop={10} style={styles.delete}>
          <Text style={styles.deleteText}>✕</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.top}>
        <PrimaryButton
          title={`+ ${t('expenses.add')}`}
          onPress={() => navigation.navigate('ExpenseForm')}
        />
        <View style={styles.totalBox}>
          <Text style={styles.muted}>{t('expenses.total')}</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>
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
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('expenses.empty')}</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  top: { padding: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  totalBox: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.danger },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.danger },
  delete: { paddingHorizontal: spacing.sm },
  deleteText: { color: colors.muted, fontSize: 18 },
});