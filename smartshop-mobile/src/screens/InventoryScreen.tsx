import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Inventory } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { confirmAction } from '../confirm';
import { formatDate, formatMoney } from '../format';
import type { MoreStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'Inventories'>;

export default function InventoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api<Inventory[]>('/api/inventories'));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load().finally(() => setLoading(false)); }, [load]));

  const openOne = items.find((i) => i.status === 'OPEN');

  function start() {
    confirmAction(t('inventory.startConfirm'), async () => {
      setBusy(true);
      setError(null);
      try {
        const inv = await api<Inventory>('/api/inventories', { method: 'POST', body: {} });
        navigation.navigate('InventoryDetail', { id: inv.id });
      } catch (e) {
        setError(errorMessage(e, t));
      } finally {
        setBusy(false);
      }
    }, t('common.cancel'), t('inventory.start'));
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.muted}>{t('inventory.subtitle')}</Text>
            {openOne ? (
              <PrimaryButton icon="clipboard-outline" title={`${t('inventory.open')} : ${openOne.number}`} onPress={() => navigation.navigate('InventoryDetail', { id: openOne.id })} />
            ) : (
              <PrimaryButton icon="add" title={t('inventory.start')} onPress={start} loading={busy} />
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t('inventory.empty')}</Text>}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('InventoryDetail', { id: item.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.flex}>
              <Text style={styles.number}>{item.number} · {t(`inventory.${item.status}`)}</Text>
              <Text style={styles.muted}>{formatDate(item.openedAt)} · {t('inventory.progress', { done: item.countedCount, total: item.productCount })}</Text>
            </View>
            <View style={styles.right}>
              {item.shortageValue > 0 ? <Text style={styles.short}>- {formatMoney(item.shortageValue)}</Text> : null}
              {item.surplusValue > 0 ? <Text style={styles.surplus}>+ {formatMoney(item.surplusValue)}</Text> : null}
            </View>
          </Pressable>
        )}
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
  card: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  pressed: { opacity: 0.7 },
  number: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
  right: { alignItems: 'flex-end', justifyContent: 'center' },
  short: { color: colors.danger, fontWeight: '800' },
  surplus: { color: colors.success, fontWeight: '800' },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius },
});
