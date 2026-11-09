import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Inventory, InventoryLine } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { confirmAction } from '../confirm';
import { formatMoney } from '../format';
import type { MoreStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'InventoryDetail'>;

/** Saisie du comptage : chaque quantité est enregistrée dès qu'on quitte le champ. */
export default function InventoryDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const [inv, setInv] = useState<Inventory | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(Promise.resolve());

  const load = useCallback(async () => {
    try {
      setInv(await api<Inventory>(`/api/inventories/${route.params.id}`));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [route.params.id, t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (inv) navigation.setOptions({ title: inv.number }); }, [inv, navigation]);

  const editable = inv?.status === 'OPEN';
  const lines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (inv?.lines ?? []).filter((l) =>
      (!q || l.productName.toLowerCase().includes(q) || l.reference.toLowerCase().includes(q))
      && (!onlyDiff || (l.difference !== null && l.difference !== 0)));
  }, [inv, search, onlyDiff]);

  function commit(line: InventoryLine) {
    const text = drafts[line.productId];
    if (text === undefined) return;
    const value = text.trim() === '' ? null : Number.parseInt(text, 10);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    // Les enregistrements sont mis en file pour garder l'ordre de saisie
    saving.current = saving.current.then(async () => {
      try {
        const updated = await api<Inventory>(`/api/inventories/${route.params.id}/counts`, {
          method: 'PUT',
          body: { counts: [{ productId: line.productId, countedQuantity: value }] },
        });
        setInv(updated);
        setDrafts((d) => { const { [line.productId]: _, ...rest } = d; return rest; });
      } catch (e) {
        setError(errorMessage(e, t));
      }
    });
  }

  function finish(action: 'close' | 'cancel') {
    confirmAction(action === 'close' ? t('inventory.closeConfirm') : t('inventory.cancel'), async () => {
      setBusy(true);
      try {
        await saving.current;
        setInv(await api<Inventory>(`/api/inventories/${route.params.id}/${action}`, { method: 'POST' }));
      } catch (e) {
        setError(errorMessage(e, t));
      } finally {
        setBusy(false);
      }
    }, t('common.cancel'), t('common.confirm'));
  }

  if (!inv) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <FlatList
        data={lines}
        keyExtractor={(l) => l.productId}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.summary}>
              <Text style={styles.summaryText}>{t('inventory.progress', { done: inv.countedCount, total: inv.productCount })}</Text>
              <Text style={styles.short}>{t('inventory.shortage')} {formatMoney(inv.shortageValue)}</Text>
              <Text style={styles.surplus}>{t('inventory.surplus')} {formatMoney(inv.surplusValue)}</Text>
            </View>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={17} color={colors.muted} />
              <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder={t('inventory.search')} placeholderTextColor={colors.muted} accessibilityLabel={t('inventory.search')} />
            </View>
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: onlyDiff }} onPress={() => setOnlyDiff((v) => !v)} style={[styles.filter, onlyDiff && styles.filterOn]}>
              <Text style={[styles.filterText, onlyDiff && styles.filterTextOn]}>{t('inventory.onlyDiff')}</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => {
          const diff = item.difference;
          return (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={2}>{item.productName}</Text>
                <Text style={styles.muted}>{item.reference} · {t('inventory.expected')} {item.expectedQuantity}</Text>
                {diff !== null && diff !== 0 ? (
                  <Text style={diff < 0 ? styles.short : styles.surplus}>{t('inventory.diff')} {diff > 0 ? '+' : ''}{diff} ({formatMoney(item.differenceValue)})</Text>
                ) : null}
              </View>
              <TextInput
                style={[styles.count, item.countedQuantity !== null && styles.countDone]}
                editable={editable}
                value={drafts[item.productId] ?? (item.countedQuantity === null ? '' : String(item.countedQuantity))}
                onChangeText={(v) => setDrafts((d) => ({ ...d, [item.productId]: v.replace(/[^\d]/g, '') }))}
                onEndEditing={() => commit(item)}
                keyboardType="number-pad"
                selectTextOnFocus
                placeholder="—"
                placeholderTextColor={colors.muted}
                accessibilityLabel={`${t('inventory.counted')} ${item.productName}`}
              />
            </View>
          );
        }}
        ListFooterComponent={editable ? (
          <View style={styles.footer}>
            <PrimaryButton icon="checkmark-done" title={t('inventory.close')} onPress={() => finish('close')} loading={busy} disabled={inv.countedCount === 0} />
            <PrimaryButton title={t('inventory.cancel')} variant="outline" onPress={() => finish('cancel')} disabled={busy} />
          </View>
        ) : <Text style={styles.status}>{t(`inventory.${inv.status}`)}</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xl },
  content: { padding: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  summary: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  summaryText: { color: colors.text, fontWeight: '800', fontSize: 16 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius, paddingHorizontal: spacing.md },
  search: { flex: 1, paddingVertical: 12, color: colors.text },
  filter: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  filterOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontWeight: '600' },
  filterTextOn: { color: colors.onPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  short: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  surplus: { color: colors.success, fontWeight: '700', fontSize: 12 },
  count: { width: 76, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.text, backgroundColor: colors.card },
  countDone: { borderColor: colors.primary, borderWidth: 2 },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
  status: { textAlign: 'center', color: colors.muted, marginTop: spacing.lg, fontWeight: '700' },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius },
});
