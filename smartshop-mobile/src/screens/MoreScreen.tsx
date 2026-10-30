
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

export default function MoreScreen({ navigation }: Props) {
  const { i18n, t } = useTranslation();
  const isAr = (i18n.language || '').startsWith('ar');

  const items = [
    {
      title: isAr ? 'المشتريات' : 'Achats',
      subtitle: isAr
        ? 'تدبير المشتريات والموردين'
        : 'Gérer les achats et les fournisseurs',
      icon: 'bag-handle-outline' as const,
      screen: 'Purchases',
    },
    {
      title: isAr ? 'التقارير والمصاريف' : 'Rapports et dépenses',
      subtitle: isAr
        ? 'ملخص النشاط والمصاريف'
        : 'Consulter les rapports et les dépenses',
      icon: 'bar-chart-outline' as const,
      screen: 'Reports',
    },
  ];

  return (
    <ScrollView
      style={styles.safe}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>
        {isAr ? 'المزيد' : 'Plus'}
      </Text>

      <Text style={styles.subtitle}>
        {isAr
          ? 'الأدوات والإعدادات الإضافية'
          : 'Autres fonctionnalités de gestion'}
      </Text>

      {items.map((item) => (
        <Pressable
          key={item.screen}
          onPress={() => navigation.navigate(item.screen)}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <View style={styles.iconWrap}>
            <Ionicons
              name={item.icon}
              size={23}
              color={colors.primary}
            />
          </View>

          <View style={styles.copy}>
            <Text style={styles.title}>
              {item.title}
            </Text>

            <Text style={styles.description}>
              {item.subtitle}
            </Text>
          </View>

          <Ionicons
            name={isAr ? 'chevron-back' : 'chevron-forward'}
            size={20}
            color={colors.muted}
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heading: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'left',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  card: {
    minHeight: 78,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    color: colors.muted,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});
