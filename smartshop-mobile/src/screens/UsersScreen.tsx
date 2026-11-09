import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../api/client';
import { errorMessage } from '../api/errors';
import type { AppUser, Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { colors, radius, spacing } from '../theme';

const ROLES: Role[] = ['SELLER', 'CASHIER', 'STOCKKEEPER', 'ACCOUNTANT', 'OWNER'];

function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.roles} accessibilityRole="radiogroup">
      {ROLES.map((r) => (
        <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: value === r }} onPress={() => onChange(r)} style={[styles.role, value === r && styles.roleActive]}>
          <Text style={[styles.roleName, value === r && styles.roleTextActive]}>{t(`roles.${r}`)}</Text>
          <Text style={[styles.roleDesc, value === r && styles.roleTextActive]}>{t(`roles.${r}_desc`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Comptes des employés : création, rôle, activation, nouveau mot de passe. */
export default function UsersScreen() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  // Création
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('SELLER');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Modification
  const [editRole, setEditRole] = useState<Role>('SELLER');
  const [editActive, setEditActive] = useState(true);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    try {
      setUsers(await api<AppUser[]>('/api/users'));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useFocusEffect(useCallback(() => { void load().finally(() => setLoading(false)); }, [load]));

  async function run(action: () => Promise<unknown>, done?: string) {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await action();
      await load();
      if (done) setInfo(done);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      setError(errorMessage(e, t));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function create() {
    setFieldErrors({});
    const ok = await run(() => api('/api/users', { method: 'POST', body: { name: name.trim(), email: email.trim(), password, role } }));
    if (ok) {
      setName('');
      setEmail('');
      setPassword('');
      setRole('SELLER');
    }
  }

  function startEdit(u: AppUser) {
    setEditing(editing === u.id ? null : u.id);
    setEditRole(u.role);
    setEditActive(u.active);
    setNewPassword('');
  }

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  return (
    <Screen>
      <Text style={styles.muted}>{t('users.subtitle')}</Text>
      {users.map((u) => {
        const self = u.email === me?.email;
        return (
          <View key={u.id} style={[styles.card, !u.active && styles.inactive]}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: editing === u.id }} onPress={() => startEdit(u)} style={styles.head}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{u.name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.name}>{u.name}{self ? ` (${t('users.you')})` : ''}</Text>
                <Text style={styles.muted}>{u.email}</Text>
              </View>
              <Text style={styles.badge}>{u.active ? t(`roles.${u.role}`) : t('users.inactive')}</Text>
              <Ionicons name={editing === u.id ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </Pressable>
            {editing === u.id ? (
              <View style={styles.edit}>
                <RolePicker value={editRole} onChange={setEditRole} />
                <View style={styles.switchRow}>
                  <Text style={styles.label}>{t('users.active')}</Text>
                  <Switch value={editActive} onValueChange={setEditActive} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={t('users.active')} />
                </View>
                <PrimaryButton title={t('users.save')} loading={saving}
                  onPress={() => void run(() => api(`/api/users/${u.id}`, { method: 'PUT', body: { name: u.name, role: editRole, active: editActive } }))} />
                <TextField label={t('users.resetPassword')} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" />
                <PrimaryButton title={t('users.resetPassword')} variant="outline" disabled={newPassword.length < 8 || saving}
                  onPress={() => void run(() => api(`/api/users/${u.id}/password`, { method: 'POST', body: { password: newPassword } }), t('users.passwordReset'))} />
              </View>
            ) : null}
          </View>
        );
      })}

      <Text style={styles.section}>{t('users.new')}</Text>
      <TextField label={t('users.name')} required value={name} onChangeText={setName} error={fieldErrors.name} />
      <TextField label={t('users.email')} required value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={fieldErrors.email} />
      <TextField label={t('users.password')} required value={password} onChangeText={setPassword} secureTextEntry hint={t('auth.passwordHint')} error={fieldErrors.password} autoComplete="new-password" />
      <Text style={styles.label}>{t('users.role')}</Text>
      <RolePicker value={role} onChange={setRole} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      <PrimaryButton icon="person-add-outline" title={t('users.new')} onPress={create} loading={saving}
        disabled={!name.trim() || !email.trim() || password.length < 8} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  muted: { color: colors.muted, fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  inactive: { opacity: 0.6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '900', fontSize: 16 },
  flex: { flex: 1 },
  name: { color: colors.text, fontWeight: '700' },
  badge: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  edit: { marginTop: spacing.md, gap: spacing.sm },
  roles: { gap: spacing.xs, marginBottom: spacing.md },
  role: { borderWidth: 1, borderColor: colors.border, borderRadius: radius, padding: spacing.sm, minHeight: 48, justifyContent: 'center' },
  roleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleName: { color: colors.text, fontWeight: '800' },
  roleDesc: { color: colors.muted, fontSize: 12 },
  roleTextActive: { color: colors.onPrimary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.sm },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
  info: { color: colors.success, backgroundColor: colors.successBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md, fontWeight: '700' },
});
