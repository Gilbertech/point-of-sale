// supabase/functions/announcement-notify/index.ts
// ✅ Triggered by DB trigger on announcements INSERT
// ✅ Sends email to all workers in the same store (or all workers if no store)
// ✅ Deploy with: supabase functions deploy announcement-notify

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Email via Resend (free tier: 100 emails/day) ──────────────────────────────
// Alternative: use Supabase's built-in SMTP under Auth > Settings > SMTP
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const CATEGORY_EMOJI: Record<string, string> = {
  general: '📢', urgent: '🚨', policy: '📋', event: '🎉', training: '🎓',
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn('[announcement-notify] RESEND_API_KEY not set — skipping email to', to);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'POS System <noreply@yourdomain.com>', // ← change to your verified domain
      to:      [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[announcement-notify] Resend error:', err);
  }
}

serve(async (req) => {
  try {
    const body = await req.json();
    const { announcement_id, store_id, title, message, category, created_by } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get all workers in this store (or all workers if store_id is null)
    let query = supabase
      .from('workers')
      .select('id, first_name, last_name, email')
      .eq('status', 'active');

    if (store_id) query = query.eq('store_id', store_id);

    const { data: workers, error } = await query;
    if (error) throw error;
    if (!workers || workers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    const emoji = CATEGORY_EMOJI[category] ?? '📢';
    const subject = `${emoji} ${title}`;

    // Send email to each worker
    const emailPromises = workers
      .filter((w: any) => w.email)
      .map((w: any) =>
        sendEmail(
          w.email,
          subject,
          `
          <!DOCTYPE html>
          <html>
          <body style="font-family: 'DM Sans', Arial, sans-serif; background: #18181b; color: #e4e4e7; margin: 0; padding: 24px;">
            <div style="max-width: 520px; margin: 0 auto; background: #27272a; border-radius: 16px; border: 1px solid #3f3f46; overflow: hidden;">
              <div style="background: #10b981; padding: 20px 24px;">
                <p style="margin: 0; color: white; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">
                  ${emoji} ${(category ?? 'general').toUpperCase()} ANNOUNCEMENT
                </p>
              </div>
              <div style="padding: 24px;">
                <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: white;">${title}</h1>
                <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #a1a1aa;">${message}</p>
                <hr style="border: none; border-top: 1px solid #3f3f46; margin: 20px 0;" />
                <p style="margin: 0; font-size: 12px; color: #71717a;">
                  Posted by <strong style="color: #d4d4d8;">${created_by}</strong> · 
                  <a href="${SUPABASE_URL.replace('https://', 'https://your-app-domain.com/worker-portal')}" 
                     style="color: #10b981; text-decoration: none;">View in portal →</a>
                </p>
              </div>
            </div>
          </body>
          </html>
          `
        )
      );

    await Promise.allSettled(emailPromises);

    console.log(`[announcement-notify] Sent to ${workers.length} workers for announcement ${announcement_id}`);
    return new Response(JSON.stringify({ sent: workers.length }), { status: 200 });

  } catch (err) {
    console.error('[announcement-notify] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});