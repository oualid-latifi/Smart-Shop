import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { errorMessage } from '../api/errors';
import type { AccountStatus, AuthResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';
import LanguageSwitcher from '../components/LanguageSwitcher';
import PrimaryButton from '../components/PrimaryButton';
import Screen from '../components/Screen';
import TextField from '../components/TextField';
import { API_URL_KEY, storage, TOKEN_KEY, REFRESH_TOKEN_KEY } from '../storage';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, logout, updateProfile } = useAuth();
  const { i18n } = useTranslation();
  const isAr = (i18n.language || '').startsWith('ar');
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    setProfileName(user?.name ?? '');
    setProfileEmail(user?.email ?? '');
  }, [user?.name, user?.email]);

  async function saveProfile() {
    setProfileSuccess(false);
    if (!profileName.trim() || !profileEmail.trim()) {
      setProfileError(isAr ? 'الاسم والبريد الإلكتروني إجباريان' : 'Le nom et l\'e-mail sont obligatoires');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail.trim())) {
      setProfileError(isAr ? 'البريد الإلكتروني غير صالح' : 'Adresse e-mail invalide');
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    try {
      await updateProfile(profileName.trim(), profileEmail.trim());
      setProfileSuccess(true);
    } catch (e) {
      setProfileError(errorMessage(e, t));
    } finally {
      setProfileSaving(false);
    }
  }

  // Mot de passe
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Adresse du serveur
  const [serverUrl, setServerUrl] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState(false);
  const [serverSaving, setServerSaving] = useState(false);

  useEffect(() => {
    storage.get(API_URL_KEY).then((saved) => setServerUrl(saved && saved.trim() ? saved : API_URL));
  }, []);

  async function saveServer(value: string) {
    const clean = value.trim().replace(/\/+$/, '');
    setServerOk(false);
    if (!/^https?:\/\/.+/i.test(clean)) {
      setServerError(t('server.invalid'));
      return;
    }

    setServerSaving(true);
    setServerError(null);
    try {
      await storage.set(API_URL_KEY, clean);
      setServerUrl(clean);
      // Test : le serveur répond-il ?
      await api<AccountStatus>('/api/auth/status', { auth: false });
      setServerOk(true);
    } catch (e) {
      setServerError(errorMessage(e, t));
    } finally {
      setServerSaving(false);
    }
  }

  async function resetServer() {
    await storage.remove(API_URL_KEY);
    setServerUrl(API_URL);
    setServerOk(false);
    setServerError(null);
  }

  async function changePassword() {
    setPwSuccess(false);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError(t('errors.required'));
      return;
    }
    if (newPassword.length < 8) {
      setPwError(t('errors.passwordShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t('password.mismatch'));
      return;
    }

    setPwSaving(true);
    setPwError(null);
    try {
      const response = await api<AuthResponse>('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      // Les autres appareils sont déconnectés : on garde le nouveau token pour celui-ci
      await storage.set(TOKEN_KEY, response.token);
      await storage.set(REFRESH_TOKEN_KEY, response.refreshToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSuccess(true);
    } catch (e) {
      setPwError(errorMessage(e, t));
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>{t('home.welcome', { name: user?.name ?? '' })}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={[styles.card, styles.spaced]}>
        <Text style={styles.section}>{isAr ? 'معلومات الحساب' : 'Profil du propriétaire'}</Text>
        <TextField
          label={isAr ? 'الاسم الكامل' : 'Nom complet'}
          value={profileName}
          onChangeText={setProfileName}
          autoCapitalize="words"
        />
        <TextField
          label={isAr ? 'البريد الإلكتروني' : 'Adresse e-mail'}
          value={profileEmail}
          onChangeText={setProfileEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
        {profileSuccess ? <Text style={styles.success}>{isAr ? 'تم تحديث المعلومات بنجاح' : 'Profil mis à jour avec succès'}</Text> : null}
        <PrimaryButton
          title={isAr ? 'حفظ المعلومات' : 'Enregistrer les modifications'}
          onPress={() => void saveProfile()}
          loading={profileSaving}
        />
      </View>

      <View style={styles.block}>
        <LanguageSwitcher />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>{t('server.title')}</Text>
        <TextField
          label={t('server.address')}
          hint={t('server.hint')}
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
        {serverOk ? <Text style={styles.success}>{t('server.ok')}</Text> : null}
        <PrimaryButton
          title={t('server.save')}
          onPress={() => void saveServer(serverUrl)}
          loading={serverSaving}
        />
        <View style={styles.gap}>
          <PrimaryButton title={t('server.reset')} onPress={() => void resetServer()} variant="outline" />
        </View>
      </View>

      <View style={[styles.card, styles.spaced]}>
        <Text style={styles.section}>{t('password.title')}</Text>
        <TextField
          label={t('password.current')}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextField
          label={t('password.new')}
          hint={t('auth.passwordHint')}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextField
          label={t('password.confirm')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        {pwError ? <Text style={styles.error}>{pwError}</Text> : null}
        {pwSuccess ? <Text style={styles.success}>{t('password.success')}</Text> : null}
        <PrimaryButton title={t('password.save')} onPress={changePassword} loading={pwSaving} />
      </View>

      <View style={styles.block}>
        <PrimaryButton title={t('common.logout')} onPress={() => void logout()} variant="outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spaced: { marginTop: spacing.lg },
  gap: { marginTop: spacing.sm },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  email: { marginTop: spacing.sm, color: colors.primary, fontWeight: '600' },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  block: { marginVertical: spacing.lg },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
  },
  success: {
    color: colors.success,
    backgroundColor: colors.successBg,
    padding: spacing.sm,
    borderRadius: radius,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
});