// Product & Inventory
export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  lowStockThreshold: number;
  barcode?: string;
  image?: string;
  storeId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryLog {
  id: string;
  productId: string;
  quantity: number;
  type: 'purchase' | 'sale' | 'adjustment' | 'return';
  reason?: string;
  storeId: string;
  createdBy: string;
  createdAt: Date;
}

// Customers
export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  loyaltyPoints: number;
  totalSpent: number;
  storeId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Sales & Transactions
export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  discount?: number;
}

export interface Transaction {
  id: string;
  transactionNumber: string;
  storeId: string;
  customerId?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'check' | 'other';
  status: 'completed' | 'refunded' | 'pending';
  cashierId: string;
  notes?: string;
  createdAt: Date;
}

export interface Receipt {
  id: string;
  transactionId: string;
  storeId: string;
  receiptNumber: string;
  createdAt: Date;
}

// Reports
export interface DailySales {
  date: string;
  storeId: string;
  totalSales: number;
  totalTransactions: number;
  averageTransaction: number;
  taxCollected: number;
}

export interface ProductSales {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface CategorySales {
  category: string;
  totalSales: number;
  totalTransactions: number;
  percentage: number;
}

// Audit Trail
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  storeId: string;
  createdAt: Date;
}
