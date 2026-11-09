
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTranslation } from 'react-i18next';
import MoreScreen from '../screens/MoreScreen';
import AgingScreen from '../screens/AgingScreen';
import InventoryDetailScreen from '../screens/InventoryDetailScreen';
import InventoryScreen from '../screens/InventoryScreen';
import PurchaseOrderDetailScreen from '../screens/PurchaseOrderDetailScreen';
import PurchaseOrderFormScreen from '../screens/PurchaseOrderFormScreen';
import PurchaseOrdersScreen from '../screens/PurchaseOrdersScreen';
import WarehousesScreen from '../screens/WarehousesScreen';
import ActivityScreen from '../screens/ActivityScreen';
import CashScreen from '../screens/CashScreen';
import ImportScreen from '../screens/ImportScreen';
import TargetsScreen from '../screens/TargetsScreen';
import UsersScreen from '../screens/UsersScreen';
import type { MoreStackParamList } from './types';
import ChecksScreen from '../screens/ChecksScreen';
import ShopSettingsScreen from '../screens/ShopSettingsScreen';
import QuotesStack from './QuotesStack';
import PurchasesStack from './PurchasesStack';
import ReportsStack from './ReportsStack';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export default function MoreStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MoreHome"
        component={MoreScreen}
        options={{ title: t('tabs.more', { defaultValue: 'Plus' }) }}
      />

      <Stack.Screen
        name="Purchases"
        component={PurchasesStack}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="Quotes"
        component={QuotesStack}
        options={{ headerShown: false }}
      />

      <Stack.Screen name="PurchaseOrders" component={PurchaseOrdersScreen} options={{ title: t('orders.title') }} />
      <Stack.Screen name="PurchaseOrderForm" component={PurchaseOrderFormScreen} options={{ title: t('orders.new') }} />
      <Stack.Screen name="PurchaseOrderDetail" component={PurchaseOrderDetailScreen} options={({ route }) => ({ title: route.params.order.number })} />
      <Stack.Screen name="Inventories" component={InventoryScreen} options={{ title: t('inventory.title') }} />
      <Stack.Screen name="InventoryDetail" component={InventoryDetailScreen} options={{ title: t('inventory.title') }} />
      <Stack.Screen name="Warehouses" component={WarehousesScreen} options={{ title: t('warehouses.title') }} />
      <Stack.Screen name="Users" component={UsersScreen} options={{ title: t('users.title') }} />
      <Stack.Screen name="Activity" component={ActivityScreen} options={{ title: t('activity.title') }} />
      <Stack.Screen name="Cash" component={CashScreen} options={{ title: t('cash.title') }} />
      <Stack.Screen name="Targets" component={TargetsScreen} options={{ title: t('targets.title') }} />
      <Stack.Screen name="Import" component={ImportScreen} options={{ title: t('import.title') }} />

      <Stack.Screen
        name="Checks"
        component={ChecksScreen}
        options={{ title: t('checks.title') }}
      />

      <Stack.Screen
        name="Aging"
        component={AgingScreen}
        options={{ title: t('aging.title') }}
      />

      <Stack.Screen
        name="ShopSettings"
        component={ShopSettingsScreen}
        options={{ title: t('shop.title') }}
      />

      <Stack.Screen
        name="Reports"
        component={ReportsStack}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
