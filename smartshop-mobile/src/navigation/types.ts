import type { Customer, Product, Purchase, Sale } from '../api/types';

export type SalesStackParamList = {
  SaleNew: undefined;
  SalesHistory: undefined;
  SaleDetail: { sale: Sale };
};

export type ProductsStackParamList = {
  ProductsList: undefined;
  ProductForm: { product?: Product } | undefined;
  Stock: { product: Product };
};

export type CustomersStackParamList = {
  CustomersList: undefined;
  CustomerForm: undefined;
  CustomerDetail: { customer: Customer };
};

export type PurchasesStackParamList = {
  PurchasesList: undefined;
  PurchaseForm: undefined;
  PurchaseDetail: { purchase: Purchase };
  SupplierForm: undefined;
};

export type ReportsStackParamList = {
  Reports: undefined;
  Expenses: undefined;
  ExpenseForm: undefined;
  Settings: undefined;
};