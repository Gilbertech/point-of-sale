import { supabase } from '@/lib/supabase/client';

// Helper: validate UUID
const isValidUUID = (uuid: string | null | undefined): boolean => {
  if (!uuid) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
};

// Get all products — accepts optional storeId to filter by branch
export const getAllProducts = async (storeId?: string | null) => {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (isValidUUID(storeId)) {
      query = query.eq('store_id', storeId!);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }

    return (data || []).map(p => ({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      price: p.price || 0,
      cost: p.cost || 0,
      stock: p.stock || 0,
      lowStockThreshold: p.low_stock_threshold || 0,
      storeId: p.store_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  } catch (err) {
    console.error('Caught exception in getAllProducts:', err);
    return [];
  }
};

// Create product
export const createProductSimple = async (product: {
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  lowStockThreshold: number;
  barcode?: string;
  storeId?: string | null;
}) => {
  if (!isValidUUID(product.storeId)) {
    throw new Error(
      'Cannot create product: a valid store_id is required. ' +
      'Make sure a store is selected before adding products.'
    );
  }

  const insertData = {
    sku: product.sku,
    barcode: product.barcode || `BC-${Date.now()}`,
    name: product.name,
    category: product.category,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    low_stock_threshold: product.lowStockThreshold,
    store_id: product.storeId,
  };

  const { data, error } = await supabase
    .from('products')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('Error creating product:', error);
    throw error;
  }

  return {
    id: data.id,
    sku: data.sku,
    barcode: data.barcode,
    name: data.name,
    category: data.category,
    price: data.price,
    cost: data.cost,
    stock: data.stock,
    lowStockThreshold: data.low_stock_threshold,
    storeId: data.store_id,
  };
};

// Update product
export const updateProductSimple = async (
  productId: string,
  updates: {
    name?: string;
    category?: string;
    price?: number;
    cost?: number;
    stock?: number;
    lowStockThreshold?: number;
    barcode?: string;
  }
) => {
  const updateData: any = {};
  if (updates.name !== undefined)              updateData.name                = updates.name;
  if (updates.category !== undefined)          updateData.category            = updates.category;
  if (updates.price !== undefined)             updateData.price               = updates.price;
  if (updates.cost !== undefined)              updateData.cost                = updates.cost;
  if (updates.stock !== undefined)             updateData.stock               = updates.stock;
  if (updates.lowStockThreshold !== undefined) updateData.low_stock_threshold = updates.lowStockThreshold;
  if (updates.barcode !== undefined)           updateData.barcode             = updates.barcode;

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    throw error;
  }

  return {
    id: data.id,
    sku: data.sku,
    barcode: data.barcode,
    name: data.name,
    category: data.category,
    price: data.price,
    cost: data.cost,
    stock: data.stock,
    lowStockThreshold: data.low_stock_threshold,
    storeId: data.store_id,
  };
};

// Delete product
export const deleteProduct = async (productId: string) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Error deleting product:', error);
    throw error;
  }

  return true;
};