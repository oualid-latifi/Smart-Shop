 import React, { useLayoutEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { deleteLocalSupplier, saveLocalSupplier } from '../database';
import { syncPendingOperations } from '../sync';
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
  useLayoutEffect(() => {
    navigation.setOptions({ title: supplier ? t('purchases.editSupplier') : t('purchases.supplierTitle') });
  }, [navigation, supplier, t]);
  const [name, setName] = useState(supplier?.name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function removeSupplier() {
    if (!supplier) return;
    Alert.alert(
      'Supprimer le fournisseur',
      "Un fournisseur avec un historique d'achats ne peut pas être supprimé.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteLocalSupplier(supplier.id)
              .then(() => {
                navigation.goBack();
                void syncPendingOperations();
              })
              .catch((e) => setError(errorMessage(e, t)));
          },
        },
      ],
    );
  }

  async function save() {
    if (!name.trim()) {
      setError(t('purchases.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveLocalSupplier({
        id: supplier?.id,
        name: name.trim(),
        phone: phone.trim() || null,
      });
      navigation.goBack();
      void syncPendingOperations();
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
      {supplier ? (
        <PrimaryButton title="Supprimer le fournisseur" onPress={removeSupplier} variant="outline" />
      ) : null}
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