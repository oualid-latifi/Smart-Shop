import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api, getBaseUrl } from '../api/client';
import { errorMessage } from '../api/errors';
import type { OnlineOrder, OnlineOrderStatus, Sale } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { Badge, Card, type Tone } from '../components/ui';
import { confirmAction } from '../confirm';
import { openWhatsApp } from '../documents';
import { formatDateTime, formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';

const FILTERS: (OnlineOrderStatus | null)[] = ['NEW', 'CONFIRMED', 'CONVERTED', 'CANCELLED', null];
const TONES: Record<OnlineOrderStatus, Tone> = { NEW: 'warning', CONFIRMED: 'primary', CONVERTED: 'success', CANCELLED: 'danger' };

/** Commandes reçues sur la boutique en ligne : confirmer, transformer en vente ou annuler. */
export default function OnlineOrdersScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<OnlineOrderStatus | null>('NEW');
  const [orders, setOrders] = useState<OnlineOrder[] | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrders(await api<OnlineOrder[]>(`/api/online-orders${status ? `?status=${status}` : ''}`));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [status, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void getBaseUrl().then((base) => setLink(`${base}/shop`)); }, []);

  async function run(order: OnlineOrder, action: 'CONFIRMED' | 'CANCELLED' | 'convert') {
    setBusy(order.id);
    setError(null);
    setDone(null);
    try {
      if (action === 'convert') {
        const sale = await api<Sale>(`/api/online-orders/${order.id}/convert`, { method: 'POST', body: {} });
        setDone(t('online.converted', { number: sale.number }));
      } else {
        await api(`/api/online-orders/${order.id}/status`, { method: 'PUT', body: { status: action } });
      }
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={styles.safe}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <Card>
        <Text style={styles.muted}>{t('online.linkHint')}</Text>
        <Text style={styles.link} selectable>{link}</Text>
        <View style={styles.row}>
          <PrimaryButton icon="share-social-outline" title={t('online.share')} variant="outline" onPress={() => void Share.share({ message: `${t('online.shareText')} ${link}` })} />
        </View>
      </Card>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f ?? 'all'} accessibilityRole="radio" accessibilityState={{ checked: status === f }} onPress={() => { setOrders(null); setStatus(f); }} style={[styles.chip, status === f && styles.chipOn]}>
            <Text style={[styles.chipText, status === f && styles.chipTextOn]}>{f ? t(`online.status.${f}`) : t('online.all')}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      {done ? <Text style={styles.done} accessibilityLiveRegion="polite">{done}</Text> : null}
      {orders === null ? <ActivityIndicator color={colors.primary} /> : orders.length === 0 ? <Text style={styles.empty}>{t('online.empty')}</Text> : null}

      {orders?.map((o) => (
        <Card key={o.id} style={styles.order}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={styles.number}>{o.number}</Text>
              <Text style={styles.muted}>{formatDateTime(o.createdAt)}</Text>
            </View>
            <Badge label={t(`online.status.${o.status}`)} tone={TONES[o.status]} />
          </View>
          <Text style={styles.name}>{o.customerName}</Text>
          <View style={styles.contact}>
            <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(`tel:${o.phone}`)} style={styles.contactBtn} hitSlop={6}>
              <Ionicons name="call-outline" size={16} color={colors.primary} />
              <Text style={styles.contactText}>{o.phone}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="WhatsApp" onPress={() => void openWhatsApp(t('online.waText', { number: o.number }), o.phone)} style={styles.contactBtn} hitSlop={6}>
              <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
            </Pressable>
          </View>
          {o.address ? <Text style={styles.muted}>📍 {o.address}</Text> : null}
          {o.note ? <Text style={styles.note}>« {o.note} »</Text> : null}
          <View style={styles.lines}>
            {o.lines.map((l) => (
              <View key={l.productId} style={styles.line}>
                <Text style={styles.lineName} numberOfLines={1}>{l.quantity} × {l.productName}</Text>
                <Text style={styles.lineTotal}>{formatMoney(l.lineTotal)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.line}>
            <Text style={styles.totalLabel}>{t('online.total')}</Text>
            <Text style={styles.total}>{formatMoney(o.total)}</Text>
          </View>
          {o.status === 'NEW' || o.status === 'CONFIRMED' ? (
            <View style={styles.actions}>
              <PrimaryButton icon="cart-outline" title={t('online.convert')} onPress={() => void run(o, 'convert')} loading={busy === o.id} disabled={!!busy} />
              <View style={styles.row}>
                {o.status === 'NEW' ? (
                  <View style={styles.flex}>
                    <PrimaryButton icon="checkmark" title={t('online.confirm')} variant="outline" onPress={() => void run(o, 'CONFIRMED')} disabled={!!busy} />
                  </View>
                ) : null}
                <View style={styles.flex}>
                  <PrimaryButton
                    icon="close"
                    title={t('online.cancel')}
                    variant="outline"
                    disabled={!!busy}
                    onPress={() => confirmAction(t('online.cancelConfirm', { number: o.number }), () => void run(o, 'CANCELLED'), t('common.cancel'), t('online.cancel'))}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  muted: { color: colors.muted, fontSize: 12 },
  link: { color: colors.primary, fontWeight: '800', marginVertical: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  chipTextOn: { color: colors.onPrimary },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  order: { marginBottom: spacing.sm, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  number: { color: colors.text, fontWeight: '900', fontSize: 15 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 4 },
  contact: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  contactBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 36 },
  contactText: { color: colors.primary, fontWeight: '700' },
  note: { color: colors.text, fontStyle: 'italic', fontSize: 13 },
  lines: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 6, gap: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  lineName: { flex: 1, color: colors.text, fontSize: 13 },
  lineTotal: { color: colors.text, fontWeight: '700', fontSize: 13 },
  totalLabel: { color: colors.muted, fontWeight: '800' },
  total: { color: colors.text, fontWeight: '900', fontSize: 16 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.sm },
  done: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.sm, fontWeight: '700' },
});
