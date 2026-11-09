import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { CashBalance, CashHandin } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { formatDateTime, formatMoney, parseNumber } from '../format';
import { colors, radius, spacing } from '../theme';

/** Espèces encaissées par chaque employé et remises au propriétaire. */
export default function CashScreen() {
  const { t } = useTranslation();
  const [balances, setBalances] = useState<CashBalance[]>([]);
  const [handins, setHandins] = useState<CashHandin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, h] = await Promise.all([api<CashBalance[]>('/api/cash/balances'), api<CashHandin[]>('/api/cash/handins')]);
      setBalances(b);
      setHandins(h);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load().finally(() => setLoading(false)); }, [load]));

  async function save() {
    const value = parseNumber(amount);
    if (!selected || value === null || value <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/cash/handins', { method: 'POST', body: { employeeId: selected, amount: value, note: note.trim() || null } });
      setAmount('');
      setNote('');
      setInfo(t('cash.done'));
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <Screen>
      <Text style={styles.muted}>{t('cash.subtitle')}</Text>
      {balances.map((b) => (
        <Pressable
          key={b.userId}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === b.userId }}
          onPress={() => { setSelected(b.userId); setAmount(b.balance > 0 ? b.balance.toFixed(2) : ''); setInfo(null); }}
          style={[styles.card, selected === b.userId && styles.cardActive]}
        >
          <View style={styles.flex}>
            <Text style={styles.name}>{b.name}</Text>
            <Text style={styles.muted}>{t(`roles.${b.role}`)} · {t('cash.collected')} {formatMoney(b.collected)} · {t('cash.handedIn')} {formatMoney(b.handedIn)}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.muted}>{t('cash.balance')}</Text>
            <Text style={[styles.balance, b.balance > 0 && styles.due]}>{formatMoney(b.balance)}</Text>
          </View>
        </Pressable>
      ))}

      {selected ? (
        <View style={styles.form}>
          <Text style={styles.section}>{t('cash.handin')}</Text>
          <TextField label={t('cash.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <TextField label={t('cash.note')} value={note} onChangeText={setNote} />
          <PrimaryButton icon="cash-outline" title={t('cash.handin')} onPress={save} loading={saving} disabled={(parseNumber(amount) ?? 0) <= 0} />
        </View>
      ) : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {handins.length > 0 ? <Text style={styles.section}>{t('cash.history')}</Text> : null}
      {handins.map((h) => (
        <View key={h.id} style={styles.histRow}>
          <View style={styles.flex}>
            <Text style={styles.name}>{h.employeeName}</Text>
            <Text style={styles.muted}>{formatDateTime(h.at)}{h.receivedBy ? ` · ${h.receivedBy}` : ''}{h.note ? ` · ${h.note}` : ''}</Text>
          </View>
          <Text style={styles.value}>{formatMoney(h.amount)}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 12 },
  card: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  cardActive: { borderColor: colors.primary, borderWidth: 2 },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700' },
  right: { alignItems: 'flex-end' },
  balance: { color: colors.text, fontWeight: '900', fontSize: 16 },
  due: { color: colors.danger },
  form: { marginTop: spacing.md },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.sm },
  histRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  value: { color: colors.text, fontWeight: '800' },
  info: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md, fontWeight: '700' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
});
