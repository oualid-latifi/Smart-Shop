import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import DashboardScreen from '../screens/DashboardScreen';
import type { Permission } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import QuickAddSheet, { type QuickAction } from '../components/QuickAddSheet';
import { NotificationsProvider } from '../notifications';
import { colors, heroGradient } from '../theme';
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
  anyOf?: Permission[]; // onglet visible seulement avec un de ces droits
}

// Accueil, Ventes, [+], Produits, Plus — les clients sont dans "Plus"
const TABS: TabDef[] = [
  { name: 'Home', component: DashboardScreen, labelKey: 'tabs.home', labelFr: 'Accueil', labelAr: 'الرئيسية', icon: 'home-outline', iconActive: 'home' },
  { name: 'Sales', component: SalesStack, labelKey: 'tabs.sales', labelFr: 'Ventes', labelAr: 'البيع', icon: 'cart-outline', iconActive: 'cart', anyOf: ['SALES'] },
  { name: 'Products', component: ProductsStack, labelKey: 'tabs.products', labelFr: 'Produits', labelAr: 'المنتجات', icon: 'cube-outline', iconActive: 'cube' },
  { name: 'More', component: MoreStack, labelKey: 'tabs.more', labelFr: 'Plus', labelAr: 'المزيد', icon: 'grid-outline', iconActive: 'grid' },
];

// Écran vide : l'onglet "+" ouvre une feuille d'actions au lieu de changer d'écran
function Empty() {
  return null;
}

export default function AppTabs() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { can } = useAuth();
  const [quickOpen, setQuickOpen] = useState(false);
  const isAr = !!i18n.language && i18n.language.startsWith('ar');
  const tabs = TABS.filter((tab) => !tab.anyOf || tab.anyOf.some(can));
  // Bouton "+" au milieu de la barre
  const middle = Math.ceil(tabs.length / 2);

  const label = (tab: TabDef) => t(tab.labelKey, { defaultValue: isAr ? tab.labelAr : tab.labelFr });

  function renderTab(tab: TabDef) {
    return (
      <Tab.Screen
        key={tab.name}
        name={tab.name}
        component={tab.component}
        options={{
          title: label(tab),
          tabBarAccessibilityLabel: label(tab),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? tab.iconActive : tab.icon} color={color} size={size} />
          ),
        }}
      />
    );
  }

  return (
    <NotificationsProvider>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
          tabBarStyle: {
            direction: 'ltr',
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 66 + insets.bottom,
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        }}
      >
        {tabs.slice(0, middle).map(renderTab)}
        <Tab.Screen
          name="QuickAdd"
          component={Empty}
          options={{
            title: '',
            tabBarAccessibilityLabel: isAr ? 'إضافة سريعة' : 'Ajout rapide',
            tabBarButton: (props) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isAr ? 'إضافة سريعة' : 'Ajout rapide'}
                onPress={() => setQuickOpen(true)}
                style={styles.plusWrap}
                testID={props.testID}
              >
                <LinearGradient colors={heroGradient} style={styles.plus}>
                  <Ionicons name="add" size={30} color="#fff" />
                </LinearGradient>
              </Pressable>
            ),
          }}
        />
        {tabs.slice(middle).map(renderTab)}
      </Tab.Navigator>

      <QuickAddSheetConnected visible={quickOpen} onClose={() => setQuickOpen(false)} />
    </NotificationsProvider>
  );
}

/** Les actions rapides naviguent vers le bon onglet puis le bon formulaire. */
function QuickAddSheetConnected({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const isAr = !!i18n.language && i18n.language.startsWith('ar');
  // Navigation de la pile racine ("Main" = les onglets) : chemin complet onglet → écran
  const root = useNavigation<any>();
  const navigate = (tab: string, screen?: string, params?: object) =>
    root.navigate('Main', { screen: tab, params: screen ? { screen, params } : undefined });

  const actions: QuickAction[] = [
    { key: 'sale', label: isAr ? 'بيع جديد' : 'Nouvelle vente', icon: 'cart-outline', tone: 'primary', anyOf: ['SALES'], onPress: () => navigate('Sales', 'SaleNew') },
    { key: 'quote', label: t('quotes.new'), icon: 'document-text-outline', tone: 'violet', anyOf: ['SALES'], onPress: () => navigate('More', 'Quotes', { screen: 'QuoteForm' }) },
    { key: 'customer', label: isAr ? 'زبون جديد' : 'Nouveau client', icon: 'person-add-outline', tone: 'success', anyOf: ['CUSTOMERS'], onPress: () => navigate('More', 'Customers', { screen: 'CustomerForm' }) },
    { key: 'product', label: t('products.add'), icon: 'cube-outline', tone: 'warning', anyOf: ['PRODUCTS_WRITE'], onPress: () => navigate('Products', 'ProductForm') },
    { key: 'expense', label: isAr ? 'مصروف جديد' : 'Nouvelle dépense', icon: 'wallet-outline', tone: 'danger', anyOf: ['REPORTS'], onPress: () => navigate('More', 'Reports', { screen: 'ExpenseForm' }) },
    { key: 'order', label: t('orders.new'), icon: 'clipboard-outline', tone: 'neutral', anyOf: ['PURCHASES'], onPress: () => navigate('More', 'PurchaseOrderForm') },
  ];
  return <QuickAddSheet visible={visible} onClose={onClose} actions={actions} />;
}

const styles = StyleSheet.create({
  plusWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: -22, borderWidth: 4, borderColor: colors.background },
});
