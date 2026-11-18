import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';
import { errorMessage } from '../api/errors';
import type { Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing } from '../theme';
import PrimaryButton from './PrimaryButton';
import TextField from './TextField';

const ROLES: Role[] = ['SELLER', 'CASHIER', 'STOCKKEEPER', 'ACCOUNTANT', 'OWNER'];

/**
 * Inscription depuis l'écran de connexion : le nouvel employé remplit son compte, puis le propriétaire
 * saisit son email et son mot de passe pour l'autoriser. Sans eux, aucun compte ne peut être créé.
 */
export default function EmployeeRegisterForm({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { registerEmployee } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('SELLER');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function field(key: string, setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setErrors((e) => ({ ...e, [key]: '' }));
    };
  }

  async function submit() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('errors.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('errors.emailInvalid');
    if (password.length < 8) next.password = t('errors.passwordShort');
    if (confirm !== password) next.confirm = t('password.mismatch');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())) next.ownerEmail = t('errors.emailInvalid');
    if (!ownerPassword) next.ownerPassword = t('errors.required');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setError(null);
    try {
      await registerEmployee({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        ownerEmail: ownerEmail.trim().toLowerCase(),
        ownerPassword,
      });
      // Succès : l'employé est connecté, l'écran est remplacé
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      setError(errorMessage(e, t));
      setLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('employee.title')}</Text>
      <Text style={styles.hint}>{t('employee.hint')}</Text>

      <TextField label={t('auth.name')} value={name} onChangeText={field('name', setName)} error={errors.name || null} autoCapitalize="words" autoComplete="name" />
      <TextField label={t('auth.email')} value={email} onChangeText={field('email', setEmail)} error={errors.email || null} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
      <TextField label={t('auth.password')} hint={t('auth.passwordHint')} value={password} onChangeText={field('password', setPassword)} error={errors.password || null} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      <TextField label={t('password.confirm')} value={confirm} onChangeText={field('confirm', setConfirm)} error={errors.confirm || null} secureTextEntry autoCapitalize="none" autoComplete="new-password" />

      <Text style={styles.section}>{t('users.role')}</Text>
      <View accessibilityRole="radiogroup" style={styles.roles}>
        {ROLES.map((r) => {
          const on = role === r;
          return (
            <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setRole(r)} style={[styles.role, on && styles.roleOn]}>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.primary : colors.muted} />
              <View style={styles.flex}>
                <Text style={styles.roleName}>{t(`roles.${r}`)}</Text>
                <Text style={styles.roleDesc}>{t(`roles.${r}_desc`)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.owner}>
        <View style={styles.ownerHead}>
          <Ionicons name="shield-checkmark" size={20} color={colors.warning} />
          <Text style={styles.ownerTitle}>{t('employee.ownerTitle')}</Text>
        </View>
        <Text style={styles.hint}>{t('employee.ownerHint')}</Text>
        <TextField label={t('employee.ownerEmail')} value={ownerEmail} onChangeText={field('ownerEmail', setOwnerEmail)} error={errors.ownerEmail || null} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" />
        <TextField label={t('employee.ownerPassword')} value={ownerPassword} onChangeText={field('ownerPassword', setOwnerPassword)} error={errors.ownerPassword || null} secureTextEntry autoCapitalize="none" autoComplete="off" onSubmitEditing={() => void submit()} />
      </View>

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <PrimaryButton icon="person-add-outline" title={t('employee.submit')} onPress={() => void submit()} loading={loading} />
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back} hitSlop={8}>
        <Text style={styles.backText}>{t('employee.back')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 22, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  hint: { color: colors.muted, marginBottom: spacing.md, fontSize: 13 },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },
  roles: { gap: spacing.xs, marginBottom: spacing.md },
  role: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius, padding: spacing.sm, minHeight: 52 },
  roleOn: { borderColor: colors.primary, backgroundColor: colors.cardAlt },
  flex: { flex: 1 },
  roleName: { color: colors.text, fontWeight: '800' },
  roleDesc: { color: colors.muted, fontSize: 12 },
  owner: { borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningBg, borderRadius: radius, padding: spacing.md, marginBottom: spacing.md },
  ownerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  ownerTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
  back: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: spacing.sm },
  backText: { color: colors.primary, fontWeight: '700' },
});
