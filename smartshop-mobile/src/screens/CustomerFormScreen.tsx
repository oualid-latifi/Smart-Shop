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

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomerForm'>;

export default function CustomerFormScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const limit = parseNumber(creditLimit);
    if (!name.trim() || (creditLimit.trim() !== '' && (limit === null || limit < 0))) {
      setError(t('customers.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api('/api/customers', {
        method: 'POST',
        body: {
          name: name.trim(),
          phone: phone.trim() || null,
          creditLimit: limit,
        },
      });
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TextField label={t('customers.name')} value={name} onChangeText={setName} />
      <TextField
        label={t('customers.phone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <TextField
        label={`${t('customers.creditLimit')} (DH)`}
        hint={t('customers.creditLimitHint')}
        value={creditLimit}
        onChangeText={setCreditLimit}
        keyboardType="decimal-pad"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={t('customers.save')} onPress={save} loading={saving} />
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