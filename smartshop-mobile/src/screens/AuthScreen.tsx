import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { AccountStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { colors, radius, spacing } from '../theme';

// Un seul écran : "créer le compte" la toute première fois, "se connecter" ensuite
export default function AuthScreen() {
  const { t } = useTranslation();
  const { login, register } = useAuth();

  const [accountExists, setAccountExists] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkAccount = useCallback(async () => {
    try {
      setError(null);
      const status = await api<AccountStatus>('/api/auth/status', { auth: false });
      setAccountExists(status.accountExists);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

  useEffect(() => {
    void checkAccount();
  }, [checkAccount]);

  async function submit() {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password || (!accountExists && !name.trim())) {
      setError(t('errors.required'));
      return;
    }
    if (!accountExists) {
      if (!cleanEmail.includes('@')) {
        setError(t('errors.emailInvalid'));
        return;
      }
      if (password.length < 8) {
        setError(t('errors.passwordShort'));
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      if (accountExists) {
        await login(cleanEmail, password);
      } else {
        await register(name.trim(), cleanEmail, password);
      }
    } catch (e) {
      setError(errorMessage(e, t));
      setLoading(false);
    }
    // En cas de succès, l'écran est remplacé : pas besoin de remettre loading à false
  }

  return (
    <Screen>
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}><Ionicons name="storefront" size={30} color="#fff" /></View>
        <Text style={styles.brand}>{t('common.appName')}</Text>
        <Text style={styles.brandHint}>{t('auth.brandHint')}</Text>
      </View>

      {accountExists === null && !error ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : null}

      {accountExists !== null ? (
        <View style={styles.card}>
          <Text style={styles.title}>
            {accountExists ? t('auth.loginTitle') : t('auth.registerTitle')}
          </Text>
          {!accountExists ? <Text style={styles.hint}>{t('auth.registerHint')}</Text> : null}

          {!accountExists ? (
            <TextField label={t('auth.name')} value={name} onChangeText={setName} />
          ) : null}
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
            hint={!accountExists ? t('auth.passwordHint') : undefined}
            onSubmitEditing={submit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            icon={accountExists ? 'log-in-outline' : 'person-add-outline'}
            title={accountExists ? t('auth.loginButton') : t('auth.registerButton')}
            onPress={submit}
            loading={loading}
          />
        </View>
      ) : null}

      {accountExists === null && error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <PrimaryButton title="↻" onPress={checkAccount} variant="outline" />
        </View>
      ) : null}

      <View style={styles.language}>
        <LanguageSwitcher />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandBlock: { alignItems: 'center', marginBottom: spacing.lg },
  brandMark: { width: 66, height: 66, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  brand: { fontSize: 29, fontWeight: '900', color: colors.primary, textAlign: 'center' },
  brandHint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  loader: { marginVertical: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  hint: { color: colors.muted, marginBottom: spacing.md },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  language: { marginTop: spacing.lg },
});