import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { createLocalPurchasePayment, getCachedPurchases } from '../database';
import { syncPendingOperations } from '../sync';
import { errorMessage } from '../api/errors';
import type { Purchase } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { formatDate, formatMoney, parseNumber } from '../format';
import type { PurchasesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<PurchasesStackParamList, 'PurchaseDetail'>;

export default function PurchaseDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const [purchase, setPurchase] = useState<Purchase>(route.params.purchase);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncPending, setSyncPending] = useState(false);

  const due = purchase.remaining > 0;

  async function pay() {
    const value = parseNumber(amount);
    if (value === null || value <= 0) {
      setError(t('purchases.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      // Persist the supplier payment locally first; the outbox retries it when
      // the PC becomes reachable. Its UUID makes backend retries idempotent.
      await createLocalPurchasePayment(purchase.id, value);
      const refreshed = await getCachedPurchases();
      const updated = refreshed.find((item) => item.id === purchase.id);
      if (updated) setPurchase(updated);
      setAmount('');
      setSuccess(true);
      setSyncPending(true);
      void syncPendingOperations()
        .then((summary) => setSyncPending(summary.pending > 0 || summary.failed > 0))
        .catch(() => setSyncPending(true));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.name}>{purchase.supplierName ?? t('purchases.noSupplier')}</Text>
        <Text style={styles.muted}>{formatDate(purchase.purchaseDate)}</Text>
        {purchase.note ? <Text style={styles.muted}>{purchase.note}</Text> : null}

        <View style={styles.lines}>
          {purchase.lines.map((line, index) => (
            <View key={`${line.productId}-${index}`} style={styles.lineRow}>
              <Text style={styles.lineName}>{line.productName}</Text>
              <Text style={styles.lineValue}>
                {line.quantity} × {formatMoney(line.unitPrice)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.muted}>{t('purchases.total')}</Text>
          <Text style={styles.text}>{formatMoney(purchase.total)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.muted}>{t('purchases.amountPaid')}</Text>
          <Text style={styles.text}>{formatMoney(purchase.amountPaid)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.muted}>{t('purchases.remaining')}</Text>
          <Text style={[styles.remaining, due ? styles.debt : styles.ok]}>
            {due ? formatMoney(purchase.remaining) : t('purchases.paid')}
          </Text>
        </View>
      </View>

      {due ? (
        <View style={styles.block}>
          <Text style={styles.section}>{t('purchases.payment')}</Text>
          <TextField
            label={t('purchases.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title={t('purchases.pay')} onPress={pay} loading={saving} />
        </View>
      ) : null}

      {success ? <Text style={styles.success}>{t('purchases.paySuccess')}</Text> : null}
      {syncPending ? <Text style={styles.muted}>Paiement enregistré sur cet appareil. Il sera synchronisé avec le PC dès que la connexion sera disponible.</Text> : null}
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
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  text: { color: colors.text, fontSize: 15, fontWeight: '600' },
  lines: {
    marginVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  lineName: { flex: 1, color: colors.text, fontSize: 15 },
  lineValue: { color: colors.muted, fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  remaining: { fontSize: 18, fontWeight: '800' },
  debt: { color: colors.danger },
  ok: { color: colors.success },
  block: { marginTop: spacing.lg },
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