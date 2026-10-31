
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CategoriesScreen from '../screens/CategoriesScreen';
import PurchasesStack from './PurchasesStack';
import ReportsStack from './ReportsStack';

const Stack = createNativeStackNavigator();

export default function MoreStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MoreHome"
        component={ReportsStack}
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
