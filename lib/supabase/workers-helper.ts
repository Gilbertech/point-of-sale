// File: lib/supabase/workers-helper.ts
// FIXES:
// 1. createSalaryRecord now accepts + passes storeId (fixes NOT NULL constraint)
// 2. Announcement insert uses simple supabase insert (no pg_net)

import { supabase } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'manager' | 'cashier' | 'inventory_staff';
  department: string;
  salary: number;
  status: 'active' | 'inactive';
  joinDate: string;
  storeId: string | null;
  userId: string | null;
  createdAt: Date;
}

export interface SalaryRecord {
  id: string;
  workerId: string;
  month: string;
  amount: number;
  status: 'paid' | 'pending';
  paidDate: string | null;
  notes: string;
  storeId: string | null;
  createdAt: Date;
}

// ── Workers ───────────────────────────────────────────────────────────────────

export const getAllWorkers = async (): Promise<WorkerData[]> => {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .order('first_name', { ascending: true });

  if (error) {
    console.error('Error fetching workers:', error);
    throw error;
  }

  return (data || []).map(mapWorker);
};

export const createWorker = async (worker: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'manager' | 'cashier' | 'inventory_staff';
  department?: string;
  salary: number;
  status?: 'active' | 'inactive';
  joinDate?: string;
  storeId?: string | null;
}) => {
  const { data, error } = await supabase
    .from('workers')
    .insert([{
      first_name:  worker.firstName,
      last_name:   worker.lastName,
      email:       worker.email,
      phone:       worker.phone || null,
      role:        worker.role,
      department:  worker.department || null,
      salary:      worker.salary,
      status:      worker.status || 'active',
      join_date:   worker.joinDate || new Date().toISOString().split('T')[0],
      store_id:    worker.storeId || null,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating worker:', error);
    throw new Error(`Failed to create worker: ${error.message}`);
  }

  return mapWorker(data);
};

export const updateWorker = async (
  workerId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: 'manager' | 'cashier' | 'inventory_staff';
    department?: string;
    salary?: number;
    status?: 'active' | 'inactive';
    joinDate?: string;
    storeId?: string | null;
  }
) => {
  const updateData: Record<string, unknown> = {};
  if (updates.firstName  !== undefined) updateData.first_name  = updates.firstName;
  if (updates.lastName   !== undefined) updateData.last_name   = updates.lastName;
  if (updates.email      !== undefined) updateData.email       = updates.email;
  if (updates.phone      !== undefined) updateData.phone       = updates.phone;
  if (updates.role       !== undefined) updateData.role        = updates.role;
  if (updates.department !== undefined) updateData.department  = updates.department;
  if (updates.salary     !== undefined) updateData.salary      = updates.salary;
  if (updates.status     !== undefined) updateData.status      = updates.status;
  if (updates.joinDate   !== undefined) updateData.join_date   = updates.joinDate;
  if (updates.storeId    !== undefined) updateData.store_id    = updates.storeId;

  const { data, error } = await supabase
    .from('workers')
    .update(updateData)
    .eq('id', workerId)
    .select()
    .single();

  if (error) {
    console.error('Error updating worker:', error);
    throw error;
  }

  return mapWorker(data);
};

export const deleteWorker = async (workerId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('workers')
    .delete()
    .eq('id', workerId);

  if (error) {
    console.error('Error deleting worker:', error);
    throw error;
  }

  return true;
};

// ── Create worker WITH login account ─────────────────────────────────────────

export const createWorkerWithAccount = async (workerData: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'manager' | 'cashier' | 'inventory_staff';
  department?: string;
  salary: number;
  status?: 'active' | 'inactive';
  joinDate?: string;
  storeId?: string | null;
}): Promise<{ worker: WorkerData; defaultPassword: string }> => {

  // Generate a simple default password
  const defaultPassword = `${workerData.firstName.toLowerCase()}${Math.floor(1000 + Math.random() * 9000)}`;

  // Call API route which handles: auth user → app_users → workers (all in FK order)
  const res = await fetch('/api/users/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:     workerData.email,
      password:  defaultPassword,
      firstName: workerData.firstName,
      lastName:  workerData.lastName,
      role:      workerData.role,
      storeId:   workerData.storeId || null,
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    throw new Error(result.error || 'Failed to create worker account');
  }

  // The API route auto-created a workers row; fetch it to return
  const { data: workerRow, error: fetchError } = await supabase
    .from('workers')
    .select('*')
    .eq('email', workerData.email)
    .single();

  if (fetchError || !workerRow) {
    // Fallback: manually create the worker row if API didn't sync it
    const worker = await createWorker(workerData);
    return { worker, defaultPassword };
  }

  // Patch any extra fields not set by the API route
  const needsUpdate: Record<string, unknown> = {};
  if (workerData.phone)      needsUpdate.phone      = workerData.phone;
  if (workerData.department) needsUpdate.department = workerData.department;
  if (workerData.salary)     needsUpdate.salary     = workerData.salary;
  if (workerData.joinDate)   needsUpdate.join_date  = workerData.joinDate;

  if (Object.keys(needsUpdate).length > 0) {
    await supabase.from('workers').update(needsUpdate).eq('id', workerRow.id);
  }

  return { worker: mapWorker({ ...workerRow, ...needsUpdate }), defaultPassword };
};

// ── Salary Records ────────────────────────────────────────────────────────────

export const getSalaryRecordsByWorker = async (workerId: string): Promise<SalaryRecord[]> => {
  const { data, error } = await supabase
    .from('salary_records')
    .select('*')
    .eq('worker_id', workerId)
    .order('month', { ascending: false });

  if (error) {
    console.error('Error fetching salary records:', error);
    throw error;
  }

  return (data || []).map(mapSalaryRecord);
};

export const createSalaryRecord = async (record: {
  workerId: string;
  month: string;
  amount: number;
  status?: 'paid' | 'pending';
  notes?: string;
  storeId?: string | null;   // ← FIXED: was missing, caused NOT NULL constraint error
}): Promise<SalaryRecord> => {
  const { data, error } = await supabase
    .from('salary_records')
    .insert([{
      worker_id: record.workerId,
      month:     record.month,
      amount:    record.amount,
      status:    record.status || 'pending',
      notes:     record.notes || null,
      store_id:  record.storeId || null,  // ← FIXED
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating salary record:', error);
    throw new Error(`Failed to create salary record: ${error.message}`);
  }

  return mapSalaryRecord(data);
};

export const markSalaryPaid = async (recordId: string): Promise<SalaryRecord> => {
  const { data, error } = await supabase
    .from('salary_records')
    .update({
      status:    'paid',
      paid_date: new Date().toISOString().split('T')[0],
    })
    .eq('id', recordId)
    .select()
    .single();

  if (error) {
    console.error('Error marking salary paid:', error);
    throw error;
  }

  return mapSalaryRecord(data);
};

// ── Internal mappers ──────────────────────────────────────────────────────────

function mapWorker(x: Record<string, any>): WorkerData {
  return {
    id:         x.id,
    firstName:  x.first_name  ?? x.firstName  ?? '',
    lastName:   x.last_name   ?? x.lastName   ?? '',
    email:      x.email       ?? '',
    phone:      x.phone       ?? '',
    role:       x.role,
    department: x.department  ?? '',
    salary:     x.salary      ?? 0,
    status:     x.status      ?? 'active',
    joinDate:   x.join_date   ?? x.joinDate   ?? '',
    storeId:    x.store_id    ?? x.storeId    ?? null,
    userId:     x.user_id     ?? x.userId     ?? null,
    createdAt:  new Date(x.created_at ?? x.createdAt),
  };
}

function mapSalaryRecord(x: Record<string, any>): SalaryRecord {
  return {
    id:        x.id,
    workerId:  x.worker_id,
    month:     x.month,
    amount:    x.amount,
    status:    x.status,
    paidDate:  x.paid_date   ?? null,
    notes:     x.notes       ?? '',
    storeId:   x.store_id    ?? null,
    createdAt: new Date(x.created_at),
  };
}