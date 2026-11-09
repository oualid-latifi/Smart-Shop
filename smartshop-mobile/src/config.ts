import { Platform } from 'react-native';

// En production : définir EXPO_PUBLIC_API_URL (en HTTPS) dans smartshop-mobile/.env,
// par exemple EXPO_PUBLIC_API_URL=https://api.ma-boutique.com
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

// Développement : mets ici l'IP de ton PC sur le Wi-Fi (commande ipconfig, ligne "Adresse IPv4")
const PC_IP = '192.168.1.47';

// Mets true seulement si tu testes avec l'émulateur Android
const USE_ANDROID_EMULATOR = false;

function resolveApiUrl(): string {
  if (ENV_API_URL && ENV_API_URL.trim()) {
    return ENV_API_URL.trim();
  }
  if (Platform.OS === 'web') {
    return 'http://localhost:8080';
  }
  if (Platform.OS === 'android' && USE_ANDROID_EMULATOR) {
    return 'http://10.0.2.2:8080';
  }
  return `http://${PC_IP}:8080`;
}

export const API_URL = resolveApiUrl();
