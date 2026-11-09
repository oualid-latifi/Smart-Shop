import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { PurchaseOrder } from '../api/types';
import DocumentActions from '../components/DocumentActions';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { confirmAction } from '../confirm';
import { openWhatsApp, shareDocument } from '../documents';
import { formatDate, formatMoney } from '../format';
import type { MoreStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { ORDER_TONE } from './PurchaseOrdersScreen';

type Props = NativeStackScreenProps<MoreStackParamList, 'PurchaseOrderDetail'>;

export default function PurchaseOrderDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const [order, setOrder] = useState<PurchaseOrder>(route.params.order);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const tone = ORDER_TONE[order.status];
  const open = order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED';

  async function refresh() {
    setOrder(await api<PurchaseOrder>(`/api/purchase-orders/${order.id}`));
  }

  function run(message: string, action: () => Promise<unknown>, okLabel: string, done?: string) {
    confirmAction(message, async () => {
      setSaving(true);
      setError(null);
      try {
        await action();
        await refresh();
        if (done) setInfo(done);
      } catch (e) {
        setError(errorMessage(e, t));
      } finally {
        setSaving(false);
      }
    }, t('common.cancel'), okLabel);
  }

  return (
    <Screen>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.number}>{order.number}</Text>
          <Text style={[styles.badge, { color: tone.fg, backgroundColor: tone.bg }]}>{t(`orders.${order.status}`)}</Text>
        </View>
        <Text style={styles.name}>{order.supplierName}</Text>
        <Text style={styles.muted}>{formatDate(order.createdAt)}</Text>
        <View style={styles.lines}>
          {order.lines.map((l) => (
            <View key={l.productId} style={styles.line}>
              <Text style={styles.lineName}>{l.productName}</Text>
              <Text style={styles.muted}>{l.receivedQuantity}/{l.quantity} · {formatMoney(l.unitPrice)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.line}>
          <Text style={styles.muted}>{t('sales.total')}</Text>
          <Text style={styles.total}>{formatMoney(order.total)}</Text>
        </View>
      </View>

      <Text style={styles.section}>{t('docs.title')}</Text>
      <DocumentActions
        onError={(e) => setError(errorMessage(e, t))}
        actions={[
          { key: 'pdf', label: t('orders.pdf'), icon: 'document-text-outline',
            onPress: () => shareDocument(`/api/purchase-orders/${order.id}/pdf`, `${order.number}.pdf`, t('docs.shareTitle')) },
          { key: 'wa', label: t('docs.whatsapp'), icon: 'logo-whatsapp',
            onPress: () => openWhatsApp(t('orders.whatsappMessage', { number: order.number, total: formatMoney(order.total) }), order.supplierPhone) },
        ]}
      />

      {info ? <Text style={styles.info}>{info}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {open ? (
        <View style={styles.actions}>
          <PrimaryButton icon="download-outline" title={t('orders.receiveAll')} loading={saving}
            onPress={() => run(t('orders.receiveConfirm'), () => api(`/api/purchase-orders/${order.id}/receive`, { method: 'POST', body: {} }), t('orders.receiveAll'), t('orders.receivedOk'))} />
          {order.status === 'ORDERED' ? (
            <PrimaryButton title={t('orders.cancel')} variant="outline" disabled={saving}
              onPress={() => run(t('orders.cancel'), () => api(`/api/purchase-orders/${order.id}/cancel`, { method: 'POST' }), t('common.confirm'))} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { color: colors.primary, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  muted: { color: colors.muted, fontSize: 13 },
  lines: { marginVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, gap: spacing.sm },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  lineName: { flex: 1, color: colors.text },
  total: { fontSize: 18, fontWeight: '800', color: colors.primary },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  info: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md, fontWeight: '700' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
});
