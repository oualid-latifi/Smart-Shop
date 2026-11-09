import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import QuoteDetailScreen from '../screens/QuoteDetailScreen';
import QuoteFormScreen from '../screens/QuoteFormScreen';
import QuotesScreen from '../screens/QuotesScreen';
import type { QuotesStackParamList } from './types';

const Stack = createNativeStackNavigator<QuotesStackParamList>();

export default function QuotesStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen name="QuotesList" component={QuotesScreen} options={{ title: t('quotes.title') }} />
      <Stack.Screen name="QuoteForm" component={QuoteFormScreen} options={{ title: t('quotes.new') }} />
      <Stack.Screen name="QuoteDetail" component={QuoteDetailScreen} options={({ route }) => ({ title: route.params.quote.number })} />
    </Stack.Navigator>
  );
}
