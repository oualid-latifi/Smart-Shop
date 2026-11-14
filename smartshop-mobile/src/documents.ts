import { Linking, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ApiError, getBaseUrl } from './api/client';
import { storage, TOKEN_KEY } from './storage';

/**
 * Télécharge un PDF du serveur (facture, devis, BL, ticket) puis ouvre la feuille de partage :
 * l'utilisateur choisit WhatsApp, l'imprimante, l'email, l'enregistrement dans Fichiers…
 */
export async function shareDocument(path: string, fileName: string, dialogTitle: string, mimeType = 'application/pdf'): Promise<void> {
  const token = await storage.get(TOKEN_KEY);
  const url = `${await getBaseUrl()}${path}`;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  if (Platform.OS === 'web') {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new ApiError(response.status, '');
    const blob = await response.blob();
    window.open(URL.createObjectURL(blob), '_blank');
    return;
  }

  let file: File;
  try {
    file = await File.downloadFileAsync(url, new File(Paths.cache, fileName), { headers, idempotent: true });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError(0, '');
  }
  const isPdf = mimeType === 'application/pdf';
  await Sharing.shareAsync(file.uri, { mimeType, UTI: isPdf ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet', dialogTitle });
}

/** Numéro marocain local (06…, 07…, 05…) -> format international pour WhatsApp (2126…). */
export function toWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (!digits) return null;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`;
  return digits;
}

/** Ouvre WhatsApp avec un message prêt à envoyer (au contact si un numéro est connu). */
export async function openWhatsApp(message: string, phone?: string | null): Promise<void> {
  const number = phone ? toWhatsAppNumber(phone) : null;
  const url = `https://wa.me/${number ?? ''}?text=${encodeURIComponent(message)}`;
  await Linking.openURL(url);
}
