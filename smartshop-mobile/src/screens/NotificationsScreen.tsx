import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { AppNotification, NotificationType } from '../api/types';
import { IconTile, type Tone } from '../components/ui';
import { formatDateTime } from '../format';
import { useNotifications } from '../notifications';
import { colors, radius, spacing } from '../theme';

type IconName = React.ComponentProps<typeof IconTile>['name'];

const LOOK: Record<NotificationType, { icon: IconName; tone: Tone; screen?: string }> = {
  LOW_STOCK: { icon: 'alert-circle-outline', tone: 'warning', screen: 'Replenishment' },
  CHECK_DUE: { icon: 'document-outline', tone: 'primary', screen: 'Checks' },
  BIG_SALE: { icon: 'flash-outline', tone: 'success' },
  TARGET_REACHED: { icon: 'trophy-outline', tone: 'violet', screen: 'Targets' },
  BACKUP_FAILED: { icon: 'cloud-offline-outline', tone: 'danger', screen: 'Backups' },
};

type Props = { navigation: { navigate: (screen: string) => void } };

/** Alertes de la boutique : stock bas, grosses ventes, chèques à encaisser, objectifs atteints… */
export default function NotificationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { items, unread, refresh, markRead, markAllRead } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  function open(n: AppNotification) {
    void markRead(n.id);
    const screen = LOOK[n.type]?.screen;
    if (screen) navigation.navigate(screen);
  }

  return (
    <ScrollView
      style={styles.safe}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <View style={styles.head}>
        <Text style={styles.muted}>{unread > 0 ? t('notifs.unread', { n: unread }) : t('notifs.allRead')}</Text>
        {unread > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => void markAllRead()} hitSlop={8}>
            <Text style={styles.link}>{t('notifs.markAll')}</Text>
          </Pressable>
        ) : null}
      </View>
      {items.length === 0 ? <Text style={styles.empty}>{t('notifs.empty')}</Text> : null}
      {items.map((n) => {
        const look = LOOK[n.type] ?? { icon: 'notifications-outline', tone: 'primary' };
        return (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            accessibilityState={{ selected: !n.read }}
            onPress={() => open(n)}
            style={({ pressed }) => [styles.row, !n.read && styles.unread, pressed && styles.pressed]}
          >
            <IconTile name={look.icon} tone={look.tone} size={40} />
            <View style={styles.flex}>
              <Text style={[styles.title, !n.read && styles.bold]} numberOfLines={2}>{n.title}</Text>
              {n.body ? <Text style={styles.body} numberOfLines={3}>{n.body}</Text> : null}
              <Text style={styles.date}>{formatDateTime(n.createdAt)}</Text>
            </View>
            {!n.read ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  muted: { color: colors.muted, fontSize: 13 },
  link: { color: colors.primary, fontWeight: '800' },
  empty: { color: colors.muted, textAlign: 'center', padding: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  unread: { borderColor: colors.primary },
  pressed: { opacity: 0.75 },
  flex: { flex: 1 },
  title: { color: colors.text, fontSize: 14 },
  bold: { fontWeight: '800' },
  body: { color: colors.muted, fontSize: 13, marginTop: 2 },
  date: { color: colors.muted, fontSize: 11, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 4 },
});
