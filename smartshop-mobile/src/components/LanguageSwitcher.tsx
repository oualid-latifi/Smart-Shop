import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, Lang } from '../i18n';
import { colors, spacing } from '../theme';

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [notice, setNotice] = useState<string | null>(null);

  async function select(lang: Lang) {
    if (lang === i18n.language) return;
    const restartNeeded = await changeLanguage(lang);
    setNotice(restartNeeded ? t('language.restartNotice') : null);
  }

  return (
    <View>
      <View style={styles.row}>
        {LANGUAGES.map(({ code, label }) => {
          const active = i18n.language === code;
          return (
            <Pressable
              key={code}
              onPress={() => select(code)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  notice: { marginTop: spacing.sm, textAlign: 'center', color: colors.muted, fontSize: 12 },
});