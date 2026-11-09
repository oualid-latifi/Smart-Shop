import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

export interface DocumentAction {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => Promise<void>;
}

/**
 * Grille de boutons "documents" (ticket, facture, BL, WhatsApp…).
 * Chaque bouton affiche son propre indicateur de chargement pendant la génération du PDF.
 */
export default function DocumentActions({ actions, onError }: { actions: DocumentAction[]; onError: (e: unknown) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: DocumentAction) {
    if (busy) return;
    setBusy(action.key);
    try {
      await action.onPress();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ busy: busy === action.key, disabled: !!busy }}
          onPress={() => void run(action)}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed, !!busy && busy !== action.key && styles.dimmed]}
        >
          {busy === action.key ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name={action.icon} size={22} color={colors.primary} />
          )}
          <Text style={styles.label} numberOfLines={2}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.7 },
  dimmed: { opacity: 0.5 },
  label: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
