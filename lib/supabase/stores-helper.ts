import { supabase } from './client';

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreData {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
}

const mapStore = (s: any): Store => ({
  id: s.id,
  name: s.name,
  address: s.address ?? '',
  phone: s.phone ?? '',
  email: s.email ?? '',
  taxRate: s.tax_rate ?? 0.08,
  currency: s.currency ?? 'KES',
  isActive: s.is_active ?? true,
  createdAt: s.created_at,
  updatedAt: s.updated_at,
});

export const getAllStores = async (): Promise<Store[]> => {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching stores:', error);
    throw error;
  }
  return (data ?? []).map(mapStore);
};

export const getStoreById = async (id: string): Promise<Store | null> => {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching store:', error);
    return null;
  }
  return mapStore(data);
};

export const createStore = async (store: CreateStoreData): Promise<Store> => {
  const { data, error } = await supabase
    .from('stores')
    .insert([{
      name: store.name,
      address: store.address,
      phone: store.phone,
      email: store.email,
      tax_rate: store.taxRate,
      currency: store.currency,
      is_active: true,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating store:', error);
    throw new Error(`Failed to create branch: ${error.message}`);
  }
  return mapStore(data);
};

export const updateStore = async (
  id: string,
  updates: Partial<CreateStoreData & { isActive: boolean }>
): Promise<Store> => {
  const payload: any = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.address !== undefined) payload.address = updates.address;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.email !== undefined) payload.email = updates.email;
  if (updates.taxRate !== undefined) payload.tax_rate = updates.taxRate;
  if (updates.currency !== undefined) payload.currency = updates.currency;
  if (updates.isActive !== undefined) payload.is_active = updates.isActive;

  const { data, error } = await supabase
    .from('stores')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating store:', error);
    throw new Error(`Failed to update branch: ${error.message}`);
  }
  return mapStore(data);
};

export const deleteStore = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('stores')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting store:', error);
    throw new Error(`Failed to delete branch: ${error.message}`);
  }
};

export const toggleStoreActive = async (id: string, isActive: boolean): Promise<Store> => {
  return updateStore(id, { isActive });
};