import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Category } from '../api/types';
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
  const [categoryId, setCategoryId] = useState<string | null>(product?.categoryId ?? null);
  const [salePrice, setSalePrice] = useState(product ? String(product.salePrice) : '');
  const [alertThreshold, setAlertThreshold] = useState(
    product ? String(product.alertThreshold) : '5',
  );
  const [purchasePrice, setPurchasePrice] = useState('');
  const [initialStock, setInitialStock] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setCategoriesError(false);
    try {
      setCategories(await api<Category[]>('/api/categories'));
    } catch {
      setCategoriesError(true);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function save() {
    const price = parseNumber(salePrice);
    if (!reference.trim() || !name.trim() || price === null || price < 0) {
      setError(t('products.invalid'));
      return;
    }

    const threshold = parseNumber(alertThreshold);
    if (alertThreshold.trim() !== '' && (threshold === null || threshold < 0 || !Number.isInteger(threshold))) {
      setError(t('products.invalid'));
      return;
    }

    // Optional values must not be silently discarded when the user entered invalid text.
    const purchase = parseNumber(purchasePrice);
    const stock = parseNumber(initialStock);
    if (!editing && purchasePrice.trim() !== '' && (purchase === null || purchase < 0)) {
      setError(t('products.invalid'));
      return;
    }
    if (!editing && initialStock.trim() !== '' &&
        (stock === null || stock < 0 || !Number.isInteger(stock))) {
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
            categoryId,
            brand: brand.trim() || null,
            model: model.trim() || null,
            capacity: capacity.trim() || null,
            imageUrl: imageUrl.trim() || null,
            salePrice: price,
            alertThreshold: Math.round(threshold ?? 5),
          },
        });
      } else {
        await api('/api/products', {
          method: 'POST',
          body: {
            reference: reference.trim(),
            name: name.trim(),
            categoryId,
            brand: brand.trim() || null,
            model: model.trim() || null,
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
      <TextField label={t('products.color')} value={color} onChangeText={setColor} />
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

      <Text style={styles.label}>{t('products.category')}</Text>
      {categoriesError ? (
        <View style={styles.categoryError}>
          <Text style={styles.errorText}>{t('common.loadError', { defaultValue: 'Impossible de charger les catégories.' })}</Text>
          <PrimaryButton title={t('common.retry')} onPress={() => void loadCategories()} variant="outline" />
        </View>
      ) : null}
      <View style={styles.chips}>
        <Chip
          label={t('products.noCategory')}
          active={categoryId === null}
          onPress={() => setCategoryId(null)}
        />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            active={categoryId === c.id}
            onPress={() => setCategoryId(c.id)}
          />
        ))}
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

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photoBlock: { marginBottom: spacing.md, gap: spacing.sm },
  productPhoto: { width: '100%', height: 180, borderRadius: radius, backgroundColor: colors.neutralBg },
  photoButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius, padding: spacing.md, alignItems: 'center' },
  photoButtonText: { color: colors.primary, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  categoryError: { marginBottom: spacing.md, gap: spacing.xs },
  errorText: { color: colors.danger, fontSize: 13 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  spacer: { marginTop: spacing.md },
});