'use client';
// app/dashboard/customers/page.tsx
// FIXES:
// 1. Complaints/Inquiries now query WITHOUT store_id filter first, then filter in JS
//    so nothing is missed due to store_id mismatch from customer portal submissions.
// 2. Customer creation syncs store_id to app_users table for User Management.
// 3. Complaints count badge shows on each customer row in Customers tab.
// 4. Support tickets from support_tickets table are also pulled into the complaints view.

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store-context';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search, Plus, Users, Star, TrendingUp, AlertCircle, X, Send,
  Camera, MessageSquare, CheckCircle2, Clock, XCircle, RefreshCw,
  Eye, Image as ImageIcon, Reply, User,
  AlertTriangle, Phone, Mail, MapPin, Edit2, Trash2,
  Building2, Paperclip, Ticket,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import {
  getAllCustomers, createCustomerSimple, updateCustomerSimple, deleteCustomer,
} from '@/lib/supabase/customers-helper';
import { supabase } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageTab = 'customers' | 'complaints' | 'inquiries' | 'tickets';

interface Complaint {
  id: string;
  customerId: string;
  customerName: string;
  subject: string;
  description: string;
  category: string;
  imageUrl: string | null;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  adminReply: string | null;
  reviewedBy: string | null;
  storeId: string | null;
  createdAt: string;
}

interface Inquiry {
  id: string;
  customerId: string;
  customerName: string;
  subject: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in-progress' | 'resolved';
  adminReply: string | null;
  reviewedBy: string | null;
  storeId: string | null;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  customerName: string;
  customerPhone: string;
  subject: string;
  message: string;
  category: string;
  status: 'open' | 'in-progress' | 'resolved';
  reply: string | null;
  storeId: string | null;
  attachments: string[];
  createdAt: string;
}

// ─── Status configs ───────────────────────────────────────────────────────────

const COMPLAINT_STATUS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  open:          { label: 'Open',        color: '#3b82f6', bg: '#eff6ff', icon: <Clock className="w-3 h-3" /> },
  'in-progress': { label: 'In Progress', color: '#f59e0b', bg: '#fffbeb', icon: <RefreshCw className="w-3 h-3" /> },
  resolved:      { label: 'Resolved',    color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle2 className="w-3 h-3" /> },
  closed:        { label: 'Closed',      color: '#6b7280', bg: '#f9fafb', icon: <XCircle className="w-3 h-3" /> },
};

const INQUIRY_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  open:          { label: 'Open',        color: '#3b82f6', bg: '#eff6ff' },
  'in-progress': { label: 'In Progress', color: '#f59e0b', bg: '#fffbeb' },
  resolved:      { label: 'Resolved',    color: '#10b981', bg: '#ecfdf5' },
};

const PRIORITY: Record<string, { color: string; bg: string }> = {
  low:    { color: '#10b981', bg: '#ecfdf5' },
  medium: { color: '#f59e0b', bg: '#fffbeb' },
  high:   { color: '#ef4444', bg: '#fef2f2' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusPill({ status, cfg }: { status: string; cfg: Record<string, any> }) {
  const s = cfg[status] ?? cfg['open'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 100,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {s.icon && s.icon} {s.label}
    </span>
  );
}

function PhotoModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1 text-sm">
          <X className="w-4 h-4" /> Close
        </button>
        <img src={url} alt="Complaint photo" className="w-full rounded-xl shadow-2xl" />
      </div>
    </div>
  );
}

// ─── Reply Panel ──────────────────────────────────────────────────────────────

function ReplyPanel({
  item, type, user, onClose, onSaved,
}: {
  item: Complaint | Inquiry;
  type: 'complaint' | 'inquiry';
  user: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reply, setReply]   = useState(item.adminReply ?? '');
  const [status, setStatus] = useState(item.status);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [photoOpen, setPhotoOpen] = useState(false);
  const complaint = type === 'complaint' ? (item as Complaint) : null;

  const statusOptions = type === 'complaint'
    ? ['open', 'in-progress', 'resolved', 'closed']
    : ['open', 'in-progress', 'resolved'];

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const table = type === 'complaint' ? 'complaints' : 'customer_inquiries';
      const { error: err } = await supabase.from(table).update({
        admin_reply: reply || null,
        status,
        reviewed_by: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      if (err) throw new Error(err.message);
      onSaved();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <>
      {complaint?.imageUrl && photoOpen && (
        <PhotoModal url={complaint.imageUrl} onClose={() => setPhotoOpen(false)} />
      )}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
          <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {type === 'complaint'
                  ? <Camera className="w-4 h-4 text-red-500" />
                  : <MessageSquare className="w-4 h-4 text-blue-500" />}
                <span className="font-bold text-foreground text-sm">{item.subject}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {item.customerName} · {item.category} · {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="bg-muted rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {type === 'complaint' ? 'Complaint Details' : 'Customer Message'}
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {type === 'complaint' ? (item as Complaint).description : (item as Inquiry).message}
              </p>
              {type === 'inquiry' && (
                <div className="flex gap-2 mt-3">
                  <span style={{
                    display: 'inline-flex', padding: '2px 8px', borderRadius: 100,
                    background: PRIORITY[(item as Inquiry).priority]?.bg,
                    color: PRIORITY[(item as Inquiry).priority]?.color,
                    fontSize: 11, fontWeight: 600,
                  }}>
                    {(item as Inquiry).priority} priority
                  </span>
                </div>
              )}
            </div>

            {complaint?.imageUrl && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">📸 Photo Evidence</p>
                <div className="relative rounded-xl overflow-hidden cursor-pointer border border-border group" onClick={() => setPhotoOpen(true)}>
                  <img src={complaint.imageUrl} alt="Complaint photo" className="w-full max-h-48 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
                      <Eye className="w-3 h-3" /> View full size
                    </div>
                  </div>
                </div>
              </div>
            )}

            {item.adminReply && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">
                  Previous Reply {item.reviewedBy && `· by ${item.reviewedBy}`}
                </p>
                <p className="text-sm text-foreground leading-relaxed">{item.adminReply}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Update Status</label>
              <div className="flex gap-2 flex-wrap">
                {statusOptions.map(s => {
                  const cfg = (type === 'complaint' ? COMPLAINT_STATUS : INQUIRY_STATUS)[s];
                  return (
                    <button key={s} onClick={() => setStatus(s as any)} style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `2px solid ${status === s ? cfg.color : '#e5e7eb'}`,
                      background: status === s ? cfg.bg : 'white',
                      color: status === s ? cfg.color : '#9ca3af',
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your Reply <span className="normal-case font-normal">(visible to customer in portal)</span>
              </label>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                rows={4}
                placeholder="Write your response to the customer..."
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>

          <div className="p-5 border-t border-border flex gap-3 shrink-0">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave} disabled={saving}>
              <Send className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save & Reply'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Support Ticket Reply Panel ───────────────────────────────────────────────

function TicketReplyPanel({
  ticket, user, onClose, onSaved,
}: {
  ticket: SupportTicket;
  user: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reply, setReply]   = useState(ticket.reply ?? '');
  const [status, setStatus] = useState(ticket.status);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const { error: err } = await supabase.from('support_tickets').update({
        reply: reply || null,
        status,
        updated_at: new Date().toISOString(),
      }).eq('id', ticket.id);
      if (err) throw new Error(err.message);
      onSaved();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <Ticket className="w-4 h-4 text-purple-500" />
              <span className="font-bold text-foreground text-sm">{ticket.subject}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {ticket.customerName} {ticket.customerPhone && `· ${ticket.customerPhone}`} · {ticket.category} · {new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="bg-muted rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ticket Message</p>
            <p className="text-sm text-foreground leading-relaxed">{ticket.message}</p>
          </div>

          {ticket.attachments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Attachments</p>
              <div className="grid grid-cols-3 gap-2">
                {ticket.attachments.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="rounded-lg overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full aspect-square object-cover hover:opacity-80 transition" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {ticket.reply && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Previous Reply</p>
              <p className="text-sm text-foreground leading-relaxed">{ticket.reply}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Update Status</label>
            <div className="flex gap-2 flex-wrap">
              {(['open', 'in-progress', 'resolved'] as const).map(s => {
                const cfg = INQUIRY_STATUS[s];
                return (
                  <button key={s} onClick={() => setStatus(s)} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `2px solid ${status === s ? cfg.color : '#e5e7eb'}`,
                    background: status === s ? cfg.bg : 'white',
                    color: status === s ? cfg.color : '#9ca3af',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Your Reply <span className="normal-case font-normal">(visible to customer)</span>
            </label>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={4}
              placeholder="Write your response to the customer..."
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-3 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave} disabled={saving}>
            <Send className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save & Reply'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { currentStore } = useStore();
  const { user } = useAuth();
  const currentStoreId = currentStore?.id ?? null;

  const [tab, setTab] = useState<PageTab>('customers');

  // ── Customer state ──
  const [customers, setCustomers]               = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [searchQuery, setSearchQuery]           = useState('');
  const [showForm, setShowForm]                 = useState(false);
  const [editingCustomer, setEditingCustomer]   = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zipCode: '',
  });

  // ── Complaint state ──
  const [complaints, setComplaints]               = useState<Complaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [complaintFilter, setComplaintFilter]     = useState<string>('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [compSearch, setCompSearch]               = useState('');

  // ── Inquiry state ──
  const [inquiries, setInquiries]               = useState<Inquiry[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [inquiryFilter, setInquiryFilter]       = useState<string>('all');
  const [selectedInquiry, setSelectedInquiry]   = useState<Inquiry | null>(null);
  const [inqSearch, setInqSearch]               = useState('');

  // ── Support Ticket state ──
  const [tickets, setTickets]               = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketFilter, setTicketFilter]     = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketSearch, setTicketSearch]     = useState('');

  // ── Load customers ──
  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const data = await getAllCustomers(currentStoreId);
      setCustomers(data);
    } catch (e) { console.error(e); }
    finally { setLoadingCustomers(false); }
  }, [currentStoreId]);

  // ── Load complaints ──
  // KEY FIX: fetch ALL complaints, then filter in JS by storeId
  // This catches complaints where store_id may be null or mismatched
  const loadComplaints = useCallback(async () => {
    setLoadingComplaints(true);
    try {
      // First try: fetch all complaints for this store
      let { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Complaints fetch error:', error);
        setComplaints([]);
        return;
      }

      console.log(`[Complaints] Total fetched from DB: ${data?.length ?? 0}`);

      // Filter in JS: show complaints that match currentStore OR have no store assigned
      const filtered = (data || []).filter(x =>
        !currentStoreId ||          // no store selected = show all
        !x.store_id ||              // complaint has no store = show it (catch-all)
        x.store_id === currentStoreId  // exact match
      );

      console.log(`[Complaints] After store filter: ${filtered.length}`);

      setComplaints(filtered.map(x => ({
        id: x.id,
        customerId: x.customer_id ?? '',
        customerName: x.customer_name ?? 'Unknown',
        subject: x.subject ?? '',
        description: x.description ?? '',
        category: x.category ?? 'General',
        imageUrl: x.image_url ?? null,
        status: x.status ?? 'open',
        adminReply: x.admin_reply ?? null,
        reviewedBy: x.reviewed_by ?? null,
        storeId: x.store_id ?? null,
        createdAt: x.created_at,
      })));
    } catch (e) {
      console.error('loadComplaints error:', e);
    } finally { setLoadingComplaints(false); }
  }, [currentStoreId]);

  // ── Load inquiries ──
  // Same fix: fetch all, filter in JS
  const loadInquiries = useCallback(async () => {
    setLoadingInquiries(true);
    try {
      let { data, error } = await supabase
        .from('customer_inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Inquiries fetch error:', error);
        setInquiries([]);
        return;
      }

      console.log(`[Inquiries] Total fetched from DB: ${data?.length ?? 0}`);

      const filtered = (data || []).filter(x =>
        !currentStoreId || !x.store_id || x.store_id === currentStoreId
      );

      setInquiries(filtered.map(x => ({
        id: x.id,
        customerId: x.customer_id ?? '',
        customerName: x.customer_name ?? 'Unknown',
        subject: x.subject ?? '',
        message: x.message ?? '',
        category: x.category ?? 'General',
        priority: x.priority ?? 'medium',
        status: x.status ?? 'open',
        adminReply: x.admin_reply ?? null,
        reviewedBy: x.reviewed_by ?? null,
        storeId: x.store_id ?? null,
        createdAt: x.created_at,
      })));
    } catch (e) {
      console.error('loadInquiries error:', e);
    } finally { setLoadingInquiries(false); }
  }, [currentStoreId]);

  // ── Load support tickets ──
  // KEY FIX: also pull support_tickets so staff sees them here
  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      let { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Support tickets fetch error:', error);
        setTickets([]);
        return;
      }

      console.log(`[Tickets] Total fetched from DB: ${data?.length ?? 0}`);

      const filtered = (data || []).filter((x: any) =>
        !currentStoreId || !x.store_id || x.store_id === currentStoreId
      );

      setTickets(filtered.map((t: any) => ({
        id: t.id,
        customerName: t.customer_name ?? 'Unknown',
        customerPhone: t.customer_phone ?? '',
        subject: t.subject ?? '',
        message: t.message ?? '',
        category: t.category ?? 'General',
        status: t.status ?? 'open',
        reply: t.reply ?? null,
        storeId: t.store_id ?? null,
        attachments: t.attachments ?? [],
        createdAt: t.created_at,
      })));
    } catch (e) {
      console.error('loadTickets error:', e);
    } finally { setLoadingTickets(false); }
  }, [currentStoreId]);

  // Load everything on mount and store change
  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadComplaints(); }, [loadComplaints]);
  useEffect(() => { loadInquiries(); }, [loadInquiries]);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleRefreshAll = () => {
    loadCustomers();
    loadComplaints();
    loadInquiries();
    loadTickets();
  };

  // ── Filtered lists ──
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      `${c.firstName} ${c.lastName} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const filteredComplaints = useMemo(() => {
    let res = complaints;
    if (complaintFilter !== 'all') res = res.filter(c => c.status === complaintFilter);
    if (compSearch) res = res.filter(c =>
      `${c.customerName} ${c.subject} ${c.category}`.toLowerCase().includes(compSearch.toLowerCase())
    );
    return res;
  }, [complaints, complaintFilter, compSearch]);

  const filteredInquiries = useMemo(() => {
    let res = inquiries;
    if (inquiryFilter !== 'all') res = res.filter(i => i.status === inquiryFilter);
    if (inqSearch) res = res.filter(i =>
      `${i.customerName} ${i.subject} ${i.category}`.toLowerCase().includes(inqSearch.toLowerCase())
    );
    return res;
  }, [inquiries, inquiryFilter, inqSearch]);

  const filteredTickets = useMemo(() => {
    let res = tickets;
    if (ticketFilter !== 'all') res = res.filter(t => t.status === ticketFilter);
    if (ticketSearch) res = res.filter(t =>
      `${t.customerName} ${t.subject} ${t.category}`.toLowerCase().includes(ticketSearch.toLowerCase())
    );
    return res;
  }, [tickets, ticketFilter, ticketSearch]);

  // ── Stats ──
  const stats = useMemo(() => ({
    total: customers.length,
    totalSpent: customers.reduce((s, c) => s + (c.totalSpent || 0), 0),
    totalPoints: customers.reduce((s, c) => s + (c.loyaltyPoints || 0), 0),
    openComplaints: complaints.filter(c => c.status === 'open').length,
    openInquiries: inquiries.filter(i => i.status === 'open').length,
    openTickets: tickets.filter(t => t.status === 'open').length,
    withPhoto: complaints.filter(c => c.imageUrl).length,
  }), [customers, complaints, inquiries, tickets]);

  // ── Customer form handlers ──
  const openNewForm = () => {
    setEditingCustomer(null);
    setFormData({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '' });
    setShowForm(true);
  };

  const openEditForm = (c: any) => {
    setEditingCustomer(c);
    setFormData({
      firstName: c.firstName || '', lastName: c.lastName || '',
      email: c.email || '', phone: c.phone || '',
      address: c.address || '', city: c.city || '',
      state: c.state || '', zipCode: c.zipCode || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStoreId) { alert('No branch selected.'); return; }
    try {
      if (editingCustomer) {
        await updateCustomerSimple(editingCustomer.id, formData);
        // Sync branch to app_users
        if (formData.email) {
          await supabase.from('app_users')
            .update({ store_id: currentStoreId })
            .eq('email', formData.email);
        }
      } else {
        await createCustomerSimple({ ...formData, storeId: currentStoreId });
        // FIX: Sync new customer into app_users so User Management sees branch
        if (formData.email) {
          await supabase.from('app_users').upsert({
            email: formData.email,
            first_name: formData.firstName,
            last_name: formData.lastName,
            role: 'customer',
            store_id: currentStoreId,
            is_active: true,
          }, { onConflict: 'email', ignoreDuplicates: false });
        }
      }
      setShowForm(false);
      setEditingCustomer(null);
      loadCustomers();
    } catch (e: any) { alert(`Failed: ${e?.message ?? e}`); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try { await deleteCustomer(id); loadCustomers(); }
    catch (e: any) { alert(`Failed: ${e?.message}`); }
  };

  const handleAssignBranch = async (customerId: string) => {
    if (!currentStoreId) { alert('Select a branch first.'); return; }
    const { error } = await supabase.from('customers')
      .update({ store_id: currentStoreId })
      .eq('id', customerId);
    if (!error) {
      await supabase.from('app_users')
        .update({ store_id: currentStoreId })
        .eq('id', customerId);
      loadCustomers();
    } else alert(`Failed: ${error.message}`);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* Reply panels */}
      {selectedComplaint && (
        <ReplyPanel
          item={selectedComplaint} type="complaint" user={user}
          onClose={() => setSelectedComplaint(null)}
          onSaved={() => { setSelectedComplaint(null); loadComplaints(); }}
        />
      )}
      {selectedInquiry && (
        <ReplyPanel
          item={selectedInquiry} type="inquiry" user={user}
          onClose={() => setSelectedInquiry(null)}
          onSaved={() => { setSelectedInquiry(null); loadInquiries(); }}
        />
      )}
      {selectedTicket && (
        <TicketReplyPanel
          ticket={selectedTicket} user={user}
          onClose={() => setSelectedTicket(null)}
          onSaved={() => { setSelectedTicket(null); loadTickets(); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {currentStore ? `Branch: ${currentStore.name}` : 'No branch selected'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRefreshAll}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button onClick={openNewForm} disabled={!currentStoreId} className="gap-2">
            <Plus className="w-4 h-4" /> Add Customer
          </Button>
        </div>
      </div>

      {!currentStore && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No branch selected. Please select a branch from the sidebar.</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Customers',       value: stats.total,                        color: 'text-foreground', icon: <Users className="w-4 h-4" /> },
          { label: 'Revenue',         value: formatCurrency(stats.totalSpent),   color: 'text-primary',    icon: <TrendingUp className="w-4 h-4" /> },
          { label: 'Loyalty Pts',     value: stats.totalPoints.toLocaleString(), color: 'text-yellow-600', icon: <Star className="w-4 h-4" /> },
          { label: 'Open Complaints', value: stats.openComplaints,               color: 'text-red-600',    icon: <Camera className="w-4 h-4" /> },
          { label: 'Open Inquiries',  value: stats.openInquiries,                color: 'text-blue-600',   icon: <MessageSquare className="w-4 h-4" /> },
          { label: 'Open Tickets',    value: stats.openTickets,                  color: 'text-purple-600', icon: <Ticket className="w-4 h-4" /> },
          { label: 'With Photos',     value: stats.withPhoto,                    color: 'text-orange-600', icon: <ImageIcon className="w-4 h-4" /> },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <span className={`${s.color} opacity-60`}>{s.icon}</span>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto">
        {([
          { key: 'customers',  label: 'Customers',      icon: <Users className="w-4 h-4" />,         badge: customers.length,      badgeColor: '' },
          { key: 'complaints', label: 'Complaints',     icon: <Camera className="w-4 h-4" />,         badge: stats.openComplaints,  badgeColor: 'bg-red-100 text-red-700' },
          { key: 'inquiries',  label: 'Inquiries',      icon: <MessageSquare className="w-4 h-4" />,  badge: stats.openInquiries,   badgeColor: 'bg-blue-100 text-blue-700' },
          { key: 'tickets',    label: 'Support Tickets',icon: <Ticket className="w-4 h-4" />,         badge: stats.openTickets,     badgeColor: 'bg-purple-100 text-purple-700' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon} {t.label}
            {t.badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                t.badgeColor || 'bg-muted text-muted-foreground'
              }`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════ CUSTOMERS TAB ══════════════════ */}
      {tab === 'customers' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Customer List</CardTitle>
              <CardDescription>{filteredCustomers.length} of {customers.length} customers</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCustomers ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr>
                        {['Name', 'Contact', 'City', 'Total Spent', 'Points', 'Branch', 'Activity', 'Actions'].map(h => (
                          <th key={h} className="py-3 px-3 font-semibold text-foreground text-left first:pl-4 last:text-center">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-muted-foreground">
                            {currentStore ? `No customers at ${currentStore.name}` : 'Select a branch to view customers'}
                          </td>
                        </tr>
                      ) : filteredCustomers.map(c => {
                        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
                        const custComplaints = complaints.filter(x => x.customerName.toLowerCase() === fullName);
                        const custInquiries  = inquiries.filter(x => x.customerName.toLowerCase() === fullName);
                        const custTickets    = tickets.filter(x => x.customerName.toLowerCase() === fullName);
                        const openCount      = custComplaints.filter(x => x.status === 'open').length
                                             + custInquiries.filter(x => x.status === 'open').length
                                             + custTickets.filter(x => x.status === 'open').length;
                        const totalActivity  = custComplaints.length + custInquiries.length + custTickets.length;

                        return (
                          <tr key={c.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                            <td className="py-3 px-3 pl-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                  {c.firstName?.[0]}{c.lastName?.[0]}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">{c.firstName} {c.lastName}</p>
                                  {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">{c.phone || '—'}</td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">{c.city || '—'}</td>
                            <td className="py-3 px-3 font-semibold text-sm">{formatCurrency(c.totalSpent || 0)}</td>
                            <td className="py-3 px-3">
                              <Badge variant="outline" className="text-xs">{c.loyaltyPoints || 0} pts</Badge>
                            </td>
                            <td className="py-3 px-3">
                              {c.storeId ? (
                                <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Linked</Badge>
                              ) : (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-xs h-6 px-2 gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                                  onClick={() => handleAssignBranch(c.id)}
                                >
                                  <Building2 className="w-3 h-3" /> Assign
                                </Button>
                              )}
                            </td>
                            {/* Activity column — complaints/inquiries/tickets for this customer */}
                            <td className="py-3 px-3">
                              {totalActivity > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {custComplaints.length > 0 && (
                                    <button
                                      onClick={() => { setTab('complaints'); setCompSearch(`${c.firstName} ${c.lastName}`); }}
                                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition"
                                    >
                                      <Camera className="w-3 h-3" />
                                      {custComplaints.filter(x=>x.status==='open').length > 0
                                        ? `${custComplaints.filter(x=>x.status==='open').length} open`
                                        : `${custComplaints.length}`}
                                    </button>
                                  )}
                                  {custInquiries.length > 0 && (
                                    <button
                                      onClick={() => { setTab('inquiries'); setInqSearch(`${c.firstName} ${c.lastName}`); }}
                                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      {custInquiries.filter(x=>x.status==='open').length > 0
                                        ? `${custInquiries.filter(x=>x.status==='open').length} open`
                                        : `${custInquiries.length}`}
                                    </button>
                                  )}
                                  {custTickets.length > 0 && (
                                    <button
                                      onClick={() => { setTab('tickets'); setTicketSearch(`${c.firstName} ${c.lastName}`); }}
                                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition"
                                    >
                                      <Ticket className="w-3 h-3" />
                                      {custTickets.filter(x=>x.status==='open').length > 0
                                        ? `${custTickets.filter(x=>x.status==='open').length} open`
                                        : `${custTickets.length}`}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditForm(c)}>
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDelete(c.id, `${c.firstName} ${c.lastName}`)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════ COMPLAINTS TAB ══════════════════ */}
      {tab === 'complaints' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search complaints…"
                value={compSearch}
                onChange={e => setCompSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'open', 'in-progress', 'resolved', 'closed'].map(f => (
                <button
                  key={f}
                  onClick={() => setComplaintFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    complaintFilter === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {f === 'all' ? `All (${complaints.length})` : `${COMPLAINT_STATUS[f]?.label} (${complaints.filter(c => c.status === f).length})`}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={loadComplaints}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {loadingComplaints ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : filteredComplaints.length === 0 ? (
            <Card>
              <CardContent className="text-center py-16 text-muted-foreground">
                <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No complaints found.</p>
                <p className="text-xs mt-1 opacity-70">
                  Total in database: {complaints.length} · Filtered to 0
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredComplaints.map(c => (
                <Card key={c.id} className={`border-border hover:shadow-sm transition-shadow ${!c.adminReply ? 'border-l-4 border-l-orange-400' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {c.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-bold text-foreground text-sm">{c.subject}</p>
                            {c.imageUrl && (
                              <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                                <ImageIcon className="w-3 h-3" /> Photo
                              </span>
                            )}
                            {!c.adminReply && (
                              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                                Awaiting reply
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            <span className="font-medium text-foreground">{c.customerName}</span>
                            {' · '}{c.category}
                            {' · '}{new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {!c.storeId && <span className="ml-1 text-orange-500">(no branch)</span>}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{c.description}</p>
                          {c.adminReply && (
                            <div className="mt-2.5 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                              <p className="text-xs text-primary font-semibold mb-0.5">
                                Your reply{c.reviewedBy ? ` · ${c.reviewedBy}` : ''}
                              </p>
                              <p className="text-xs text-foreground line-clamp-1">{c.adminReply}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusPill status={c.status} cfg={COMPLAINT_STATUS} />
                        <Button
                          size="sm"
                          variant={c.adminReply ? 'outline' : 'default'}
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => setSelectedComplaint(c)}
                        >
                          <Reply className="w-3.5 h-3.5" />
                          {c.adminReply ? 'Edit Reply' : 'Reply'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ INQUIRIES TAB ══════════════════ */}
      {tab === 'inquiries' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search inquiries…"
                value={inqSearch}
                onChange={e => setInqSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'open', 'in-progress', 'resolved'].map(f => (
                <button
                  key={f}
                  onClick={() => setInquiryFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    inquiryFilter === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {f === 'all' ? `All (${inquiries.length})` : `${INQUIRY_STATUS[f]?.label} (${inquiries.filter(i => i.status === f).length})`}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={loadInquiries}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {loadingInquiries ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : filteredInquiries.length === 0 ? (
            <Card>
              <CardContent className="text-center py-16 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No inquiries found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredInquiries.map(i => {
                const pc = PRIORITY[i.priority] ?? PRIORITY.medium;
                return (
                  <Card key={i.id} className={`border-border hover:shadow-sm transition-shadow ${!i.adminReply ? 'border-l-4 border-l-blue-400' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {i.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="font-bold text-foreground text-sm">{i.subject}</p>
                              <span style={{
                                display: 'inline-flex', padding: '2px 8px', borderRadius: 100,
                                background: pc.bg, color: pc.color, fontSize: 10, fontWeight: 600,
                              }}>
                                {i.priority}
                              </span>
                              {!i.adminReply && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                                  Awaiting reply
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              <span className="font-medium text-foreground">{i.customerName}</span>
                              {' · '}{i.category}
                              {' · '}{new Date(i.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{i.message}</p>
                            {i.adminReply && (
                              <div className="mt-2.5 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                                <p className="text-xs text-primary font-semibold mb-0.5">
                                  Your reply{i.reviewedBy ? ` · ${i.reviewedBy}` : ''}
                                </p>
                                <p className="text-xs text-foreground line-clamp-1">{i.adminReply}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <StatusPill status={i.status} cfg={INQUIRY_STATUS} />
                          <Button
                            size="sm"
                            variant={i.adminReply ? 'outline' : 'default'}
                            className="gap-1.5 h-8 text-xs"
                            onClick={() => setSelectedInquiry(i)}
                          >
                            <Reply className="w-3.5 h-3.5" />
                            {i.adminReply ? 'Edit Reply' : 'Reply'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ SUPPORT TICKETS TAB ══════════════════ */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets…"
                value={ticketSearch}
                onChange={e => setTicketSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'open', 'in-progress', 'resolved'].map(f => (
                <button
                  key={f}
                  onClick={() => setTicketFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                    ticketFilter === f
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {f === 'all' ? `All (${tickets.length})` : `${INQUIRY_STATUS[f]?.label} (${tickets.filter(t => t.status === f).length})`}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={loadTickets}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {loadingTickets ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="text-center py-16 text-muted-foreground">
                <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No support tickets found.</p>
                <p className="text-xs mt-1 opacity-70">Total in database: {tickets.length}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map(t => (
                <Card key={t.id} className={`border-border hover:shadow-sm transition-shadow ${!t.reply ? 'border-l-4 border-l-purple-400' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {t.customerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-bold text-foreground text-sm">{t.subject}</p>
                            {t.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                                <Paperclip className="w-3 h-3" /> {t.attachments.length}
                              </span>
                            )}
                            {!t.reply && (
                              <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                                Awaiting reply
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            <span className="font-medium text-foreground">{t.customerName}</span>
                            {t.customerPhone && ` · ${t.customerPhone}`}
                            {' · '}{t.category}
                            {' · '}{new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{t.message}</p>
                          {t.reply && (
                            <div className="mt-2.5 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                              <p className="text-xs text-primary font-semibold mb-0.5">Your reply</p>
                              <p className="text-xs text-foreground line-clamp-1">{t.reply}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusPill status={t.status} cfg={INQUIRY_STATUS} />
                        <Button
                          size="sm"
                          variant={t.reply ? 'outline' : 'default'}
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => setSelectedTicket(t)}
                        >
                          <Reply className="w-3.5 h-3.5" />
                          {t.reply ? 'Edit Reply' : 'Reply'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ ADD/EDIT MODAL ══════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
                {currentStore && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Branch: <span className="text-primary font-medium">{currentStore.name}</span>
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {['firstName', 'lastName'].map(k => (
                  <div key={k} className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {k === 'firstName' ? 'First Name *' : 'Last Name *'}
                    </label>
                    <Input
                      required
                      value={(formData as any)[k]}
                      onChange={e => setFormData(p => ({ ...p, [k]: e.target.value }))}
                      placeholder={k === 'firstName' ? 'Jane' : 'Doe'}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+254 700 000 000"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</label>
                <Input
                  value={formData.address}
                  onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                  placeholder="123 Main St"
                  className="h-9"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([['city', 'City'], ['state', 'State/County'], ['zipCode', 'ZIP/Postal']] as [string, string][]).map(([k, label]) => (
                  <div key={k} className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
                    <Input
                      value={(formData as any)[k]}
                      onChange={e => setFormData(p => ({ ...p, [k]: e.target.value }))}
                      placeholder={label}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" className="flex-1">{editingCustomer ? 'Save Changes' : 'Add Customer'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}