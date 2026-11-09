import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputInstance, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing } from '../theme';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null; // message affiché sous le champ, bordure rouge
  required?: boolean; // ajoute un astérisque au libellé
}

const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, hint, error, required, style, onFocus, onBlur, secureTextEntry, ...inputProps },
  ref,
) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View>
        <TextInput
          ref={ref}
          style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError, secureTextEntry && styles.inputWithToggle, style]}
          placeholderTextColor={colors.muted}
          accessibilityLabel={required ? `${label}, ${t('common.required')}` : label}
          accessibilityHint={error || hint}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
        />
        {/* Les champs mot de passe ont un bouton pour afficher / masquer la saisie */}
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('auth.hidePassword') : t('auth.showPassword')}
            onPress={() => setRevealed((v) => !v)}
            style={styles.toggle}
            hitSlop={8}
          >
            <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

export default TextField;

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  required: { color: colors.danger },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  inputFocused: { borderColor: colors.primary, borderWidth: 2, paddingHorizontal: spacing.md - 1, paddingVertical: 13 },
  inputError: { borderColor: colors.danger },
  inputWithToggle: { paddingRight: 48 },
  toggle: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, color: colors.muted, marginTop: spacing.xs },
  error: { fontSize: 12, color: colors.danger, marginTop: spacing.xs, fontWeight: '600' },
});
