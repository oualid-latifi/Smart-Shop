import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { parseNumber } from '../format';
import type { CustomersStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { useUnsavedChanges } from '../useUnsavedChanges';

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomerForm'>;

export default function CustomerFormScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const customer = route.params?.customer;
  const editing = !!customer;
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [ice, setIce] = useState(customer?.ice ?? '');
  const [iceError, setIceError] = useState<string | null>(null);
  const [creditLimit, setCreditLimit] = useState(customer?.creditLimit == null ? '' : String(customer.creditLimit));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useUnsavedChanges(dirty && !saving);

  async function save() {
    const limit = parseNumber(creditLimit);
    const badName = !name.trim();
    const badLimit = creditLimit.trim() !== '' && (limit === null || limit < 0);
    setNameError(badName ? t('form.required') : null);
    setLimitError(badLimit ? t('form.invalidNumber') : null);
    const badIce = ice.trim() !== '' && !/^\d{15}$/.test(ice.trim());
    setIceError(badIce ? t('customers.iceHint') : null);
    if (badName || badLimit || badIce) {
      setError(t('form.fixErrors'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api(editing && customer ? `/api/customers/${customer.id}` : '/api/customers', {
        method: editing ? 'PUT' : 'POST',
        body: {
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          ice: ice.trim() || null,
          creditLimit: limit,
        },
      });
      setDirty(false);
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TextField
        label={t('customers.name')}
        required
        value={name}
        onChangeText={(v) => { setName(v); setDirty(true); setNameError(null); }}
        error={nameError}
        autoComplete="name"
      />
      <TextField
        label={t('customers.phone')}
        value={phone}
        onChangeText={(v) => { setPhone(v); setDirty(true); }}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <TextField
        label={t('customers.address')}
        value={address}
        onChangeText={(v) => { setAddress(v); setDirty(true); }}
        autoComplete="street-address"
      />
      <TextField
        label={t('customers.ice')}
        hint={t('customers.iceHint')}
        value={ice}
        onChangeText={(v) => { setIce(v); setDirty(true); setIceError(null); }}
        error={iceError}
        keyboardType="number-pad"
        maxLength={15}
      />
      <TextField
        label={`${t('customers.creditLimit')} (DH)`}
        hint={t('customers.creditLimitHint')}
        value={creditLimit}
        onChangeText={(v) => { setCreditLimit(v); setDirty(true); setLimitError(null); }}
        keyboardType="decimal-pad"
        error={limitError}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={t(editing ? 'customers.update' : 'customers.save')} onPress={save} loading={saving} />
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