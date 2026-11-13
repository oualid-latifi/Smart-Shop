import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avatarColor, colors, radius, spacing } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'violet' | 'neutral';

const TONES: Record<Tone, { fg: string; bg: string }> = {
  primary: { fg: '#6ea0ff', bg: colors.primarySoft },
  success: { fg: colors.success, bg: colors.successBg },
  warning: { fg: colors.warning, bg: colors.warningBg },
  danger: { fg: colors.danger, bg: colors.dangerBg },
  violet: { fg: colors.violet, bg: colors.violetBg },
  neutral: { fg: colors.muted, bg: colors.neutralBg },
};

export function toneColors(tone: Tone) {
  return TONES[tone];
}

/** Carte de base : fond bleu nuit, coins arrondis, bordure discrète. */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Pastille colorée : "En stock : 15", "Payée", "30+"… */
export function Badge({ label, tone = 'success', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={c.fg} /> : null}
      <Text style={[styles.badgeText, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Icône dans un carré arrondi coloré (tuiles de statistiques, menus). */
export function IconTile({ name, tone = 'primary', size = 40 }: { name: IconName; tone?: Tone; size?: number }) {
  const c = TONES[tone];
  return (
    <View style={[styles.iconTile, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: c.bg }]}>
      <Ionicons name={name} size={size * 0.5} color={c.fg} />
    </View>
  );
}

/** Rond avec les initiales (clients, employés). */
export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const c = avatarColor(name);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }]}>
      <Text style={[styles.avatarText, { color: c.fg, fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

/** Vignette produit : photo si disponible, sinon icône. */
export function ProductThumb({ uri, size = 52 }: { uri?: string | null; size?: number }) {
  return uri ? (
    <Image source={{ uri }} style={[styles.thumb, { width: size, height: size }]} resizeMode="cover" />
  ) : (
    <View style={[styles.thumb, styles.thumbEmpty, { width: size, height: size }]}>
      <Ionicons name="phone-portrait-outline" size={size * 0.45} color={colors.muted} />
    </View>
  );
}

/** Titre de section avec lien "Voir tout" facultatif. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Petite tuile chiffre : icône, valeur, libellé. */
export function StatTile({ icon, tone, value, label }: { icon: IconName; tone: Tone; value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <IconTile name={icon} tone={tone} size={34} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  iconTile: { alignItems: 'center', justifyContent: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '900' },
  thumb: { borderRadius: 12, backgroundColor: colors.cardAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  sectionActionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  statTile: { flex: 1, backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: spacing.sm + 4, gap: 6 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
});
