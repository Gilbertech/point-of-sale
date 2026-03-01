import { supabase } from './client';

// ─── Stock Sessions ───────────────────────────────────────────────────────────

export const getAllStockSessions = async () => {
  const { data, error } = await supabase
    .from('stock_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[v0] Error fetching stock sessions:', error);
    throw error;
  }

  return (data || []).map(s => ({
    id: s.id,
    name: s.name,
    createdBy: s.created_by,
    storeId: s.store_id,
    status: s.status as 'in-progress' | 'completed',
    itemCount: s.item_count || 0,
    discrepancies: s.discrepancies || 0,
    createdAt: new Date(s.created_at),
    completedAt: s.completed_at ? new Date(s.completed_at) : null,
  }));
};

export const createStockSession = async (session: {
  name: string;
  createdBy: string;
  storeId: string; // ✅ required
}) => {
  const { data, error } = await supabase
    .from('stock_sessions')
    .insert([{
      name: session.name,
      created_by: session.createdBy,
      store_id: session.storeId, // ✅ saved to DB
      status: 'in-progress',
      item_count: 0,
      discrepancies: 0,
    }])
    .select()
    .single();

  if (error) {
    console.error('[v0] Error creating stock session:', error);
    throw new Error(`Failed to create stock session: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    createdBy: data.created_by,
    storeId: data.store_id,
    status: data.status as 'in-progress' | 'completed',
    itemCount: data.item_count || 0,
    discrepancies: data.discrepancies || 0,
    createdAt: new Date(data.created_at),
    completedAt: null,
  };
};

export const completeStockSession = async (
  sessionId: string,
  itemCount: number,
  discrepancies: number
): Promise<boolean> => {
  const { error } = await supabase
    .from('stock_sessions')
    .update({
      status: 'completed',
      item_count: itemCount,
      discrepancies,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[v0] Error completing stock session:', error);
    throw error;
  }

  return true;
};

// ─── Stock Count Items ────────────────────────────────────────────────────────

export const saveStockCountItems = async (
  sessionId: string,
  items: Array<{
    productId: string;
    systemCount: number;
    physicalCount: number;
    variance: number;
    notes?: string;
    storeId: string; // ✅ required
  }>
) => {
  const rows = items.map(item => ({
    session_id: sessionId,
    product_id: item.productId,
    system_count: item.systemCount,
    physical_count: item.physicalCount,
    variance: item.variance,
    notes: item.notes || null,
    store_id: item.storeId, // ✅ saved to DB
  }));

  const { data, error } = await supabase
    .from('stock_count_items')
    .insert(rows)
    .select();

  if (error) {
    console.error('[v0] Error saving stock count items:', error);
    throw new Error(`Failed to save stock count items: ${error.message}`);
  }

  return data;
};

export const getStockCountItems = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('stock_count_items')
    .select(`
      *,
      products (
        id,
        name,
        sku,
        category,
        stock
      )
    `)
    .eq('session_id', sessionId);

  if (error) {
    console.error('[v0] Error fetching stock count items:', error);
    throw error;
  }

  return (data || []).map(item => ({
    id: item.id,
    sessionId: item.session_id,
    productId: item.product_id,
    productName: item.products?.name || '',
    sku: item.products?.sku || '',
    category: item.products?.category || '',
    systemCount: item.system_count,
    physicalCount: item.physical_count,
    variance: item.variance,
    notes: item.notes || '',
  }));
};