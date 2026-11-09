import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Check, CheckStatus } from '../api/types';
import { confirmAction } from '../confirm';
import { formatDate, formatMoney } from '../format';
import { colors, radius, spacing } from '../theme';

const TABS: CheckStatus[] = ['PENDING', 'CASHED', 'BOUNCED'];

/** Chèques reçus : à encaisser (triés par échéance), encaissés, impayés. */
export default function ChecksScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CheckStatus>('PENDING');
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: CheckStatus) => {
    try {
      setError(null);
      setChecks(await api<Check[]>(`/api/checks?status=${s}`));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load(status).finally(() => setLoading(false));
    }, [load, status]),
  );

  async function act(check: Check, action: 'cashed' | 'bounced') {
    setBusy(check.operationId);
    try {
      await api(`/api/checks/${check.operationId}/${action}`, { method: 'POST' });
      await load(status);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  }

  function dueLabel(c: Check) {
    if (c.daysUntilDue > 0) return t('checks.dueIn', { days: c.daysUntilDue });
    if (c.daysUntilDue === 0) return t('checks.dueToday');
    return t('checks.overdue', { days: -c.daysUntilDue });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: status === tab }}
            onPress={() => setStatus(tab)}
            style={[styles.tab, status === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, status === tab && styles.tabTextActive]}>{t(`checks.${tab}`)}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={checks}
          keyExtractor={(c) => c.operationId}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(status); setRefreshing(false); }} colors={[colors.primary]} tintColor={colors.primary} />}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-outline" size={30} color={colors.muted} />
              <Text style={styles.muted}>{t('checks.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const urgent = item.status === 'PENDING' && item.daysUntilDue <= 3;
            return (
              <View style={[styles.card, urgent && styles.cardUrgent]}>
                <View style={styles.head}>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{item.customerName}</Text>
                    <Text style={styles.muted}>n° {item.number}{item.bank ? ` · ${item.bank}` : ''}</Text>
                  </View>
                  <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
                </View>
                <Text style={[styles.due, urgent && styles.dueUrgent]}>
                  {formatDate(item.dueDate)} · {item.status === 'PENDING' ? dueLabel(item) : t(`checks.${item.status}`)}
                </Text>
                {item.status === 'PENDING' ? (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!!busy}
                      onPress={() => void act(item, 'cashed')}
                      style={[styles.action, styles.actionOk]}
                    >
                      {busy === item.operationId ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="checkmark" size={18} color={colors.onPrimary} />}
                      <Text style={styles.actionOkText}>{t('checks.cashed')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!!busy}
                      onPress={() => confirmAction(t('checks.bounceConfirm'), () => void act(item, 'bounced'), t('common.cancel'), t('checks.bounced'))}
                      style={[styles.action, styles.actionKo]}
                    >
                      <Ionicons name="close" size={18} color={colors.danger} />
                      <Text style={styles.actionKoText}>{t('checks.bounced')}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xl },
  tabs: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0, width: '100%', maxWidth: 640, alignSelf: 'center' },
  tab: { flex: 1, minHeight: 44, borderRadius: radius, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: colors.onPrimary },
  content: { padding: spacing.md, gap: spacing.sm, width: '100%', maxWidth: 640, alignSelf: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cardUrgent: { borderColor: colors.danger, borderWidth: 2 },
  head: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  amount: { color: colors.text, fontWeight: '800', fontSize: 16 },
  due: { color: colors.muted, marginTop: spacing.sm, fontWeight: '600' },
  dueUrgent: { color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: radius },
  actionOk: { backgroundColor: colors.success },
  actionOkText: { color: colors.onPrimary, fontWeight: '800' },
  actionKo: { borderWidth: 1, borderColor: colors.danger },
  actionKoText: { color: colors.danger, fontWeight: '800' },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.sm },
});
