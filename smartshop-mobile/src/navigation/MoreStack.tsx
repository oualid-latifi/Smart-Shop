import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import CategoriesScreen from '../screens/CategoriesScreen';
import PurchasesStack from './PurchasesStack';
import ReportsStack from './ReportsStack';
import { colors, radius, spacing } from '../theme';

const Stack = createNativeStackNavigator();

function MoreHomeScreen({ navigation }: any) {
  const { t } = useTranslation();

  const options = [
    {
      title: t('tabs.purchases'),
      subtitle: t('purchases.subtitle', { defaultValue: 'Suivi des achats et des fournisseurs' }),
      icon: 'bag-handle-outline' as const,
      onPress: () => navigation.navigate('Purchases'),
    },
    {
      title: t('tabs.reports'),
      subtitle: t('reports.periodLabel', { defaultValue: 'Période' }),
      icon: 'bar-chart-outline' as const,
      onPress: () => navigation.navigate('Reports'),
    },
    {
      title: t('products.category'),
      subtitle: t('products.catalogSubtitle'),
      icon: 'grid-outline' as const,
      onPress: () => navigation.navigate('Categories'),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('more.title', { defaultValue: 'Plus' })}</Text>
        <Text style={styles.subtitle}>{t('more.subtitle', { defaultValue: 'Choisis la rubrique que tu souhaites ouvrir.' })}</Text>
        {options.map((option) => (
          <Pressable
            key={option.title}
            onPress={option.onPress}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.iconBox}>
              <Ionicons name={option.icon} size={23} color={colors.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function MoreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MoreHome"
        component={MoreHomeScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Catégories' }} />

      <Stack.Screen
        name="Purchases"
        component={PurchasesStack}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Reports"
        component={ReportsStack}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  title: { fontSize: 25, fontWeight: '900', color: colors.text, marginBottom: 2 },
  subtitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius, padding: spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.neutralBg, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1, gap: 3 },
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  optionSubtitle: { color: colors.muted, fontSize: 12 },
  pressed: { opacity: 0.75 },
});
