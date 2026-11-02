import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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

  const [reference, setReference] = useState(product?.reference ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [model, setModel] = useState(product?.model ?? '');
  const [capacity, setCapacity] = useState(product?.capacity ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [salePrice, setSalePrice] = useState(product ? String(product.salePrice) : '');
  const [alertThreshold, setAlertThreshold] = useState(
    product ? String(product.alertThreshold) : '5',
  );
  const [purchasePrice, setPurchasePrice] = useState('');
  const [initialStock, setInitialStock] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const price = parseNumber(salePrice);
    if (!reference.trim() || !name.trim() || price === null || price < 0) {
      setError(t('products.invalid'));
      return;
    }

    const threshold = parseNumber(alertThreshold);
    if (alertThreshold.trim() !== '' && (threshold === null || threshold < 0)) {
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
            reference: reference.trim(),
            name: name.trim(),
            brand: brand.trim() || null,
            model: model.trim() || null,
            capacity: capacity.trim() || null,
            imageUrl: imageUrl.trim() || null,
            salePrice: price,
            alertThreshold: Math.round(threshold ?? 5),
          },
        });
      } else {
        const purchase = parseNumber(purchasePrice);
        const stock = parseNumber(initialStock);
        await api('/api/products', {
          method: 'POST',
          body: {
            reference: reference.trim(),
            name: name.trim(),
            brand: brand.trim() || null,
            model: model.trim() || null,
            color: color.trim() || null,
            capacity: capacity.trim() || null,
            imageUrl: imageUrl.trim() || null,
            salePrice: price,
            purchasePrice: purchase,
            initialStock: stock === null ? null : Math.round(stock),
            alertThreshold: threshold === null ? null : Math.round(threshold),
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
      <TextField label={t('products.reference')} value={reference} onChangeText={setReference} />
      <TextField label={t('products.name')} value={name} onChangeText={setName} />
      <TextField label={t('products.brand')} value={brand} onChangeText={setBrand} />
      <TextField label={t('products.model')} value={model} onChangeText={setModel} />
      <TextField label={t('products.capacity')} value={capacity} onChangeText={setCapacity} />
      <View style={styles.photoBlock}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.productPhoto} resizeMode="cover" /> : null}
        <Pressable
          style={styles.photoButton}
          onPress={async () => {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              Alert.alert(t('products.takePhoto'), t('products.photoHint'));
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.65,
              base64: true,
            });
            if (!result.canceled && result.assets[0].base64) {
              setImageUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
            }
          }}
        >
          <Text style={styles.photoButtonText}>{t('products.takePhoto')}</Text>
        </Pressable>
      </View>

      <TextField
        label={`${t('products.salePrice')} (DH)`}
        value={salePrice}
        onChangeText={setSalePrice}
        keyboardType="decimal-pad"
      />
      <TextField
        label={t('products.alertThreshold')}
        value={alertThreshold}
        onChangeText={setAlertThreshold}
        keyboardType="number-pad"
      />

      {!editing ? (
        <>
          <TextField
            label={`${t('products.purchasePrice')} (DH)`}
            hint={t('products.optional')}
            value={purchasePrice}
            onChangeText={setPurchasePrice}
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('products.initialStock')}
            hint={t('products.optional')}
            value={initialStock}
            onChangeText={setInitialStock}
            keyboardType="number-pad"
          />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={t('products.save')} onPress={save} loading={saving} />

      {editing && product ? (
        <View style={styles.spacer}>
          <PrimaryButton
            title={t('stock.open')}
            onPress={() => navigation.navigate('Stock', { product })}
            variant="outline"
          />
        </View>
      ) : null}

      {editing && product?.active ? (
        <View style={styles.spacer}>
          <PrimaryButton
            title={t('products.deactivate')}
            onPress={deactivate}
            disabled={saving}
            variant="outline"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoBlock: { marginBottom: spacing.md, gap: spacing.sm },
  productPhoto: { width: '100%', height: 180, borderRadius: radius, backgroundColor: colors.neutralBg },
  photoButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius, padding: spacing.md, alignItems: 'center' },
  photoButtonText: { color: colors.primary, fontWeight: '800' },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  spacer: { marginTop: spacing.md },
});