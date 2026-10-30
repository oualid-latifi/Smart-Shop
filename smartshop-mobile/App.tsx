
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { initI18n } from './src/i18n';
import AppTabs from './src/navigation/AppTabs';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import { colors, isDark } from './src/theme';

const RootStack = createNativeStackNavigator();

const baseTheme = isDark ? DarkTheme : DefaultTheme;

const navTheme = {
  ...baseTheme,
  colors: {
    ...baseTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
  },
};

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function Root() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <Splash />;
  }

  if (status !== 'signedIn') {
    return <AuthScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={AppTabs} />

        <RootStack.Screen
          name="Settings"
          component={HomeScreen}
          options={{
            headerShown: true,
            title: 'Paramètres',
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <Splash />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
