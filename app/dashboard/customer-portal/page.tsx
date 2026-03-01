'use client';
// Place at: app/customer-portal/page.tsx  (or app/dashboard/customer-portal/page.tsx)
//
// ✅ STAFF-SIDE view — for cashiers, managers, admins to handle customer issues
// ✅ No login required — uses the existing staff session (useAuth)
// ✅ Sunrise theme — coral/amber/cream matching your CSS variables
// ✅ Tabs: Complaints | Inquiries
// ✅ Actions: view photo, reply, change status (open → in-progress → resolved → closed)

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context';
import {
  MessageSquare, Camera, CheckCircle2, Clock, XCircle,
  ChevronDown, RefreshCw, Send, User, AlertCircle,
  Search, Filter, Eye, MessageCircle, Package,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ─── Types ─────────────────────────────────────────────────────────────────────
type TabKey   = 'complaints' | 'inquiries';
type Status   = 'open' | 'in-progress' | 'resolved' | 'closed';
type Priority = 'low' | 'medium' | 'high';

interface Complaint {
  id:           string;
  customerId:   string;
  customerName: string;
  subject:      string;
  description:  string;
  category:     string;
  status:       Status;
  imageUrl:     string | null;
  adminReply:   string | null;
  storeId:      string | null;
  createdAt:    string;
}

interface Inquiry {
  id:           string;
  customerId:   string;
  customerName: string;
  subject:      string;
  message:      string;
  category:     string;
  priority:     Priority;
  status:       Status;
  adminReply:   string | null;
  storeId:      string | null;
  createdAt:    string;
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  open:          'bg-blue-100 text-blue-800',
  'in-progress': 'bg-yellow-100 text-yellow-800',
  resolved:      'bg-green-100 text-green-800',
  closed:        'bg-gray-100 text-gray-600',
};

const PRIORITY_BADGE: Record<string, string> = {
  low:    'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high:   'bg-red-100 text-red-800',
};

const STATUS_OPTIONS: Status[] = ['open', 'in-progress', 'resolved', 'closed'];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status.replace('-', ' ')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_BADGE[priority] ?? 'bg-muted text-muted-foreground'}`}>
      {priority}
    </span>
  );
}

// ─── Reply + Status panel (shared by complaint & inquiry) ──────────────────────
function ReplyPanel({
  id, table, currentStatus, currentReply,
  onSaved,
}: {
  id: string; table: 'complaints' | 'customer_inquiries';
  currentStatus: Status; currentReply: string | null;
  onSaved: () => void;
}) {
  const [reply,   setReply]   = useState(currentReply ?? '');
  const [status,  setStatus]  = useState<Status>(currentStatus);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const { error: err } = await supabase
        .from(table)
        .update({ status, admin_reply: reply || null })
        .eq('id', id);
      if (err) throw new Error(err.message);
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e?.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {/* Status selector */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
          Update Status
        </label>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-colors ${
                status === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50'
              }`}>
              {s.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Reply textarea */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
          Reply to Customer
        </label>
        <textarea
          rows={3}
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder="Type your reply… the customer will see this in their portal."
          className="w-full px-3 py-2 text-sm border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
          <Send className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save Reply & Status'}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function CustomerPortalStaffPage() {
  const { user }         = useAuth();
  const { currentStore } = useStore();

  const [tab,        setTab]        = useState<TabKey>('complaints');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [inquiries,  setInquiries]  = useState<Inquiry[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState<string>('all');
  const [expandedId,    setExpandedId]    = useState<string | null>(null);

  // ── Load data ───────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    try {
      const [compRes, inqRes] = await Promise.all([
        supabase
          .from('complaints')
          .select('*')
          .eq('store_id', currentStore.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('customer_inquiries')
          .select('*')
          .eq('store_id', currentStore.id)
          .order('created_at', { ascending: false }),
      ]);

      setComplaints((compRes.data || []).map((x: any) => ({
        id: x.id, customerId: x.customer_id, customerName: x.customer_name,
        subject: x.subject, description: x.description, category: x.category,
        status: x.status, imageUrl: x.image_url ?? null,
        adminReply: x.admin_reply ?? null, storeId: x.store_id,
        createdAt: x.created_at,
      })));

      setInquiries((inqRes.data || []).map((x: any) => ({
        id: x.id, customerId: x.customer_id, customerName: x.customer_name,
        subject: x.subject, message: x.message, category: x.category,
        priority: x.priority, status: x.status,
        adminReply: x.admin_reply ?? null, storeId: x.store_id,
        createdAt: x.created_at,
      })));
    } catch (e) { console.error('[CustomerPortalStaff]', e); }
    finally { setLoading(false); }
  }, [currentStore?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filtered = {
    complaints: complaints.filter(c =>
      (statusFilter === 'all' || c.status === statusFilter) &&
      (search === '' || c.subject.toLowerCase().includes(search.toLowerCase()) || c.customerName.toLowerCase().includes(search.toLowerCase()))
    ),
    inquiries: inquiries.filter(i =>
      (statusFilter === 'all' || i.status === statusFilter) &&
      (search === '' || i.subject.toLowerCase().includes(search.toLowerCase()) || i.customerName.toLowerCase().includes(search.toLowerCase()))
    ),
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = {
    totalComplaints: complaints.length,
    openComplaints:  complaints.filter(c => c.status === 'open').length,
    totalInquiries:  inquiries.length,
    openInquiries:   inquiries.filter(i => i.status === 'open').length,
    resolved:        [...complaints, ...inquiries].filter(x => x.status === 'resolved').length,
    pending:         [...complaints, ...inquiries].filter(x => x.status === 'open' || x.status === 'in-progress').length,
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading customer cases…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-primary" />
            Customer Cases
          </h1>
          <p className="text-muted-foreground mt-1">
            Showing data for: {currentStore?.name ?? 'All stores'}
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm" className="gap-2 border-border">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* ── Stat cards — same 6-col grid as worker management ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Complaints',      value: stats.totalComplaints, color: 'text-foreground' },
          { label: 'Open Complaints', value: stats.openComplaints,  color: 'text-destructive' },
          { label: 'Inquiries',       value: stats.totalInquiries,  color: 'text-foreground' },
          { label: 'Open Inquiries',  value: stats.openInquiries,   color: 'text-yellow-600' },
          { label: 'Resolved',        value: stats.resolved,        color: 'text-green-600'  },
          { label: 'Pending Action',  value: stats.pending,         color: 'text-primary'    },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs — same style as worker management ── */}
      <div className="flex border-b border-border gap-0 overflow-x-auto">
        {([
          { key: 'complaints', label: `Complaints`, icon: <Camera className="w-4 h-4" />,       count: stats.openComplaints },
          { key: 'inquiries',  label: `Inquiries`,  icon: <MessageSquare className="w-4 h-4" />, count: stats.openInquiries  },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setExpandedId(null); }}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.icon}{t.label}
            {t.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search + filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by customer or subject…"
            className="pl-9 border-border bg-card text-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 text-sm border border-border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.replace('-', ' ')}</option>
          ))}
        </select>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          COMPLAINTS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'complaints' && (
        <div className="space-y-3">
          {filtered.complaints.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="text-center py-14 text-muted-foreground">
                <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No complaints found</p>
                <p className="text-sm mt-1">
                  {statusFilter !== 'all' ? `No ${statusFilter} complaints.` : 'Customers haven\'t submitted any complaints yet.'}
                </p>
              </CardContent>
            </Card>
          ) : filtered.complaints.map(c => (
            <Card key={c.id} className={`bg-card border-border transition-shadow ${c.status === 'open' ? 'border-l-4 border-l-destructive' : c.status === 'in-progress' ? 'border-l-4 border-l-yellow-400' : ''}`}>
              <CardContent className="p-4">

                {/* Header row */}
                <div className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {c.customerName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{c.subject}</p>
                        <StatusBadge status={c.status} />
                        {c.adminReply && (
                          <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                            ✓ Replied
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <User className="w-3 h-3 inline mr-1" />{c.customerName}
                        <span className="mx-1.5">·</span>{c.category}
                        <span className="mx-1.5">·</span>{new Date(c.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${expandedId === c.id ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded details */}
                {expandedId === c.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">

                    {/* Description */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                      <p className="text-sm text-foreground leading-relaxed">{c.description}</p>
                    </div>

                    {/* Photo */}
                    {c.imageUrl && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Attached Photo</p>
                        <img
                          src={c.imageUrl}
                          alt="complaint photo"
                          className="w-full max-h-64 object-cover rounded-lg border border-border cursor-pointer"
                          onClick={() => window.open(c.imageUrl!, '_blank')}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Click to open full size</p>
                      </div>
                    )}

                    {/* Previous reply */}
                    {c.adminReply && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2.5 border border-border">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Your Previous Reply</p>
                        <p className="text-sm text-foreground">{c.adminReply}</p>
                      </div>
                    )}

                    {/* Reply panel */}
                    <ReplyPanel
                      id={c.id}
                      table="complaints"
                      currentStatus={c.status}
                      currentReply={c.adminReply}
                      onSaved={loadData}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          INQUIRIES TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'inquiries' && (
        <div className="space-y-3">
          {filtered.inquiries.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="text-center py-14 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No inquiries found</p>
                <p className="text-sm mt-1">
                  {statusFilter !== 'all' ? `No ${statusFilter} inquiries.` : "Customers haven't submitted any inquiries yet."}
                </p>
              </CardContent>
            </Card>
          ) : filtered.inquiries.map(i => (
            <Card key={i.id} className={`bg-card border-border transition-shadow ${i.status === 'open' ? 'border-l-4 border-l-blue-400' : i.priority === 'high' && i.status !== 'resolved' ? 'border-l-4 border-l-destructive' : ''}`}>
              <CardContent className="p-4">

                {/* Header row */}
                <div className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === i.id ? null : i.id)}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-accent/20 text-accent-foreground font-bold text-sm flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                      {i.customerName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{i.subject}</p>
                        <StatusBadge status={i.status} />
                        <PriorityBadge priority={i.priority} />
                        {i.adminReply && (
                          <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                            ✓ Replied
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <User className="w-3 h-3 inline mr-1" />{i.customerName}
                        <span className="mx-1.5">·</span>{i.category}
                        <span className="mx-1.5">·</span>{new Date(i.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${expandedId === i.id ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded */}
                {expandedId === i.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Message</p>
                      <p className="text-sm text-foreground leading-relaxed">{i.message}</p>
                    </div>

                    {i.adminReply && (
                      <div className="bg-muted/50 rounded-lg px-3 py-2.5 border border-border">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Your Previous Reply</p>
                        <p className="text-sm text-foreground">{i.adminReply}</p>
                      </div>
                    )}

                    <ReplyPanel
                      id={i.id}
                      table="customer_inquiries"
                      currentStatus={i.status}
                      currentReply={i.adminReply}
                      onSaved={loadData}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}