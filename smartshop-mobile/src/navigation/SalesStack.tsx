import React from 'react';
import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import SaleDetailScreen from '../screens/SaleDetailScreen';
import SaleScreen from '../screens/SaleScreen';
import SalesHistoryScreen from '../screens/SalesHistoryScreen';
import { colors } from '../theme';
import type { SalesStackParamList } from './types';

const Stack = createNativeStackNavigator<SalesStackParamList>();

export default function SalesStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SaleNew"
        component={SaleScreen}
        options={({ navigation }) => ({
          title: t('tabs.sales'),
          headerRight: () => (
            <Pressable onPress={() => navigation.navigate('SalesHistory')} hitSlop={10}>
              <Ionicons name="time-outline" size={26} color={colors.text} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="SalesHistory"
        component={SalesHistoryScreen}
        options={{ title: t('history.title') }}
      />
      <Stack.Screen
        name="SaleDetail"
        component={SaleDetailScreen}
        options={{ title: t('history.detailTitle') }}
      />
    </Stack.Navigator>
  );
}