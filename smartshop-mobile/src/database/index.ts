import type { Product } from '../api/types';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

let database: SQLiteDatabase | null = null;
let databasePromise: Promise<SQLiteDatabase> | null = null;

const CURRENT_SCHEMA_VERSION = 1;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (database) return database;

  // Share one initialization promise so simultaneous screens never open
  // and migrate the same SQLite database more than once.
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await openDatabaseAsync('smartshop.db');

      // Connection-level pragmas must be configured before the migration transaction.
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
      `);

      const versionRow = await db.getFirstAsync<{ user_version: number }>(
        'PRAGMA user_version',
      );
      if (!versionRow) {
        throw new Error('Impossible de lire la version du schéma SQLite.');
      }
      if (versionRow.user_version > CURRENT_SCHEMA_VERSION) {
        throw new Error(
          `La base SQLite (version ${versionRow.user_version}) est plus récente que cette version de SmartShop.`,
        );
      }

      await db.withTransactionAsync(async () => {
        if (versionRow.user_version < 1) {
          // Initial schema. CREATE IF NOT EXISTS preserves existing local data.
          await db.execAsync(`

    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS local_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      reference TEXT NOT NULL,
      name TEXT NOT NULL,
      category_id TEXT,
      category_name TEXT,
      brand TEXT,
      model TEXT,
      color TEXT,
      capacity TEXT,
      image_url TEXT,
      average_purchase_price REAL NOT NULL DEFAULT 0,
      purchase_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      stock_quantity REAL NOT NULL DEFAULT 0,
      alert_threshold REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      credit_limit REAL,
      balance REAL NOT NULL DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY NOT NULL,
      supplier_id TEXT,
      purchase_date TEXT NOT NULL,
      total REAL NOT NULL,
      amount_paid REAL NOT NULL DEFAULT 0,
      remaining REAL NOT NULL DEFAULT 0,
      note TEXT,
      sync_status TEXT NOT NULL DEFAULT 'SYNCED'
    );

    CREATE TABLE IF NOT EXISTS purchase_lines (
      id TEXT PRIMARY KEY NOT NULL,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY NOT NULL,
      customer_id TEXT,
      sale_date TEXT NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      amount_paid REAL NOT NULL DEFAULT 0,
      remaining REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'VALIDATED',
      cancellation_reason TEXT,
      sync_status TEXT NOT NULL DEFAULT 'SYNCED'
    );

    CREATE TABLE IF NOT EXISTS sale_lines (
      id TEXT PRIMARY KEY NOT NULL,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_id TEXT,
      created_at TEXT NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      entity_type TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sales_date
      ON sales(sale_date);

    CREATE INDEX IF NOT EXISTS idx_purchases_date
      ON purchases(purchase_date);

    CREATE INDEX IF NOT EXISTS idx_sale_lines_sale
      ON sale_lines(sale_id);

    CREATE INDEX IF NOT EXISTS idx_purchase_lines_purchase
      ON purchase_lines(purchase_id);

    CREATE INDEX IF NOT EXISTS idx_outbox_status
      ON outbox(status, created_at);

    CREATE INDEX IF NOT EXISTS idx_stock_product
      ON stock_movements(product_id, created_at);
  
          `);

          // Upgrade databases created by older app versions without deleting data.
          const productColumns = await db.getAllAsync<{ name: string }>(
            'PRAGMA table_info(products)',
          );
          const hasPurchasePrice = productColumns.some(
            (column) => column.name === 'purchase_price',
          );
          if (!hasPurchasePrice) {
            await db.execAsync(
              'ALTER TABLE products ADD COLUMN purchase_price REAL NOT NULL DEFAULT 0',
            );
            await db.execAsync(
              'UPDATE products SET purchase_price = average_purchase_price',
            );
          }

          await db.execAsync('PRAGMA user_version = 1');
        }
      });

      database = db;
      return db;
    })().catch((error) => {
      // Allow a later retry if opening or migrating the database failed.
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export async function testDatabase(): Promise<string> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO local_metadata (key, value)
     VALUES (?, ?)`,
    'database_status',
    'SQLite is working',
  );

  const result = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM local_metadata WHERE key = ?',
    'database_status',
  );

  return result?.value ?? 'Database test failed';
}

export async function testProductCRUD(): Promise<string> {
  const db = await getDatabase();

  // 1. Ajouter un produit test
  await db.runAsync(
    `INSERT OR REPLACE INTO products (
      id, reference, name, brand,
      sale_price, average_purchase_price, purchase_price,
      stock_quantity, alert_threshold, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'TEST-001',
    'TEST-REF-001',
    'Produit de test SQLite',
    'Samsung',
    1500,
    1200,
    1200,
    5,
    2,
    1,
  );

  // 2. Lire le produit
  const product = await db.getFirstAsync<{
    id: string;
    name: string;
    sale_price: number;
    stock_quantity: number;
  }>(
    `SELECT id, name, sale_price, stock_quantity
     FROM products WHERE id = ?`,
    'TEST-001',
  );

  if (!product) {
    throw new Error('Produit introuvable');
  }

  // 3. Supprimer le produit test
  await db.runAsync(
    'DELETE FROM products WHERE id = ?',
    'TEST-001',
  );

  return `CRUD OK: ${product.name} | ${product.sale_price} DH | Stock: ${product.stock_quantity}`;
}

// تخزين المنتجات القادمة من Backend في SQLite
export async function saveProducts(products: Product[]): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const product of products) {
      await db.runAsync(
        `INSERT INTO products (
          id, reference, name, category_id, category_name,
          brand, model, color, capacity, image_url,
          average_purchase_price, purchase_price, sale_price,
          stock_quantity, alert_threshold, active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          reference = excluded.reference,
          name = excluded.name,
          category_id = excluded.category_id,
          category_name = excluded.category_name,
          brand = excluded.brand,
          model = excluded.model,
          color = excluded.color,
          capacity = excluded.capacity,
          image_url = excluded.image_url,
          average_purchase_price = excluded.average_purchase_price,
          purchase_price = excluded.purchase_price,
          sale_price = excluded.sale_price,
          stock_quantity = excluded.stock_quantity,
          alert_threshold = excluded.alert_threshold,
          active = excluded.active,
          updated_at = excluded.updated_at`,
        product.id,
        product.reference,
        product.name,
        product.categoryId,
        product.categoryName,
        product.brand,
        product.model,
        product.color,
        product.capacity,
        product.imageUrl,
        product.averagePurchasePrice,
        product.purchasePrice,
        product.salePrice,
        product.stockQuantity,
        product.alertThreshold,
        product.active ? 1 : 0,
        new Date().toISOString(),
      );
    }
  });
}

// قراءة المنتجات المخزنة محلياً
export async function getCachedProducts(): Promise<Product[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<any>(
    'SELECT * FROM products ORDER BY name ASC',
  );

  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    brand: row.brand,
    model: row.model,
    color: row.color,
    capacity: row.capacity,
    imageUrl: row.image_url,
    averagePurchasePrice: row.average_purchase_price,
    purchasePrice: row.purchase_price,
    salePrice: row.sale_price,
    stockQuantity: row.stock_quantity,
    alertThreshold: row.alert_threshold,
    lowStock: row.stock_quantity <= row.alert_threshold,
    active: row.active === 1,
  }));
}