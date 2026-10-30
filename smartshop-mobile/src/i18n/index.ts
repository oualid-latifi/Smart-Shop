import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager, Platform } from 'react-native';
import { storage, LANG_KEY } from '../storage';
import fr from './fr.json';
import ar from './ar.json';

export type Lang = 'fr' | 'ar';

// Applique le sens d'écriture. Renvoie true si l'application doit être redémarrée (téléphone).
function applyDirection(lang: Lang): boolean {
  const rtl = lang === 'ar';

  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', lang);
    }
    return false;
  }

  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return I18nManager.isRTL !== rtl;
}

export async function initI18n(): Promise<void> {
  const saved = await storage.get(LANG_KEY);
  const deviceLang = getLocales()[0]?.languageCode;

  let lang: Lang = 'fr';
  if (saved === 'ar' || saved === 'fr') {
    lang = saved;
  } else if (deviceLang === 'ar') {
    lang = 'ar';
  }

  await i18n.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      ar: { translation: ar },
    },
    lng: lang,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  });

  applyDirection(lang);
}

// Renvoie true si l'utilisateur doit fermer puis rouvrir l'application
export async function changeLanguage(lang: Lang): Promise<boolean> {
  await storage.set(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
  return applyDirection(lang);
}

export default i18n;