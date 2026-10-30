import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { ExpenseCategory } from '../api/types';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { parseNumber } from '../format';
import type { ReportsStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<ReportsStackParamList, 'ExpenseForm'>;

const CATEGORIES: ExpenseCategory[] = ['RENT', 'TRANSPORT', 'ELECTRICITY', 'REPAIR', 'OTHER'];

export default function ExpenseFormScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<ExpenseCategory>('OTHER');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = parseNumber(amount);
    if (value === null || value <= 0) {
      setError(t('expenses.invalid'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api('/api/expenses', {
        method: 'POST',
        body: { category, amount: value, note: note.trim() || null },
      });
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e, t));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.label}>{t('expenses.category')}</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
              {t(`expenses.cat.${c}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextField
        label={`${t('expenses.amount')} (DH)`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <TextField label={t('expenses.note')} value={note} onChangeText={setNote} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton title={t('expenses.save')} onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
});