import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { PurchaseOrder, PurchaseOrderStatus } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { formatDate, formatMoney } from '../format';
import type { MoreStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'PurchaseOrders'>;

export const ORDER_TONE: Record<PurchaseOrderStatus, { fg: string; bg: string }> = {
  ORDERED: { fg: colors.primary, bg: colors.neutralBg },
  PARTIALLY_RECEIVED: { fg: colors.primary, bg: colors.neutralBg },
  RECEIVED: { fg: colors.success, bg: colors.successBg },
  CANCELLED: { fg: colors.muted, bg: colors.neutralBg },
};

export default function PurchaseOrdersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    api<PurchaseOrder[]>('/api/purchase-orders')
      .then(setOrders)
      .catch((e) => setError(errorMessage(e, t)))
      .finally(() => setLoading(false));
  }, [t]));

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.muted}>{t('orders.subtitle')}</Text>
            <PrimaryButton icon="add" title={t('orders.new')} onPress={() => navigation.navigate('PurchaseOrderForm')} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t('orders.empty')}</Text>}
        renderItem={({ item }) => {
          const tone = ORDER_TONE[item.status];
          return (
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate('PurchaseOrderDetail', { order: item })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.flex}>
                <Text style={styles.number}>{item.number}</Text>
                <Text style={styles.name}>{item.supplierName}</Text>
                <Text style={styles.muted}>{formatDate(item.createdAt)}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.total}>{formatMoney(item.total)}</Text>
                <Text style={[styles.badge, { color: tone.fg, backgroundColor: tone.bg }]}>{t(`orders.${item.status}`)}</Text>
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
  flex: { flex: 1 },
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  pressed: { opacity: 0.7 },
  number: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  name: { color: colors.text, fontWeight: '700', fontSize: 15, marginVertical: 2 },
  muted: { color: colors.muted, fontSize: 12 },
  right: { alignItems: 'flex-end', justifyContent: 'space-between' },
  total: { color: colors.text, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius },
});
