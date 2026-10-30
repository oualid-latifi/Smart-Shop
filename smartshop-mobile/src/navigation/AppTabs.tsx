import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DashboardScreen from '../screens/DashboardScreen';
import { colors } from '../theme';
import CustomersStack from './CustomersStack';
import ProductsStack from './ProductsStack';
import MoreStack from './MoreStack';
import SalesStack from './SalesStack';

const Tab = createBottomTabNavigator();
type IconName = React.ComponentProps<typeof Ionicons>['name'];
interface TabDef {
  name: string;
  component: React.ComponentType<any>;
  labelKey: string;
  labelFr: string;
  labelAr: string;
  icon: IconName;
  iconActive: IconName;
}

// Icônes distinctes et immédiatement reconnaissables pour chaque espace.
const TABS: TabDef[] = [
  { name: 'Home', component: DashboardScreen, labelKey: 'tabs.home', labelFr: 'Accueil', labelAr: 'الرئيسية', icon: 'home-outline', iconActive: 'home' },
  { name: 'Sales', component: SalesStack, labelKey: 'tabs.sales', labelFr: 'Vente', labelAr: 'البيع', icon: 'cart-outline', iconActive: 'cart' },
  { name: 'Customers', component: CustomersStack, labelKey: 'tabs.customers', labelFr: 'Clients', labelAr: 'الزبناء', icon: 'people-outline', iconActive: 'people' },
  { name: 'Products', component: ProductsStack, labelKey: 'tabs.products', labelFr: 'Produits', labelAr: 'المنتجات', icon: 'cube-outline', iconActive: 'cube' },
  { name: 'More', component: MoreStack, labelKey: 'tabs.more', labelFr: 'Plus', labelAr: 'المزيد', icon: 'menu-outline', iconActive: 'menu' },
];

export default function AppTabs() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAr = !!i18n.language && i18n.language.startsWith('ar');

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2, marginBottom: 1 },
        tabBarItemStyle: { paddingTop: 5 },
        tabBarStyle: {
          direction: 'ltr',
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 7),
          elevation: 12,
          shadowColor: '#0f172a',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            title: t(tab.labelKey, { defaultValue: isAr ? tab.labelAr : tab.labelFr }),
            tabBarAccessibilityLabel: t(tab.labelKey, { defaultValue: isAr ? tab.labelAr : tab.labelFr }),
            tabBarIcon: ({ color, size, focused }) => (
              <View style={{ minWidth: 42, height: 29, paddingHorizontal: 9, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.neutralBg : 'transparent' }}>
                <Ionicons name={focused ? tab.iconActive : tab.icon} color={color} size={focused ? size + 3 : size + 1} />
              </View>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
