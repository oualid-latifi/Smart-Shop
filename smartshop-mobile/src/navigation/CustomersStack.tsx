import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import CustomerFormScreen from '../screens/CustomerFormScreen';
import CustomersScreen from '../screens/CustomersScreen';
import type { CustomersStackParamList } from './types';

const Stack = createNativeStackNavigator<CustomersStackParamList>();

export default function CustomersStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CustomersList"
        component={CustomersScreen}
        options={{ title: t('tabs.customers') }}
      />
      <Stack.Screen
        name="CustomerForm"
        component={CustomerFormScreen}
        options={{ title: t('customers.newTitle') }}
      />
      <Stack.Screen
        name="CustomerDetail"
        component={CustomerDetailScreen}
        options={{ title: t('customers.detailTitle') }}
      />
    </Stack.Navigator>
  );
}