
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import type { ReportsStackParamList } from './types';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export default function ReportsStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: t('tabs.reports') }}
      />

      <Stack.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{ title: t('expenses.title') }}
      />

      <Stack.Screen
        name="ExpenseForm"
        component={ExpenseFormScreen}
        options={{ title: t('expenses.newTitle') }}
      />
    </Stack.Navigator>
  );
}
