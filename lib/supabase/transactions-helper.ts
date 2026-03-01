import { supabase } from './client';

// Helper function to validate UUID format
const isValidUUID = (uuid: string | null | undefined): boolean => {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Get all transactions — now accepts an optional storeId to filter by branch
export const getAllTransactions = async (limit = 100, storeId?: string | null) => {
  try {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        transaction_items (
          id,
          product_id,
          product_name,
          quantity,
          price,
          subtotal
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // ✅ Filter by store when a valid storeId is provided
    if (isValidUUID(storeId)) {
      query = query.eq('store_id', storeId!);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return (data || []).map(t => ({
      id: t.id,
      transactionNumber: t.transaction_number,
      items: (t.transaction_items || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      subtotal: t.subtotal || 0,
      tax: t.tax || 0,
      discount: t.discount || 0,
      total: t.total || 0,
      paymentMethod: t.payment_method,
      customerId: t.customer_id,
      storeId: t.store_id,
      cashierId: t.cashier_id,
      notes: t.notes,
      createdAt: new Date(t.created_at),
      updatedAt: new Date(t.updated_at),
    }));
  } catch (err) {
    console.error('Caught exception in getAllTransactions:', err);
    return [];
  }
};

// Resolve a safe cashier_id that is guaranteed to exist in the users table,
// or null if no matching user can be found (avoids FK violation).
const resolveCashierId = async (candidateId?: string | null): Promise<string | null> => {
  let id = isValidUUID(candidateId) ? candidateId! : null;

  if (!id) {
    const { data: { user } } = await supabase.auth.getUser();
    id = user?.id && isValidUUID(user.id) ? user.id : null;
  }

  if (!id) return null;

  const { data: existingUser } = await supabase
    .from('app_users')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (!existingUser) {
    console.warn(`[DEBUG] cashier_id "${id}" not found in app_users — inserting with null`);
    return null;
  }

  return id;
};

// Create transaction with items
export const createTransactionSimple = async (transaction: {
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  customerId?: string | null;
  storeId?: string | null;
  cashierId?: string | null;
  notes?: string | null;
}) => {
  console.log('[DEBUG] Creating transaction with data:', transaction);

  const transactionNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const cashierId  = await resolveCashierId(transaction.cashierId);
  const customerId = isValidUUID(transaction.customerId) ? transaction.customerId! : null;
  const storeId    = isValidUUID(transaction.storeId)    ? transaction.storeId!    : null;

  console.log('[DEBUG] Resolved IDs:', { cashierId, customerId, storeId });

  const transactionData = {
    transaction_number: transactionNumber,
    subtotal: transaction.subtotal,
    tax: transaction.tax,
    discount: transaction.discount,
    total: transaction.total,
    payment_method: transaction.paymentMethod,
    customer_id: customerId,
    store_id: storeId,
    cashier_id: cashierId,
    notes: transaction.notes || null,
  };

  const { data: transactionRecord, error: transactionError } = await supabase
    .from('transactions')
    .insert([transactionData])
    .select()
    .single();

  if (transactionError) {
    console.error('Error creating transaction:', transactionError);
    throw new Error(`Failed to create transaction: ${transactionError.message}`);
  }

  const itemsData = transaction.items.map(item => ({
    transaction_id: transactionRecord.id,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal,
  }));

  const { data: itemsRecords, error: itemsError } = await supabase
    .from('transaction_items')
    .insert(itemsData)
    .select();

  if (itemsError) {
    console.error('Error creating transaction items:', itemsError);
    await supabase.from('transactions').delete().eq('id', transactionRecord.id);
    throw new Error(`Failed to create transaction items: ${itemsError.message}`);
  }

  return {
    id: transactionRecord.id,
    transactionNumber: transactionRecord.transaction_number,
    items: (itemsRecords || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
    })),
    subtotal: transactionRecord.subtotal || 0,
    tax: transactionRecord.tax || 0,
    discount: transactionRecord.discount || 0,
    total: transactionRecord.total || 0,
    paymentMethod: transactionRecord.payment_method,
    customerId: transactionRecord.customer_id,
    storeId: transactionRecord.store_id,
    cashierId: transactionRecord.cashier_id,
    notes: transactionRecord.notes,
    createdAt: new Date(transactionRecord.created_at),
    updatedAt: new Date(transactionRecord.updated_at),
  };
};

// Update transaction
export const updateTransactionSimple = async (
  transactionId: string,
  updates: {
    subtotal?: number;
    tax?: number;
    discount?: number;
    total?: number;
    paymentMethod?: string;
    customerId?: string | null;
    notes?: string | null;
  }
) => {
  const updateData: any = {};
  if (updates.subtotal !== undefined)     updateData.subtotal       = updates.subtotal;
  if (updates.tax !== undefined)          updateData.tax            = updates.tax;
  if (updates.discount !== undefined)     updateData.discount       = updates.discount;
  if (updates.total !== undefined)        updateData.total          = updates.total;
  if (updates.paymentMethod !== undefined) updateData.payment_method = updates.paymentMethod;
  if (updates.customerId !== undefined) {
    updateData.customer_id = isValidUUID(updates.customerId) ? updates.customerId : null;
  }
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { data, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', transactionId)
    .select(`
      *,
      transaction_items (
        id,
        product_id,
        product_name,
        quantity,
        price,
        subtotal
      )
    `)
    .single();

  if (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }

  return {
    id: data.id,
    transactionNumber: data.transaction_number,
    items: (data.transaction_items || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
    })),
    subtotal: data.subtotal || 0,
    tax: data.tax || 0,
    discount: data.discount || 0,
    total: data.total || 0,
    paymentMethod: data.payment_method,
    customerId: data.customer_id,
    storeId: data.store_id,
    cashierId: data.cashier_id,
    notes: data.notes,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

// Delete transaction
export const deleteTransaction = async (transactionId: string) => {
  const { error: itemsError } = await supabase
    .from('transaction_items')
    .delete()
    .eq('transaction_id', transactionId);

  if (itemsError) {
    console.error('Error deleting transaction items:', itemsError);
    throw itemsError;
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId);

  if (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }

  return true;
};