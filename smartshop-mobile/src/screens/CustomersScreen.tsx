import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import type { Customer } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { formatMoney } from '../format';
import type { CustomersStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomersList'>;

export default function CustomersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<Customer[]>('/api/customers');
      setCustomers(data);
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

  const totalDebt = customers.reduce((sum, c) => sum + Math.max(0, c.balance), 0);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers
      .filter((c) => (onlyDebt ? c.balance > 0 : true))
      .filter(
        (c) =>
          !query || c.name.toLowerCase().includes(query) || (c.phone ?? '').includes(query),
      )
      .sort((a, b) => b.balance - a.balance);
  }, [customers, search, onlyDebt]);

  function renderItem({ item }: { item: Customer }) {
    const inDebt = item.balance > 0;
    return (
      <Pressable
        onPress={() => navigation.navigate('CustomerDetail', { customer: item })}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.customerAvatar}><Ionicons name="person-outline" size={19} color={colors.primary} /></View>
        <View style={styles.flex}>
          <Text style={styles.name}>{item.name}</Text>
          {item.phone ? <Text style={styles.muted}>{item.phone}</Text> : null}
        </View>
        <View style={styles.balanceWrap}><Text style={[styles.balance, inDebt ? styles.debt : styles.ok]}>{inDebt ? formatMoney(item.balance) : t('customers.noDebt')}</Text><Ionicons name="chevron-forward" size={16} color={colors.muted} /></View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.top}>
        <View style={styles.pageHeading}><View style={styles.headingIcon}><Ionicons name="people" size={22} color={colors.primary} /></View><View style={styles.headingCopy}><Text style={styles.pageTitle}>{t('tabs.customers')}</Text><Text style={styles.pageSubtitle}>{t('customers.subtitle')}</Text></View></View>
        <PrimaryButton icon="person-add-outline" title={t('customers.add')} onPress={() => navigation.navigate('CustomerForm')} />

        <View style={styles.totalBox}>
          <View style={styles.totalIcon}><Ionicons name="wallet-outline" size={19} color={colors.danger} /></View>
          <View style={styles.totalCopy}><Text style={styles.muted}>{t('customers.totalDebt')}</Text><Text style={styles.totalCaption}>{t('customers.withDebt')}</Text></View>
          <Text style={styles.totalValue}>{formatMoney(totalDebt)}</Text>
        </View>

        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('customers.search')}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
        />

        <View style={styles.chips}>
          <Chip label={t('customers.all')} active={!onlyDebt} onPress={() => setOnlyDebt(false)} />
          <Chip label={t('customers.withDebt')} active={onlyDebt} onPress={() => setOnlyDebt(true)} />
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
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {customers.length === 0 ? t('customers.empty') : t('customers.noResult')}
            </Text>
          }
        />
      )}
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
  top: { padding: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },
  pageHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, headingIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' }, headingCopy: { flex: 1 }, pageTitle: { fontSize: 21, fontWeight: '900', color: colors.text }, pageSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  totalBox: { backgroundColor: colors.card, borderRadius: 17, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  totalIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' }, totalCopy: { flex: 1 }, totalCaption: { color: colors.muted, fontSize: 10, marginTop: 2 },
  totalValue: { fontSize: 17, fontWeight: '900', color: colors.danger },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  chips: { flexDirection: 'row', gap: spacing.sm },
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
  pressed: { opacity: 0.7 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  customerAvatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  balanceWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balance: { fontSize: 15, fontWeight: '700' },
  debt: { color: colors.danger },
  ok: { color: colors.success },
});