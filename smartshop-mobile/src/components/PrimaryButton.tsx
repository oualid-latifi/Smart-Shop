import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
}: Props) {
  const outline = variant === 'outline';
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        outline ? styles.outline : styles.filled,
        (pressed || inactive) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={outline ? colors.primary : colors.onPrimary} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={outline ? colors.primary : colors.onPrimary} /> : null}
          <Text style={[styles.text, outline ? styles.textOutline : styles.textFilled]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  filled: { backgroundColor: colors.primary, elevation: 2, shadowColor: colors.primary, shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  dimmed: { opacity: 0.6 },
  text: { fontSize: 14, fontWeight: '800' },
  textFilled: { color: colors.onPrimary },
  textOutline: { color: colors.primary },
});