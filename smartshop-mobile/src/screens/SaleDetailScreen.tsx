import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Sale } from '../api/types';
import DocumentActions from '../components/DocumentActions';
import PinPrompt from '../components/PinPrompt';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { useAuth } from '../auth/AuthContext';
import { confirmAction } from '../confirm';
import { openWhatsApp, shareDocument } from '../documents';
import { formatDateTime, formatMoney } from '../format';
import type { SalesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<SalesStackParamList, 'SaleDetail'>;

export default function SaleDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [sale, setSale] = useState<Sale>(route.params.sale);
  // Après un retour, l'écran de retour renvoie la vente mise à jour
  React.useEffect(() => setSale(route.params.sale), [route.params.sale]);
  const canReturn = sale.status !== 'CANCELLED' && sale.lines.some((l) => l.quantity > l.returnedQuantity);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  const cancelled = sale.status === 'CANCELLED';

  // La facture et le BL reçoivent leur numéro au premier téléchargement : on recharge la vente ensuite
  async function refreshSale() {
    setSale(await api<Sale>(`/api/sales/${sale.id}`));
  }

  const documentActions = [
    { key: 't80', label: t('docs.ticket80'), icon: 'receipt-outline' as const,
      onPress: () => shareDocument(`/api/sales/${sale.id}/ticket.pdf?width=80`, `${sale.number}.pdf`, t('docs.shareTitle')) },
    { key: 't58', label: t('docs.ticket58'), icon: 'receipt-outline' as const,
      onPress: () => shareDocument(`/api/sales/${sale.id}/ticket.pdf?width=58`, `${sale.number}-58.pdf`, t('docs.shareTitle')) },
    { key: 'inv', label: sale.invoiceNumber ?? t('docs.invoice'), icon: 'document-text-outline' as const,
      onPress: async () => {
        await shareDocument(`/api/sales/${sale.id}/invoice.pdf`, `facture-${sale.number}.pdf`, t('docs.shareTitle'));
        await refreshSale();
      } },
    { key: 'bl', label: sale.deliveryNumber ?? t('docs.deliveryNote'), icon: 'cube-outline' as const,
      onPress: async () => {
        await shareDocument(`/api/sales/${sale.id}/delivery-note.pdf`, `bl-${sale.number}.pdf`, t('docs.shareTitle'));
        await refreshSale();
      } },
    { key: 'wa', label: t('docs.whatsapp'), icon: 'logo-whatsapp' as const,
      onPress: () => openWhatsApp(
        t('docs.saleMessage', {
          name: sale.customerName ?? '',
          number: sale.number,
          total: formatMoney(sale.total),
          rest: sale.remaining > 0 ? t('docs.restPart', { rest: formatMoney(sale.remaining) }) : '',
        }),
        sale.customerPhone,
      ) },
  ];

  async function cancelSale(approvalPin?: string) {
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Sale>(`/api/sales/${sale.id}/cancel`, {
        method: 'POST',
        body: { reason: reason.trim(), approvalPin: approvalPin ?? null },
      });
      setSale(updated);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'APPROVAL_REQUIRED') setPinMessage(e.message);
      else setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  function askCancel() {
    if (!reason.trim()) {
      setError(t('history.invalidReason'));
      return;
    }
    confirmAction(t('history.cancelConfirm'), () => void cancelSale(), t('common.cancel'), t('common.confirm'));
  }

  return (
    <Screen>
      <PinPrompt
        visible={pinMessage !== null}
        message={pinMessage}
        onCancel={() => setPinMessage(null)}
        onSubmit={(pin) => { setPinMessage(null); void cancelSale(pin); }}
      />
      <View style={styles.card}>
        <Text style={styles.number}>{sale.number}</Text>
        <Text style={styles.name}>{sale.customerName ?? t('sales.walkIn')}</Text>
        <Text style={styles.muted}>{formatDateTime(sale.saleDate)}</Text>
        {cancelled ? <Text style={styles.badgeOff}>{t('history.cancelled')}</Text> : null}

        <View style={styles.lines}>
          {sale.lines.map((line, index) => (
            <View key={`${line.productId}-${index}`} style={styles.lineRow}>
              <Text style={styles.lineName}>
                {line.productName}
                {line.returnedQuantity > 0 ? <Text style={styles.returned}>{`  (${line.returnedQuantity} ${t('returns.returned')})`}</Text> : null}
              </Text>
              <Text style={styles.lineValue}>
                {line.quantity} × {formatMoney(line.unitPrice)}
              </Text>
            </View>
          ))}
        </View>

        <Row label={t('history.discount')} value={formatMoney(sale.discount)} />
        <Row label={t('sales.total')} value={formatMoney(sale.total)} strong />
        {sale.returnedAmount > 0 ? <Row label={t('returns.credit')} value={`- ${formatMoney(sale.returnedAmount)}`} /> : null}
        {sale.refundedAmount > 0 ? <Row label={t('returns.refund')} value={formatMoney(sale.refundedAmount)} /> : null}
        <Row label={t('payments.method')} value={t(`payments.${sale.paymentMethod}`)} />
        <Row label={t('history.paid')} value={formatMoney(sale.amountPaid)} />
        <Row
          label={t('history.kridi')}
          value={formatMoney(sale.remaining)}
          danger={sale.remaining > 0 && !cancelled}
        />
        {!cancelled && sale.profit !== null ? <Row label={t('history.profit')} value={formatMoney(sale.profit)} /> : null}
        {sale.sellerName ? <Row label={t('roles.SELLER')} value={sale.sellerName} /> : null}

        {cancelled && sale.cancellationReason ? (
          <Text style={styles.reason}>
            {t('history.reason')} : {sale.cancellationReason}
          </Text>
        ) : null}
      </View>

      {!cancelled ? (
        <View style={styles.block}>
          <Text style={styles.section}>{t('docs.title')}</Text>
          <DocumentActions actions={documentActions} onError={(e) => setError(errorMessage(e, t) || t('docs.failed'))} />
        </View>
      ) : null}

      {canReturn ? (
        <View style={styles.block}>
          <PrimaryButton icon="return-down-back-outline" title={t('returns.open')} variant="outline" onPress={() => navigation.navigate('SaleReturn', { sale })} />
        </View>
      ) : null}

      {sale.returns.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.section}>{t('returns.history')}</Text>
          {sale.returns.map((r) => (
            <View key={r.id} style={styles.returnRow}>
              <Text style={styles.muted}>{formatDateTime(r.returnedAt)}{r.reason ? ` · ${r.reason}` : ''}</Text>
              <Text style={styles.value}>- {formatMoney(r.creditAmount)}{r.refundAmount > 0 ? ` (${t('returns.refund')} ${formatMoney(r.refundAmount)})` : ''}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!cancelled && sale.returns.length === 0 && can('SALES_CANCEL') ? (
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
  number: { fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 0.5, marginBottom: 2 },
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
  returned: { color: colors.danger, fontSize: 12 },
  returnRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 },
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