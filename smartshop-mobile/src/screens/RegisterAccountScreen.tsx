import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { api, ApiError, getBaseUrl } from '../api/client';
import { errorMessage } from '../api/errors';
import type { AppUser, Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import PrimaryButton from '../components/PrimaryButton';
import TextField from '../components/TextField';
import { IconTile, type Tone } from '../components/ui';
import { openWhatsApp } from '../documents';
import { colors, heroGradient, radius, spacing } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ROLES: { role: Role; icon: IconName; tone: Tone }[] = [
  { role: 'SELLER', icon: 'cart-outline', tone: 'primary' },
  { role: 'CASHIER', icon: 'cash-outline', tone: 'success' },
  { role: 'STOCKKEEPER', icon: 'cube-outline', tone: 'warning' },
  { role: 'ACCOUNTANT', icon: 'calculator-outline', tone: 'violet' },
  { role: 'OWNER', icon: 'shield-checkmark-outline', tone: 'danger' },
];

/** 0 à 4 : longueur, majuscules, chiffres, symboles. */
function strength(password: string): number {
  if (password.length < 8) return password.length > 0 ? 1 : 0;
  let score = 1;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const STRENGTH_COLORS = [colors.border, colors.danger, colors.warning, colors.primary, colors.success];

/** Création d'un compte pour un membre de l'équipe : réservée au propriétaire. */
export default function RegisterAccountScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('SELLER');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<AppUser | null>(null);

  if (user?.role !== 'OWNER') {
    return (
      <View style={styles.denied}>
        <IconTile name="lock-closed-outline" tone="danger" size={64} />
        <Text style={styles.deniedTitle}>{t('register.ownerOnly')}</Text>
        <Text style={styles.muted}>{t('register.ownerOnlyHint')}</Text>
      </View>
    );
  }

  const score = strength(password);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('errors.required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('register.emailInvalid');
    if (password.length < 8) next.password = t('errors.passwordShort');
    if (confirm !== password) next.confirm = t('password.mismatch');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const account = await api<AppUser>('/api/users', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim().toLowerCase(), password, role },
      });
      setCreated(account);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      setError(errorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setName('');
    setEmail('');
    setPassword('');
    setConfirm('');
    setRole('SELLER');
    setErrors({});
    setCreated(null);
  }

  async function shareAccess(account: AppUser) {
    // Le mot de passe n'est pas envoyé : à transmettre de vive voix
    const message = t('register.shareText', { name: account.name, email: account.email, role: t(`roles.${account.role}`), server: await getBaseUrl() });
    await openWhatsApp(message);
  }

  if (created) {
    return (
      <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
        <View style={styles.success}>
          <View style={styles.tick}><Ionicons name="checkmark" size={40} color={colors.success} /></View>
          <Text style={styles.successTitle}>{t('register.created')}</Text>
          <Text style={styles.muted}>{t('register.createdHint')}</Text>
        </View>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{t('register.name')}</Text>
          <Text style={styles.summaryValue}>{created.name}</Text>
          <Text style={styles.summaryLabel}>{t('register.email')}</Text>
          <Text style={styles.summaryValue} selectable>{created.email}</Text>
          <Text style={styles.summaryLabel}>{t('users.role')}</Text>
          <Text style={styles.summaryValue}>{t(`roles.${created.role}`)}</Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton icon="logo-whatsapp" title={t('register.share')} onPress={() => void shareAccess(created)} />
          <PrimaryButton icon="person-add-outline" title={t('register.another')} variant="outline" onPress={reset} />
          <PrimaryButton icon="people-outline" title={t('register.team')} variant="outline" onPress={() => navigation.navigate('Main', { screen: 'More', params: { screen: 'Users' } })} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="person-add" size={30} color="#fff" />
        <Text style={styles.heroTitle}>{t('register.title')}</Text>
        <Text style={styles.heroText}>{t('register.subtitle')}</Text>
      </LinearGradient>

      <Text style={styles.section}>{t('register.identity')}</Text>
      <TextField label={t('register.name')} value={name} onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }} error={errors.name || null} autoCapitalize="words" required />
      <TextField label={t('register.email')} value={email} onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }} error={errors.email || null} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} required />

      <Text style={styles.section}>{t('register.security')}</Text>
      <TextField label={t('password.new')} hint={t('auth.passwordHint')} value={password} onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }} error={errors.password || null} secureTextEntry autoCapitalize="none" required />
      <View style={styles.meter} accessibilityLabel={t('register.strength', { level: t(`register.level${score}`) })}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.meterBar, { backgroundColor: i <= score ? STRENGTH_COLORS[score] : colors.border }]} />
        ))}
      </View>
      {password ? <Text style={[styles.meterText, { color: STRENGTH_COLORS[score] }]}>{t(`register.level${score}`)}</Text> : null}
      <TextField label={t('password.confirm')} value={confirm} onChangeText={(v) => { setConfirm(v); setErrors((e) => ({ ...e, confirm: '' })); }} error={errors.confirm || null} secureTextEntry autoCapitalize="none" required />

      <Text style={styles.section}>{t('users.role')}</Text>
      <View accessibilityRole="radiogroup" style={styles.roles}>
        {ROLES.map((r) => {
          const on = role === r.role;
          return (
            <Pressable key={r.role} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setRole(r.role)} style={[styles.role, on && styles.roleOn]}>
              <IconTile name={r.icon} tone={r.tone} size={40} />
              <View style={styles.flex}>
                <Text style={styles.roleName}>{t(`roles.${r.role}`)}</Text>
                <Text style={styles.roleDesc}>{t(`roles.${r.role}_desc`)}</Text>
              </View>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.muted} />
            </Pressable>
          );
        })}
      </View>
      {role === 'OWNER' ? <Text style={styles.warning}>{t('register.ownerWarning')}</Text> : null}

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <PrimaryButton icon="person-add-outline" title={t('register.submit')} onPress={() => void submit()} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  hero: { borderRadius: radius + 4, padding: spacing.lg, gap: 4, marginBottom: spacing.sm },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: spacing.sm },
  heroText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.md, marginBottom: spacing.sm },
  meter: { flexDirection: 'row', gap: 6, marginTop: -spacing.xs },
  meterBar: { flex: 1, height: 6, borderRadius: 3 },
  meterText: { fontSize: 12, fontWeight: '700', marginTop: 4, marginBottom: spacing.sm },
  roles: { gap: spacing.sm, marginBottom: spacing.sm },
  role: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 64 },
  roleOn: { borderColor: colors.primary, borderWidth: 2 },
  roleName: { color: colors.text, fontWeight: '800', fontSize: 15 },
  roleDesc: { color: colors.muted, fontSize: 12 },
  flex: { flex: 1 },
  muted: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  warning: { color: colors.warning, backgroundColor: colors.warningBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.sm, fontSize: 13 },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
  denied: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  deniedTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  success: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  tick: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  successTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  summary: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  summaryLabel: { color: colors.muted, fontSize: 12, marginTop: spacing.sm },
  summaryValue: { color: colors.text, fontWeight: '700', fontSize: 15 },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
