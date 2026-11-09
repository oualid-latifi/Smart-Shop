import { Alert, Platform } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

/**
 * Demande confirmation avant de quitter un formulaire modifié mais pas enregistré
 * (bouton retour, geste de retour, flèche de l'en-tête).
 */
export function useUnsavedChanges(dirty: boolean) {
  const navigation = useNavigation();
  const { t } = useTranslation();

  usePreventRemove(dirty, ({ data }) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('common.unsavedMessage'))) {
        navigation.dispatch(data.action);
      }
      return;
    }
    Alert.alert(t('common.unsavedTitle'), t('common.unsavedMessage'), [
      { text: t('common.keepEditing'), style: 'cancel' },
      { text: t('common.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
}
