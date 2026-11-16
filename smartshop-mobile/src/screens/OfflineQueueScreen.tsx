import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { OpType } from '../db';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { Badge, Card, IconTile, type Tone } from '../components/ui';
import { confirmAction } from '../confirm';
import { formatDateTime, formatMoney } from '../format';
import { useOffline } from '../offline';
import { colors, radius, spacing } from '../theme';

const LOOK: Record<OpType, { icon: React.ComponentProps<typeof Ionicons>['name']; tone: Tone }> = {
  SALE_CREATE: { icon: 'cart-outline', tone: 'primary' },
  CUSTOMER_CREATE: { icon: 'person-add-outline', tone: 'violet' },
  PAYMENT_CREATE: { icon: 'cash-outline', tone: 'success' },
};

/** État de la synchronisation et opérations faites hors-ligne, pas encore envoyées au serveur. */
export default function OfflineQueueScreen() {
  const { t } = useTranslation();
  const { queue, syncing, offline, lastSync, retry, discard } = useOffline();

  return (
    <Screen>
      <Card style={styles.status}>
        <Ionicons name={offline ? 'cloud-offline-outline' : 'cloud-done-outline'} size={28} color={offline ? colors.warning : colors.success} />
        <View style={styles.flex}>
          <Text style={styles.statusTitle}>{offline ? t('offline.noServer') : t('offline.connected')}</Text>
          <Text style={styles.muted}>{lastSync ? t('offline.lastSync', { date: formatDateTime(lastSync) }) : t('offline.neverSynced')}</Text>
        </View>
      </Card>
      <Text style={styles.help}>{t('offline.help')}</Text>
      <View style={styles.actions}>
        <PrimaryButton icon="sync-outline" title={t('offline.syncNow')} onPress={() => void retry()} loading={syncing} />
      </View>

      <Text style={styles.section}>{t('offline.pendingTitle', { n: queue.length })}</Text>
      {queue.length === 0 ? <Text style={styles.empty}>{t('offline.empty')}</Text> : null}
      {queue.map((op) => (
        <View key={op.opId} style={[styles.row, op.error ? styles.rowError : null]}>
          <View style={styles.head}>
            <IconTile name={LOOK[op.type].icon} tone={LOOK[op.type].tone} size={40} />
            <View style={styles.flex}>
              <Text style={styles.title}>{t(`offline.type.${op.type}`)}{op.total !== null ? ` · ${formatMoney(op.total)}` : ''}</Text>
              {op.label ? <Text style={styles.muted} numberOfLines={2}>{op.label}</Text> : null}
              <Text style={styles.muted}>{formatDateTime(op.occurredAt)}</Text>
            </View>
            <Badge label={op.error ? t('offline.refused') : t('offline.waiting')} tone={op.error ? 'danger' : 'warning'} />
          </View>
          {op.error ? <Text style={styles.error}>{op.error}</Text> : null}
          {op.error ? (
            <PrimaryButton
              icon="trash-outline"
              title={t('offline.discard')}
              variant="outline"
              onPress={() => confirmAction(t('offline.discardConfirm'), () => void discard(op.opId), t('common.cancel'), t('offline.discard'))}
            />
          ) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  help: { color: colors.muted, fontSize: 12, marginTop: spacing.sm },
  muted: { color: colors.muted, fontSize: 12 },
  actions: { marginVertical: spacing.md },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  row: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  rowError: { borderColor: colors.danger },
  head: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
  title: { color: colors.text, fontWeight: '800', fontSize: 15 },
  error: { color: colors.danger, fontSize: 13 },
});
