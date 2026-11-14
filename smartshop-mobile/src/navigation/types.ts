import type { Customer, Product, Purchase, PurchaseOrder, Quote, Sale } from '../api/types';

export type SalesStackParamList = {
  SaleNew: undefined;
  SalesHistory: undefined;
  SaleDetail: { sale: Sale };
  SaleReturn: { sale: Sale };
};

export type ProductsStackParamList = {
  ProductsList: undefined;
  ProductForm: { product?: Product } | undefined;
  Stock: { product: Product };
};

export type CustomersStackParamList = {
  CustomersList: undefined;
  CustomerForm: { customer?: Customer } | undefined;
  CustomerDetail: { customer: Customer };
};

export type PurchasesStackParamList = {
  PurchasesList: undefined;
  PurchaseForm: undefined;
  PurchaseDetail: { purchase: Purchase };
  SupplierForm: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Customers: undefined;
  Purchases: undefined;
  Quotes: undefined;
  Checks: undefined;
  Aging: undefined;
  ShopSettings: undefined;
  Reports: undefined;
  Inventories: undefined;
  InventoryDetail: { id: string };
  PurchaseOrders: undefined;
  PurchaseOrderForm: undefined;
  PurchaseOrderDetail: { order: PurchaseOrder };
  Warehouses: undefined;
  Users: undefined;
  Activity: undefined;
  Cash: undefined;
  Targets: undefined;
  Import: undefined;
  Promotions: undefined;
  Replenishment: undefined;
  Dormant: undefined;
  Insights: undefined;
  Notifications: undefined;
  Backups: undefined;
  OnlineOrders: undefined;
};

export type QuotesStackParamList = {
  QuotesList: undefined;
  QuoteForm: undefined;
  QuoteDetail: { quote: Quote };
};

export type ReportsStackParamList = {
  Reports: undefined;
  Expenses: undefined;
  ExpenseForm: undefined;
  Settings: undefined;
};