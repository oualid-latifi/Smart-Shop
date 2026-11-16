import type { Kind, OutboxOp } from './db';

export type { Kind, OpType, OutboxOp } from './db';

/** Version web de la base locale (navigateur) : même interface que db.ts, stockée dans localStorage. */

const PREFIX = 'smartshop_db_';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREFIX + key) : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Stockage plein ou indisponible : l'application continue sans copie locale
  }
}

type Records = Record<string, unknown>;

export const localDb = {
  async putRecords<T extends { id: string }>(kind: Kind, rows: T[], replaceAll = false): Promise<void> {
    const current = read<Records>(kind, {});
    const next: Records = replaceAll ? Object.fromEntries(Object.entries(current).filter(([id]) => id.startsWith('local:'))) : current;
    rows.forEach((row) => (next[row.id] = row));
    write(kind, next);
  },

  async list<T>(kind: Kind): Promise<T[]> {
    return Object.values(read<Records>(kind, {})) as T[];
  },

  async remove(kind: Kind, id: string): Promise<void> {
    const current = read<Records>(kind, {});
    delete current[id];
    write(kind, current);
  },

  async pruneSales(keep: number): Promise<void> {
    const sales = Object.values(read<Records>('sale', {})) as { id: string; saleDate: string }[];
    sales.sort((a, b) => b.saleDate.localeCompare(a.saleDate));
    write('sale', Object.fromEntries(sales.slice(0, keep).map((s) => [s.id, s])));
  },

  async getMeta(key: string): Promise<string | null> {
    return read<Record<string, string | null>>('meta', {})[key] ?? null;
  },

  async setMeta(key: string, value: string | null): Promise<void> {
    const meta = read<Record<string, string | null>>('meta', {});
    meta[key] = value;
    write('meta', meta);
  },

  async addOp(op: OutboxOp): Promise<void> {
    const ops = read<OutboxOp[]>('outbox', []);
    if (!ops.some((o) => o.opId === op.opId)) write('outbox', [...ops, op]);
  },

  async ops(): Promise<OutboxOp[]> {
    return read<OutboxOp[]>('outbox', []);
  },

  async removeOp(opId: string): Promise<void> {
    write('outbox', read<OutboxOp[]>('outbox', []).filter((o) => o.opId !== opId));
  },

  async setOpError(opId: string, error: string | null): Promise<void> {
    write('outbox', read<OutboxOp[]>('outbox', []).map((o) => (o.opId === opId ? { ...o, status: error ? 'ERROR' : 'PENDING', error } : o)));
  },

  async resetErrors(): Promise<void> {
    write('outbox', read<OutboxOp[]>('outbox', []).map((o) => ({ ...o, status: 'PENDING', error: null })));
  },

  async clearData(): Promise<void> {
    (['product', 'customer', 'sale'] as Kind[]).forEach((k) => write(k, {}));
    const user = await this.getMeta('user');
    write('meta', { user });
  },
};
