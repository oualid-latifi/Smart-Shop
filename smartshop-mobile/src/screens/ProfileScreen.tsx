import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { TargetProgress } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { Avatar, Card, IconTile, type Tone } from '../components/ui';
import { confirmAction } from '../confirm';
import { formatMoney } from '../format';
import { useOffline } from '../offline';
import { colors, heroGradient, radius, spacing } from '../theme';
import { ProgressBar } from './TargetsScreen';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Page du profil : qui je suis, mes ventes du mois, et les raccourcis du compte. */
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const isAr = !!i18n.language && i18n.language.startsWith('ar');
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const { queue } = useOffline();
  const [target, setTarget] = useState<TargetProgress | null>(null);

  useFocusEffect(useCallback(() => {
    api<TargetProgress[]>('/api/targets')
      .then((list) => setTarget(list.find((x) => x.name === user?.name) ?? null))
      .catch(() => setTarget(null));
  }, [user?.name]));

  if (!user) return null;

  const rows: { icon: IconName; tone: Tone; label: string; hint: string; onPress: () => void }[] = [
    { icon: 'key-outline', tone: 'warning', label: t('profile.password'), hint: t('profile.passwordHint'), onPress: () => navigation.navigate('Settings') },
    { icon: 'server-outline', tone: 'primary', label: t('profile.server'), hint: t('profile.serverHint'), onPress: () => navigation.navigate('Settings') },
    { icon: 'notifications-outline', tone: 'violet', label: t('notifs.title'), hint: t('notifs.subtitle'), onPress: () => navigation.navigate('Main', { screen: 'More', params: { screen: 'Notifications' } }) },
  ];

  function signOut() {
    const message = queue.length > 0 ? t('profile.logoutPending', { n: queue.length }) : t('profile.logoutConfirm');
    confirmAction(message, () => void logout(), t('common.cancel'), t('common.logout'));
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Avatar name={user.name} size={84} />
        <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
        <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
        <View style={styles.role}>
          <Ionicons name="shield-checkmark" size={14} color="#fff" />
          <Text style={styles.roleText}>{t(`roles.${user.role}`)}</Text>
        </View>
        <Text style={styles.roleDesc}>{t(`roles.${user.role}_desc`)}</Text>
      </LinearGradient>

      {target ? (
        <Card style={styles.block}>
          <Text style={styles.cardTitle}>{t('profile.month')}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(target.achieved)}</Text>
              <Text style={styles.muted}>{t('profile.revenue')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{target.salesCount}</Text>
              <Text style={styles.muted}>{t('profile.sales')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{target.percent !== null ? `${Math.round(target.percent)}%` : '—'}</Text>
              <Text style={styles.muted}>{t('profile.target')}</Text>
            </View>
          </View>
          {target.target !== null ? <ProgressBar percent={target.percent} /> : <Text style={styles.muted}>{t('profile.noTarget')}</Text>}
        </Card>
      ) : null}

      <Card style={styles.block}>
        <Text style={styles.cardTitle}>{t('common.language')}</Text>
        <LanguageSwitcher />
      </Card>

      <View style={styles.block}>
        {rows.map((row) => (
          <Pressable key={row.label} accessibilityRole="button" onPress={row.onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <IconTile name={row.icon} tone={row.tone} size={40} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{row.label}</Text>
              <Text style={styles.muted}>{row.hint}</Text>
            </View>
            <Ionicons name={isAr ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>{t('common.logout')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  hero: { borderRadius: radius + 4, padding: spacing.lg, alignItems: 'center', gap: 4 },
  name: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: spacing.sm },
  email: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  roleText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  roleDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginTop: 2 },
  block: { marginTop: spacing.md },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginBottom: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.cardAlt, borderRadius: radius, padding: spacing.sm, alignItems: 'center' },
  statValue: { color: colors.text, fontWeight: '900', fontSize: 16 },
  muted: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, minHeight: 68 },
  flex: { flex: 1 },
  rowTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.75 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 52, borderRadius: radius, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerBg, marginTop: spacing.sm },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
});
