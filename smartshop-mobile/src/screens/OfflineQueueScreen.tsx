import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import { Badge, Card } from '../components/ui';
import { confirmAction } from '../confirm';
import { formatDateTime, formatMoney } from '../format';
import { useOffline } from '../offline';
import { colors, radius, spacing } from '../theme';

/** Ventes faites sans réseau, en attente d'envoi au serveur. */
export default function OfflineQueueScreen() {
  const { t } = useTranslation();
  const { queue, syncing, offline, sync, discard } = useOffline();

  return (
    <Screen>
      <Card>
        <Text style={styles.muted}>{offline ? t('offline.help') : t('offline.helpOnline')}</Text>
      </Card>
      <View style={styles.actions}>
        <PrimaryButton icon="cloud-upload-outline" title={t('offline.syncNow')} onPress={() => void sync()} loading={syncing} disabled={queue.length === 0} />
      </View>
      {queue.length === 0 ? <Text style={styles.empty}>{t('offline.empty')}</Text> : null}
      {queue.map((s) => (
        <View key={s.clientRef} style={[styles.row, s.error ? styles.rowError : null]}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={styles.total}>{formatMoney(s.total)}</Text>
              <Text style={styles.muted}>{formatDateTime(s.createdAt)} · {t('offline.items', { n: Array.isArray(s.body.lines) ? s.body.lines.length : 0 })}</Text>
            </View>
            <Badge label={s.error ? t('offline.refused') : t('offline.waiting')} tone={s.error ? 'danger' : 'warning'} />
          </View>
          {s.error ? <Text style={styles.error}>{s.error}</Text> : null}
          {s.error ? (
            <PrimaryButton
              icon="trash-outline"
              title={t('offline.discard')}
              variant="outline"
              onPress={() => confirmAction(t('offline.discardConfirm'), () => void discard(s.clientRef), t('common.cancel'), t('offline.discard'))}
            />
          ) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: 12 },
  actions: { marginVertical: spacing.md },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  row: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  rowError: { borderColor: colors.danger },
  head: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
  total: { color: colors.text, fontWeight: '900', fontSize: 16 },
  error: { color: colors.danger, fontSize: 13 },
});
