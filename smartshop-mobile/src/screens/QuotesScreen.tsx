import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Quote, QuoteStatus } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { formatDate, formatMoney } from '../format';
import type { QuotesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<QuotesStackParamList, 'QuotesList'>;

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, { fg: string; bg: string }> = {
  PENDING: { fg: colors.primary, bg: colors.neutralBg },
  ACCEPTED: { fg: colors.success, bg: colors.successBg },
  CONVERTED: { fg: colors.success, bg: colors.successBg },
  REJECTED: { fg: colors.danger, bg: colors.dangerBg },
  EXPIRED: { fg: colors.muted, bg: colors.neutralBg },
};

export default function QuotesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setQuotes(await api<Quote[]>('/api/quotes'));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={styles.loader} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <FlatList
        data={quotes}
        keyExtractor={(q) => q.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.subtitle}>{t('quotes.subtitle')}</Text>
            <PrimaryButton icon="add" title={t('quotes.new')} onPress={() => navigation.navigate('QuoteForm')} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={32} color={colors.muted} />
            <Text style={styles.muted}>{t('quotes.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const tone = QUOTE_STATUS_COLORS[item.status];
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('QuoteDetail', { quote: item })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <Text style={styles.number}>{item.number}</Text>
                <Text style={styles.name} numberOfLines={1}>{item.customerName ?? '—'}</Text>
                <Text style={styles.muted}>{formatDate(item.createdAt)} · {t('quotes.validUntil')} {formatDate(item.validUntil)}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.total}>{formatMoney(item.total)}</Text>
                <Text style={[styles.badge, { color: tone.fg, backgroundColor: tone.bg }]}>{t(`quotes.status_${item.status}`)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xl },
  content: { padding: spacing.md, gap: spacing.sm, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  subtitle: { color: colors.muted, fontSize: 13 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  pressed: { opacity: 0.7 },
  number: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', marginVertical: 2 },
  muted: { color: colors.muted, fontSize: 12 },
  right: { alignItems: 'flex-end', justifyContent: 'space-between' },
  total: { color: colors.text, fontSize: 15, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius },
});
