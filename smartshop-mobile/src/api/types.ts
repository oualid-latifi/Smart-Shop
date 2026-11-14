export interface AccountStatus {
  accountExists: boolean;
}

export type Role = 'OWNER' | 'SELLER' | 'CASHIER' | 'STOCKKEEPER' | 'ACCOUNTANT';
export type Permission = 'SALES' | 'SALES_CANCEL' | 'CUSTOMERS' | 'PAYMENTS' | 'PRODUCTS_WRITE' | 'STOCK' | 'PURCHASES' | 'REPORTS' | 'MARGINS' | 'CASH' | 'SETTINGS' | 'USERS';

export interface AuthResponse {
  token: string;
  expiresAt: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  permissions: Permission[];
}

export type AppUser = MeResponse;

export interface Product {
  id: string;
  reference: string;
  name: string;
  barcode: string | null;
  brand: string | null;
  model: string | null;
  variantGroup: string | null;
  color: string | null;
  capacity: string | null;
  imageUrl: string | null;
  averagePurchasePrice: number | null; // masqué sans le droit MARGINS
  salePrice: number;
  vatRate: number | null;
  unitsPerPack: number | null;
  packPrice: number | null;
  stockQuantity: number;
  alertThreshold: number;
  lowStock: boolean;
  active: boolean;
  promoPrice: number | null;
  secondItemPercent: number | null;
  promoLabel: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  ice: string | null;
  creditLimit: number | null;
  balance: number;
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
}

export interface PurchaseLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Purchase {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  purchaseDate: string;
  total: number;
  amountPaid: number;
  returnedAmount: number;
  refundReceived: number;
  remaining: number;
  note: string | null;
  lines: PurchaseLine[];
}

export type ExpenseCategory = 'RENT' | 'TRANSPORT' | 'ELECTRICITY' | 'REPAIR' | 'OTHER';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  note: string | null;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

export interface ReportSummary {
  from: string;
  to: string;
  salesCount: number;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  cashCollected: number;
  paidToSuppliers: number;
  purchasesTotal: number;
  netCashFlow: number;
  topProducts: TopProduct[];
  totalCustomerDebt: number;
  totalSupplierDebt: number;
  stockValue: number;
  lowStockCount: number;
}

export type SaleStatus = 'VALIDATED' | 'CANCELLED';

export interface SaleLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  returnedQuantity: number;
  packCount: number | null;
  packPrice: number | null;
  lineTotal: number;
}

export interface Sale {
  id: string;
  number: string;
  invoiceNumber: string | null;
  deliveryNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  sellerName: string | null;
  saleDate: string;
  discount: number;
  discountPercent: number | null;
  total: number;
  returnedAmount: number;
  refundedAmount: number;
  netTotal: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  remaining: number;
  profit: number | null;
  status: SaleStatus;
  cancellationReason: string | null;
  lines: SaleLine[];
  returns: { id: string; returnedAt: string; creditAmount: number; refundAmount: number; reason: string | null }[];
}

export type StockMovementType = 'PURCHASE' | 'SALE' | 'SALE_CANCELLATION' | 'ADJUSTMENT' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'TRANSFER_OUT' | 'TRANSFER_IN';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  referenceId: string | null;
  createdAt: string;
  note: string | null;
}
export interface ShopSettings {
  shopName: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  ice: string | null;
  fiscalId: string | null;
  tradeRegister: string | null;
  patente: string | null;
  defaultVatRate: number;
  quoteValidityDays: number;
  documentFooter: string | null;
  ticketFooter: string | null;
  maxDiscountPercent: number | null;
  hasApprovalPin: boolean;
  bigSaleAmount: number | null;
  weeklyReportEnabled: boolean;
  reportEmails: string | null;
  onlineShopEnabled: boolean;
}

export type OnlineOrderStatus = 'NEW' | 'CONFIRMED' | 'CONVERTED' | 'CANCELLED';

export interface OnlineOrder {
  id: string;
  number: string;
  customerName: string;
  phone: string;
  address: string | null;
  note: string | null;
  status: OnlineOrderStatus;
  total: number;
  createdAt: string;
  saleId: string | null;
  lines: { productId: string; productName: string; quantity: number; unitPrice: number; lineTotal: number }[];
}

export type NotificationType = 'LOW_STOCK' | 'CHECK_DUE' | 'BIG_SALE' | 'TARGET_REACHED' | 'BACKUP_FAILED' | 'ONLINE_ORDER';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  referenceId: string | null;
  createdAt: string;
  read: boolean;
}

export interface NotificationFeed {
  unread: number;
  items: AppNotification[];
}

export interface BackupInfo {
  name: string;
  size: number;
  createdAt: string;
}

export interface WeeklyReport {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED' | 'EXPIRED';

export interface QuoteLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Quote {
  id: string;
  number: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  validUntil: string;
  discount: number;
  discountPercent: number | null;
  total: number;
  status: QuoteStatus;
  note: string | null;
  saleId: string | null;
  lines: QuoteLine[];
}

export type PaymentMethod = 'CASH' | 'CHECK' | 'TRANSFER' | 'CARD';
export type CheckStatus = 'PENDING' | 'CASHED' | 'BOUNCED';

export interface Check {
  operationId: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  number: string;
  bank: string | null;
  dueDate: string;
  amount: number;
  status: CheckStatus;
  receivedAt: string;
  daysUntilDue: number;
}

export type StatementEntryType = 'SALE' | 'PAYMENT' | 'CHECK_BOUNCED' | 'RETURN' | 'REFUND';

export interface Statement {
  customerId: string;
  customerName: string;
  from: string | null;
  to: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  entries: { date: string; type: StatementEntryType; reference: string; label: string; debit: number; credit: number; balance: number }[];
}

export interface Aging {
  customerId: string;
  name: string;
  phone: string | null;
  total: number;
  days0to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  oldestDays: number;
}

export interface InventoryLine {
  productId: string;
  productName: string;
  reference: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  difference: number | null;
  differenceValue: number;
}

export interface Inventory {
  id: string;
  number: string;
  openedAt: string;
  closedAt: string | null;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  note: string | null;
  productCount: number;
  countedCount: number;
  discrepancyCount: number;
  shortageValue: number;
  surplusValue: number;
  lines: InventoryLine[];
}

export type PurchaseOrderStatus = 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
  createdAt: string;
  expectedDate: string | null;
  status: PurchaseOrderStatus;
  note: string | null;
  total: number;
  lines: { productId: string; productName: string; quantity: number; receivedQuantity: number; unitPrice: number }[];
}

export type WarehouseType = 'STORAGE' | 'QUARANTINE';

export interface Warehouse {
  id: string;
  name: string;
  type: WarehouseType;
  active: boolean;
  productCount: number;
  totalUnits: number;
  value: number;
}

export interface WarehouseStockLine {
  productId: string;
  productName: string;
  reference: string;
  quantity: number;
  value: number;
}

export interface ProductLocations {
  productId: string;
  productName: string;
  shopQuantity: number;
  warehouses: { warehouseId: string; name: string; type: WarehouseType; quantity: number }[];
}

export interface Activity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  path: string;
  targetId: string | null;
  at: string;
}

export interface CashBalance {
  userId: string;
  name: string;
  role: Role;
  collected: number;
  handedIn: number;
  balance: number;
}

export interface CashHandin {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  receivedBy: string | null;
  note: string | null;
  at: string;
}

export interface TargetProgress {
  userId: string;
  name: string;
  month: string;
  target: number | null;
  achieved: number;
  salesCount: number;
  percent: number | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
}

export type PromotionKind = 'PERCENT_OFF' | 'FIXED_PRICE' | 'SECOND_ITEM_PERCENT';

export interface Promotion {
  id: string;
  name: string;
  kind: PromotionKind;
  value: number;
  productId: string | null;
  productName: string | null;
  brand: string | null;
  startsOn: string;
  endsOn: string;
  active: boolean;
  running: boolean;
}

export interface Replenishment {
  productId: string;
  reference: string;
  name: string;
  stock: number;
  alertThreshold: number;
  soldInPeriod: number;
  dailyAverage: number;
  daysOfCover: number | null;
  suggestedQuantity: number;
  lastSupplierId: string | null;
  lastSupplierName: string | null;
  lastPurchasePrice: number;
}

export interface DormantProduct {
  productId: string;
  reference: string;
  name: string;
  stock: number;
  stockValue: number;
  lastSaleDate: string | null;
  daysWithoutSale: number | null;
}

export interface SupplierPrice {
  supplierId: string | null;
  supplierName: string;
  lastPrice: number;
  minPrice: number;
  averagePrice: number;
  purchases: number;
  totalQuantity: number;
  lastPurchaseDate: string;
  cheapest: boolean;
}

export interface Insights {
  month: {
    current: { revenue: number; profit: number; sales: number };
    previous: { revenue: number; profit: number; sales: number };
    revenueChangePercent: number | null;
    profitChangePercent: number | null;
  };
  forecast: { revenueSoFar: number; projectedRevenue: number; daysElapsed: number; daysInMonth: number };
  byWeekday: { index: number; revenue: number; sales: number }[];
  byHour: { index: number; revenue: number; sales: number }[];
  byBrand: { brand: string; revenue: number; cost: number; margin: number; marginPercent: number; units: number }[];
  analysisFrom: string;
  analysisTo: string;
}
