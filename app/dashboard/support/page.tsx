'use client';
// Place at: app/dashboard/support/page.tsx
// FIX 1: Added storeId to SupportTicket interface.
// FIX 2: All roles (including admin) scoped to currentStore by default.
//         Admins get a "This Branch / All Branches" toggle.

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search, Plus, X, Send, CheckCircle2, Clock, AlertCircle,
  Phone, Mail, MessageSquare, Camera, Upload, Paperclip, Image as ImageIcon, Layers,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context';
import {
  getAllSupportTickets,
  createSupportTicket,
  replyToSupportTicket,
  resolveSupportTicket,
} from '@/lib/supabase/queries-support-helper';

type TicketStatus = 'open' | 'in-progress' | 'resolved';

interface SupportTicket {
  id: string;
  customerName: string;
  customerPhone: string;
  subject: string;
  message: string;
  category: string;
  status: TicketStatus;
  reply: string | null;
  createdAt: Date;
  storeId?: string | null;   // ← ADDED: required for branch filtering
  attachments?: string[];
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  open:          'bg-blue-100 text-blue-800',
  'in-progress': 'bg-yellow-100 text-yellow-800',
  resolved:      'bg-green-100 text-green-800',
};

const CATEGORIES = ['Receipt Issue', 'Refund', 'Returns', 'Loyalty Program', 'Product Quality', 'Other'];

const isCustomerRole = (role?: string) => role === 'customer';

// ── Ticket Modal ──────────────────────────────────────────────────────────────
function TicketModal({ onClose, onSubmit, prefillName, prefillPhone }: {
  onClose: () => void;
  onSubmit: (data: {
    customerName: string;
    customerPhone: string;
    subject: string;
    category: string;
    message: string;
    attachments: File[];
  }) => Promise<void>;
  prefillName?: string;
  prefillPhone?: string;
}) {
  const [form, setForm] = useState({
    customerName:  prefillName  ?? '',
    customerPhone: prefillPhone ?? '',
    subject:       '',
    category:      'Receipt Issue',
    message:       '',
  });
  const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const isCustomer = !!prefillName;

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleFileAdd = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 4 - attachments.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => setAttachments(prev => [
        ...prev, { file, preview: e.target?.result as string }
      ]);
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10 border-b border-border pb-3">
          <CardTitle className="text-foreground">New Support Ticket</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">

          {isCustomer ? (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {form.customerName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">{form.customerName}</p>
                {form.customerPhone && (
                  <p className="text-xs text-muted-foreground">{form.customerPhone}</p>
                )}
              </div>
              <span className="ml-auto text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                ✓ Auto-filled
              </span>
            </div>
          ) : (
            <>
              {([
                ['Customer Name *',  'customerName',  'text'],
                ['Phone Number',     'customerPhone', 'tel'],
              ] as [string, string, string][]).map(([label, key, type]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">{label}</label>
                  <Input
                    type={type}
                    value={(form as any)[key]}
                    onChange={e => set(key, e.target.value)}
                    className="border-border bg-input text-foreground"
                  />
                </div>
              ))}
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Subject *</label>
            <Input
              value={form.subject}
              onChange={e => set('subject', e.target.value)}
              className="border-border bg-input text-foreground"
              placeholder="Brief description of your issue"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Category</label>
            <select
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Message *</label>
            <textarea
              rows={4}
              value={form.message}
              onChange={e => set('message', e.target.value)}
              placeholder="Describe your issue in detail..."
              className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Attachments <span className="font-normal text-xs">(optional, max 4)</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => cameraRef.current?.click()} disabled={attachments.length >= 4}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border bg-muted text-muted-foreground hover:bg-accent disabled:opacity-40 transition">
                  <Camera className="w-3.5 h-3.5" /> Camera
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={attachments.length >= 4}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border bg-muted text-muted-foreground hover:bg-accent disabled:opacity-40 transition">
                  <Upload className="w-3.5 h-3.5" /> Upload
                </button>
              </div>
            </div>

            <input ref={fileRef}   type="file" multiple accept="image/*,application/pdf" className="hidden"
              onChange={e => handleFileAdd(e.target.files)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleFileAdd(e.target.files)} />

            {attachments.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {attachments.map((att, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-border">
                    {att.file.type.startsWith('image/') ? (
                      <img src={att.preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Paperclip className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {attachments.length < 4 && (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition">
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition">
                <ImageIcon className="w-7 h-7 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Add photos of receipts, products, etc.</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={async () => {
                if (!form.customerName || !form.subject || !form.message) {
                  alert('Name, subject and message are required.');
                  return;
                }
                setSaving(true);
                await onSubmit({ ...form, attachments: attachments.map(a => a.file) });
                setSaving(false);
                onClose();
              }}
            >
              {saving ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SupportPage() {
  const { user }         = useAuth();
  const { currentStore } = useStore();

  const isCustomer = isCustomerRole(user?.role);
  const isAdmin    = ['super_admin', 'admin'].includes(user?.role ?? '');
  const storeId    = currentStore?.id ?? null;

  const autofillName  = isCustomer
    ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || ''
    : undefined;
  const autofillPhone = isCustomer ? ((user as any)?.phone ?? '') : undefined;

  const [allTickets,      setAllTickets]      = useState<SupportTicket[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [selected,        setSelected]        = useState<SupportTicket | null>(null);
  const [showModal,       setShowModal]       = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [filterStatus,    setFilterStatus]    = useState<'all' | TicketStatus>('all');
  const [reply,           setReply]           = useState('');
  const [replying,        setReplying]        = useState(false);
  const [resolving,       setResolving]       = useState(false);
  const [showAllBranches, setShowAllBranches] = useState(false);

  useEffect(() => { loadTickets(); }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await getAllSupportTickets();
      setAllTickets(data);
    } catch (error) {
      console.error('Error loading tickets:', error);
      alert('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  // ── BRANCH + ROLE FILTER ─────────────────────────────────────────────────
  // Customers    → only their own tickets (matched by name)
  // All others   → current branch only, unless admin toggled "All Branches"
  const tickets = useMemo(() => {
    if (isCustomer) {
      return allTickets.filter(t => t.customerName === autofillName);
    }
    const shouldFilterByBranch = storeId && !(isAdmin && showAllBranches);
    if (shouldFilterByBranch) {
      return allTickets.filter(t => t.storeId === storeId || t.storeId == null);
    }
    return allTickets;
  }, [allTickets, isCustomer, autofillName, storeId, isAdmin, showAllBranches]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreate = async (data: {
    customerName: string; customerPhone: string;
    subject: string; category: string; message: string; attachments: File[];
  }) => {
    if (!currentStore?.id) {
      alert('No store selected. Please select a branch from the sidebar.');
      return;
    }
    try {
      await createSupportTicket({
        customerName:  data.customerName,
        customerPhone: data.customerPhone,
        subject:       data.subject,
        category:      data.category,
        message:       data.message,
        storeId:       currentStore.id,
        attachments:   data.attachments,
      });
      await loadTickets();
    } catch (error) {
      alert(`Failed to create ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setReplying(true);
    try {
      await replyToSupportTicket(selected.id, reply);
      setReply('');
      setSelected(prev => prev ? { ...prev, reply, status: 'in-progress' } : prev);
      await loadTickets();
    } catch (error) {
      alert(`Failed to send reply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally { setReplying(false); }
  };

  const handleResolve = async (id: string) => {
    setResolving(true);
    try {
      await resolveSupportTicket(id);
      setSelected(prev => prev?.id === id ? { ...prev, status: 'resolved' } : prev);
      await loadTickets();
    } catch (error) {
      alert(`Failed to resolve ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally { setResolving(false); }
  };

  const filtered = useMemo(() => {
    let res = [...tickets];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      res = res.filter(t =>
        t.customerName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') res = res.filter(t => t.status === filterStatus);
    return res;
  }, [tickets, searchQuery, filterStatus]);

  // Stats scoped to the branch-filtered tickets (not allTickets)
  const stats = useMemo(() => ({
    open:       tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in-progress').length,
    resolved:   tickets.filter(t => t.status === 'resolved').length,
  }), [tickets]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading support tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {isCustomer ? 'My Support Tickets' : 'Customer Support'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isCustomer
              ? `Logged in as ${autofillName}`
              : isAdmin && showAllBranches
                ? 'Showing all branches'
                : currentStore
                  ? `Support tickets for ${currentStore.name}`
                  : 'Manage customer inquiries and complaints'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* All-branches toggle — admins only */}
          {isAdmin && !isCustomer && (
            <Button
              variant={showAllBranches ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAllBranches(v => !v)}
              className="gap-1.5 text-xs"
            >
              <Layers className="w-3.5 h-3.5" />
              {showAllBranches ? 'All Branches' : 'This Branch'}
            </Button>
          )}
          <Button
            onClick={() => setShowModal(true)}
            disabled={!currentStore}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </Button>
        </div>
      </div>

      {!currentStore && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No store selected. Please select a branch from the sidebar.</AlertDescription>
        </Alert>
      )}

      {/* Stats — scoped to current branch */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Open',        value: stats.open,       icon: <AlertCircle  className="h-5 w-5 text-blue-600" />,   iconBg: 'bg-blue-50' },
          { label: 'In Progress', value: stats.inProgress, icon: <Clock        className="h-5 w-5 text-yellow-600" />, iconBg: 'bg-yellow-50' },
          { label: 'Resolved',    value: stats.resolved,   icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,  iconBg: 'bg-green-50' },
        ].map((m, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <div className={`w-9 h-9 rounded-xl ${m.iconBg} flex items-center justify-center`}>{m.icon}</div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{m.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Contact info */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-primary" /><span className="font-medium text-foreground">Support:</span><span className="text-muted-foreground">+254 800 000 100</span></div>
          <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-primary" /><span className="font-medium text-foreground">Email:</span><span className="text-muted-foreground">support@shop.co.ke</span></div>
          <div className="flex items-center gap-2 text-sm"><MessageSquare className="w-4 h-4 text-primary" /><span className="font-medium text-foreground">Hours:</span><span className="text-muted-foreground">Mon–Sat, 8AM–6PM</span></div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name or subject..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 border-border bg-input text-foreground"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'open', 'in-progress', 'resolved'] as const).map(s => (
                <Button key={s} size="sm" variant={filterStatus === s ? 'default' : 'outline'}
                  onClick={() => setFilterStatus(s)} className="capitalize">{s}</Button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
              {!isCustomer && !showAllBranches && currentStore ? ` in ${currentStore.name}` : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tickets list + detail */}
      <div className={`grid gap-4 ${selected ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="text-center py-10 text-muted-foreground">
                {allTickets.length === 0
                  ? 'No tickets yet.'
                  : tickets.length === 0
                    ? `No tickets for ${currentStore?.name ?? 'this branch'} yet.`
                    : 'No tickets match your filters.'}
              </CardContent>
            </Card>
          ) : filtered.map(t => (
            <Card key={t.id} onClick={() => setSelected(t)}
              className={`bg-card cursor-pointer hover:shadow-sm transition-all ${selected?.id === t.id ? 'border-primary' : 'border-border'}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.customerName} · {t.customerPhone}</p>
                  </div>
                  <Badge className={`${STATUS_COLORS[t.status]} shrink-0`}>{t.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{t.message}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t.category}</Badge>
                    {t.attachments && t.attachments.length > 0 && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Paperclip className="w-3 h-3" />{t.attachments.length}
                      </span>
                    )}
                  </div>
                  <span>{t.createdAt.toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selected && (
          <Card className="bg-card border-border sticky top-6 h-fit">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-base">#{selected.id.slice(0, 8).toUpperCase()}</CardTitle>
                <CardDescription>{selected.subject}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge className={STATUS_COLORS[selected.status]}>{selected.status}</Badge>
                <Badge variant="outline">{selected.category}</Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium text-foreground">Customer:</span> <span className="text-muted-foreground">{selected.customerName}</span></p>
                {selected.customerPhone && <p><span className="font-medium text-foreground">Phone:</span> <span className="text-muted-foreground">{selected.customerPhone}</span></p>}
                <p><span className="font-medium text-foreground">Date:</span> <span className="text-muted-foreground">{selected.createdAt.toLocaleString()}</span></p>
              </div>
              <div className="bg-muted rounded-xl p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Message</p>
                <p className="text-sm text-foreground">{selected.message}</p>
              </div>

              {selected.attachments && selected.attachments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Attachments</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.attachments.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="rounded-lg overflow-hidden border border-border">
                        <img src={url} alt="" className="w-full aspect-square object-cover hover:opacity-80 transition" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selected.reply && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-1">
                  <p className="text-xs text-primary font-medium">Support Reply</p>
                  <p className="text-sm text-foreground">{selected.reply}</p>
                </div>
              )}

              {!isCustomer && selected.status !== 'resolved' && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Type your reply to the customer..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleReply} disabled={replying} className="flex-1 gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                      <Send className="w-4 h-4" />{replying ? 'Sending...' : 'Reply'}
                    </Button>
                    <Button onClick={() => handleResolve(selected.id)} disabled={resolving} className="flex-1 gap-1 bg-green-600 text-white hover:bg-green-700">
                      <CheckCircle2 className="w-4 h-4" />{resolving ? 'Resolving...' : 'Resolve'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showModal && (
        <TicketModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          prefillName={autofillName}
          prefillPhone={autofillPhone}
        />
      )}
    </div>
  );
}