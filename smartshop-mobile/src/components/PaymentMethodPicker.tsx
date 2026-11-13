import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { PaymentMethod } from '../api/types';
import { colors, radius, spacing } from '../theme';
import TextField from './TextField';

export interface PaymentValue {
  method: PaymentMethod;
  checkNumber: string;
  checkBank: string;
  checkDueDate: string; // JJ/MM/AAAA
}

export const EMPTY_PAYMENT: PaymentValue = { method: 'CASH', checkNumber: '', checkBank: '', checkDueDate: '' };

const METHODS: { value: PaymentMethod; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'CASH', icon: 'cash-outline' },
  { value: 'CHECK', icon: 'document-outline' },
  { value: 'TRANSFER', icon: 'swap-horizontal-outline' },
  { value: 'CARD', icon: 'card-outline' },
];

/** "25/12/2026" -> "2026-12-25" ; null si la date est invalide. */
export function parseFrenchDate(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getDate() !== Number(d) || date.getMonth() !== Number(m) - 1) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

/** Erreur à afficher, ou null si le paiement est complet. */
export function paymentError(value: PaymentValue, t: (key: string) => string): string | null {
  if (value.method !== 'CHECK') return null;
  if (!value.checkNumber.trim()) return t('payments.checkNumberRequired');
  if (!parseFrenchDate(value.checkDueDate)) return t('payments.dueDateInvalid');
  return null;
}

/** Corps JSON attendu par l'API : { method, check } */
export function paymentBody(value: PaymentValue) {
  return {
    method: value.method,
    check: value.method === 'CHECK'
      ? { number: value.checkNumber.trim(), bank: value.checkBank.trim() || null, dueDate: parseFrenchDate(value.checkDueDate) }
      : null,
  };
}

export default function PaymentMethodPicker({ value, onChange }: { value: PaymentValue; onChange: (v: PaymentValue) => void }) {
  const { t } = useTranslation();
  const set = (patch: Partial<PaymentValue>) => onChange({ ...value, ...patch });

  return (
    <View>
      <Text style={styles.label}>{t('payments.method')}</Text>
      <View style={styles.list} accessibilityRole="radiogroup">
        {METHODS.map((m, i) => {
          const active = value.method === m.value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => set({ method: m.value, checkDueDate: m.value === 'CHECK' && !value.checkDueDate ? inDays(0) : value.checkDueDate })}
              style={[styles.option, i > 0 && styles.optionDivider]}
            >
              <View style={[styles.radio, active && styles.radioOn]}>{active ? <View style={styles.radioDot} /> : null}</View>
              <Ionicons name={m.icon} size={18} color={active ? colors.primary : colors.muted} />
              <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>{t(`payments.${m.value}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      {value.method === 'CHECK' ? (
        <View style={styles.check}>
          <View style={styles.twoCols}>
            <View style={styles.flex}>
              <TextField label={t('payments.checkNumber')} required value={value.checkNumber} onChangeText={(v) => set({ checkNumber: v })} />
            </View>
            <View style={styles.flex}>
              <TextField label={t('payments.bank')} value={value.checkBank} onChangeText={(v) => set({ checkBank: v })} />
            </View>
          </View>
          <TextField
            label={t('payments.dueDate')}
            required
            hint="JJ/MM/AAAA"
            value={value.checkDueDate}
            onChangeText={(v) => set({ checkDueDate: v })}
            keyboardType="numbers-and-punctuation"
            error={value.checkDueDate && !parseFrenchDate(value.checkDueDate) ? t('payments.dueDateInvalid') : null}
          />
          <View style={styles.row}>
            {[0, 30, 60, 90].map((days) => (
              <Pressable key={days} accessibilityRole="button" onPress={() => set({ checkDueDate: inDays(days) })} style={styles.quick}>
                <Text style={styles.quickText}>{days === 0 ? t('payments.today') : `+${days} j`}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  list: { backgroundColor: colors.cardAlt, borderRadius: radius, marginBottom: spacing.md, paddingHorizontal: spacing.md },
  option: { minHeight: 48, flexDirection: 'row', gap: spacing.sm + 2, alignItems: 'center' },
  optionDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionText: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  optionTextActive: { color: colors.text, fontWeight: '800' },
  check: { backgroundColor: colors.neutralBg, borderRadius: radius, padding: spacing.md, marginBottom: spacing.md },
  twoCols: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  quick: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  quickText: { color: colors.text, fontWeight: '600', fontSize: 13 },
});
