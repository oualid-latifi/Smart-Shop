import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Quote, QuoteStatus, Sale } from '../api/types';
import DocumentActions from '../components/DocumentActions';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { confirmAction } from '../confirm';
import { openWhatsApp, shareDocument } from '../documents';
import { formatDate, formatMoney } from '../format';
import type { QuotesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { QUOTE_STATUS_COLORS } from './QuotesScreen';

type Props = NativeStackScreenProps<QuotesStackParamList, 'QuoteDetail'>;

export default function QuoteDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const [quote, setQuote] = useState<Quote>(route.params.quote);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tone = QUOTE_STATUS_COLORS[quote.status];
  const open = quote.status !== 'CONVERTED' && quote.status !== 'REJECTED';

  async function setStatus(status: QuoteStatus) {
    setSaving(true);
    setError(null);
    try {
      setQuote(await api<Quote>(`/api/quotes/${quote.id}/status`, { method: 'PUT', body: { status } }));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  function convert() {
    confirmAction(
      t('quotes.convertConfirm'),
      async () => {
        setSaving(true);
        setError(null);
        try {
          const sale = await api<Sale>(`/api/quotes/${quote.id}/convert`, { method: 'POST', body: {} });
          setQuote(await api<Quote>(`/api/quotes/${quote.id}`));
          setInfo(`${t('quotes.converted')} ${sale.number}`);
        } catch (e) {
          setError(errorMessage(e, t));
        } finally {
          setSaving(false);
        }
      },
      t('common.cancel'),
      t('quotes.convert'),
    );
  }

  return (
    <Screen>
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Text style={styles.number}>{quote.number}</Text>
          <Text style={[styles.badge, { color: tone.fg, backgroundColor: tone.bg }]}>{t(`quotes.status_${quote.status}`)}</Text>
        </View>
        <Text style={styles.name}>{quote.customerName ?? '—'}</Text>
        <Text style={styles.muted}>{formatDate(quote.createdAt)} · {t('quotes.validUntil')} {formatDate(quote.validUntil)}</Text>

        <View style={styles.lines}>
          {quote.lines.map((line, index) => (
            <View key={`${line.productId}-${index}`} style={styles.lineRow}>
              <Text style={styles.lineName}>{line.productName}</Text>
              <Text style={styles.muted}>{line.quantity} × {formatMoney(line.unitPrice)}</Text>
            </View>
          ))}
        </View>
        {quote.discount > 0 ? (
          <View style={styles.row}><Text style={styles.muted}>{t('history.discount')}</Text><Text style={styles.value}>- {formatMoney(quote.discount)}</Text></View>
        ) : null}
        <View style={styles.row}><Text style={styles.muted}>{t('sales.total')}</Text><Text style={styles.total}>{formatMoney(quote.total)}</Text></View>
        {quote.note ? <Text style={styles.note}>{quote.note}</Text> : null}
      </View>

      <Text style={styles.section}>{t('docs.title')}</Text>
      <DocumentActions
        onError={(e) => setError(errorMessage(e, t) || t('docs.failed'))}
        actions={[
          { key: 'pdf', label: t('quotes.pdf'), icon: 'document-text-outline',
            onPress: () => shareDocument(`/api/quotes/${quote.id}/pdf`, `${quote.number}.pdf`, t('docs.shareTitle')) },
          { key: 'wa', label: t('docs.whatsapp'), icon: 'logo-whatsapp',
            onPress: () => openWhatsApp(
              t('docs.quoteMessage', { name: quote.customerName ?? '', number: quote.number, total: formatMoney(quote.total), date: formatDate(quote.validUntil) }),
              quote.customerPhone,
            ) },
        ]}
      />

      {info ? <Text style={styles.info} accessibilityLiveRegion="polite">{info}</Text> : null}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

      {open ? (
        <View style={styles.actions}>
          <PrimaryButton icon="cart-outline" title={t('quotes.convert')} onPress={convert} loading={saving} />
          <View style={styles.twoCols}>
            <View style={styles.flex}>
              <PrimaryButton icon="thumbs-up-outline" title={t('quotes.accept')} variant="outline" onPress={() => void setStatus('ACCEPTED')} disabled={saving || quote.status === 'ACCEPTED'} />
            </View>
            <View style={styles.flex}>
              <PrimaryButton icon="thumbs-down-outline" title={t('quotes.reject')} variant="outline" onPress={() => void setStatus('REJECTED')} disabled={saving} />
            </View>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  badge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  muted: { color: colors.muted, fontSize: 13 },
  lines: { marginVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, gap: spacing.sm },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  lineName: { flex: 1, color: colors.text, fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  value: { color: colors.text, fontWeight: '600' },
  total: { fontSize: 18, fontWeight: '800', color: colors.primary },
  note: { marginTop: spacing.md, color: colors.muted, fontStyle: 'italic' },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  twoCols: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  info: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md, fontWeight: '700' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
});
