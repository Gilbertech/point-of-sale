// File: lib/supabase/suppliers-helper.ts

import { supabase } from './client';

export const getAllSuppliers = async () => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching suppliers:', error);
    throw error;
  }

  return (data || []).map(s => ({
    id: s.id,
    name: s.name,
    contactPerson: s.contact_person,
    email: s.email,
    phone: s.phone,
    address: s.address,
    city: s.city,
    country: s.country,
    category: s.category,
    status: s.status as 'active' | 'inactive',
    totalOrders: s.total_orders || 0,
    totalSpent: s.total_spent || 0,
    lastOrderDate: s.last_order_date || null,
    notes: s.notes || '',
    storeId: s.store_id || null,   // ← auto-detected store
    createdAt: new Date(s.created_at),
  }));
};

export const createSupplier = async (supplier: {
  name: string;
  contactPerson: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  category: string;
  status: 'active' | 'inactive';
  notes?: string;
  storeId?: string | null;
}) => {
  const { data, error } = await supabase
    .from('suppliers')
    .insert([{
      name: supplier.name,
      contact_person: supplier.contactPerson,
      email: supplier.email || null,
      phone: supplier.phone || null,
      address: supplier.address || null,
      city: supplier.city || null,
      country: supplier.country || null,
      category: supplier.category,
      status: supplier.status,
      total_orders: 0,
      total_spent: 0,
      notes: supplier.notes || null,
      store_id: supplier.storeId || null,   // ← persist store
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating supplier:', error);
    throw new Error(`Failed to create supplier: ${error.message}`);
  }

  return mapSupplier(data);
};

export const updateSupplier = async (
  supplierId: string,
  updates: {
    name?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    category?: string;
    status?: 'active' | 'inactive';
    notes?: string;
    storeId?: string | null;
    totalSpent?: number;
    lastOrderDate?: string | null;
  }
) => {
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined)          updateData.name            = updates.name;
  if (updates.contactPerson !== undefined) updateData.contact_person  = updates.contactPerson;
  if (updates.email !== undefined)         updateData.email           = updates.email;
  if (updates.phone !== undefined)         updateData.phone           = updates.phone;
  if (updates.address !== undefined)       updateData.address         = updates.address;
  if (updates.city !== undefined)          updateData.city            = updates.city;
  if (updates.country !== undefined)       updateData.country         = updates.country;
  if (updates.category !== undefined)      updateData.category        = updates.category;
  if (updates.status !== undefined)        updateData.status          = updates.status;
  if (updates.notes !== undefined)         updateData.notes           = updates.notes;
  if (updates.storeId !== undefined)       updateData.store_id        = updates.storeId || null;
  // Super admin editable
  if (updates.totalSpent !== undefined)    updateData.total_spent     = updates.totalSpent;
  if (updates.lastOrderDate !== undefined) updateData.last_order_date = updates.lastOrderDate || null;

  const { data, error } = await supabase
    .from('suppliers')
    .update(updateData)
    .eq('id', supplierId)
    .select()
    .single();

  if (error) {
    console.error('Error updating supplier:', error);
    throw error;
  }

  return mapSupplier(data);
};

export const deleteSupplier = async (supplierId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', supplierId);

  if (error) {
    console.error('Error deleting supplier:', error);
    throw error;
  }

  return true;
};

// ─── Internal mapper ──────────────────────────────────────────────────────────

function mapSupplier(s: Record<string, any>) {
  return {
    id: s.id,
    name: s.name,
    contactPerson: s.contact_person,
    email: s.email,
    phone: s.phone,
    address: s.address,
    city: s.city,
    country: s.country,
    category: s.category,
    status: s.status as 'active' | 'inactive',
    totalOrders: s.total_orders || 0,
    totalSpent: s.total_spent || 0,
    lastOrderDate: s.last_order_date || null,
    notes: s.notes || '',
    storeId: s.store_id || null,
    createdAt: new Date(s.created_at),
  };
}