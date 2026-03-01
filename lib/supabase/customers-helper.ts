import { supabase } from './client';

// ✅ Get customers — filtered by storeId for multi-store isolation
export const getAllCustomers = async (storeId?: string | null) => {
  let query = supabase
    .from('customers')
    .select('*')
    .order('first_name');

  // ✅ Only show customers belonging to the current store
  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }

  return (data || []).map(c => ({
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    city: c.city,
    state: c.state,
    zipCode: c.postal_code,
    loyaltyPoints: c.loyalty_points || 0,
    totalSpent: c.total_spent || 0,
    storeId: c.store_id,
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
  }));
};

// ✅ Create customer — always tied to the current store
export const createCustomerSimple = async (customer: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  storeId: string; // ✅ required for multi-store
}) => {
  console.log('[DEBUG] Creating customer with data:', customer);

  const insertData = {
    first_name: customer.firstName,
    last_name: customer.lastName,
    email: customer.email || null,
    phone: customer.phone || null,
    address: customer.address || null,
    city: customer.city || null,
    state: customer.state || null,
    postal_code: customer.zipCode || null,
    store_id: customer.storeId,  // ✅ store-scoped
    loyalty_points: 0,
    total_spent: 0,
  };

  const { data, error } = await supabase
    .from('customers')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    throw new Error(`Failed to create customer: ${error.message || JSON.stringify(error)}`);
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone,
    address: data.address,
    city: data.city,
    state: data.state,
    zipCode: data.postal_code,
    loyaltyPoints: data.loyalty_points || 0,
    totalSpent: data.total_spent || 0,
    storeId: data.store_id,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

// Update customer
export const updateCustomerSimple = async (
  customerId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    loyaltyPoints?: number;
    totalSpent?: number;
  }
) => {
  const updateData: any = {};
  if (updates.firstName !== undefined)     updateData.first_name      = updates.firstName;
  if (updates.lastName !== undefined)      updateData.last_name       = updates.lastName;
  if (updates.email !== undefined)         updateData.email           = updates.email;
  if (updates.phone !== undefined)         updateData.phone           = updates.phone;
  if (updates.address !== undefined)       updateData.address         = updates.address;
  if (updates.city !== undefined)          updateData.city            = updates.city;
  if (updates.state !== undefined)         updateData.state           = updates.state;
  if (updates.zipCode !== undefined)       updateData.postal_code     = updates.zipCode;
  if (updates.loyaltyPoints !== undefined) updateData.loyalty_points  = updates.loyaltyPoints;
  if (updates.totalSpent !== undefined)    updateData.total_spent     = updates.totalSpent;

  const { data, error } = await supabase
    .from('customers')
    .update(updateData)
    .eq('id', customerId)
    .select()
    .single();

  if (error) {
    console.error('Error updating customer:', error);
    throw error;
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone,
    address: data.address,
    city: data.city,
    state: data.state,
    zipCode: data.postal_code,
    loyaltyPoints: data.loyalty_points || 0,
    totalSpent: data.total_spent || 0,
    storeId: data.store_id,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
};

// Delete customer — only call this from admin/super_admin roles (enforced in UI)
export const deleteCustomer = async (customerId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId);

  if (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }

  return true;
};