import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { TargetProgress } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { formatMoney, parseNumber } from '../format';
import { colors, radius, spacing } from '../theme';

export function ProgressBar({ percent }: { percent: number | null }) {
  const value = Math.min(100, Math.max(0, percent ?? 0));
  return (
    <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }}>
      <View style={[styles.fill, { width: `${value}%` }, value >= 100 && styles.fillDone]} />
    </View>
  );
}

/** Objectifs mensuels des vendeurs : progression visible par tous, modifiable par le propriétaire. */
export default function TargetsScreen() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [rows, setRows] = useState<TargetProgress[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api<TargetProgress[]>('/api/targets'));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load().finally(() => setLoading(false)); }, [load]));

  async function save(row: TargetProgress) {
    const value = parseNumber(drafts[row.userId] ?? '');
    if (value === null || value < 0) return;
    setBusy(row.userId);
    try {
      await api('/api/targets', { method: 'PUT', body: { userId: row.userId, month: row.month, amount: value } });
      setDrafts((d) => { const { [row.userId]: _, ...rest } = d; return rest; });
      await load();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <Screen>
      <Text style={styles.muted}>{t('targets.subtitle')} ({rows[0]?.month ?? ''})</Text>
      {rows.map((r) => (
        <View key={r.userId} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.name}>{r.name}</Text>
            <Text style={styles.percent}>{r.percent !== null ? `${r.percent} %` : t('targets.none')}</Text>
          </View>
          <ProgressBar percent={r.percent} />
          <Text style={styles.muted}>
            {formatMoney(r.achieved)}{r.target !== null ? ` / ${formatMoney(r.target)}` : ''} · {t('targets.sales', { n: r.salesCount })}
          </Text>
          {can('USERS') ? (
            <View style={styles.setRow}>
              <TextInput
                style={styles.input}
                value={drafts[r.userId] ?? (r.target !== null ? String(r.target) : '')}
                onChangeText={(v) => setDrafts((d) => ({ ...d, [r.userId]: v }))}
                keyboardType="decimal-pad"
                placeholder={t('targets.set')}
                placeholderTextColor={colors.muted}
                accessibilityLabel={`${t('targets.set')} ${r.name}`}
              />
              <View style={styles.saveBtn}>
                <PrimaryButton title={t('targets.save')} onPress={() => void save(r)} loading={busy === r.userId} disabled={drafts[r.userId] === undefined} />
              </View>
            </View>
          ) : null}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm, gap: spacing.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  percent: { color: colors.primary, fontWeight: '900' },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.neutralBg, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  fillDone: { backgroundColor: colors.success },
  setRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.background },
  saveBtn: { width: 110 },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginTop: spacing.md },
});
