 import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import type { PurchasesStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<PurchasesStackParamList, 'SupplierForm'>;

export default function SupplierFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const supplier = route.params?.supplier;
  const [name, setName] = useState(supplier?.name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      setError(t('purchases.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api(supplier ? `/api/suppliers/${supplier.id}` : '/api/suppliers', {
        method: supplier ? 'PUT' : 'POST',
        body: { name: name.trim(), phone: phone.trim() || null },
      });
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TextField label={t('purchases.supplierName')} value={name} onChangeText={setName} />
      <TextField
        label={t('purchases.supplierPhone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={supplier ? t('purchases.updateSupplier') : t('purchases.save')} onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
});