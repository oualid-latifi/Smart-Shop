import { API_URL } from '../config';
import { storage, TOKEN_KEY, REFRESH_TOKEN_KEY, API_URL_KEY } from '../storage';

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;
  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message); this.status = status; this.fieldErrors = fieldErrors;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) { onUnauthorized = handler; }

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  logoutOn401?: boolean;
}

async function getBaseUrl(): Promise<string> {
  const custom = await storage.get(API_URL_KEY);
  return (custom?.trim() || API_URL).replace(/\\/+$/, '');
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const raw = await response.text();
  let data: any = null;
  if (raw) { try { data = JSON.parse(raw); } catch { data = null; } }
  if (!response.ok) {
    const message = typeof data?.message === 'string' ? data.message : '';
    const fieldErrors = data && !data.message ? data as Record<string, string> : undefined;
    throw new ApiError(response.status, message, fieldErrors);
  }
  return data as T;
}

async function send<T>(path: string, options: RequestOptions, token?: string | null): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const base = await getBaseUrl();
    const response = await fetch(`${base}${path}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: controller.signal,
    });
    return await readResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'network');
  } finally { clearTimeout(timer); }
}

let refreshInFlight: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await storage.get(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;
      try {
        const result = await send<{ token: string; refreshToken: string }>('/api/auth/refresh',
          { method: 'POST', body: { refreshToken }, auth: false });
        await storage.set(TOKEN_KEY, result.token);
        await storage.set(REFRESH_TOKEN_KEY, result.refreshToken);
        return result.token;
      } catch (error) {
        if (error instanceof ApiError && error.status !== 0) {
          await storage.remove(TOKEN_KEY);
          await storage.remove(REFRESH_TOKEN_KEY);
        }
        return null;
      }
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, logoutOn401 = true } = options;
  let token = auth ? await storage.get(TOKEN_KEY) : null;
  try {
    return await send<T>(path, options, token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !auth || !logoutOn401) throw error;
    const freshToken = await refreshAccessToken();
    if (freshToken) {
      try { return await send<T>(path, options, freshToken); }
      catch (retryError) {
        if (!(retryError instanceof ApiError) || retryError.status !== 401) throw retryError;
      }
    }
    onUnauthorized?.();
    throw new ApiError(401, 'Session expirée : veuillez vous reconnecter');
  }
}