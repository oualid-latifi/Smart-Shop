import { API_URL } from '../config';
import { storage, TOKEN_KEY, API_URL_KEY } from '../storage';

export class ApiError extends Error {
  status: number; // 0 = serveur injoignable
  fieldErrors?: Record<string, string>;
  code?: string; // ex : APPROVAL_REQUIRED (code du propriétaire demandé)

  constructor(status: number, message: string, fieldErrors?: Record<string, string>, code?: string) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
  }
}

// Appelé quand le serveur répond 401 (token expiré ou refusé) : on déconnecte l'utilisateur
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean; // false pour login / register / status
  logoutOn401?: boolean; // false : ne pas déconnecter sur une erreur 401 (ex : mauvais mot de passe)
}

// Adresse du serveur : celle choisie dans les Réglages, sinon celle de config.ts
export async function getBaseUrl(): Promise<string> {
  const custom = await storage.get(API_URL_KEY);
  const base = custom && custom.trim() ? custom.trim() : API_URL;
  return base.replace(/\/+$/, '');
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, logoutOn401 = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (auth) {
    const token = await storage.get(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const baseUrl = await getBaseUrl();

  // Si le serveur ne répond pas en 10 secondes, on affiche l'erreur réseau
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'network');
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let data: any = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth && logoutOn401 && onUnauthorized) {
      onUnauthorized();
    }
    // Le serveur répond au format "Problem Details" (RFC 9457) : detail/message + errors par champ
    const message: string =
      typeof data?.message === 'string' ? data.message : typeof data?.detail === 'string' ? data.detail : '';
    const fieldErrors =
      data?.errors && typeof data.errors === 'object' ? (data.errors as Record<string, string>) : undefined;
    throw new ApiError(response.status, message, fieldErrors, typeof data?.code === 'string' ? data.code : undefined);
  }

  return data as T;
}