// Application Configuration

export const APP_CONFIG = {
  // Application Info
  APP_NAME: 'POS System',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'Professional Multi-Store Point of Sale System',
  
  // Currency Settings
  CURRENCY: 'KSH',
  CURRENCY_SYMBOL: 'KSh',
  CURRENCY_NAME: 'Kenyan Shilling',
  
  // Location/Locale
  LOCALE: 'en-KE',
  TIMEZONE: 'Africa/Nairobi',
  
  // Tax Settings
  DEFAULT_TAX_RATE: 0.16, // 16% VAT in Kenya
  
  // Business Settings
  MAX_STORES: 100,
  MAX_USERS_PER_STORE: 50,
  
  // Feature Flags
  ENABLE_BARCODE_SCANNING: true,
  ENABLE_CUSTOMER_LOYALTY: true,
  ENABLE_MULTI_STORE: true,
  ENABLE_INVENTORY_ALERTS: true,
  ENABLE_FINANCIAL_REPORTS: true,
  
  // Session Settings
  SESSION_TIMEOUT_MINUTES: 30,
  REMEMBER_ME_DAYS: 7,
};

export const ROLE_PERMISSIONS = {
  admin: [
    'view_all',
    'manage_users',
    'manage_stores',
    'manage_inventory',
    'manage_sales',
    'manage_customers',
    'view_reports',
    'manage_settings',
    'manage_roles',
    'audit_logs',
  ],
  manager: [
    'view_all',
    'manage_inventory',
    'manage_sales',
    'manage_customers',
    'view_reports',
    'manage_staff',
  ],
  cashier: [
    'process_sales',
    'view_products',
    'manage_cart',
    'process_payments',
    'print_receipts',
    'view_customers',
  ],
  inventory_staff: [
    'manage_inventory',
    'view_products',
    'update_stock',
    'view_reports',
  ],
};

export const STORE_CONFIG = {
  DEFAULT_TAX_RATE: 0.16,
  CURRENCY: 'KSH',
  ENABLE_INVENTORY_ALERTS: true,
  LOW_STOCK_ALERT_THRESHOLD: 0.2, // Alert when stock drops to 20%
};
