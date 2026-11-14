import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Port du back-end Spring Boot
const API_PORT = 8080;

/**
 * Adresse du serveur, sans rien à modifier quand l'IP du PC change :
 * 1. EXPO_PUBLIC_API_URL (fichier .env) : adresse fixe, à utiliser en production (https://…)
 * 2. En développement : l'IP du PC qui lance "npx expo start" (le back-end tourne sur le même PC)
 * 3. Sinon : localhost (navigateur web sur le PC)
 * L'adresse peut aussi être forcée depuis l'application (écran de connexion ou Réglages).
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv;

  if (Platform.OS === 'web') return `http://localhost:${API_PORT}`;

  // hostUri vaut par exemple "192.168.1.25:8081" : c'est l'adresse du PC sur le Wi-Fi
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && isLocalAddress(host)) return `http://${host}:${API_PORT}`;

  return `http://localhost:${API_PORT}`;
}

/** Adresse IP du réseau local (pas un tunnel Expo "*.exp.direct", qui ne mène pas au back-end). */
function isLocalAddress(host: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|localhost$)/.test(host);
}

export const API_URL = resolveApiUrl();
