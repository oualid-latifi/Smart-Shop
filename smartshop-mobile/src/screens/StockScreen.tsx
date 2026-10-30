import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Product, StockMovement } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import TextField from '../components/TextField';
import { formatDateTime, parseNumber } from '../format';
import type { ProductsStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<ProductsStackParamList, 'Stock'>;

export default function StockScreen({ route }: Props) {
  const { t } = useTranslation();
  const [product, setProduct] = useState<Product>(route.params.product);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState(t('stock.defaultNote'));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadMovements = useCallback(async () => {
    try {
      const data = await api<StockMovement[]>(
        `/api/stock/movements?productId=${product.id}&limit=50`,
      );
      setMovements(data);
    } catch {
      setMovements([]);
    }
  }, [product.id]);

  useFocusEffect(
    useCallback(() => {
      void loadMovements();
    }, [loadMovements]),
  );

  async function adjust() {
    const value = parseNumber(counted);
    if (value === null || value < 0 || !Number.isInteger(value) || !note.trim()) {
      setError(t('stock.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await api<Product>('/api/stock/adjustments', {
        method: 'POST',
        body: { productId: product.id, countedQuantity: value, note: note.trim() },
      });
      setProduct(updated);
      setCounted('');
      setSuccess(true);
      await loadMovements();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.muted}>{product.reference}</Text>
          <Text style={styles.label}>{t('stock.current')}</Text>
          <Text style={[styles.stock, product.lowStock && styles.low]}>{product.stockQuantity}</Text>
        </View>

        <Text style={styles.section}>{t('stock.adjustTitle')}</Text>
        <TextField
          label={t('stock.counted')}
          value={counted}
          onChangeText={setCounted}
          keyboardType="number-pad"
        />
        <TextField label={t('stock.note')} value={note} onChangeText={setNote} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{t('stock.success')}</Text> : null}
        <PrimaryButton title={t('stock.adjust')} onPress={adjust} loading={saving} />

        <Text style={styles.section}>{t('stock.movements')}</Text>
        {movements.length === 0 ? (
          <Text style={styles.muted}>{t('stock.noMovements')}</Text>
        ) : (
          movements.map((m) => (
            <View key={m.id} style={styles.moveRow}>
              <View style={styles.flex}>
                <Text style={styles.moveType}>{t(`stock.type.${m.type}`)}</Text>
                {m.note ? <Text style={styles.muted}>{m.note}</Text> : null}
                <Text style={styles.muted}>{formatDateTime(m.createdAt)}</Text>
              </View>
              <Text style={[styles.qty, m.quantity >= 0 ? styles.plus : styles.minus]}>
                {m.quantity > 0 ? `+${m.quantity}` : String(m.quantity)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  label: { marginTop: spacing.md, color: colors.muted, fontSize: 13 },
  stock: { fontSize: 30, fontWeight: '800', color: colors.primary },
  low: { color: colors.danger },
  section: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  success: {
    color: colors.success,
    backgroundColor: colors.successBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  moveType: { fontSize: 15, fontWeight: '700', color: colors.text },
  qty: { fontSize: 18, fontWeight: '800' },
  plus: { color: colors.success },
  minus: { color: colors.danger },
});