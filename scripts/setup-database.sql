-- POS System Database Schema for Supabase
-- This script creates all necessary tables for the POS system with KSH currency support

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'inventory_staff')),
  store_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stores table
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  tax_rate DECIMAL(5, 4) DEFAULT 0.16,
  currency VARCHAR(3) DEFAULT 'KSH',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for users
ALTER TABLE users ADD CONSTRAINT fk_users_store_id FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  barcode VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  stock INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  image_url VARCHAR(500),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sku, store_id)
);

-- Inventory logs table
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL,
  log_type VARCHAR(50) NOT NULL CHECK (log_type IN ('purchase', 'sale', 'adjustment', 'return')),
  reason TEXT,
  reference_id VARCHAR(100),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier VARCHAR(50) DEFAULT 'Regular',
  total_spent DECIMAL(12, 2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_number VARCHAR(50) UNIQUE NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'card', 'check', 'other')),
  status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'pending')),
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transaction items table
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  line_total DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  printed_at TIMESTAMP WITH TIME ZONE,
  printed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_store_id ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_store_id ON transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_date ON inventory_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stores (users can only see their own store)
CREATE POLICY store_access ON stores FOR SELECT
  USING (TRUE); -- Allow viewing all stores for now

-- RLS Policies for products (users can only see products from their store)
CREATE POLICY product_access ON products FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.store_id = products.store_id
  ));

CREATE POLICY product_insert ON products FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.store_id = products.store_id
  ));

-- RLS Policies for customers
CREATE POLICY customer_access ON customers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.store_id = customers.store_id
  ));

-- RLS Policies for transactions
CREATE POLICY transaction_access ON transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.store_id = transactions.store_id
  ));

CREATE POLICY transaction_insert ON transactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.store_id = transactions.store_id
  ));

-- Insert default store
INSERT INTO stores (name, city, state, postal_code, tax_rate, currency) 
VALUES ('Main Store', 'Nairobi', 'Nairobi', '00100', 0.16, 'KSH')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
