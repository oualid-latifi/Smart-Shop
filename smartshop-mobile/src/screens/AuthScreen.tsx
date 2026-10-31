import React, { useState } from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '../api/errors';
import { useAuth } from '../auth/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { colors, radius, spacing } from '../theme';

type AuthMode = 'login' | 'register';

export default function AuthScreen() {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isRegister = mode === 'register';

  async function submit() {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password || (isRegister && !name.trim())) {
      setError(t('errors.required'));
      return;
    }
    if (!cleanEmail.includes('@')) {
      setError(t('errors.emailInvalid'));
      return;
    }
    if (isRegister && password.length < 8) {
      setError(t('errors.passwordShort'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isRegister) await register(name.trim(), cleanEmail, password);
      else await login(cleanEmail, password);
    } catch (e) {
      setError(errorMessage(e, t));
      setLoading(false);
    }
  }

  function changeMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setPassword('');
  }

  return (
    <Screen>
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}><Ionicons name="storefront" size={30} color="#fff" /></View>
        <Text style={styles.brand}>{t('common.appName')}</Text>
        <Text style={styles.brandHint}>{t('auth.brandHint')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}</Text>
        {isRegister ? <Text style={styles.hint}>{t('auth.registerHint')}</Text> : null}
        {isRegister ? <TextField label={t('auth.name')} value={name} onChangeText={setName} /> : null}
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          hint={isRegister ? t('auth.passwordHint') : undefined}
          onSubmitEditing={submit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          icon={isRegister ? 'person-add-outline' : 'log-in-outline'}
          title={isRegister ? t('auth.registerButton') : t('auth.loginButton')}
          onPress={submit}
          loading={loading}
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>
            {isRegister ? t('auth.haveAccount') : t('auth.noAccount')}
          </Text>
          <Pressable onPress={() => changeMode(isRegister ? 'login' : 'register')} accessibilityRole="button">
            <Text style={styles.switchLink}>
              {isRegister ? t('auth.loginLink') : t('auth.registerLink')}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.language}><LanguageSwitcher /></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandBlock: { alignItems: 'center', marginBottom: spacing.lg },
  brandMark: { width: 66, height: 66, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  brand: { fontSize: 29, fontWeight: '900', color: colors.primary, textAlign: 'center' },
  brandHint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 22, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  hint: { color: colors.muted, marginBottom: spacing.md },
  error: { color: colors.danger, backgroundColor: colors.dangerBg, padding: spacing.sm, borderRadius: radius, marginBottom: spacing.md },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: spacing.md },
  switchText: { color: colors.muted, fontSize: 13 },
  switchLink: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  language: { marginTop: spacing.lg },
});
