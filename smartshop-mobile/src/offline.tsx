import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { api, ApiError } from './api/client';

/**
 * Mode hors-ligne : le catalogue et les clients sont gardés sur le téléphone, et une vente faite
 * sans réseau est mise en file d'attente puis envoyée dès que le serveur répond.
 * Chaque vente porte un identifiant (clientRef) : le serveur ne l'enregistre qu'une seule fois.
 */

export interface QueuedSale {
  clientRef: string;
  body: Record<string, unknown>;
  total: number;
  createdAt: string;
  error?: string;      // refusée par le serveur (stock, PIN…) : à corriger ou supprimer
}

const QUEUE = 'offline-sales';
const RETRY_MS = 30_000;

// ---------------------------------------------------------------- Stockage local (fichiers JSON)

function file(name: string) {
  return new File(Paths.document, `${name}.json`);
}

export async function readLocal<T>(name: string): Promise<T | null> {
  try {
    if (Platform.OS === 'web') {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`smartshop_${name}`) : null;
      return raw ? (JSON.parse(raw) as T) : null;
    }
    const f = file(name);
    return f.exists ? (JSON.parse(await f.text()) as T) : null;
  } catch {
    return null;
  }
}

export async function writeLocal(name: string, value: unknown): Promise<void> {
  try {
    const text = JSON.stringify(value);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(`smartshop_${name}`, text);
      return;
    }
    const f = file(name);
    if (!f.exists) f.create();
    f.write(text);
  } catch {
    // Mémoire pleine ou stockage indisponible : l'application continue sans cache
  }
}

export function newClientRef(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------- File d'attente

interface OfflineValue {
  queue: QueuedSale[];
  syncing: boolean;
  offline: boolean;
  enqueue: (sale: QueuedSale) => Promise<void>;
  sync: () => Promise<void>;
  discard: (clientRef: string) => Promise<void>;
  setOffline: (offline: boolean) => void;
}

const Context = createContext<OfflineValue>({
  queue: [],
  syncing: false,
  offline: false,
  enqueue: async () => undefined,
  sync: async () => undefined,
  discard: async () => undefined,
  setOffline: () => undefined,
});

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);
  const queueRef = useRef<QueuedSale[]>([]);
  const running = useRef(false);

  const save = useCallback(async (next: QueuedSale[]) => {
    queueRef.current = next;
    setQueue(next);
    await writeLocal(QUEUE, next);
  }, []);

  const sync = useCallback(async () => {
    if (running.current) return;
    const pending = queueRef.current.filter((s) => !s.error);
    if (pending.length === 0) return;
    running.current = true;
    setSyncing(true);
    try {
      for (const sale of pending) {
        try {
          await api('/api/sales', { method: 'POST', body: { ...sale.body, clientRef: sale.clientRef } });
          await save(queueRef.current.filter((s) => s.clientRef !== sale.clientRef));
          setOffline(false);
        } catch (e) {
          if (e instanceof ApiError && e.status === 0) {
            setOffline(true);
            break; // toujours pas de réseau : on réessaiera plus tard
          }
          const message = e instanceof ApiError && e.message ? e.message : 'Erreur';
          await save(queueRef.current.map((s) => (s.clientRef === sale.clientRef ? { ...s, error: message } : s)));
        }
      }
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, [save]);

  useEffect(() => {
    void readLocal<QueuedSale[]>(QUEUE).then((saved) => {
      queueRef.current = saved ?? [];
      setQueue(queueRef.current);
      void sync();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void sync();
    }, RETRY_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && void sync());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [sync]);

  const enqueue = useCallback(async (sale: QueuedSale) => {
    setOffline(true);
    await save([...queueRef.current.filter((s) => s.clientRef !== sale.clientRef), sale]);
  }, [save]);

  const discard = useCallback(async (clientRef: string) => {
    await save(queueRef.current.filter((s) => s.clientRef !== clientRef));
  }, [save]);

  // Erreur corrigée côté serveur (ex. stock réapprovisionné) : on peut relancer
  const retry = useCallback(async () => {
    await save(queueRef.current.map((s) => ({ ...s, error: undefined })));
    await sync();
  }, [save, sync]);

  return (
    <Context.Provider value={{ queue, syncing, offline, enqueue, sync: retry, discard, setOffline }}>
      {children}
    </Context.Provider>
  );
}

export function useOffline() {
  return useContext(Context);
}
