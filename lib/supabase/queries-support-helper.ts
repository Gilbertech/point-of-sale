import { supabase } from './client';

// ─── Worker Queries ───────────────────────────────────────────────────────────

export const getAllWorkerQueries = async () => {
  const { data, error } = await supabase
    .from('worker_queries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching worker queries:', error); throw error; }

  return (data || []).map(q => ({
    id: q.id, workerId: q.worker_id, submittedBy: q.submitted_by,
    submittedByRole: q.submitted_by_role, subject: q.subject,
    message: q.message, category: q.category,
    priority: q.priority as 'low' | 'medium' | 'high',
    status: q.status as 'open' | 'in-progress' | 'resolved',
    adminReply: q.admin_reply || null,
    resolvedAt: q.resolved_at ? new Date(q.resolved_at) : null,
    createdAt: new Date(q.created_at), storeId: q.store_id ?? null,
  }));
};

export const getWorkerQueriesByWorker = async (workerId: string) => {
  const { data, error } = await supabase
    .from('worker_queries').select('*').eq('worker_id', workerId)
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching worker queries:', error); throw error; }

  return (data || []).map(q => ({
    id: q.id, workerId: q.worker_id, submittedBy: q.submitted_by,
    submittedByRole: q.submitted_by_role, subject: q.subject,
    message: q.message, category: q.category,
    priority: q.priority as 'low' | 'medium' | 'high',
    status: q.status as 'open' | 'in-progress' | 'resolved',
    adminReply: q.admin_reply || null,
    resolvedAt: q.resolved_at ? new Date(q.resolved_at) : null,
    createdAt: new Date(q.created_at), storeId: q.store_id ?? null,
  }));
};

export const createWorkerQuery = async (query: {
  workerId: string; submittedBy: string; submittedByRole: string;
  subject: string; message: string; category: string;
  priority: 'low' | 'medium' | 'high'; storeId: string;
}) => {
  const { data, error } = await supabase
    .from('worker_queries')
    .insert([{
      worker_id: query.workerId, submitted_by: query.submittedBy,
      submitted_by_role: query.submittedByRole, subject: query.subject,
      message: query.message, category: query.category,
      priority: query.priority, status: 'open', store_id: query.storeId,
    }])
    .select().single();

  if (error) { throw new Error(`Failed to create query: ${error.message}`); }

  return {
    id: data.id, workerId: data.worker_id, submittedBy: data.submitted_by,
    submittedByRole: data.submitted_by_role, subject: data.subject,
    message: data.message, category: data.category,
    priority: data.priority as 'low' | 'medium' | 'high',
    status: data.status as 'open' | 'in-progress' | 'resolved',
    adminReply: data.admin_reply || null, resolvedAt: null,
    createdAt: new Date(data.created_at), storeId: data.store_id ?? null,
  };
};

export const replyToWorkerQuery = async (queryId: string, reply: string): Promise<boolean> => {
  const { error } = await supabase.from('worker_queries')
    .update({ admin_reply: reply, status: 'in-progress' }).eq('id', queryId);
  if (error) throw error;
  return true;
};

export const resolveWorkerQuery = async (queryId: string): Promise<boolean> => {
  const { error } = await supabase.from('worker_queries')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', queryId);
  if (error) throw error;
  return true;
};

// ─── Attachment Upload ────────────────────────────────────────────────────────
//
// ONE-TIME SETUP in Supabase Dashboard:
//   Storage → New bucket → Name: "support-attachments" → ✅ Public bucket → Create
//
// The support_tickets table also needs an attachments column:
//   ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT '{}';

const BUCKET = 'support-attachments';

async function uploadAttachment(file: File, ticketId: string): Promise<string | null> {
  try {
    const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path     = `${ticketId}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      console.error('[Attachment] Upload failed:', uploadError.message);
      return null;
    }

    // Always store the full public URL — never just the path
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    console.log('[Attachment] Uploaded OK:', data?.publicUrl);
    return data?.publicUrl ?? null;

  } catch (e) {
    console.error('[Attachment] Exception:', e);
    return null;
  }
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export const getAllSupportTickets = async () => {
  const { data, error } = await supabase
    .from('support_tickets').select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching support tickets:', error); throw error; }

  return (data || []).map(t => ({
    id: t.id, customerName: t.customer_name, customerPhone: t.customer_phone || '',
    subject: t.subject, message: t.message, category: t.category,
    status: t.status as 'open' | 'in-progress' | 'resolved',
    reply: t.reply || null,
    attachments: Array.isArray(t.attachments) ? t.attachments : [],
    storeId: t.store_id ?? null, createdAt: new Date(t.created_at),
  }));
};

export const createSupportTicket = async (ticket: {
  customerName:  string;
  customerPhone?: string;
  subject:       string;
  message:       string;
  category:      string;
  storeId:       string;
  attachments?:  File[];
}) => {
  // Step 1: Insert ticket to get its ID (used as storage folder)
  const { data, error } = await supabase
    .from('support_tickets')
    .insert([{
      customer_name:  ticket.customerName,
      customer_phone: ticket.customerPhone || null,
      subject:        ticket.subject,
      message:        ticket.message,
      category:       ticket.category,
      status:         'open',
      store_id:       ticket.storeId,
      attachments:    [],
    }])
    .select().single();

  if (error) throw new Error(`Failed to create ticket: ${error.message}`);

  // Step 2: Upload files and collect public URLs
  const files = ticket.attachments ?? [];
  if (files.length > 0) {
    const results  = await Promise.all(files.map(f => uploadAttachment(f, data.id)));
    const urls     = results.filter((u): u is string => !!u);

    if (urls.length > 0) {
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ attachments: urls })
        .eq('id', data.id);

      if (updateError) {
        console.error('[Attachment] Failed to save URLs:', updateError.message);
      }
    }
  }

  return {
    id: data.id, customerName: data.customer_name, customerPhone: data.customer_phone || '',
    subject: data.subject, message: data.message, category: data.category,
    status: data.status as 'open' | 'in-progress' | 'resolved',
    reply: data.reply || null,
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    storeId: data.store_id ?? null, createdAt: new Date(data.created_at),
  };
};

export const replyToSupportTicket = async (ticketId: string, reply: string): Promise<boolean> => {
  const { error } = await supabase.from('support_tickets')
    .update({ reply, status: 'in-progress' }).eq('id', ticketId);
  if (error) throw error;
  return true;
};

export const resolveSupportTicket = async (ticketId: string): Promise<boolean> => {
  const { error } = await supabase.from('support_tickets')
    .update({ status: 'resolved' }).eq('id', ticketId);
  if (error) throw error;
  return true;
};