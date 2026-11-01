import type { Customer, Expense, Product, Purchase, ReportSummary, Sale, Supplier } from '../api/types';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

let database: SQLiteDatabase | null = null;
let databasePromise: Promise<SQLiteDatabase> | null = null;

const CURRENT_SCHEMA_VERSION = 4;

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

        if (versionRow.user_version < 2) {
          await db.execAsync(`
            CREATE TABLE IF NOT EXISTS customer_payments (
              id TEXT PRIMARY KEY NOT NULL,
              customer_id TEXT NOT NULL,
              amount REAL NOT NULL,
              paid_at TEXT NOT NULL,
              sync_status TEXT NOT NULL DEFAULT 'PENDING'
            );
            CREATE INDEX IF NOT EXISTS idx_customer_payments_customer
              ON customer_payments(customer_id, paid_at DESC);
            CREATE INDEX IF NOT EXISTS idx_customer_payments_sync
              ON customer_payments(sync_status);
            PRAGMA user_version = 2;
          `);
        }
        if (versionRow.user_version < 3) {
          await db.execAsync(`
            CREATE TABLE IF NOT EXISTS expenses (
              id TEXT PRIMARY KEY NOT NULL,
              category TEXT NOT NULL,
              amount REAL NOT NULL,
              expense_date TEXT NOT NULL,
              note TEXT,
              sync_status TEXT NOT NULL DEFAULT 'SYNCED'
            );
            CREATE INDEX IF NOT EXISTS idx_expenses_date
              ON expenses(expense_date DESC);
            CREATE TABLE IF NOT EXISTS report_cache (
              period TEXT PRIMARY KEY NOT NULL,
              payload TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            PRAGMA user_version = 3;
          `);
        }

        if (versionRow.user_version < 4) {
          await db.execAsync(`
            CREATE TABLE IF NOT EXISTS purchase_payments (
              id TEXT PRIMARY KEY NOT NULL,
              purchase_id TEXT NOT NULL,
              amount REAL NOT NULL,
              paid_at TEXT NOT NULL,
              sync_status TEXT NOT NULL DEFAULT 'PENDING'
            );
            CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase
              ON purchase_payments(purchase_id, paid_at DESC);
            CREATE INDEX IF NOT EXISTS idx_purchase_payments_sync
              ON purchase_payments(sync_status);
            PRAGMA user_version = 4;
          `);
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

// Serialize writes made through this module. Expo's async transactions share
// one connection, so unrelated concurrent writes must not overlap a transaction.
let transactionTail: Promise<void> = Promise.resolve();

async function withSerializedTransaction<T>(
  db: SQLiteDatabase,
  operation: () => Promise<T>,
): Promise<T> {
  const execution = transactionTail.then(async () => {
    let result!: T;
    await db.withTransactionAsync(async () => {
      result = await operation();
    });
    return result;
  });
  transactionTail = execution.then(
    () => undefined,
    () => undefined,
  );
  return execution;
}

export async function testDatabase(): Promise<string> {
  const db = await getDatabase();

  return withSerializedTransaction(db, async () => {
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
  });
}

export async function testProductCRUD(): Promise<string> {
  const db = await getDatabase();

  return withSerializedTransaction(db, async () => {
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
  });
}

// تخزين المنتجات القادمة من Backend في SQLite
export async function saveProducts(products: Product[]): Promise<void> {
  const db = await getDatabase();

  await withSerializedTransaction(db, async () => {
    // Keep stock movements from unsynced local operations on top of the server snapshot.
    const pendingStock = await db.getAllAsync<{ product_id: string; quantity_delta: number }>(
      `SELECT movement.product_id, SUM(movement.quantity) AS quantity_delta
       FROM stock_movements movement
       INNER JOIN outbox queued ON queued.id = movement.reference_id
       WHERE queued.status IN ('PENDING', 'FAILED')
       GROUP BY movement.product_id`,
    );
    const pendingStockByProduct = new Map(
      pendingStock.map((row) => [row.product_id, row.quantity_delta]),
    );
    const pendingPurchases = await db.getAllAsync<{
      product_id: string;
      quantity_delta: number;
      cost_delta: number;
    }>(
      `SELECT line.product_id,
              SUM(line.quantity) AS quantity_delta,
              SUM(line.quantity * line.unit_price) AS cost_delta
       FROM purchase_lines line
       INNER JOIN purchases purchase ON purchase.id = line.purchase_id
       INNER JOIN outbox queued ON queued.id = purchase.id
       WHERE queued.status IN ('PENDING', 'FAILED')
       GROUP BY line.product_id`,
    );
    const pendingPurchaseByProduct = new Map(
      pendingPurchases.map((row) => [row.product_id, row]),
    );
    const latestPendingPurchasePrices = await db.getAllAsync<{
      product_id: string;
      unit_price: number;
    }>(
      `SELECT line.product_id, line.unit_price
       FROM purchase_lines line
       INNER JOIN purchases purchase ON purchase.id = line.purchase_id
       INNER JOIN outbox queued ON queued.id = purchase.id
       WHERE queued.status IN ('PENDING', 'FAILED')
       ORDER BY purchase.purchase_date DESC, purchase.id DESC`,
    );
    const latestPurchasePriceByProduct = new Map<string, number>();
    for (const row of latestPendingPurchasePrices) {
      if (!latestPurchasePriceByProduct.has(row.product_id)) {
        latestPurchasePriceByProduct.set(row.product_id, row.unit_price);
      }
    }

    for (const product of products) {
      const pendingPurchase = pendingPurchaseByProduct.get(product.id);
      const averagePurchasePrice = pendingPurchase && product.stockQuantity + pendingPurchase.quantity_delta > 0
        ? Math.round(
            ((product.averagePurchasePrice * Math.max(0, product.stockQuantity) +
              pendingPurchase.cost_delta) /
              (Math.max(0, product.stockQuantity) + pendingPurchase.quantity_delta)) * 100,
          ) / 100
        : product.averagePurchasePrice;
      const purchasePrice =
        latestPurchasePriceByProduct.get(product.id) ?? product.purchasePrice;
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
        averagePurchasePrice,
        purchasePrice,
        product.salePrice,
        product.stockQuantity + (pendingStockByProduct.get(product.id) ?? 0),
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
  // Avoid reading a half-written operation from an active async transaction.
  await transactionTail;

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

export interface LocalSaleInput {
  customerId: string | null;
  discount: number;
  amountPaid: number | null;
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

export interface PendingOutboxItem {
  id: string;
  idempotency_key: string;
  entity_type: string;
  operation: string;
  payload: string;
  status: string;
  attempts: number;
  created_at: string;
  last_error: string | null;
}

function createLocalUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function getLocalDateTimeString(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function saveCustomers(customers: Customer[]): Promise<void> {
  const db = await getDatabase();
  await withSerializedTransaction(db, async () => {
    const pendingDebt = await db.getAllAsync<{ customer_id: string; debt_delta: number }>(
      `SELECT customer_id, SUM(remaining) AS debt_delta
       FROM sales
       WHERE sync_status IN ('PENDING', 'FAILED')
         AND status = 'VALIDATED'
         AND customer_id IS NOT NULL
       GROUP BY customer_id`,
    );
    const pendingDebtByCustomer = new Map(
      pendingDebt.map((row) => [row.customer_id, row.debt_delta]),
    );
    const pendingPayments = await db.getAllAsync<{ customer_id: string; paid_total: number }>(
      `SELECT customer_id, SUM(amount) AS paid_total
       FROM customer_payments
       WHERE sync_status IN ('PENDING', 'FAILED')
       GROUP BY customer_id`,
    );
    const pendingPaymentsByCustomer = new Map(
      pendingPayments.map((row) => [row.customer_id, row.paid_total]),
    );

    for (const customer of customers) {
      await db.runAsync(
        `INSERT INTO customers (id, name, phone, credit_limit, balance, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           phone = excluded.phone,
           credit_limit = excluded.credit_limit,
           balance = excluded.balance,
           updated_at = excluded.updated_at`,
        customer.id,
        customer.name,
        customer.phone,
        customer.creditLimit,
        Math.max(
          0,
          customer.balance
            + (pendingDebtByCustomer.get(customer.id) ?? 0)
            - (pendingPaymentsByCustomer.get(customer.id) ?? 0),
        ),
        new Date().toISOString(),
      );
    }
  });
}

export interface LocalCustomerInput {
  id?: string;
  name: string;
  phone: string | null;
  creditLimit: number | null;
}

export async function saveLocalCustomer(input: LocalCustomerInput): Promise<string> {
  const db = await getDatabase();
  const id = input.id ?? createLocalUuid();
  const operation = input.id ? 'UPDATE' : 'CREATE';
  const createdAt = getLocalDateTimeString();
  await withSerializedTransaction(db, async () => {
    const existing = input.id
      ? await db.getFirstAsync<{ id: string }>('SELECT id FROM customers WHERE id = ?', id)
      : null;
    if (input.id && !existing) throw new Error('Client introuvable dans la base locale.');

    await db.runAsync(
      `INSERT INTO customers (id, name, phone, credit_limit, balance, updated_at)
       VALUES (?, ?, ?, ?, 0, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         phone = excluded.phone,
         credit_limit = excluded.credit_limit,
         updated_at = excluded.updated_at`,
      id, input.name, input.phone, input.creditLimit, createdAt,
    );
    const payload = {
      id,
      name: input.name,
      phone: input.phone,
      creditLimit: input.creditLimit,
    };
    await db.runAsync(
      `INSERT INTO outbox (
        id, idempotency_key, entity_type, operation, payload, status, attempts, created_at
      ) VALUES (?, ?, 'CUSTOMER', ?, ?, 'PENDING', 0, ?)`,
      createLocalUuid(), createLocalUuid(), operation, JSON.stringify(payload), createdAt,
    );
  });
  return id;
}

export interface LocalSupplierInput {
  id?: string;
  name: string;
  phone: string | null;
}

export async function saveLocalSupplier(input: LocalSupplierInput): Promise<string> {
  const db = await getDatabase();
  const id = input.id ?? createLocalUuid();
  const operation = input.id ? 'UPDATE' : 'CREATE';
  const createdAt = getLocalDateTimeString();
  await withSerializedTransaction(db, async () => {
    const existing = input.id
      ? await db.getFirstAsync<{ id: string }>('SELECT id FROM suppliers WHERE id = ?', id)
      : null;
    if (input.id && !existing) throw new Error('Fournisseur introuvable dans la base locale.');

    await db.runAsync(
      `INSERT INTO suppliers (id, name, phone, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         phone = excluded.phone,
         updated_at = excluded.updated_at`,
      id, input.name, input.phone, createdAt,
    );
    const payload = { id, name: input.name, phone: input.phone };
    await db.runAsync(
      `INSERT INTO outbox (
        id, idempotency_key, entity_type, operation, payload, status, attempts, created_at
      ) VALUES (?, ?, 'SUPPLIER', ?, ?, 'PENDING', 0, ?)`,
      createLocalUuid(), createLocalUuid(), operation, JSON.stringify(payload), createdAt,
    );
  });
  return id;
}

export async function deleteLocalCustomer(customerId: string): Promise<void> {
  const db = await getDatabase();
  const createdAt = getLocalDateTimeString();
  await withSerializedTransaction(db, async () => {
    const customer = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM customers WHERE id = ?', customerId,
    );
    if (!customer) throw new Error('Client introuvable dans la base locale.');
    const history = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sales WHERE customer_id = ?', customerId,
    );
    if ((history?.count ?? 0) > 0) {
      throw new Error('Suppression impossible : ce client possède un historique de ventes.');
    }
    await db.runAsync('DELETE FROM customers WHERE id = ?', customerId);
    await db.runAsync(
      `INSERT INTO outbox (
        id, idempotency_key, entity_type, operation, payload, status, attempts, created_at
      ) VALUES (?, ?, 'CUSTOMER', 'DELETE', ?, 'PENDING', 0, ?)`,
      createLocalUuid(), createLocalUuid(), JSON.stringify({ id: customerId }), createdAt,
    );
  });
}

export async function deleteLocalSupplier(supplierId: string): Promise<void> {
  const db = await getDatabase();
  const createdAt = getLocalDateTimeString();
  await withSerializedTransaction(db, async () => {
    const supplier = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM suppliers WHERE id = ?', supplierId,
    );
    if (!supplier) throw new Error('Fournisseur introuvable dans la base locale.');
    const history = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM purchases WHERE supplier_id = ?', supplierId,
    );
    if ((history?.count ?? 0) > 0) {
      throw new Error("Suppression impossible : ce fournisseur possède un historique d'achats.");
    }
    await db.runAsync('DELETE FROM suppliers WHERE id = ?', supplierId);
    await db.runAsync(
      `INSERT INTO outbox (
        id, idempotency_key, entity_type, operation, payload, status, attempts, created_at
      ) VALUES (?, ?, 'SUPPLIER', 'DELETE', ?, 'PENDING', 0, ?)`,
      createLocalUuid(), createLocalUuid(), JSON.stringify({ id: supplierId }), createdAt,
    );
  });
}

export interface LocalCustomerPayment {
  id: string;
  customerId: string;
  amount: number;
  paidAt: string;
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
}

export async function createLocalCustomerPayment(
  customerId: string,
  requestedAmount: number,
): Promise<string> {
  const db = await getDatabase();
  const paymentId = createLocalUuid();
  const paidAt = getLocalDateTimeString();
  const amount = roundMoney(requestedAmount);

  await withSerializedTransaction(db, async () => {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Montant de paiement invalide.');
    }
    const customer = await db.getFirstAsync<{ balance: number }>(
      'SELECT balance FROM customers WHERE id = ?',
      customerId,
    );
    if (!customer) throw new Error('Client introuvable dans la base locale.');
    const balance = roundMoney(customer.balance);
    if (balance <= 0) throw new Error("Ce client n'a pas de dette.");
    if (amount > balance) {
      throw new Error(`Le paiement dépasse la dette du client (${balance.toFixed(2)} DH).`);
    }

    await db.runAsync(
      'UPDATE customers SET balance = ?, updated_at = ? WHERE id = ?',
      roundMoney(balance - amount),
      paidAt,
      customerId,
    );
    await db.runAsync(
      `INSERT INTO customer_payments (id, customer_id, amount, paid_at, sync_status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      paymentId,
      customerId,
      amount,
      paidAt,
    );
    const payload = { id: paymentId, customerId, amount, paidAt };
    await db.runAsync(
      `INSERT INTO outbox (
        id, idempotency_key, entity_type, operation, payload, status, attempts, created_at
      ) VALUES (?, ?, 'CUSTOMER_PAYMENT', 'CREATE', ?, 'PENDING', 0, ?)`,
      paymentId,
      paymentId,
      JSON.stringify(payload),
      paidAt,
    );
  });

  return paymentId;
}

export async function getCachedCustomerPayments(
  customerId: string,
): Promise<LocalCustomerPayment[]> {
  const db = await getDatabase();
  await transactionTail;
  const rows = await db.getAllAsync<{
    id: string;
    customer_id: string;
    amount: number;
    paid_at: string;
    sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
  }>(
    `SELECT id, customer_id, amount, paid_at, sync_status
     FROM customer_payments
     WHERE customer_id = ?
     ORDER BY paid_at DESC`,
    customerId,
  );
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    amount: row.amount,
    paidAt: row.paid_at,
    syncStatus: row.sync_status,
  }));
}

export async function getCachedCustomers(): Promise<Customer[]> {
  const db = await getDatabase();
  // Avoid reading a half-written operation from an active async transaction.
  await transactionTail;
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    phone: string | null;
    credit_limit: number | null;
    balance: number;
  }>('SELECT id, name, phone, credit_limit, balance FROM customers ORDER BY name ASC');

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    creditLimit: row.credit_limit,
    balance: row.balance,
  }));
}

/**
 * Persists a sale, its stock movements and its sync command atomically.
 * The server receives the same UUID, making a retry safe after a lost response.
 */
export async function createLocalSale(input: LocalSaleInput): Promise<string> {
  const db = await getDatabase();
  const saleId = createLocalUuid();
  const createdAt = getLocalDateTimeString();

  await withSerializedTransaction(db, async () => {
    if (input.lines.length === 0) throw new Error('La vente doit contenir au moins un produit.');

    let subtotal = 0;
    let costTotal = 0;
    const lines: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      unitCost: number;
    }> = [];

    for (const requestedLine of input.lines) {
      if (!Number.isInteger(requestedLine.quantity) || requestedLine.quantity <= 0) {
        throw new Error('Quantité de vente invalide.');
      }
      const product = await db.getFirstAsync<{
        id: string;
        name: string;
        active: number;
        stock_quantity: number;
        sale_price: number;
        average_purchase_price: number;
      }>(
        `SELECT id, name, active, stock_quantity, sale_price, average_purchase_price
         FROM products WHERE id = ?`,
        requestedLine.productId,
      );
      if (!product || product.active !== 1) {
        throw new Error('Produit introuvable ou désactivé.');
      }
      const alreadyRequested = lines
        .filter((line) => line.productId === product.id)
        .reduce((quantity, line) => quantity + line.quantity, 0);
      if (product.stock_quantity < alreadyRequested + requestedLine.quantity) {
        throw new Error(`Stock insuffisant pour ${product.name}.`);
      }

      const unitPrice = roundMoney(requestedLine.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error('Prix de vente invalide.');
      }
      const unitCost = product.average_purchase_price || 0;
      subtotal += unitPrice * requestedLine.quantity;
      costTotal += unitCost * requestedLine.quantity;
      lines.push({
        productId: product.id,
        quantity: requestedLine.quantity,
        unitPrice,
        unitCost,
      });
    }

    const discount = roundMoney(input.discount);
    subtotal = roundMoney(subtotal);
    costTotal = roundMoney(costTotal);
    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) {
      throw new Error('Remise invalide.');
    }
    const total = roundMoney(subtotal - discount);
    const amountPaid = input.amountPaid === null ? total : roundMoney(input.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > total) {
      throw new Error('Montant payé invalide.');
    }
    const remaining = roundMoney(total - amountPaid);

    if (remaining > 0 && !input.customerId) {
      throw new Error('Une vente à crédit nécessite un client.');
    }

    if (input.customerId) {
      const customer = await db.getFirstAsync<{
        id: string;
        credit_limit: number | null;
        balance: number;
      }>(
        'SELECT id, credit_limit, balance FROM customers WHERE id = ?',
        input.customerId,
      );
      if (!customer) throw new Error('Client introuvable dans la base locale.');
      if (
        remaining > 0 &&
        customer.credit_limit !== null &&
        customer.balance + remaining > customer.credit_limit
      ) {
        throw new Error('La limite de crédit du client sera dépassée.');
      }
    }

    await db.runAsync(
      `INSERT INTO sales (
        id, customer_id, sale_date, discount, total, amount_paid,
        remaining, profit, status, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'VALIDATED', 'PENDING')`,
      saleId,
      input.customerId,
      createdAt,
      discount,
      total,
      amountPaid,
      remaining,
      roundMoney(total - costTotal),
    );

    for (const line of lines) {
      await db.runAsync(
        `INSERT INTO sale_lines (id, sale_id, product_id, quantity, unit_price, unit_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        createLocalUuid(),
        saleId,
        line.productId,
        line.quantity,
        line.unitPrice,
        line.unitCost,
      );
      await db.runAsync(
        'UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = ? WHERE id = ?',
        line.quantity,
        createdAt,
        line.productId,
      );
      await db.runAsync(
        `INSERT INTO stock_movements (id, product_id, type, quantity, reference_id, created_at, note)
         VALUES (?, ?, 'SALE', ?, ?, ?, ?)`,
        createLocalUuid(),
        line.productId,
        -line.quantity,
        saleId,
        createdAt,
        'Vente locale',
      );
    }

    if (input.customerId && remaining > 0) {
      await db.runAsync(
        'UPDATE customers SET balance = balance + ?, updated_at = ? WHERE id = ?',
        remaining,
        createdAt,
        input.customerId,
      );
    }

    const payload = {
      id: saleId,
      saleDate: createdAt,
      customerId: input.customerId,
      discount,
      amountPaid,
      lines: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    };
    await db.runAsync(
      `INSERT INTO outbox (
        id, idempotency_key, entity_type, operation, payload, status, attempts, created_at
      ) VALUES (?, ?, 'SALE', 'CREATE', ?, 'PENDING', 0, ?)`,
      saleId,
      saleId,
      JSON.stringify(payload),
      createdAt,
    );
  });

  return saleId;
}

/**
 * Annule une vente dans SQLite et met en file la commande serveur.
 * Le mouvement de stock référence l'ID de commande pour être rejoué une seule fois
 * lors de la reconstruction du stock depuis le serveur.
 */
export async function cancelLocalSale(saleId: string, reason: string): Promise<string> {
  const db = await getDatabase();
  const cancellationId = createLocalUuid();
  const createdAt = getLocalDateTimeString();
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error('Le motif d’annulation est obligatoire.');

  await withSerializedTransaction(db, async () => {
    const sale = await db.getFirstAsync<{
      id: string; customer_id: string | null; remaining: number; status: string;
    }>('SELECT id, customer_id, remaining, status FROM sales WHERE id = ?', saleId);
    if (!sale) throw new Error('Vente introuvable dans la base locale.');
    if (sale.status === 'CANCELLED') throw new Error('Cette vente est déjà annulée.');

    const lines = await db.getAllAsync<{ product_id: string; quantity: number }>(
      'SELECT product_id, quantity FROM sale_lines WHERE sale_id = ?',
      saleId,
    );
    if (lines.length === 0) throw new Error('Les lignes de cette vente sont introuvables.');

    for (const line of lines) {
      await db.runAsync(
        'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = ? WHERE id = ?',
        line.quantity,
        createdAt,
        line.product_id,
      );
      await db.runAsync(
        `INSERT INTO stock_movements (id, product_id, type, quantity, reference_id, created_at, note)
         VALUES (?, ?, 'SALE_CANCELLATION', ?, ?, ?, ?)`,
        createLocalUuid(),
        line.product_id,
        line.quantity,
        cancellationId,
        createdAt,
        normalizedReason,
      );
    }

    if (sale.customer_id && sale.remaining > 0) {
      await db.runAsync(
        'UPDATE customers SET balance = MAX(0, balance - ?), updated_at = ? WHERE id = ?',
        sale.remaining,
        createdAt,
        sale.customer_id,
      );
    }

    await db.runAsync(
      "UPDATE sales SET status = 'CANCELLED', cancellation_reason = ?, sync_status = 'PENDING' WHERE id = ?",
      normalizedReason,
      saleId,
    );
    const payload = { saleId, reason: normalizedReason };
    await db.runAsync(
      `INSERT INTO outbox (
        id, idempotency_key, entity_type, operation, payload, status, attempts, created_at
      ) VALUES (?, ?, 'SALE_CANCEL', 'CREATE', ?, 'PENDING', 0, ?)`,
      cancellationId,
      cancellationId,
      JSON.stringify(payload),
      createdAt,
    );
  });

  return cancellationId;
}

export async function saveLocalExpense(input: {
  category: Expense['category'];
  amount: number;
  note: string | null;
}): Promise<string> {
  const db = await getDatabase();
  const id = createLocalUuid();
  const expenseDate = getLocalDateTimeString().slice(0, 10);
  const amount = roundMoney(input.amount);
  await withSerializedTransaction(db, async () => {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Montant de dépense invalide.');
    await db.runAsync(`INSERT INTO expenses (id, category, amount, expense_date, note, sync_status) VALUES (?, ?, ?, ?, ?, 'PENDING')`, id, input.category, amount, expenseDate, input.note);
    const payload = { id, category: input.category, amount, expenseDate, note: input.note };
    await db.runAsync(`INSERT INTO outbox (id, idempotency_key, entity_type, operation, payload, status, attempts, created_at) VALUES (?, ?, 'EXPENSE', 'CREATE', ?, 'PENDING', 0, ?)`, id, id, JSON.stringify(payload), getLocalDateTimeString());
  });
  return id;
}

export async function deleteLocalExpense(expenseId: string): Promise<void> {
  const db = await getDatabase();
  const createdAt = getLocalDateTimeString();
  await withSerializedTransaction(db, async () => {
    const expense = await db.getFirstAsync<{ id: string }>('SELECT id FROM expenses WHERE id = ?', expenseId);
    if (!expense) throw new Error('Dépense introuvable.');
    const pendingCreate = await db.getFirstAsync<{ id: string }>(`SELECT id FROM outbox WHERE entity_type = 'EXPENSE' AND operation = 'CREATE' AND status IN ('PENDING', 'FAILED') AND id = ?`, expenseId);
    if (pendingCreate) {
      await db.runAsync('DELETE FROM outbox WHERE id = ?', expenseId);
      await db.runAsync('DELETE FROM expenses WHERE id = ?', expenseId);
      return;
    }
    await db.runAsync("UPDATE expenses SET sync_status = 'DELETE_PENDING' WHERE id = ?", expenseId);
    const deleteId = createLocalUuid();
    await db.runAsync(`INSERT INTO outbox (id, idempotency_key, entity_type, operation, payload, status, attempts, created_at) VALUES (?, ?, 'EXPENSE', 'DELETE', ?, 'PENDING', 0, ?)`, deleteId, deleteId, JSON.stringify({ id: expenseId }), createdAt);
  });
}

export async function getCachedExpenses(): Promise<Expense[]> {
  const db = await getDatabase();
  await transactionTail;
  const rows = await db.getAllAsync<{ id: string; category: Expense['category']; amount: number; expense_date: string; note: string | null }>("SELECT id, category, amount, expense_date, note FROM expenses WHERE sync_status <> 'DELETE_PENDING' ORDER BY expense_date DESC, rowid DESC");
  return rows.map((row) => ({ id: row.id, category: row.category, amount: row.amount, expenseDate: row.expense_date, note: row.note }));
}

export async function saveExpenses(expenses: Expense[]): Promise<void> {
  const db = await getDatabase();
  await withSerializedTransaction(db, async () => {
    for (const expense of expenses) {
      await db.runAsync(`INSERT INTO expenses (id, category, amount, expense_date, note, sync_status) VALUES (?, ?, ?, ?, ?, 'SYNCED') ON CONFLICT(id) DO UPDATE SET category = excluded.category, amount = excluded.amount, expense_date = excluded.expense_date, note = excluded.note, sync_status = 'SYNCED' WHERE NOT EXISTS (SELECT 1 FROM outbox queued WHERE queued.entity_type = 'EXPENSE' AND queued.status IN ('PENDING', 'FAILED') AND json_extract(queued.payload, '$.id') = excluded.id)`, expense.id, expense.category, expense.amount, expense.expenseDate, expense.note);
    }
  });
}

export async function cacheReportSummary(period: string, report: ReportSummary): Promise<void> {
  const db = await getDatabase();
  await withSerializedTransaction(db, async () => {
    await db.runAsync(`INSERT INTO report_cache (period, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(period) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`, period, JSON.stringify(report), getLocalDateTimeString());
  });
}

export async function getCachedReportSummary(period: string): Promise<ReportSummary | null> {
  const db = await getDatabase();
  await transactionTail;
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM report_cache WHERE period = ?', period);
  if (!row) return null;
  try { return JSON.parse(row.payload) as ReportSummary; } catch { return null; }
}
export async function getPendingOutbox(limit = 25): Promise<PendingOutboxItem[]> {
  const db = await getDatabase();
  // Avoid reading a half-written operation from an active async transaction.
  await transactionTail;
  return db.getAllAsync<PendingOutboxItem>(
    `SELECT id, idempotency_key, entity_type, operation, payload, status,
            attempts, created_at, last_error
     FROM outbox
     WHERE status = 'PENDING'
     ORDER BY created_at ASC, rowid ASC
     LIMIT ?`,
    limit,
  );
}

export async function markOutboxSynced(item: PendingOutboxItem): Promise<void> {
  const db = await getDatabase();
  await withSerializedTransaction(db, async () => {
    await db.runAsync(
      "UPDATE outbox SET status = 'SYNCED', last_error = NULL WHERE id = ?",
      item.id,
    );
    if (item.entity_type === 'SALE') {
      await db.runAsync("UPDATE sales SET sync_status = 'SYNCED' WHERE id = ?", item.id);
    } else if (item.entity_type === 'SALE_CANCEL') {
      const payload = JSON.parse(item.payload) as { saleId?: string };
      if (payload.saleId) {
        await db.runAsync("UPDATE sales SET sync_status = 'SYNCED' WHERE id = ?", payload.saleId);
      }
    } else if (item.entity_type === 'CUSTOMER_PAYMENT') {
      await db.runAsync("UPDATE customer_payments SET sync_status = 'SYNCED' WHERE id = ?", item.id);
    } else if (item.entity_type === 'PURCHASE') {
      await db.runAsync("UPDATE purchases SET sync_status = 'SYNCED' WHERE id = ?", item.id);
    } else if (item.entity_type === 'PURCHASE_PAYMENT') {
      await db.runAsync("UPDATE purchase_payments SET sync_status = 'SYNCED' WHERE id = ?", item.id);
    } else if (item.entity_type === 'EXPENSE') {
      const payload = JSON.parse(item.payload) as { id?: string };
      if (item.operation === 'DELETE' && payload.id) await db.runAsync('DELETE FROM expenses WHERE id = ?', payload.id);
      else await db.runAsync("UPDATE expenses SET sync_status = 'SYNCED' WHERE id = ?", item.id);
    }
  });
}

export async function recordOutboxFailure(
  itemId: string,
  message: string,
  permanent = false,
): Promise<void> {
  const db = await getDatabase();
  await withSerializedTransaction(db, async () => {
    await db.runAsync(
      `UPDATE outbox
       SET attempts = attempts + 1,
           last_error = ?,
           status = CASE WHEN ? = 1 THEN 'FAILED' ELSE 'PENDING' END
       WHERE id = ?`,
      message.slice(0, 1000),
      permanent ? 1 : 0,
      itemId,
    );
    await db.runAsync(
      `UPDATE customer_payments
       SET sync_status = CASE WHEN ? = 1 THEN 'FAILED' ELSE 'PENDING' END
       WHERE id = (SELECT id FROM outbox WHERE id = ? AND entity_type = 'CUSTOMER_PAYMENT')`,
      permanent ? 1 : 0,
      itemId,
    );
    await db.runAsync(
      `UPDATE purchase_payments
       SET sync_status = CASE WHEN ? = 1 THEN 'FAILED' ELSE 'PENDING' END
       WHERE id = (SELECT id FROM outbox WHERE id = ? AND entity_type = 'PURCHASE_PAYMENT')`,
      permanent ? 1 : 0,
      itemId,
    );
  });
}


export interface LocalPurchaseInput {
  supplierId: string | null;
  amountPaid: number;
  note: string | null;
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

export async function saveSuppliers(suppliers: Supplier[]): Promise<void> {
  const db = await getDatabase();
  await withSerializedTransaction(db, async () => {
    for (const supplier of suppliers) {
      await db.runAsync(
        `INSERT INTO suppliers (id, name, phone, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           phone = excluded.phone,
           updated_at = excluded.updated_at
         WHERE NOT EXISTS (
           SELECT 1 FROM outbox queued
           WHERE queued.entity_type = 'SUPPLIER'
             AND queued.status IN ('PENDING', 'FAILED')
             AND json_extract(queued.payload, '$.id') = excluded.id
         )`,
        supplier.id,
        supplier.name,
        supplier.phone,
        new Date().toISOString(),
      );
    }
  });
}

export async function getCachedSuppliers(): Promise<Supplier[]> {
  const db = await getDatabase();
  // Avoid reading a half-written operation from an active async transaction.
  await transactionTail;
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    phone: string | null;
  }>('SELECT id, name, phone FROM suppliers ORDER BY name ASC');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
  }));
}

/**
 * Persists a purchase, weighted average cost, stock movements and its outbox
 * command in one transaction.
 */
export async function createLocalPurchase(input: LocalPurchaseInput): Promise<string> {
  const db = await getDatabase();
  const purchaseId = createLocalUuid();
  const createdAt = getLocalDateTimeString();

  await withSerializedTransaction(db, async () => {
    if (input.lines.length === 0) throw new Error('L’achat doit contenir au moins un produit.');

    let total = 0;
    const lines: Array<{ productId: string; quantity: number; unitPrice: number }> = [];

    for (const requestedLine of input.lines) {
      if (!Number.isInteger(requestedLine.quantity) || requestedLine.quantity <= 0) {
        throw new Error('Quantité d’achat invalide.');
      }
      if (!Number.isFinite(requestedLine.unitPrice) || requestedLine.unitPrice < 0) {
        throw new Error('Prix d’achat invalide.');
      }

      const product = await db.getFirstAsync<{
        id: string;
        name: string;
        active: number;
        stock_quantity: number;
        average_purchase_price: number;
      }>(
        `SELECT id, name, active, stock_quantity, average_purchase_price
         FROM products WHERE id = ?`,
        requestedLine.productId,
      );
      if (!product || product.active !== 1) {
        throw new Error('Produit introuvable ou désactivé.');
      }

      total += requestedLine.quantity * roundMoney(requestedLine.unitPrice);
      lines.push({
        productId: product.id,
        quantity: requestedLine.quantity,
        unitPrice: roundMoney(requestedLine.unitPrice),
      });
    }

    total = roundMoney(total);
    const amountPaid = roundMoney(input.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > total) {
      throw new Error('Montant payé invalide.');
    }
    if (input.supplierId) {
      const supplier = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM suppliers WHERE id = ?',
        input.supplierId,
      );
      if (!supplier) throw new Error('Fournisseur introuvable dans la base locale.');
    }

    const remaining = roundMoney(total - amountPaid);
    await db.runAsync(
      `INSERT INTO purchases (
        id, supplier_id, purchase_date, total, amount_paid, remaining, note, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      purchaseId,
      input.supplierId,
      createdAt,
      total,
      amountPaid,
      remaining,
      input.note,
    );

    for (const line of lines) {
      const product = await db.getFirstAsync<{
        stock_quantity: number;
        average_purchase_price: number;
      }>(
        'SELECT stock_quantity, average_purchase_price FROM products WHERE id = ?',
        line.productId,
      );
      if (!product) throw new Error('Produit introuvable pendant la mise à jour du stock.');

      const oldQuantity = product.stock_quantity;
      const newQuantity = oldQuantity + line.quantity;
      const oldValue = (product.average_purchase_price || 0) * Math.max(0, oldQuantity);
      const newAverage = oldQuantity <= 0
        ? line.unitPrice
        : (oldValue + line.unitPrice * line.quantity) / newQuantity;

      await db.runAsync(
        `INSERT INTO purchase_lines (id, purchase_id, product_id, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        createLocalUuid(),
        purchaseId,
        line.productId,
        line.quantity,
        line.unitPrice,
      );
      await db.runAsync(
        `UPDATE products
         SET stock_quantity = ?, average_purchase_price = ?, purchase_price = ?, updated_at = ?
         WHERE id = ?`,
        newQuantity,
        Math.round(newAverage * 100) / 100,
        line.unitPrice,
        createdAt,
        line.productId,
      );
      await db.runAsync(
        `INSERT INTO stock_movements (id, product_id, type, quantity, reference_id, created_at, note)
         VALUES (?, ?, 'PURCHASE', ?, ?, ?, ?)`,
        createLocalUuid(),
        line.productId,
        line.quantity,
        purchaseId,
        createdAt,
        'Achat local',
      );
    }

    const payload = {
      id: purchaseId,
      purchaseDate: createdAt,
      supplierId: input.supplierId,
      amountPaid,
      note: input.note,
      lines,
    };
    await db.runAsync(
      `INSERT INTO outbox (
        id, idempotency_key, entity_type, operation, payload, status, attempts, created_at
      ) VALUES (?, ?, 'PURCHASE', 'CREATE', ?, 'PENDING', 0, ?)`,
      purchaseId,
      purchaseId,
      JSON.stringify(payload),
      createdAt,
    );
  });

  return purchaseId;
}


/**
 * Enregistre un règlement fournisseur localement. Le même identifiant est envoyé
 * au serveur afin qu'une réponse HTTP perdue ne provoque jamais un double paiement.
 */
export async function createLocalPurchasePayment(
  purchaseId: string,
  requestedAmount: number,
): Promise<string> {
  const db = await getDatabase();
  const paymentId = createLocalUuid();
  const paidAt = getLocalDateTimeString();
  const amount = roundMoney(requestedAmount);

  await withSerializedTransaction(db, async () => {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Montant de paiement invalide.');
    }
    const purchase = await db.getFirstAsync<{ amount_paid: number; remaining: number }>(
      'SELECT amount_paid, remaining FROM purchases WHERE id = ?',
      purchaseId,
    );
    if (!purchase) throw new Error('Achat introuvable dans la base locale.');
    const remaining = roundMoney(purchase.remaining);
    if (remaining <= 0) throw new Error('Cet achat est déjà réglé.');
    if (amount > remaining) {
      throw new Error(`Le paiement dépasse le reste à payer (${remaining.toFixed(2)} DH).`);
    }

    await db.runAsync(
      'UPDATE purchases SET amount_paid = ?, remaining = ?, sync_status = ? WHERE id = ?',
      roundMoney(purchase.amount_paid + amount),
      roundMoney(remaining - amount),
      'PENDING',
      purchaseId,
    );
    await db.runAsync(
      `INSERT INTO purchase_payments (id, purchase_id, amount, paid_at, sync_status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      paymentId,
      purchaseId,
      amount,
      paidAt,
    );
    const payload = { id: paymentId, purchaseId, amount, paidAt };
    await db.runAsync(
      `INSERT INTO outbox (
        id, idempotency_key, entity_type, operation, payload, status, attempts, created_at
      ) VALUES (?, ?, 'PURCHASE_PAYMENT', 'CREATE', ?, 'PENDING', 0, ?)`,
      paymentId,
      paymentId,
      JSON.stringify(payload),
      paidAt,
    );
  });

  return paymentId;
}

export async function getCachedSales(): Promise<Sale[]> {
  const db = await getDatabase();
  // Avoid reading a half-written operation from an active async transaction.
  await transactionTail;
  const rows = await db.getAllAsync<{
    id: string;
    customer_id: string | null;
    customer_name: string | null;
    sale_date: string;
    discount: number;
    total: number;
    amount_paid: number;
    remaining: number;
    profit: number;
    status: 'VALIDATED' | 'CANCELLED';
    cancellation_reason: string | null;
  }>(
    `SELECT sale.id, sale.customer_id, customer.name AS customer_name,
            sale.sale_date, sale.discount, sale.total, sale.amount_paid,
            sale.remaining, sale.profit, sale.status, sale.cancellation_reason
     FROM sales sale
     LEFT JOIN customers customer ON customer.id = sale.customer_id
     ORDER BY sale.sale_date DESC`,
  );

  const result: Sale[] = [];
  for (const row of rows) {
    const lineRows = await db.getAllAsync<{
      id: string;
      product_id: string;
      product_name: string | null;
      quantity: number;
      unit_price: number;
      unit_cost: number;
    }>(
      `SELECT line.id, line.product_id, product.name AS product_name,
              line.quantity, line.unit_price, line.unit_cost
       FROM sale_lines line
       LEFT JOIN products product ON product.id = line.product_id
       WHERE line.sale_id = ?`,
      row.id,
    );
    result.push({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      saleDate: row.sale_date,
      discount: row.discount,
      total: row.total,
      amountPaid: row.amount_paid,
      remaining: row.remaining,
      profit: row.profit,
      status: row.status,
      cancellationReason: row.cancellation_reason,
      lines: lineRows.map((line) => ({
        saleLineId: line.id,
        productId: line.product_id,
        productName: line.product_name ?? 'Produit',
        quantity: line.quantity,
        unitPrice: line.unit_price,
        unitCost: line.unit_cost,
      })),
    });
  }
  return result;
}

export async function getCachedPurchases(): Promise<Purchase[]> {
  const db = await getDatabase();
  // Avoid reading a half-written operation from an active async transaction.
  await transactionTail;
  const rows = await db.getAllAsync<{
    id: string;
    supplier_id: string | null;
    supplier_name: string | null;
    purchase_date: string;
    total: number;
    amount_paid: number;
    remaining: number;
    note: string | null;
  }>(
    `SELECT purchase.id, purchase.supplier_id, supplier.name AS supplier_name,
            purchase.purchase_date, purchase.total, purchase.amount_paid,
            purchase.remaining, purchase.note
     FROM purchases purchase
     LEFT JOIN suppliers supplier ON supplier.id = purchase.supplier_id
     ORDER BY purchase.purchase_date DESC`,
  );

  const result: Purchase[] = [];
  for (const row of rows) {
    const lineRows = await db.getAllAsync<{
      product_id: string;
      product_name: string | null;
      quantity: number;
      unit_price: number;
    }>(
      `SELECT line.product_id, product.name AS product_name,
              line.quantity, line.unit_price
       FROM purchase_lines line
       LEFT JOIN products product ON product.id = line.product_id
       WHERE line.purchase_id = ?`,
      row.id,
    );
    result.push({
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      purchaseDate: row.purchase_date,
      total: row.total,
      amountPaid: row.amount_paid,
      remaining: row.remaining,
      note: row.note,
      lines: lineRows.map((line) => ({
        productId: line.product_id,
        productName: line.product_name ?? 'Produit',
        quantity: line.quantity,
        unitPrice: line.unit_price,
      })),
    });
  }
  return result;
}


export async function saveSales(sales: Sale[]): Promise<void> {
  const db = await getDatabase();
  await withSerializedTransaction(db, async () => {
    for (const sale of sales) {
      // A server snapshot must never replace a sale that is still waiting in the
      // local outbox. Its local lines and totals are the source of truth until
      // the backend acknowledges the exact operation.
      const pendingSale = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM outbox
         WHERE status IN ('PENDING', 'FAILED')
           AND (
             (entity_type = 'SALE' AND id = ?)
             OR (entity_type = 'SALE_CANCEL'
                 AND json_extract(payload, '$.saleId') = ?)
           )
         LIMIT 1`,
        sale.id,
        sale.id,
      );
      if (pendingSale) continue;

      await db.runAsync(
        `INSERT INTO sales (
          id, customer_id, sale_date, discount, total, amount_paid,
          remaining, profit, status, cancellation_reason, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
        ON CONFLICT(id) DO UPDATE SET
          customer_id = excluded.customer_id,
          sale_date = excluded.sale_date,
          discount = excluded.discount,
          total = excluded.total,
          amount_paid = excluded.amount_paid,
          remaining = excluded.remaining,
          profit = excluded.profit,
          status = excluded.status,
          cancellation_reason = excluded.cancellation_reason,
          sync_status = 'SYNCED'`,
        sale.id,
        sale.customerId,
        sale.saleDate,
        sale.discount,
        sale.total,
        sale.amountPaid,
        sale.remaining,
        sale.profit,
        sale.status,
        sale.cancellationReason,
      );

      await db.runAsync('DELETE FROM sale_lines WHERE sale_id = ?', sale.id);
      for (const line of sale.lines) {
        await db.runAsync(
          `INSERT INTO sale_lines (id, sale_id, product_id, quantity, unit_price, unit_cost)
           VALUES (?, ?, ?, ?, ?, ?)`,
          line.saleLineId,
          sale.id,
          line.productId,
          line.quantity,
          line.unitPrice,
          line.unitCost,
        );
      }

      await db.runAsync(
        "UPDATE outbox SET status = 'SYNCED', last_error = NULL WHERE id = ? AND entity_type = 'SALE'",
        sale.id,
      );
    }
  });
}

export async function savePurchases(purchases: Purchase[]): Promise<void> {
  const db = await getDatabase();
  await withSerializedTransaction(db, async () => {
    for (const purchase of purchases) {
      // Keep the locally-created purchase and its stock-affecting lines intact
      // until its outbox operation has been acknowledged by the backend.
      const pendingPurchase = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM outbox
         WHERE status IN ('PENDING', 'FAILED')
           AND (
             (entity_type = 'PURCHASE' AND id = ?)
             OR (entity_type = 'PURCHASE_PAYMENT'
                 AND json_extract(payload, '$.purchaseId') = ?)
           )
         LIMIT 1`,
        purchase.id,
        purchase.id,
      );
      if (pendingPurchase) continue;

      await db.runAsync(
        `INSERT INTO purchases (
          id, supplier_id, purchase_date, total, amount_paid, remaining, note, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED')
        ON CONFLICT(id) DO UPDATE SET
          supplier_id = excluded.supplier_id,
          purchase_date = excluded.purchase_date,
          total = excluded.total,
          amount_paid = excluded.amount_paid,
          remaining = excluded.remaining,
          note = excluded.note,
          sync_status = 'SYNCED'`,
        purchase.id,
        purchase.supplierId,
        purchase.purchaseDate,
        purchase.total,
        purchase.amountPaid,
        purchase.remaining,
        purchase.note,
      );

      await db.runAsync('DELETE FROM purchase_lines WHERE purchase_id = ?', purchase.id);
      for (const line of purchase.lines) {
        await db.runAsync(
          `INSERT INTO purchase_lines (id, purchase_id, product_id, quantity, unit_price)
           VALUES (?, ?, ?, ?, ?)`,
          createLocalUuid(),
          purchase.id,
          line.productId,
          line.quantity,
          line.unitPrice,
        );
      }

      await db.runAsync(
        "UPDATE outbox SET status = 'SYNCED', last_error = NULL WHERE id = ? AND entity_type = 'PURCHASE'",
        purchase.id,
      );
    }
  });
}
