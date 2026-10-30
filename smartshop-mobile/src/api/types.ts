export interface AccountStatus {
  accountExists: boolean;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  name: string;
  email: string;
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  reference: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  capacity: string | null;
  imageUrl: string | null;
  averagePurchasePrice: number;
  salePrice: number;
  stockQuantity: number;
  alertThreshold: number;
  lowStock: boolean;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  creditLimit: number | null;
  balance: number;
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
  unitCost: number;
}

export interface Sale {
  id: string;
  customerId: string | null;
  customerName: string | null;
  saleDate: string;
  discount: number;
  total: number;
  amountPaid: number;
  remaining: number;
  profit: number;
  status: SaleStatus;
  cancellationReason: string | null;
  lines: SaleLine[];
}

export type StockMovementType = 'PURCHASE' | 'SALE' | 'SALE_CANCELLATION' | 'ADJUSTMENT';

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