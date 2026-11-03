import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { confirmAction } from '../confirm';
import { parseNumber } from '../format';
import type { ProductsStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductForm'>;

export default function ProductFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const product = route.params?.product;
  const editing = !!product;

  const [name, setName] = useState(product?.name ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [model, setModel] = useState(product?.model ?? '');
  const [alertThreshold, setAlertThreshold] = useState(
    product ? String(product.alertThreshold) : '5',
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const threshold = parseNumber(alertThreshold);
    if (!name.trim() ||
        (alertThreshold.trim() !== '' &&
          (threshold === null || threshold < 0 || !Number.isInteger(threshold)))) {
      setError(t('products.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editing && product) {
        await api(`/api/products/${product.id}`, {
          method: 'PUT',
          body: {
            reference: product.reference,
            name: name.trim(),
            brand: brand.trim() || null,
            model: model.trim() || null,
            color: product.color,
            capacity: product.capacity,
            imageUrl: product.imageUrl,
            salePrice: product.salePrice,
            purchasePrice: product.purchasePrice,
            alertThreshold: Math.round(threshold ?? 5),
          },
        });
      } else {
        await api('/api/products', {
          method: 'POST',
          body: {
            name: name.trim(),
            brand: brand.trim() || null,
            model: model.trim() || null,
            alertThreshold: Math.round(threshold ?? 5),
          },
        });
      }
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  }

  function deactivate() {
    if (!product) return;
    confirmAction(
      t('products.deactivateConfirm'),
      async () => {
        setSaving(true);
        setError(null);
        try {
          await api(`/api/products/${product.id}`, { method: 'DELETE' });
          navigation.goBack();
        } catch (e) {
          setError(errorMessage(e, t));
          setSaving(false);
        }
      },
      t('common.cancel'),
      t('common.confirm'),
    );
  }

  return (
    <Screen>
      <TextField label={t('products.name')} value={name} onChangeText={setName} />
      <TextField label={t('products.brand')} value={brand} onChangeText={setBrand} />
      <TextField label={t('products.model')} value={model} onChangeText={setModel} />
      <TextField
        label={t('products.alertThreshold')}
        value={alertThreshold}
        onChangeText={setAlertThreshold}
        keyboardType="number-pad"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton title={t('products.save')} onPress={save} loading={saving} />

      {editing && product ? (
        <View style={styles.spacer}>
          <PrimaryButton title={t('stock.open')} onPress={() => navigation.navigate('Stock', { product })} variant="outline" />
        </View>
      ) : null}

      {editing && product?.active ? (
        <View style={styles.spacer}>
          <PrimaryButton title={t('products.deactivate')} onPress={deactivate} disabled={saving} variant="outline" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
  spacer: { marginTop: spacing.md },
});
