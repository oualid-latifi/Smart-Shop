import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Customer, Sale } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { formatDate, formatMoney, parseNumber } from '../format';
import type { CustomersStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomerDetail'>;

export default function CustomerDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const [customer, setCustomer] = useState<Customer>(route.params.customer);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const inDebt = customer.balance > 0;

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistoryError(null);
      const data = await api<Sale[]>(`/api/customers/${customer.id}/sales`);
      setSales(data);
    } catch (e) {
      setHistoryError(errorMessage(e, t));
    } finally {
      setHistoryLoading(false);
    }
  }, [customer.id, t]);

  useFocusEffect(useCallback(() => {
    void loadHistory();
  }, [loadHistory]));

  async function pay() {
    const value = parseNumber(amount);
    if (value === null || value <= 0) {
      setError(t('customers.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await api<Customer>(`/api/customers/${customer.id}/payments`, {
        method: 'POST',
        body: { amount: value },
      });
      setCustomer(updated);
      setAmount('');
      setSuccess(true);
      await loadHistory();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.name}>{customer.name}</Text>
        {customer.phone ? <Text style={styles.muted}>{customer.phone}</Text> : null}
        {customer.creditLimit !== null ? (
          <Text style={styles.muted}>
            {t('customers.creditLimit')} : {formatMoney(customer.creditLimit)}
          </Text>
        ) : null}

        <Text style={styles.label}>{t('customers.balance')}</Text>
        <Text style={[styles.balance, inDebt ? styles.debt : styles.ok]}>
          {inDebt ? formatMoney(customer.balance) : t('customers.noDebt')}
        </Text>
      </View>

      {customer.phone ? (
        <View style={styles.block}>
          <PrimaryButton
            title={t('customers.call')}
            onPress={() => void Linking.openURL(`tel:${customer.phone}`)}
            variant="outline"
          />
        </View>
      ) : null}

      {inDebt ? (
        <View style={styles.block}>
          <Text style={styles.section}>{t('customers.payment')}</Text>
          <TextField
            label={t('customers.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title={t('customers.pay')} onPress={pay} loading={saving} />
        </View>
      ) : null}

      {success ? <Text style={styles.success}>{t('customers.paySuccess')}</Text> : null}

      <View style={styles.historyBlock}>
        <View style={styles.historyHeading}><Ionicons name="time-outline" size={19} color={colors.primary} /><Text style={styles.section}>{t('customers.purchaseHistory')}</Text></View>
        {historyLoading ? <ActivityIndicator color={colors.primary} /> : historyError ? (
          <View>
            <Text style={styles.error}>{historyError}</Text>
            <PrimaryButton title={t('common.retry')} onPress={() => void loadHistory()} variant="outline" />
          </View>
        ) : sales.length === 0 ? (
          <Text style={styles.muted}>{t('customers.noHistory')}</Text>
        ) : sales.map((sale) => (
          <View key={sale.id} style={styles.saleRow}>
            <View style={styles.saleIcon}><Ionicons name="receipt-outline" size={18} color={colors.primary} /></View>
            <View style={styles.saleInfo}>
              <Text style={styles.saleDate}>{formatDate(sale.saleDate)}{sale.status === 'CANCELLED' ? ` · ${t('history.cancelled')}` : ''}</Text>
              <Text style={styles.muted} numberOfLines={1}>{sale.lines.map((line) => line.productName).join('، ')}</Text>
              <Text style={styles.muted}>{sale.lines.reduce((n, line) => n + line.quantity, 0)} {t('customers.items')} · {t('customers.paid')}: {formatMoney(sale.amountPaid)}</Text>
              {sale.remaining > 0 ? <Text style={styles.saleDebt}>{t('customers.remaining')}: {formatMoney(sale.remaining)}</Text> : null}
            </View>
            <Text style={styles.saleTotal}>{formatMoney(sale.total)}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, marginTop: 2 },
  label: { marginTop: spacing.md, color: colors.muted, fontSize: 13 },
  balance: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  debt: { color: colors.danger },
  ok: { color: colors.success },
  block: { marginTop: spacing.lg },
  historyBlock: { marginTop: spacing.xl, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  historyHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  saleIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  saleInfo: { flex: 1 },
  saleDate: { color: colors.text, fontWeight: '700' },
  saleTotal: { color: colors.primary, fontWeight: '800' },
  saleDebt: { color: colors.danger, fontSize: 12, marginTop: 2 },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  success: {
    marginTop: spacing.md,
    color: colors.success,
    backgroundColor: colors.successBg,
    padding: spacing.sm,
    borderRadius: radius,
    fontWeight: '700',
  },
});