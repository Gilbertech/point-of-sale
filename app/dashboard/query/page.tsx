'use client';
// app/dashboard/query/page.tsx

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, X, Send, CheckCircle2, Clock,
  AlertCircle, MessageCircleQuestion, User, LogOut, ShoppingBag,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context'; // ✅
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { createSupportTicket } from '@/lib/supabase/queries-support-helper';

type Priority    = 'low' | 'medium' | 'high';
type QueryStatus = 'open' | 'in-progress' | 'resolved';

interface WorkerQuery {
  id: string;
  workerId: string;
  submittedBy: string;
  submittedByRole: string;
  subject: string;
  message: string;
  category: string;
  priority: Priority;
  status: QueryStatus;
  adminReply: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

interface SupportTicket {
  id: string;
  customerName: string;
  customerPhone: string;
  subject: string;
  message: string;
  category: string;
  status: QueryStatus;
  reply: string | null;
  createdAt: Date;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low:    'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high:   'bg-red-100 text-red-800',
};
const STATUS_COLORS: Record<QueryStatus, string> = {
  open:          'bg-blue-100 text-blue-800',
  'in-progress': 'bg-yellow-100 text-yellow-800',
  resolved:      'bg-green-100 text-green-800',
};
const STATUS_ICONS: Record<QueryStatus, React.ReactNode> = {
  open:          <AlertCircle  className="w-3 h-3" />,
  'in-progress': <Clock        className="w-3 h-3" />,
  resolved:      <CheckCircle2 className="w-3 h-3" />,
};

const WORKER_CATEGORIES   = ['Payroll', 'Leave', 'Technical', 'Scheduling', 'Complaint', 'Other'];
const CUSTOMER_CATEGORIES = ['Receipt Issue', 'Refund', 'Returns', 'Loyalty Program', 'Product Quality', 'Order Issue', 'Other'];

// ─── Customer Submit Modal ─────────────────────────────────────────────────────
function CustomerQueryModal({ user, storeId, onClose, onSuccess }: {
  user: any;
  storeId: string; // ✅
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ subject: '', category: CUSTOMER_CATEGORIES[0], message: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.message) { setError('Subject and message are required.'); return; }
    setSaving(true); setError('');
    try {
      await createSupportTicket({
        customerName:  `${user.firstName} ${user.lastName}`.trim(),
        customerPhone: form.phone || '',
        subject:       form.subject,
        category:      form.category,
        message:       form.message,
        storeId,       // ✅ auto-injected
      });
      onSuccess(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Submit a Support Query</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Phone <span className="font-normal text-xs">(optional)</span></label>
              <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+254 7XX XXX XXX" className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Subject *</label>
              <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="e.g. Issue with my receipt" className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                {CUSTOMER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Message *</label>
              <textarea rows={4} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Describe your issue in detail..." className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Send className="w-4 h-4" />{saving ? 'Submitting...' : 'Submit Query'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Worker Submit Modal ───────────────────────────────────────────────────────
function WorkerQueryModal({ user, storeId, onClose, onSuccess }: {
  user: any;
  storeId: string; // ✅
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ subject: '', category: WORKER_CATEGORIES[0], message: '', priority: 'medium' as Priority });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const needsWorkerLookup = ['cashier', 'inventory_staff', 'manager'].includes(user.role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.message) { setError('Subject and message are required.'); return; }
    setSaving(true); setError('');

    try {
      let workerIdToUse: string = user.id;

      if (needsWorkerLookup) {
        const { data: workerRow } = await supabase
          .from('workers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (workerRow?.id) workerIdToUse = workerRow.id;
      }

      const { error: err } = await supabase.from('worker_queries').insert([{
        worker_id:         workerIdToUse,
        submitted_by:      `${user.firstName} ${user.lastName}`.trim(),
        submitted_by_role: user.role,
        subject:           form.subject,
        message:           form.message,
        category:          form.category,
        priority:          form.priority,
        status:            'open',
        store_id:          storeId, // ✅ auto-injected
      }]);

      if (err) throw new Error(err.message);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit query.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Submit a Query</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="bg-muted rounded-lg px-3 py-2.5 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Subject *</label>
              <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="e.g. Payroll discrepancy" className="border-border bg-input text-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                  {WORKER_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Priority</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value as Priority)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Message *</label>
              <textarea rows={4} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Describe your query in detail..." className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Send className="w-4 h-4" />{saving ? 'Submitting...' : 'Submit Query'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function QueryPage() {
  const { user, logout } = useAuth();
  const { currentStore } = useStore(); // ✅
  const router = useRouter();

  const isAdmin    = user?.role === 'super_admin' || user?.role === 'admin';
  const isManager  = user?.role === 'manager';
  const isCustomer = user?.role === 'customer';
  const canSeeAll  = isAdmin || isManager;
  const canResolve = isAdmin;

  const [queries,      setQueries]      = useState<WorkerQuery[]>([]);
  const [myTickets,    setMyTickets]    = useState<SupportTicket[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedQ,    setSelectedQ]    = useState<WorkerQuery | null>(null);
  const [selectedT,    setSelectedT]    = useState<SupportTicket | null>(null);
  const [showModal,    setShowModal]    = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | QueryStatus>('all');
  const [reply,        setReply]        = useState('');
  const [replying,     setReplying]     = useState(false);
  const [resolving,    setResolving]    = useState(false);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isCustomer) {
        const fullName = `${user.firstName} ${user.lastName}`.trim();
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('customer_name', fullName)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setMyTickets((data || []).map((t: any) => ({
          id: t.id, customerName: t.customer_name, customerPhone: t.customer_phone || '',
          subject: t.subject, message: t.message, category: t.category,
          status: t.status as QueryStatus, reply: t.reply ?? null, createdAt: new Date(t.created_at),
        })));
      } else if (canSeeAll) {
        const { data, error } = await supabase
          .from('worker_queries')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setQueries(mapWorkerRows(data || []));
      } else {
        let workerIdFilter = user.id;
        const { data: workerRow } = await supabase
          .from('workers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (workerRow?.id) workerIdFilter = workerRow.id;

        const { data, error } = await supabase
          .from('worker_queries')
          .select('*')
          .eq('worker_id', workerIdFilter)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setQueries(mapWorkerRows(data || []));
      }
    } catch (err) {
      console.error('Error loading queries:', err);
    } finally {
      setLoading(false);
    }
  };

  const mapWorkerRows = (data: any[]): WorkerQuery[] => data.map(q => ({
    id: q.id, workerId: q.worker_id,
    submittedBy: q.submitted_by, submittedByRole: q.submitted_by_role,
    subject: q.subject, message: q.message, category: q.category,
    priority: q.priority as Priority, status: q.status as QueryStatus,
    adminReply: q.admin_reply ?? null,
    resolvedAt: q.resolved_at ? new Date(q.resolved_at) : null,
    createdAt: new Date(q.created_at),
  }));

  const handleReply = async () => {
    if (!selectedQ || !reply.trim()) return;
    setReplying(true);
    try {
      const { error } = await supabase
        .from('worker_queries')
        .update({ admin_reply: reply, status: 'in-progress' })
        .eq('id', selectedQ.id);
      if (error) throw error;
      setSelectedQ(prev => prev ? { ...prev, adminReply: reply, status: 'in-progress' } : prev);
      setReply('');
      await loadData();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally { setReplying(false); }
  };

  const handleResolve = async (id: string) => {
    setResolving(true);
    try {
      const { error } = await supabase
        .from('worker_queries')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setSelectedQ(prev => prev?.id === id ? { ...prev, status: 'resolved' } : prev);
      await loadData();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally { setResolving(false); }
  };

  const filteredQueries = useMemo(() => {
    let res = [...queries];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      res = res.filter(i => i.subject.toLowerCase().includes(q) || i.submittedBy.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') res = res.filter(q => q.status === filterStatus);
    return res;
  }, [queries, searchQuery, filterStatus]);

  const filteredTickets = useMemo(() => {
    let res = [...myTickets];
    if (searchQuery) { const q = searchQuery.toLowerCase(); res = res.filter(t => t.subject.toLowerCase().includes(q)); }
    if (filterStatus !== 'all') res = res.filter(t => t.status === filterStatus);
    return res;
  }, [myTickets, searchQuery, filterStatus]);

  const stats = useMemo(() => {
    const src = isCustomer ? myTickets : queries;
    return {
      open:       src.filter(q => q.status === 'open').length,
      inProgress: src.filter(q => q.status === 'in-progress').length,
      resolved:   src.filter(q => q.status === 'resolved').length,
    };
  }, [queries, myTickets, isCustomer]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Customer portal ──────────────────────────────────────────────────────────
  if (isCustomer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
        <header className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-none">POS System</p>
                <p className="text-xs text-muted-foreground mt-0.5">Customer Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {user!.firstName[0]}{user!.lastName[0]}
                </div>
                <span className="text-sm text-foreground font-medium">{user!.firstName} {user!.lastName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { logout(); router.replace('/login'); }} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <LogOut className="w-4 h-4" /> Sign Out
              </Button>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-white rounded-2xl border border-border p-5 flex items-center justify-between gap-4 shadow-sm">
            <div>
              <h1 className="text-xl font-bold text-foreground">Hello, {user!.firstName} 👋</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Submit support queries and track their progress.</p>
            </div>
            <Button
              onClick={() => setShowModal(true)}
              disabled={!currentStore}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              <Plus className="w-4 h-4" /> New Query
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Open',        value: stats.open,       color: 'text-blue-600',   bg: 'bg-blue-50' },
              { label: 'In Progress', value: stats.inProgress, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Resolved',    value: stats.resolved,   color: 'text-green-600',  bg: 'bg-green-50' },
            ].map(s => (
              <Card key={s.label} className={`${s.bg} border-0 shadow-sm`}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">My Support Tickets</h2>
            {filteredTickets.length === 0 ? (
              <Card className="bg-white border-border shadow-sm">
                <CardContent className="text-center py-14 space-y-3">
                  <MessageCircleQuestion className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-muted-foreground text-sm">No queries yet.</p>
                  <Button variant="outline" size="sm" onClick={() => setShowModal(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Submit your first query
                  </Button>
                </CardContent>
              </Card>
            ) : filteredTickets.map(t => (
              <Card key={t.id} onClick={() => setSelectedT(selectedT?.id === t.id ? null : t)}
                className={`bg-white cursor-pointer hover:shadow-sm transition-all ${selectedT?.id === t.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground truncate">{t.subject}</p>
                    <Badge className={`${STATUS_COLORS[t.status]} flex items-center gap-1 text-xs shrink-0`}>{STATUS_ICONS[t.status]}{t.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.message}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="outline">{t.category}</Badge>
                    <span>{t.createdAt.toLocaleDateString()}</span>
                  </div>
                  {selectedT?.id === t.id && (
                    <div className="pt-3 mt-2 border-t border-border space-y-3">
                      <div className="bg-muted rounded-xl p-3">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Your message</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{t.message}</p>
                      </div>
                      {t.reply ? (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                          <p className="text-xs text-primary font-semibold mb-1">Support Reply</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{t.reply}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-xl p-3">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          No reply yet — our support team will get back to you soon.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
        {showModal && currentStore && (
          <CustomerQueryModal
            user={user}
            storeId={currentStore.id} // ✅
            onClose={() => setShowModal(false)}
            onSuccess={loadData}
          />
        )}
      </div>
    );
  }

  // ── Staff / Admin layout ─────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <MessageCircleQuestion className="w-8 h-8 text-primary" />
            {canSeeAll ? 'Worker Queries' : 'My Queries'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {canSeeAll
              ? 'Staff support requests — customer tickets are in the Support page'
              : 'Submit and track your queries to management'}
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          disabled={!currentStore}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> New Query
        </Button>
      </div>

      {!currentStore && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No store selected. Please select a branch from the sidebar.</AlertDescription>
        </Alert>
      )}

      {canSeeAll && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Open',        value: stats.open,       color: 'text-blue-600',   bg: 'bg-blue-50',   icon: <AlertCircle  className="h-5 w-5 text-blue-600" /> },
            { label: 'In Progress', value: stats.inProgress, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: <Clock        className="h-5 w-5 text-yellow-600" /> },
            { label: 'Resolved',    value: stats.resolved,   color: 'text-green-600',  bg: 'bg-green-50',  icon: <CheckCircle2 className="h-5 w-5 text-green-600" /> },
          ].map((m, i) => (
            <Card key={i} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
                <div className={`w-9 h-9 rounded-xl ${m.bg} flex items-center justify-center`}>{m.icon}</div>
              </CardHeader>
              <CardContent><div className={`text-2xl font-bold ${m.color}`}>{m.value}</div></CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-card border-border">
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={canSeeAll ? 'Search by subject or staff name...' : 'Search your queries...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 border-border bg-input text-foreground"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'open', 'in-progress', 'resolved'] as const).map(s => (
              <Button key={s} size="sm" variant={filterStatus === s ? 'default' : 'outline'} onClick={() => setFilterStatus(s)} className="capitalize">{s}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${selectedQ ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-3">
          {filteredQueries.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="text-center py-10 text-muted-foreground">
                {queries.length === 0 ? 'No queries yet. Click "New Query" to submit one.' : 'No queries match your filters.'}
              </CardContent>
            </Card>
          ) : filteredQueries.map(q => (
            <Card key={q.id} onClick={() => setSelectedQ(selectedQ?.id === q.id ? null : q)}
              className={`bg-card cursor-pointer hover:shadow-sm transition-all ${selectedQ?.id === q.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{q.subject}</p>
                    {canSeeAll && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <User className="w-3 h-3 shrink-0" />
                        {q.submittedBy} · <span className="capitalize">{q.submittedByRole.replace(/_/g, ' ')}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={`${STATUS_COLORS[q.status]} flex items-center gap-1`}>{STATUS_ICONS[q.status]}{q.status}</Badge>
                    <Badge className={PRIORITY_COLORS[q.priority]}>{q.priority}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{q.message}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Badge variant="outline">{q.category}</Badge>
                  <span>{q.createdAt.toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedQ && (
          <Card className="bg-card border-border sticky top-6 h-fit">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div className="min-w-0">
                <CardTitle className="text-foreground text-base truncate">{selectedQ.subject}</CardTitle>
                {canSeeAll && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by {selectedQ.submittedBy} · {selectedQ.submittedByRole.replace(/_/g, ' ')}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSelectedQ(null)}><X className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge className={`${STATUS_COLORS[selectedQ.status]} flex items-center gap-1`}>{STATUS_ICONS[selectedQ.status]}{selectedQ.status}</Badge>
                <Badge className={PRIORITY_COLORS[selectedQ.priority]}>{selectedQ.priority} priority</Badge>
                <Badge variant="outline">{selectedQ.category}</Badge>
              </div>
              <div className="bg-muted rounded-xl p-3 space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Message</p>
                <p className="text-sm text-foreground">{selectedQ.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{selectedQ.createdAt.toLocaleString()}</p>
              </div>
              {selectedQ.adminReply && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-1">
                  <p className="text-xs text-primary font-semibold">Management Reply</p>
                  <p className="text-sm text-foreground">{selectedQ.adminReply}</p>
                </div>
              )}
              {selectedQ.status === 'resolved' && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl p-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> This query has been resolved.
                </div>
              )}
              {canResolve && selectedQ.status !== 'resolved' && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleReply} disabled={replying || !reply.trim()} className="flex-1 gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                      <Send className="w-4 h-4" />{replying ? 'Sending...' : 'Reply'}
                    </Button>
                    <Button onClick={() => handleResolve(selectedQ.id)} disabled={resolving} className="flex-1 gap-1 bg-green-600 text-white hover:bg-green-700">
                      <CheckCircle2 className="w-4 h-4" />{resolving ? 'Resolving...' : 'Resolve'}
                    </Button>
                  </div>
                </div>
              )}
              {isManager && !isAdmin && selectedQ.status !== 'resolved' && (
                <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                  Only admins can reply and resolve queries.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showModal && user && currentStore && (
        isCustomer
          ? <CustomerQueryModal user={user} storeId={currentStore.id} onClose={() => setShowModal(false)} onSuccess={loadData} />
          : <WorkerQueryModal   user={user} storeId={currentStore.id} onClose={() => setShowModal(false)} onSuccess={loadData} />
      )}
    </div>
  );
}