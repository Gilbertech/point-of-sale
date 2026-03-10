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
// SETUP CHECKLIST in Supabase Dashboard:
//   1. Storage → New bucket → Name: "support-attachments" → ✅ Public bucket → Create
//   2. Run these RLS policies (already done if you ran the SQL):
//      CREATE POLICY "Allow uploads" ON storage.objects
//        FOR INSERT WITH CHECK (bucket_id = 'support-attachments');
//      CREATE POLICY "Allow reads" ON storage.objects
//        FOR SELECT USING (bucket_id = 'support-attachments');
//   3. support_tickets table needs attachments column:
//      ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS attachments text[] DEFAULT '{}';

const BUCKET = 'complaint-images';

async function uploadAttachment(file: File, ticketId: string): Promise<string | null> {
  try {
    const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path     = `${ticketId}/${safeName}`;

    console.log(`[Attachment] Uploading: ${file.name} → ${BUCKET}/${path}`);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      console.error('[Attachment] Upload FAILED:', uploadError.message, uploadError);
      return null;
    }

    console.log('[Attachment] Upload OK, path:', uploadData?.path);

    // Always use getPublicUrl — it never fails, just builds the URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData?.publicUrl ?? null;

    console.log('[Attachment] Public URL:', publicUrl);
    return publicUrl;

  } catch (e) {
    console.error('[Attachment] Exception during upload:', e);
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
  console.log('[createSupportTicket] Starting, files:', ticket.attachments?.length ?? 0);

  // ── Step 1: Insert ticket row to get its ID (used as storage folder name) ──
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
      attachments:    [],          // start empty, updated after uploads
    }])
    .select()
    .single();

  if (error) throw new Error(`Failed to create ticket: ${error.message}`);
  console.log('[createSupportTicket] Ticket inserted, id:', data.id);

  // ── Step 2: Upload files and collect public URLs ──
  const files = ticket.attachments ?? [];
  let savedUrls: string[] = [];

  if (files.length > 0) {
    console.log(`[createSupportTicket] Uploading ${files.length} file(s)…`);

    const results = await Promise.all(
      files.map(f => uploadAttachment(f, data.id))
    );

    savedUrls = results.filter((u): u is string => !!u);
    console.log('[createSupportTicket] Uploaded URLs:', savedUrls);

    if (savedUrls.length > 0) {
      // ── Step 3: Write URLs back to the ticket row ──
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ attachments: savedUrls })
        .eq('id', data.id);

      if (updateError) {
        // Don't throw — ticket was created, just log the attachment save failure
        console.error('[createSupportTicket] Failed to save attachment URLs:', updateError.message);
      } else {
        console.log('[createSupportTicket] Attachment URLs saved to DB ✓');
      }
    } else {
      console.warn('[createSupportTicket] All uploads failed — no URLs to save');
    }
  }

  return {
    id:           data.id,
    customerName: data.customer_name,
    customerPhone: data.customer_phone || '',
    subject:      data.subject,
    message:      data.message,
    category:     data.category,
    status:       data.status as 'open' | 'in-progress' | 'resolved',
    reply:        data.reply || null,
    // Return the URLs we actually saved, not the empty [] from initial insert
    attachments:  savedUrls,
    storeId:      data.store_id ?? null,
    createdAt:    new Date(data.created_at),
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