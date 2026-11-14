import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useOffline } from '../offline';
import { colors, radius, spacing } from '../theme';

/** Bandeau « hors-ligne / ventes en attente » : touche pour voir la file d'attente. */
export default function OfflineBanner({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { queue, offline, syncing } = useOffline();
  const failed = queue.filter((s) => s.error).length;
  if (!offline && queue.length === 0) return null;

  const tone = failed > 0 ? styles.danger : styles.warning;
  const label = failed > 0
    ? t('offline.failed', { n: failed })
    : queue.length > 0
      ? t('offline.pending', { n: queue.length })
      : t('offline.noNetwork');

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.banner, tone]} accessibilityLiveRegion="polite">
      {syncing ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name={failed > 0 ? 'alert-circle' : 'cloud-offline-outline'} size={18} color={colors.text} />}
      <Text style={styles.text}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius, marginBottom: spacing.sm, borderWidth: 1 },
  warning: { backgroundColor: colors.warningBg, borderColor: colors.warning },
  danger: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  text: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 13 },
});
