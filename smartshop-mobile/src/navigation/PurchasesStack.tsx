import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import PurchaseDetailScreen from '../screens/PurchaseDetailScreen';
import PurchaseFormScreen from '../screens/PurchaseFormScreen';
import PurchasesScreen from '../screens/PurchasesScreen';
import SupplierFormScreen from '../screens/SupplierFormScreen';
import SuppliersScreen from '../screens/SuppliersScreen';
import type { PurchasesStackParamList } from './types';

const Stack = createNativeStackNavigator<PurchasesStackParamList>();

export default function PurchasesStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="PurchasesList"
        component={PurchasesScreen}
        options={{ title: t('tabs.purchases') }}
      />
      <Stack.Screen
        name="PurchaseForm"
        component={PurchaseFormScreen}
        options={{ title: t('purchases.newTitle') }}
      />
      <Stack.Screen
        name="PurchaseDetail"
        component={PurchaseDetailScreen}
        options={{ title: t('purchases.detailTitle') }}
      />
      <Stack.Screen
        name="SuppliersList"
        component={SuppliersScreen}
        options={{ title: t('purchases.suppliersTitle') }}
      />
      <Stack.Screen
        name="SupplierForm"
        component={SupplierFormScreen}
        options={{ title: t('purchases.supplierTitle') }}
      />
    </Stack.Navigator>
  );
}