import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Purchase } from '../api/types';
import { formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';
import PrimaryButton from './PrimaryButton';
import TextField from './TextField';

/** Renvoi d'articles au fournisseur depuis la fiche d'un achat. */
export default function SupplierReturnForm({ purchase, onDone }: { purchase: Purchase; onDone: (p: Purchase) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lines = purchase.lines
    .map((l) => ({ productId: l.productId, quantity: Number.parseInt(quantities[l.productId] ?? '', 10) }))
    .filter((l) => Number.isFinite(l.quantity) && l.quantity > 0);
  const credit = purchase.lines.reduce((sum, l) => {
    const q = Number.parseInt(quantities[l.productId] ?? '', 10);
    return sum + (Number.isFinite(q) && q > 0 ? q * l.unitPrice : 0);
  }, 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Purchase>(`/api/purchases/${purchase.id}/returns`, {
        method: 'POST',
        body: { lines, reason: reason.trim() || null },
      });
      setQuantities({});
      setReason('');
      setOpen(false);
      setInfo(t('supplierReturn.done'));
      onDone(updated);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <View>
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <PrimaryButton icon="return-up-back-outline" title={t('supplierReturn.open')} variant="outline" onPress={() => { setInfo(null); setOpen(true); }} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('supplierReturn.title')}</Text>
      {purchase.lines.map((l, i) => (
        <View key={`${l.productId}-${i}`} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={2}>{l.productName}</Text>
            <Text style={styles.muted}>{l.quantity} × {formatMoney(l.unitPrice)}</Text>
          </View>
          <TextInput
            style={styles.qty}
            value={quantities[l.productId] ?? ''}
            onChangeText={(v) => setQuantities((q) => ({ ...q, [l.productId]: v.replace(/[^\d]/g, '') }))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            accessibilityLabel={`${t('supplierReturn.quantity')} ${l.productName}`}
          />
        </View>
      ))}
      <TextField label={t('returns.reason')} value={reason} onChangeText={setReason} />
      {credit > 0 ? <Text style={styles.credit}>{t('returns.credit')} : {formatMoney(credit)}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton title={t('supplierReturn.save')} onPress={save} loading={saving} disabled={lines.length === 0} />
      <View style={styles.spacer}>
        <PrimaryButton title={t('common.cancel')} variant="outline" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  qty: { width: 72, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 8, textAlign: 'center', color: colors.text, fontWeight: '700', backgroundColor: colors.background },
  credit: { color: colors.text, fontWeight: '700', marginBottom: spacing.md },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
  info: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.sm, fontWeight: '700' },
  spacer: { marginTop: spacing.sm },
});
