import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Activity, AppUser } from '../api/types';
import { formatDateTime } from '../format';
import { colors, radius, spacing } from '../theme';

/** Journal d'activité des 7 derniers jours, filtrable par employé. */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await api<Activity[]>(`/api/activity${userId ? `?userId=${userId}` : ''}`));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t, userId]);

  useEffect(() => {
    api<AppUser[]>('/api/users').then(setUsers).catch(() => undefined);
  }, []);
  useEffect(() => { setLoading(true); void load().finally(() => setLoading(false)); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterBar}>
        {[{ id: null as string | null, name: t('activity.all') }, ...users.map((u) => ({ id: u.id as string | null, name: u.name }))].map((u) => (
          <Pressable key={u.id ?? 'all'} accessibilityRole="radio" accessibilityState={{ checked: userId === u.id }} onPress={() => setUserId(u.id)} style={[styles.chip, userId === u.id && styles.chipActive]}>
            <Text style={[styles.chipText, userId === u.id && styles.chipTextActive]}>{u.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} colors={[colors.primary]} tintColor={colors.primary} />}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
          ListEmptyComponent={<Text style={styles.empty}>{t('activity.empty')}</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.dot} />
              <View style={styles.flex}>
                <Text style={styles.action}>{item.action}</Text>
                <Text style={styles.muted}>{item.userName} · {formatDateTime(item.at)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xl },
  filterBar: { flexGrow: 0 },
  filters: { gap: spacing.sm, padding: spacing.md },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  flex: { flex: 1 },
  action: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.sm },
});
