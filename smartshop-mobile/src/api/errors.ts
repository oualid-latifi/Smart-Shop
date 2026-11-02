import type { TFunction } from 'i18next';
import { ApiError } from './client';

// Transforme une erreur en texte à afficher à l'utilisateur
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return t('errors.network');
    if (error.fieldErrors) {
      const first = Object.values(error.fieldErrors)[0];
      if (first) return first;
    }
    if (error.message) return error.message;
    if (error.status >= 500) return `Erreur serveur (HTTP ${error.status}). Vérifie les logs du Backend.`;
    if (error.status >= 400) return `Requête refusée par le Backend (HTTP ${error.status}). Vérifie les données envoyées.`;
  }
  return t('errors.unknown');
}