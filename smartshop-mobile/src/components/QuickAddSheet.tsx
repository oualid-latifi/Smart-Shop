import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Permission } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { colors, radius, spacing } from '../theme';
import { IconTile, type Tone } from './ui';

export interface QuickAction {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone: Tone;
  anyOf: Permission[];
  onPress: () => void;
}

/** Feuille d'actions rapides ouverte par le bouton "+" central de la barre d'onglets. */
export default function QuickAddSheet({ visible, onClose, actions }: { visible: boolean; onClose: () => void; actions: QuickAction[] }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const insets = useSafeAreaInsets();
  const allowed = actions.filter((a) => a.anyOf.some(can));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('scanner.close')} />
      <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.grid}>
          {allowed.map((a) => (
            <Pressable
              key={a.key}
              accessibilityRole="button"
              onPress={() => { onClose(); a.onPress(); }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <IconTile name={a.icon} tone={a.tone} size={48} />
              <Text style={styles.label} numberOfLines={2}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,8,20,0.6)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius + 10, borderTopRightRadius: radius + 10, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius, backgroundColor: colors.cardAlt, minHeight: 104 },
  pressed: { opacity: 0.7 },
  label: { color: colors.text, fontWeight: '700', fontSize: 12, textAlign: 'center' },
});
