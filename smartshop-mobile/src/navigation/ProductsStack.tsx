import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import ProductFormScreen from '../screens/ProductFormScreen';
import ProductsScreen from '../screens/ProductsScreen';
import StockScreen from '../screens/StockScreen';
import type { ProductsStackParamList } from './types';

const Stack = createNativeStackNavigator<ProductsStackParamList>();

export default function ProductsStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProductsList"
        component={ProductsScreen}
        options={{ title: t('tabs.products') }}
      />
      <Stack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={({ route }) => ({
          title: route.params?.product ? t('products.editTitle') : t('products.newTitle'),
        })}
      />
      <Stack.Screen
        name="Stock"
        component={StockScreen}
        options={{ title: t('stock.title') }}
      />
    </Stack.Navigator>
  );
}