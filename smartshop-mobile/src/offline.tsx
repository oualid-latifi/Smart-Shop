import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { api, ApiError } from './api/client';
import type { Customer, Product, Sale, ShopSettings } from './api/types';
import { localDb, type OpType, type OutboxOp } from './db';
import { storage, USER_KEY } from './storage';

/**
 * Fonctionnement sans Internet ni serveur, puis synchronisation automatique dans les deux sens :
 * 1. push : les opérations faites hors-ligne (ventes, nouveaux clients, paiements) partent dans l'ordre.
 *    Chacune a un identifiant unique : le serveur ne l'applique qu'une fois, même si elle est renvoyée.
 * 2. pull : le serveur renvoie ce qui a changé depuis la dernière synchronisation (stock, prix, clients…),
 *    enregistré dans la base SQLite du téléphone.
 * Les écrans lisent la base locale : stock et dettes affichés tiennent compte des opérations pas encore envoyées.
 */

const RETRY_MS = 30_000;
const BATCH = 50;
const KEEP_SALES = 500;
export const LOCAL_PREFIX = 'local:';

interface PullResponse {
  cursor: string;
  promoKey: string;
  full: boolean;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  settings: ShopSettings;
}

interface OperationResult {
  opId: string;
  status: 'OK' | 'DUPLICATE' | 'ERROR';
  resultId: string | null;
  number: string | null;
  message: string | null;
}

/** Heure locale du téléphone (le serveur travaille à l'heure du Maroc, sans fuseau). */
function localIsoNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function newClientRef(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function currentEmail(): Promise<string | null> {
  const saved = await storage.get(USER_KEY);
  if (!saved) return null;
  try {
    return (JSON.parse(saved) as { email: string }).email;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Lecture (base locale + opérations en attente)

/** Produits actifs, stock diminué des ventes pas encore envoyées. */
export async function localProducts(): Promise<Product[]> {
  const [products, ops] = await Promise.all([localDb.list<Product>('product'), localDb.ops()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const sold = new Map<string, number>();
  ops.filter((o) => o.type === 'SALE_CREATE').forEach((o) => {
    ((o.payload.lines as { productId: string; quantity: number; packs?: boolean }[]) ?? []).forEach((l) => {
      const perPack = l.packs ? byId.get(l.productId)?.unitsPerPack ?? 1 : 1;
      sold.set(l.productId, (sold.get(l.productId) ?? 0) + l.quantity * perPack);
    });
  });
  return products
    .filter((p) => p.active)
    .map((p) => (sold.has(p.id) ? { ...p, stockQuantity: p.stockQuantity - (sold.get(p.id) ?? 0) } : p));
}

/** Clients actifs (y compris ceux créés hors-ligne), dette corrigée des ventes et paiements en attente. */
export async function localCustomers(): Promise<Customer[]> {
  const [customers, ops] = await Promise.all([localDb.list<Customer>('customer'), localDb.ops()]);
  const delta = new Map<string, number>();
  const key = (o: OutboxOp) => (o.customerOpId ? `${LOCAL_PREFIX}${o.customerOpId}` : (o.payload.customerId as string | null));
  ops.forEach((o) => {
    const id = key(o);
    if (!id) return;
    if (o.type === 'SALE_CREATE' && o.total !== null) {
      const paid = typeof o.payload.amountPaid === 'number' ? o.payload.amountPaid : o.total;
      delta.set(id, (delta.get(id) ?? 0) + Math.max(0, o.total - paid));
    }
    if (o.type === 'PAYMENT_CREATE') delta.set(id, (delta.get(id) ?? 0) - Number(o.payload.amount ?? 0));
  });
  return customers
    .filter((c) => c.active)
    .map((c) => (delta.has(c.id) ? { ...c, balance: c.balance + (delta.get(c.id) ?? 0) } : c))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function localSales(): Promise<Sale[]> {
  const sales = await localDb.list<Sale>('sale');
  return sales.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
}

export async function localSettings(): Promise<ShopSettings | null> {
  const raw = await localDb.getMeta('settings');
  return raw ? (JSON.parse(raw) as ShopSettings) : null;
}

// ---------------------------------------------------------------- Contexte

export interface NewOp {
  opId?: string;
  type: OpType;
  payload: Record<string, unknown>;
  customerOpId?: string | null;
  label: string;
  total?: number | null;
}

interface OfflineValue {
  queue: OutboxOp[];
  syncing: boolean;
  offline: boolean;
  lastSync: string | null;
  version: number;   // augmente à chaque changement de la base locale : les écrans se rechargent
  enqueue: (op: NewOp) => Promise<string>;
  sync: () => Promise<void>;
  retry: () => Promise<void>;
  discard: (opId: string) => Promise<void>;
  setOffline: (offline: boolean) => void;
}

const Context = createContext<OfflineValue>({
  queue: [],
  syncing: false,
  offline: false,
  lastSync: null,
  version: 0,
  enqueue: async () => '',
  sync: async () => undefined,
  retry: async () => undefined,
  discard: async () => undefined,
  setOffline: () => undefined,
});

/** Ventes de l'ancienne file (fichier JSON) reprises dans la base SQLite, une seule fois. */
async function migrateLegacyQueue(email: string) {
  if (Platform.OS === 'web') return;
  try {
    const file = new File(Paths.document, 'offline-sales.json');
    if (!file.exists) return;
    const legacy = JSON.parse(await file.text()) as { clientRef: string; body: Record<string, unknown>; total: number; createdAt: string }[];
    for (const s of legacy) {
      const { clientRef: _ignored, ...payload } = s.body;
      await localDb.addOp({
        opId: s.clientRef, type: 'SALE_CREATE', payload, customerOpId: null, occurredAt: s.createdAt,
        userEmail: email, label: '', total: s.total, status: 'PENDING', error: null,
      });
    }
    file.delete();
  } catch {
    // Fichier illisible : rien à reprendre
  }
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<OutboxOp[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const running = useRef(false);

  const refreshQueue = useCallback(async () => {
    try {
      setQueue(await localDb.ops());
    } catch (e) {
      console.warn('Base locale indisponible', e);
    }
    setVersion((v) => v + 1);
  }, []);

  const push = useCallback(async (email: string): Promise<boolean> => {
    const pending = (await localDb.ops()).filter((o) => o.status === 'PENDING' && o.userEmail === email);
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      const { results } = await api<{ results: OperationResult[] }>('/api/sync/push', {
        method: 'POST',
        body: {
          operations: batch.map((o) => ({ opId: o.opId, type: o.type, payload: o.payload, customerOpId: o.customerOpId, occurredAt: o.occurredAt })),
        },
      });
      for (const r of results) {
        const op = batch.find((o) => o.opId === r.opId);
        if (r.status === 'ERROR') {
          await localDb.setOpError(r.opId, r.message ?? 'Erreur');
        } else {
          await localDb.removeOp(r.opId);
          // Le vrai client arrive avec le pull : on retire sa copie provisoire
          if (op?.type === 'CUSTOMER_CREATE') await localDb.remove('customer', `${LOCAL_PREFIX}${op.opId}`);
        }
      }
    }
    return true;
  }, []);

  const pull = useCallback(async () => {
    const [since, promoKey] = await Promise.all([localDb.getMeta('cursor'), localDb.getMeta('promoKey')]);
    const query = new URLSearchParams();
    if (since) query.set('since', since);
    if (promoKey) query.set('promoKey', promoKey);
    const data = await api<PullResponse>(`/api/sync/pull${query.toString() ? `?${query}` : ''}`);
    await localDb.putRecords('product', data.products, data.full);
    await localDb.putRecords('customer', data.customers, !since);
    await localDb.putRecords('sale', data.sales);
    await localDb.pruneSales(KEEP_SALES);
    await localDb.setMeta('settings', JSON.stringify(data.settings));
    await localDb.setMeta('promoKey', data.promoKey);
    await localDb.setMeta('cursor', data.cursor);
    const now = new Date().toISOString();
    await localDb.setMeta('lastSync', now);
    setLastSync(now);
  }, []);

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setSyncing(true);
    try {
      const email = await currentEmail();
      if (!email) return;
      // Autre compte sur ce téléphone : ses droits (marges, clients) ne sont pas les mêmes
      if ((await localDb.getMeta('user')) !== email) {
        await localDb.clearData();
        await localDb.setMeta('user', email);
        await migrateLegacyQueue(email);
      }
      await push(email);
      await pull();
      setOffline(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setOffline(true);
      else if (!(e instanceof ApiError)) console.warn('Synchronisation impossible', e);
    } finally {
      running.current = false;
      setSyncing(false);
      await refreshQueue();
    }
  }, [push, pull, refreshQueue]);

  useEffect(() => {
    localDb.getMeta('lastSync').then(setLastSync).catch(() => undefined);
    void refreshQueue().then(sync);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void sync();
    }, RETRY_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && void sync());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [sync, refreshQueue]);

  const enqueue = useCallback(async (op: NewOp) => {
    const opId = op.opId ?? newClientRef();
    await localDb.addOp({
      opId,
      type: op.type,
      payload: op.payload,
      customerOpId: op.customerOpId ?? null,
      occurredAt: localIsoNow(),
      userEmail: (await currentEmail()) ?? '',
      label: op.label,
      total: op.total ?? null,
      status: 'PENDING',
      error: null,
    });
    await refreshQueue();
    void sync();
    return opId;
  }, [refreshQueue, sync]);

  // Erreurs corrigées entre-temps (stock réapprovisionné, client enregistré…) : on retente tout
  const retry = useCallback(async () => {
    await localDb.resetErrors();
    await refreshQueue();
    await sync();
  }, [refreshQueue, sync]);

  const discard = useCallback(async (opId: string) => {
    const op = (await localDb.ops()).find((o) => o.opId === opId);
    await localDb.removeOp(opId);
    if (op?.type === 'CUSTOMER_CREATE') await localDb.remove('customer', `${LOCAL_PREFIX}${opId}`);
    await refreshQueue();
  }, [refreshQueue]);

  return (
    <Context.Provider value={{ queue, syncing, offline, lastSync, version, enqueue, sync, retry, discard, setOffline }}>
      {children}
    </Context.Provider>
  );
}

export function useOffline() {
  return useContext(Context);
}
