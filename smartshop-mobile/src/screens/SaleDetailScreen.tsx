import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Sale } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { confirmAction } from '../confirm';
import { formatDateTime, formatMoney } from '../format';
import type { SalesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<SalesStackParamList, 'SaleDetail'>;

export default function SaleDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const [sale, setSale] = useState<Sale>(route.params.sale);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cancelled = sale.status === 'CANCELLED';

  function askCancel() {
    if (!reason.trim()) {
      setError(t('history.invalidReason'));
      return;
    }
    confirmAction(
      t('history.cancelConfirm'),
      async () => {
        setSaving(true);
        setError(null);
        try {
          const updated = await api<Sale>(`/api/sales/${sale.id}/cancel`, {
            method: 'POST',
            body: { reason: reason.trim() },
          });
          setSale(updated);
        } catch (e) {
          setError(errorMessage(e, t));
        } finally {
          setSaving(false);
        }
      },
      t('common.cancel'),
      t('common.confirm'),
    );
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.name}>{sale.customerName ?? t('sales.walkIn')}</Text>
        <Text style={styles.muted}>{formatDateTime(sale.saleDate)}</Text>
        {cancelled ? <Text style={styles.badgeOff}>{t('history.cancelled')}</Text> : null}

        <View style={styles.lines}>
          {sale.lines.map((line, index) => (
            <View key={`${line.productId}-${index}`} style={styles.lineRow}>
              <Text style={styles.lineName}>{line.productName}</Text>
              <Text style={styles.lineValue}>
                {line.quantity} × {formatMoney(line.unitPrice)}
              </Text>
            </View>
          ))}
        </View>

        <Row label={t('history.discount')} value={formatMoney(sale.discount)} />
        <Row label={t('sales.total')} value={formatMoney(sale.total)} strong />
        <Row label={t('history.paid')} value={formatMoney(sale.amountPaid)} />
        <Row
          label={t('history.kridi')}
          value={formatMoney(sale.remaining)}
          danger={sale.remaining > 0 && !cancelled}
        />
        {!cancelled ? <Row label={t('history.profit')} value={formatMoney(sale.profit)} /> : null}

        {cancelled && sale.cancellationReason ? (
          <Text style={styles.reason}>
            {t('history.reason')} : {sale.cancellationReason}
          </Text>
        ) : null}
      </View>

      {!cancelled ? (
        <View style={styles.block}>
          <Text style={styles.section}>{t('history.cancelTitle')}</Text>
          <TextField label={t('history.reason')} value={reason} onChangeText={setReason} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            title={t('history.cancelButton')}
            onPress={askCancel}
            loading={saving}
            variant="outline"
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Row({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.value, strong && styles.strong, danger && styles.danger]}>{value}</Text>
    </View>
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
  badgeOff: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    color: colors.muted,
    backgroundColor: colors.neutralBg,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
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
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  value: { color: colors.text, fontSize: 15, fontWeight: '600' },
  strong: { fontSize: 18, fontWeight: '800', color: colors.primary },
  danger: { color: colors.danger },
  reason: { marginTop: spacing.md, color: colors.muted, fontStyle: 'italic' },
  block: { marginTop: spacing.lg },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
});