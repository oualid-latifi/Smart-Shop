import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing } from '../theme';
import PrimaryButton from './PrimaryButton';

interface Props {
  visible: boolean;
  message: string | null;     // explication renvoyée par le serveur
  onCancel: () => void;
  onSubmit: (pin: string) => void;
}

/** Demande le code PIN du propriétaire (grosse remise, annulation de vente). */
export default function PinPrompt({ visible, message, onCancel, onSubmit }: Props) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  useEffect(() => { if (visible) setPin(''); }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.icon}><Ionicons name="lock-closed" size={26} color={colors.warning} /></View>
          <Text style={styles.title}>{t('approval.title')}</Text>
          <Text style={styles.message}>{message || t('approval.hint')}</Text>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/[^\d]/g, '').slice(0, 8))}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            placeholder={t('approval.placeholder')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('approval.placeholder')}
            onSubmitEditing={() => pin.length >= 4 && onSubmit(pin)}
          />
          <PrimaryButton icon="checkmark" title={t('approval.validate')} onPress={() => onSubmit(pin)} disabled={pin.length < 4} />
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel} hitSlop={8}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,8,20,0.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: radius + 4, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm, alignItems: 'stretch' },
  icon: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: colors.warningBg, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.muted, textAlign: 'center', marginBottom: spacing.sm },
  input: { minHeight: 56, borderRadius: radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardAlt, color: colors.text, fontSize: 24, letterSpacing: 8, textAlign: 'center', marginBottom: spacing.sm },
  cancel: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  cancelText: { color: colors.muted, fontWeight: '700' },
});
