import * as SQLite from 'expo-sqlite';

/**
 * Base locale SQLite du téléphone :
 * - records : copie des données du serveur (produits, clients, ventes), une ligne JSON par élément
 * - meta    : curseur de synchronisation, paramètres de la boutique, compte du téléphone
 * - outbox  : opérations faites hors-ligne, envoyées dans l'ordre (seq) puis supprimées
 * La version web utilise db.web.ts (localStorage).
 */

export type Kind = 'product' | 'customer' | 'sale';
export type OpType = 'SALE_CREATE' | 'CUSTOMER_CREATE' | 'PAYMENT_CREATE';

export interface OutboxOp {
  opId: string;
  type: OpType;
  payload: Record<string, unknown>;
  customerOpId: string | null;   // client créé hors-ligne par une opération précédente
  occurredAt: string;            // heure réelle de l'opération sur le téléphone
  userEmail: string;             // compte qui a fait l'opération
  label: string;                 // résumé affiché (client, produits…)
  total: number | null;
  status: 'PENDING' | 'ERROR';
  error: string | null;
}

const SCHEMA_VERSION = 2;

// Structure attendue de chaque table (CREATE TABLE IF NOT EXISTS ne corrige pas une table existante)
const TABLES: Record<string, { columns: string[]; create: string }> = {
  records: {
    columns: ['kind', 'id', 'data'],
    create: 'CREATE TABLE records (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (kind, id))',
  },
  meta: {
    columns: ['key', 'value'],
    create: 'CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT)',
  },
  outbox: {
    columns: ['seq', 'op_id', 'type', 'payload', 'customer_op_id', 'occurred_at', 'user_email', 'label', 'total', 'status', 'error'],
    create: `CREATE TABLE outbox (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      op_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      customer_op_id TEXT,
      occurred_at TEXT NOT NULL,
      user_email TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      total REAL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      error TEXT
    )`,
  },
};

/**
 * Crée les tables manquantes et répare celles qui n'ont pas la bonne structure (ancienne version de l'app) :
 * la table est reconstruite et les lignes existantes recopiées pour les colonnes communes — rien n'est perdu.
 */
async function migrate(database: SQLite.SQLiteDatabase) {
  for (const [name, table] of Object.entries(TABLES)) {
    const info = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${name})`);
    if (info.length === 0) {
      await database.execAsync(table.create);
      continue;
    }
    const existing = info.map((c) => c.name);
    if (table.columns.every((c) => existing.includes(c))) continue;
    const common = table.columns.filter((c) => c !== 'seq' && existing.includes(c));
    await database.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(`ALTER TABLE ${name} RENAME TO ${name}_old`);
      await txn.execAsync(table.create);
      if (common.length > 0) {
        const cols = common.join(', ');
        await txn.execAsync(`INSERT OR IGNORE INTO ${name} (${cols}) SELECT ${cols} FROM ${name}_old`).catch(() => undefined);
      }
      await txn.execAsync(`DROP TABLE ${name}_old`);
    });
  }
  await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      const database = await SQLite.openDatabaseAsync('smartshop.db');
      await database.execAsync('PRAGMA journal_mode = WAL');
      try {
        await migrate(database);
      } catch {
        // Base locale illisible : on repart d'une base vide (le serveur reste la référence)
        for (const name of Object.keys(TABLES)) await database.execAsync(`DROP TABLE IF EXISTS ${name}; DROP TABLE IF EXISTS ${name}_old`);
        await migrate(database);
      }
      return database;
    })();
    opening.catch(() => (opening = null));
  }
  return opening;
}

interface OutboxRow {
  op_id: string;
  type: OpType;
  payload: string;
  customer_op_id: string | null;
  occurred_at: string;
  user_email: string;
  label: string;
  total: number | null;
  status: 'PENDING' | 'ERROR';
  error: string | null;
}

export const localDb = {
  /** Enregistre des éléments reçus du serveur. replaceAll : la liste reçue est complète (sauf éléments "local:"). */
  async putRecords<T extends { id: string }>(kind: Kind, rows: T[], replaceAll = false): Promise<void> {
    const database = await db();
    await database.withExclusiveTransactionAsync(async (txn) => {
      if (replaceAll) await txn.runAsync("DELETE FROM records WHERE kind = ? AND id NOT LIKE 'local:%'", kind);
      for (const row of rows) {
        await txn.runAsync('INSERT OR REPLACE INTO records (kind, id, data) VALUES (?, ?, ?)', kind, row.id, JSON.stringify(row));
      }
    });
  },

  async list<T>(kind: Kind): Promise<T[]> {
    const rows = await (await db()).getAllAsync<{ data: string }>('SELECT data FROM records WHERE kind = ?', kind);
    return rows.map((r) => JSON.parse(r.data) as T);
  },

  async remove(kind: Kind, id: string): Promise<void> {
    await (await db()).runAsync('DELETE FROM records WHERE kind = ? AND id = ?', kind, id);
  },

  /** Ne garde que les N ventes les plus récentes. */
  async pruneSales(keep: number): Promise<void> {
    await (await db()).runAsync(
      "DELETE FROM records WHERE kind = 'sale' AND id NOT IN (SELECT id FROM records WHERE kind = 'sale' ORDER BY json_extract(data, '$.saleDate') DESC LIMIT ?)",
      keep,
    );
  },

  async getMeta(key: string): Promise<string | null> {
    const row = await (await db()).getFirstAsync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', key);
    return row?.value ?? null;
  },

  async setMeta(key: string, value: string | null): Promise<void> {
    await (await db()).runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
  },

  async addOp(op: OutboxOp): Promise<void> {
    await (await db()).runAsync(
      `INSERT OR IGNORE INTO outbox (op_id, type, payload, customer_op_id, occurred_at, user_email, label, total, status, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      op.opId, op.type, JSON.stringify(op.payload), op.customerOpId, op.occurredAt, op.userEmail, op.label, op.total, op.status, op.error,
    );
  },

  async ops(): Promise<OutboxOp[]> {
    const rows = await (await db()).getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY seq');
    return rows.map((r) => ({
      opId: r.op_id,
      type: r.type,
      payload: JSON.parse(r.payload) as Record<string, unknown>,
      customerOpId: r.customer_op_id,
      occurredAt: r.occurred_at,
      userEmail: r.user_email,
      label: r.label,
      total: r.total,
      status: r.status,
      error: r.error,
    }));
  },

  async removeOp(opId: string): Promise<void> {
    await (await db()).runAsync('DELETE FROM outbox WHERE op_id = ?', opId);
  },

  async setOpError(opId: string, error: string | null): Promise<void> {
    await (await db()).runAsync('UPDATE outbox SET status = ?, error = ? WHERE op_id = ?', error ? 'ERROR' : 'PENDING', error, opId);
  },

  async resetErrors(): Promise<void> {
    await (await db()).runAsync("UPDATE outbox SET status = 'PENDING', error = NULL");
  },

  /** Autre compte sur ce téléphone : on efface la copie des données (jamais les opérations en attente). */
  async clearData(): Promise<void> {
    const database = await db();
    await database.execAsync("DELETE FROM records; DELETE FROM meta WHERE key <> 'user';");
  },
};
