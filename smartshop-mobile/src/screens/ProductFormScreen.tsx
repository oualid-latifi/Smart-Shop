import React, { useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInputInstance, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';
import { errorMessage } from '../api/errors';
import BarcodeScanner from '../components/BarcodeScanner';
import SupplierPrices from '../components/SupplierPrices';
import { useAuth } from '../auth/AuthContext';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { confirmAction } from '../confirm';
import { formatMoney, parseNumber } from '../format';
import type { ProductsStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { useUnsavedChanges } from '../useUnsavedChanges';

type Props = NativeStackScreenProps<ProductsStackParamList, 'ProductForm'>;
type FieldErrors = Partial<Record<'reference' | 'name' | 'salePrice' | 'vatRate' | 'unitsPerPack' | 'packPrice' | 'alertThreshold' | 'purchasePrice' | 'initialStock', string>>;

const PHOTO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.65,
  base64: true,
};

export default function ProductFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const product = route.params?.product;
  const { can } = useAuth();
  const editing = !!product;

  const [reference, setReference] = useState(product?.reference ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [scanning, setScanning] = useState(false);
  const [name, setName] = useState(product?.name ?? '');
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [model, setModel] = useState(product?.model ?? '');
  const [color, setColor] = useState(product?.color ?? '');
  const [capacity, setCapacity] = useState(product?.capacity ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [salePrice, setSalePrice] = useState(product ? String(product.salePrice) : '');
  const [alertThreshold, setAlertThreshold] = useState(
    product ? String(product.alertThreshold) : '5',
  );
  const [vatRate, setVatRate] = useState(product?.vatRate == null ? '' : String(product.vatRate));
  const [unitsPerPack, setUnitsPerPack] = useState(product?.unitsPerPack == null ? '' : String(product.unitsPerPack));
  const [packPrice, setPackPrice] = useState(product?.packPrice == null ? '' : String(product.packPrice));
  const [purchasePrice, setPurchasePrice] = useState('');
  const [initialStock, setInitialStock] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const nameRef = useRef<TextInputInstance>(null);
  const brandRef = useRef<TextInputInstance>(null);
  const modelRef = useRef<TextInputInstance>(null);
  const colorRef = useRef<TextInputInstance>(null);
  const capacityRef = useRef<TextInputInstance>(null);
  const priceRef = useRef<TextInputInstance>(null);
  const thresholdRef = useRef<TextInputInstance>(null);
  const purchaseRef = useRef<TextInputInstance>(null);
  const stockRef = useRef<TextInputInstance>(null);

  useUnsavedChanges(dirty && !saving);

  // Chaque modification marque le formulaire comme "modifié" et efface l'erreur du champ
  function bind(setter: (value: string) => void, field?: keyof FieldErrors) {
    return (value: string) => {
      setter(value);
      setDirty(true);
      if (field && fieldErrors[field]) {
        setFieldErrors((current) => ({ ...current, [field]: undefined }));
      }
    };
  }

  const salePriceValue = parseNumber(salePrice);
  const purchasePriceValue = parseNumber(purchasePrice);
  const costForMargin = editing ? product?.averagePurchasePrice ?? null : purchasePriceValue;
  const margin =
    salePriceValue !== null && costForMargin !== null && costForMargin > 0 ? salePriceValue - costForMargin : null;

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!reference.trim()) errors.reference = t('form.required');
    if (!name.trim()) errors.name = t('form.required');
    if (!salePrice.trim()) errors.salePrice = t('form.required');
    else if (salePriceValue === null || salePriceValue < 0) errors.salePrice = t('form.invalidNumber');

    const upp = parseNumber(unitsPerPack);
    if (unitsPerPack.trim() !== '' && (upp === null || upp < 2 || !Number.isInteger(upp))) errors.unitsPerPack = t('form.invalidInteger');
    const pp = parseNumber(packPrice);
    if (packPrice.trim() !== '' && (pp === null || pp < 0)) errors.packPrice = t('form.invalidNumber');
    const vat = parseNumber(vatRate);
    if (vatRate.trim() !== '' && (vat === null || vat < 0 || vat > 100)) errors.vatRate = t('form.invalidNumber');

    const threshold = parseNumber(alertThreshold);
    if (alertThreshold.trim() !== '' && (threshold === null || threshold < 0 || !Number.isInteger(threshold))) {
      errors.alertThreshold = t('form.invalidInteger');
    }
    if (!editing) {
      if (purchasePrice.trim() !== '' && (purchasePriceValue === null || purchasePriceValue < 0)) {
        errors.purchasePrice = t('form.invalidNumber');
      }
      const stock = parseNumber(initialStock);
      if (initialStock.trim() !== '' && (stock === null || stock < 0 || !Number.isInteger(stock))) {
        errors.initialStock = t('form.invalidInteger');
      }
    }
    return errors;
  }

  async function save() {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(t('form.fixErrors'));
      return;
    }

    const threshold = parseNumber(alertThreshold);
    setSaving(true);
    setError(null);
    try {
      const common = {
        reference: reference.trim(),
        name: name.trim(),
        barcode: barcode.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        color: color.trim() || null,
        capacity: capacity.trim() || null,
        imageUrl: imageUrl.trim() || null,
        salePrice: salePriceValue,
        vatRate: parseNumber(vatRate),
        unitsPerPack: parseNumber(unitsPerPack),
        packPrice: unitsPerPack.trim() === '' ? null : parseNumber(packPrice),
      };
      if (editing && product) {
        await api(`/api/products/${product.id}`, {
          method: 'PUT',
          body: { ...common, alertThreshold: Math.round(threshold ?? 5) },
        });
      } else {
        const stock = parseNumber(initialStock);
        await api('/api/products', {
          method: 'POST',
          body: {
            ...common,
            purchasePrice: purchasePriceValue,
            initialStock: stock === null ? null : Math.round(stock),
            alertThreshold: threshold === null ? null : Math.round(threshold),
          },
        });
      }
      setDirty(false);
      navigation.goBack();
    } catch (e) {
      // Les erreurs de validation du serveur s'affichent sous le champ concerné
      if (e instanceof ApiError && e.fieldErrors) {
        setFieldErrors(e.fieldErrors as FieldErrors);
        setError(t('form.fixErrors'));
      } else {
        setError(errorMessage(e, t));
      }
      setSaving(false);
    }
  }

  async function pickPhoto(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('products.sectionPhoto'), t('products.photoHint'));
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(PHOTO_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PHOTO_OPTIONS);
    if (!result.canceled && result.assets[0]?.base64) {
      setImageUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setDirty(true);
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
          setDirty(false);
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
      <Text style={styles.section}>{t('products.sectionInfo')}</Text>
      <TextField
        label={t('products.reference')}
        required
        value={reference}
        onChangeText={bind(setReference, 'reference')}
        error={fieldErrors.reference}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => nameRef.current?.focus()}
        blurOnSubmit={false}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField label={t('products.barcode')} hint={t('products.barcodeHint')} value={barcode}
            onChangeText={bind(setBarcode)} keyboardType="number-pad" autoCorrect={false} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('scanner.title')} onPress={() => setScanning(true)} style={styles.scanButton}>
          <Ionicons name="barcode-outline" size={22} color={colors.onPrimary} />
          <Text style={styles.scanText}>{t('scanner.scan')}</Text>
        </Pressable>
      </View>
      <BarcodeScanner visible={scanning} onClose={() => setScanning(false)} onScanned={(code) => { setScanning(false); setBarcode(code); setDirty(true); }} />
      <TextField
        ref={nameRef}
        label={t('products.name')}
        required
        value={name}
        onChangeText={bind(setName, 'name')}
        error={fieldErrors.name}
        returnKeyType="next"
        onSubmitEditing={() => brandRef.current?.focus()}
        blurOnSubmit={false}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField ref={brandRef} label={t('products.brand')} value={brand} onChangeText={bind(setBrand)}
            returnKeyType="next" onSubmitEditing={() => modelRef.current?.focus()} blurOnSubmit={false} />
        </View>
        <View style={styles.half}>
          <TextField ref={modelRef} label={t('products.model')} value={model} onChangeText={bind(setModel)}
            returnKeyType="next" onSubmitEditing={() => colorRef.current?.focus()} blurOnSubmit={false} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField ref={colorRef} label={t('products.color')} value={color} onChangeText={bind(setColor)}
            returnKeyType="next" onSubmitEditing={() => capacityRef.current?.focus()} blurOnSubmit={false} />
        </View>
        <View style={styles.half}>
          <TextField ref={capacityRef} label={t('products.capacity')} value={capacity} onChangeText={bind(setCapacity)}
            returnKeyType="next" onSubmitEditing={() => priceRef.current?.focus()} blurOnSubmit={false} />
        </View>
      </View>

      <Text style={styles.section}>{t('products.sectionPrice')}</Text>
      <TextField
        ref={priceRef}
        label={`${t('products.salePrice')} (DH)`}
        required
        value={salePrice}
        onChangeText={bind(setSalePrice, 'salePrice')}
        error={fieldErrors.salePrice}
        keyboardType="decimal-pad"
        returnKeyType="next"
        onSubmitEditing={() => (editing ? thresholdRef : purchaseRef).current?.focus()}
        blurOnSubmit={false}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField label={t('products.unitsPerPack')} hint={t('products.unitsPerPackHint')} value={unitsPerPack}
            onChangeText={bind(setUnitsPerPack, 'unitsPerPack')} error={fieldErrors.unitsPerPack} keyboardType="number-pad" />
        </View>
        <View style={styles.half}>
          <TextField label={t('products.packPrice')} hint={t('products.packPriceHint')} value={packPrice}
            onChangeText={bind(setPackPrice, 'packPrice')} error={fieldErrors.packPrice} keyboardType="decimal-pad" editable={unitsPerPack.trim() !== ''} />
        </View>
      </View>
      <TextField
        label={t('products.vatRate')}
        hint={t('products.vatHint')}
        value={vatRate}
        onChangeText={bind(setVatRate, 'vatRate')}
        error={fieldErrors.vatRate}
        keyboardType="decimal-pad"
      />
      {!editing ? (
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField
              ref={purchaseRef}
              label={`${t('products.purchasePrice')} (DH)`}
              hint={t('products.optional')}
              value={purchasePrice}
              onChangeText={bind(setPurchasePrice, 'purchasePrice')}
              error={fieldErrors.purchasePrice}
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => stockRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>
          <View style={styles.half}>
            <TextField
              ref={stockRef}
              label={t('products.initialStock')}
              hint={t('products.optional')}
              value={initialStock}
              onChangeText={bind(setInitialStock, 'initialStock')}
              error={fieldErrors.initialStock}
              keyboardType="number-pad"
              returnKeyType="next"
              onSubmitEditing={() => thresholdRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>
        </View>
      ) : null}
      {margin !== null ? (
        <View style={[styles.margin, margin < 0 && styles.marginNegative]}>
          <Ionicons name={margin < 0 ? 'trending-down' : 'trending-up'} size={16} color={margin < 0 ? colors.danger : colors.success} />
          <Text style={[styles.marginText, margin < 0 && styles.marginTextNegative]}>
            {t('products.margin')} : {formatMoney(margin)}
          </Text>
        </View>
      ) : null}
      <TextField
        ref={thresholdRef}
        label={t('products.alertThreshold')}
        value={alertThreshold}
        onChangeText={bind(setAlertThreshold, 'alertThreshold')}
        error={fieldErrors.alertThreshold}
        keyboardType="number-pad"
      />

      <Text style={styles.section}>{t('products.sectionPhoto')}</Text>
      <View style={styles.photoBlock}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productPhoto} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.productPhoto, styles.photoPlaceholder]}>
            <Ionicons name="image-outline" size={36} color={colors.muted} />
          </View>
        )}
        <View style={styles.row}>
          <PhotoButton icon="camera-outline" label={t('products.takePhoto')} onPress={() => void pickPhoto('camera')} />
          <PhotoButton icon="images-outline" label={t('products.choosePhoto')} onPress={() => void pickPhoto('library')} />
          {imageUrl ? (
            <PhotoButton icon="trash-outline" label={t('products.removePhoto')} danger onPress={() => { setImageUrl(''); setDirty(true); }} />
          ) : null}
        </View>
      </View>

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

      <PrimaryButton icon="checkmark" title={t('products.save')} onPress={save} loading={saving} />

      {editing && product && can('STOCK') ? <SupplierPrices productId={product.id} /> : null}

      {editing && product ? (
        <View style={styles.spacer}>
          <PrimaryButton
            icon="layers-outline"
            title={t('stock.open')}
            onPress={() => navigation.navigate('Stock', { product })}
            variant="outline"
          />
        </View>
      ) : null}

      {editing && product?.active ? (
        <Pressable accessibilityRole="button" onPress={deactivate} disabled={saving} style={styles.dangerLink} hitSlop={8}>
          <Ionicons name="archive-outline" size={16} color={colors.danger} />
          <Text style={styles.dangerLinkText}>{t('products.deactivate')}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function PhotoButton({ icon, label, onPress, danger = false }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const tint = danger ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.photoButton, { borderColor: tint }, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={[styles.photoButtonText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  scanButton: { alignSelf: 'flex-start', marginTop: 24, minHeight: 50, flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: spacing.md, borderRadius: radius, backgroundColor: colors.primary },
  scanText: { color: colors.onPrimary, fontWeight: '800' },
  margin: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.successBg, borderRadius: radius, padding: spacing.sm, marginBottom: spacing.md },
  marginNegative: { backgroundColor: colors.dangerBg },
  marginText: { color: colors.success, fontWeight: '700' },
  marginTextNegative: { color: colors.danger },
  photoBlock: { marginBottom: spacing.md, gap: spacing.sm },
  productPhoto: { width: '100%', height: 180, borderRadius: radius, backgroundColor: colors.neutralBg },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoButton: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 6, borderWidth: 1, borderRadius: radius, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  photoButtonText: { fontWeight: '800', fontSize: 13 },
  pressed: { opacity: 0.6 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  spacer: { marginTop: spacing.md },
  dangerLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginTop: spacing.md },
  dangerLinkText: { color: colors.danger, fontWeight: '700' },
});
