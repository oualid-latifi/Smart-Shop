import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { getCachedSuppliers, saveSuppliers } from '../database';
import { errorMessage } from '../api/errors';
import type { Supplier } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import { colors, radius, spacing } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PurchasesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<PurchasesStackParamList, 'SuppliersList'>;

export default function SuppliersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const cached = await getCachedSuppliers().catch(() => []);
    setSuppliers(cached);
    setLoading(false);

    try {
      const data = await api<Supplier[]>('/api/suppliers');
      await saveSuppliers(data);
      setSuppliers(await getCachedSuppliers());
    } catch (e) {
      if (cached.length === 0) setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]));

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <PrimaryButton title={t('common.retry')} onPress={() => void load()} variant="outline" />
        </View>
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('purchases.suppliersEmpty')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => navigation.navigate('SupplierForm', { supplier: item })}
              accessibilityRole="button"
            >
              <View style={styles.icon}><Ionicons name="business-outline" size={22} color={colors.primary} /></View>
              <View style={styles.copy}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone || t('purchases.noPhone')}</Text>
              </View>
              <View style={styles.editAction}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={styles.editText}>{t('purchases.editSupplier')}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xl },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl, flexGrow: 1 },
  pressed: { opacity: 0.75 },
  editAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 10, backgroundColor: colors.neutralBg },
  editText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius + 3, padding: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  phone: { color: colors.muted, fontSize: 12, marginTop: 4 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  center: { padding: spacing.lg },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
});
