// File: lib/supabase/suppliers-helper.ts

import { supabase } from './client';

export const getAllSuppliers = async () => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (error) { console.error('Error fetching suppliers:', error); throw error; }
  return (data || []).map(mapSupplier);
};

export const createSupplier = async (supplier: {
  name: string; contactPerson: string; email?: string; phone?: string;
  address?: string; city?: string; country?: string; category: string;
  status: 'active' | 'inactive'; notes?: string; storeId?: string | null;
  website?: string; taxPin?: string; paymentTerms?: string;
  leadTimeDays?: number; minOrderValue?: number; rating?: number;
  bankName?: string; bankAccount?: string; bankBranch?: string;
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
      store_id: supplier.storeId || null,
      website: supplier.website || null,
      tax_pin: supplier.taxPin || null,
      payment_terms: supplier.paymentTerms || 'Net 30',
      lead_time_days: supplier.leadTimeDays ?? 7,
      min_order_value: supplier.minOrderValue ?? 0,
      rating: supplier.rating ?? 0,
      bank_name: supplier.bankName || null,
      bank_account: supplier.bankAccount || null,
      bank_branch: supplier.bankBranch || null,
    }])
    .select()
    .single();

  if (error) { console.error('Error creating supplier:', error); throw new Error(`Failed to create supplier: ${error.message}`); }
  return mapSupplier(data);
};

export const updateSupplier = async (supplierId: string, updates: {
  name?: string; contactPerson?: string; email?: string; phone?: string;
  address?: string; city?: string; country?: string; category?: string;
  status?: 'active' | 'inactive'; notes?: string; storeId?: string | null;
  totalSpent?: number; lastOrderDate?: string | null;
  website?: string; taxPin?: string; paymentTerms?: string;
  leadTimeDays?: number; minOrderValue?: number; rating?: number;
  bankName?: string; bankAccount?: string; bankBranch?: string;
}) => {
  const u: Record<string, unknown> = {};
  if (updates.name !== undefined)          u.name             = updates.name;
  if (updates.contactPerson !== undefined) u.contact_person   = updates.contactPerson;
  if (updates.email !== undefined)         u.email            = updates.email;
  if (updates.phone !== undefined)         u.phone            = updates.phone;
  if (updates.address !== undefined)       u.address          = updates.address;
  if (updates.city !== undefined)          u.city             = updates.city;
  if (updates.country !== undefined)       u.country          = updates.country;
  if (updates.category !== undefined)      u.category         = updates.category;
  if (updates.status !== undefined)        u.status           = updates.status;
  if (updates.notes !== undefined)         u.notes            = updates.notes;
  if (updates.storeId !== undefined)       u.store_id         = updates.storeId || null;
  if (updates.totalSpent !== undefined)    u.total_spent      = updates.totalSpent;
  if (updates.lastOrderDate !== undefined) u.last_order_date  = updates.lastOrderDate || null;
  if (updates.website !== undefined)       u.website          = updates.website || null;
  if (updates.taxPin !== undefined)        u.tax_pin          = updates.taxPin || null;
  if (updates.paymentTerms !== undefined)  u.payment_terms    = updates.paymentTerms;
  if (updates.leadTimeDays !== undefined)  u.lead_time_days   = updates.leadTimeDays;
  if (updates.minOrderValue !== undefined) u.min_order_value  = updates.minOrderValue;
  if (updates.rating !== undefined)        u.rating           = updates.rating;
  if (updates.bankName !== undefined)      u.bank_name        = updates.bankName || null;
  if (updates.bankAccount !== undefined)   u.bank_account     = updates.bankAccount || null;
  if (updates.bankBranch !== undefined)    u.bank_branch      = updates.bankBranch || null;

  const { data, error } = await supabase
    .from('suppliers').update(u).eq('id', supplierId).select().single();

  if (error) { console.error('Error updating supplier:', error); throw error; }
  return mapSupplier(data);
};

export const deleteSupplier = async (supplierId: string): Promise<boolean> => {
  const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
  if (error) { console.error('Error deleting supplier:', error); throw error; }
  return true;
};

function mapSupplier(s: Record<string, any>) {
  return {
    id: s.id, name: s.name, contactPerson: s.contact_person,
    email: s.email, phone: s.phone, address: s.address,
    city: s.city, country: s.country, category: s.category,
    status: s.status as 'active' | 'inactive',
    totalOrders: s.total_orders || 0, totalSpent: s.total_spent || 0,
    lastOrderDate: s.last_order_date || null, notes: s.notes || '',
    storeId: s.store_id || null, createdAt: new Date(s.created_at),
    // New fields
    website: s.website || '', taxPin: s.tax_pin || '',
    paymentTerms: s.payment_terms || 'Net 30',
    leadTimeDays: s.lead_time_days ?? 7,
    minOrderValue: s.min_order_value ?? 0,
    rating: s.rating ?? 0,
    bankName: s.bank_name || '', bankAccount: s.bank_account || '',
    bankBranch: s.bank_branch || '',
  };
}