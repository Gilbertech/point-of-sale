'use client';
// app/dashboard/page.tsx
// ✅ Customers see their Support Tickets view — no routing, no redirect
// ✅ Staff see the normal dashboard
// One file, one export, role switch at the bottom.

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DollarSign, ShoppingCart, TrendingUp, AlertCircle, Activity, Zap,
  Search, Plus, X, Send, CheckCircle2, Clock,
  Phone, Mail, MessageSquare, Camera, Upload, Paperclip, Image as ImageIcon,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { formatCurrency, formatChartValue } from '@/lib/currency';
import { getAllTransactions } from '@/lib/supabase/transactions-helper';
import { getAllProducts } from '@/lib/supabase/products-helper';
import {
  getAllSupportTickets,
  createSupportTicket,
  replyToSupportTicket,
  resolveSupportTicket,
} from '@/lib/supabase/queries-support-helper';

// ─── Shared types ─────────────────────────────────────────────────────────────
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
  attachments?: string[];
}
const STATUS_COLORS: Record<TicketStatus, string> = {
  open:          'bg-blue-100 text-blue-800',
  'in-progress': 'bg-yellow-100 text-yellow-800',
  resolved:      'bg-green-100 text-green-800',
};
const CATEGORIES = ['Receipt Issue', 'Refund', 'Returns', 'Loyalty Program', 'Product Quality', 'Other'];

// ─── Ticket Modal ─────────────────────────────────────────────────────────────
function TicketModal({ onClose, onSubmit, prefillName, prefillPhone }: {
  onClose: () => void;
  onSubmit: (data: { customerName: string; customerPhone: string; subject: string; category: string; message: string; attachments: File[] }) => Promise<void>;
  prefillName?: string;
  prefillPhone?: string;
}) {
  const [form, setForm] = useState({ customerName: prefillName ?? '', customerPhone: prefillPhone ?? '', subject: '', category: 'Receipt Issue', message: '' });
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
      reader.onload = e => setAttachments(prev => [...prev, { file, preview: e.target?.result as string }]);
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

          {/* Identity — read-only banner for customers, editable for staff */}
          {isCustomer ? (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                {form.customerName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">{form.customerName}</p>
                {form.customerPhone && <p className="text-xs text-muted-foreground">{form.customerPhone}</p>}
              </div>
              <span className="ml-auto text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">✓ Auto-filled</span>
            </div>
          ) : (
            <>
              {([['Customer Name *', 'customerName', 'text'], ['Phone Number', 'customerPhone', 'tel']] as [string, string, string][]).map(([label, key, type]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">{label}</label>
                  <Input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)} className="border-border bg-input text-foreground" />
                </div>
              ))}
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Subject *</label>
            <Input value={form.subject} onChange={e => set('subject', e.target.value)} className="border-border bg-input text-foreground" placeholder="Brief description of your issue" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Message *</label>
            <textarea rows={4} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Describe your issue in detail..." className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">Attachments <span className="font-normal text-xs">(optional, max 4)</span></label>
              <div className="flex gap-2">
                <button type="button" onClick={() => cameraRef.current?.click()} disabled={attachments.length >= 4} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border bg-muted text-muted-foreground hover:bg-accent disabled:opacity-40 transition">
                  <Camera className="w-3.5 h-3.5" /> Camera
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={attachments.length >= 4} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border bg-muted text-muted-foreground hover:bg-accent disabled:opacity-40 transition">
                  <Upload className="w-3.5 h-3.5" /> Upload
                </button>
              </div>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={e => handleFileAdd(e.target.files)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileAdd(e.target.files)} />
            {attachments.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {attachments.map((att, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-border">
                    {att.file.type.startsWith('image/') ? <img src={att.preview} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Paperclip className="w-5 h-5 text-muted-foreground" /></div>}
                    <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                {attachments.length < 4 && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition"><Plus className="w-5 h-5" /></button>
                )}
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition">
                <ImageIcon className="w-7 h-7 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Add photos of receipts, products, etc.</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}
              onClick={async () => {
                if (!form.customerName || !form.subject || !form.message) { alert('Name, subject and message are required.'); return; }
                setSaving(true);
                await onSubmit({ ...form, attachments: attachments.map(a => a.file) });
                setSaving(false);
                onClose();
              }}>
              {saving ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Customer view — support tickets only ────────────────────────────────────
function CustomerSupportView() {
  const { user } = useAuth();
  const { currentStore } = useStore();

  const autofillName  = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || '';
  const autofillPhone = (user as any)?.phone ?? '';

  const [tickets,      setTickets]      = useState<SupportTicket[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<SupportTicket | null>(null);
  const [showModal,    setShowModal]    = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TicketStatus>('all');

  useEffect(() => { loadTickets(); }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await getAllSupportTickets();
      // Show only this customer's tickets
      setTickets(data.filter((t: SupportTicket) => t.customerName === autofillName));
    } catch (e) {
      console.error('Error loading tickets:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: { customerName: string; customerPhone: string; subject: string; category: string; message: string; attachments: File[] }) => {
    if (!currentStore?.id) { alert('No store selected.'); return; }
    try {
      await createSupportTicket({ ...data, storeId: currentStore.id });
      await loadTickets();
    } catch (e) {
      alert(`Failed to create ticket: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const filtered = useMemo(() => {
    let res = [...tickets];
    if (searchQuery) { const q = searchQuery.toLowerCase(); res = res.filter(t => t.subject.toLowerCase().includes(q)); }
    if (filterStatus !== 'all') res = res.filter(t => t.status === filterStatus);
    return res;
  }, [tickets, searchQuery, filterStatus]);

  const stats = useMemo(() => ({
    open:       tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in-progress').length,
    resolved:   tickets.filter(t => t.status === 'resolved').length,
  }), [tickets]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading your tickets...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Support Tickets</h1>
          <p className="text-muted-foreground mt-1">Logged in as {autofillName}</p>
        </div>
        <Button onClick={() => setShowModal(true)} disabled={!currentStore} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>

      {!currentStore && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No store selected. Please select a branch from the sidebar.</AlertDescription>
        </Alert>
      )}

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

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex flex-wrap gap-6">
          <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-primary" /><span className="font-medium text-foreground">Support:</span><span className="text-muted-foreground">+254 800 000 100</span></div>
          <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-primary" /><span className="font-medium text-foreground">Email:</span><span className="text-muted-foreground">support@shop.co.ke</span></div>
          <div className="flex items-center gap-2 text-sm"><MessageSquare className="w-4 h-4 text-primary" /><span className="font-medium text-foreground">Hours:</span><span className="text-muted-foreground">Mon–Sat, 8AM–6PM</span></div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tickets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 border-border bg-input text-foreground" />
          </div>
          <div className="flex gap-2">
            {(['all', 'open', 'in-progress', 'resolved'] as const).map(s => (
              <Button key={s} size="sm" variant={filterStatus === s ? 'default' : 'outline'} onClick={() => setFilterStatus(s)} className="capitalize">{s}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${selected ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="text-center py-10 text-muted-foreground">
                {tickets.length === 0 ? 'No tickets yet. Click "New Ticket" to get help.' : 'No tickets match your filters.'}
              </CardContent>
            </Card>
          ) : filtered.map(t => (
            <Card key={t.id} onClick={() => setSelected(t)} className={`bg-card cursor-pointer hover:shadow-sm transition-all ${selected?.id === t.id ? 'border-primary' : 'border-border'}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                  </div>
                  <Badge className={`${STATUS_COLORS[t.status]} shrink-0`}>{t.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{t.message}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {t.attachments && t.attachments.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{t.attachments.length}</span>}
                    {t.reply && <span className="text-primary font-medium">↩ Reply received</span>}
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
              <p className="text-sm text-muted-foreground">{selected.createdAt.toLocaleString()}</p>
              <div className="bg-muted rounded-xl p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Your message</p>
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
              {selected.reply ? (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 space-y-1">
                  <p className="text-xs text-primary font-medium">Support Reply</p>
                  <p className="text-sm text-foreground">{selected.reply}</p>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Awaiting response from support team</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showModal && <TicketModal onClose={() => setShowModal(false)} onSubmit={handleCreate} prefillName={autofillName} prefillPhone={autofillPhone} />}
    </div>
  );
}

// ─── Staff dashboard view ─────────────────────────────────────────────────────
function StaffDashboardView() {
  const { currentStore } = useStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products,     setProducts]     = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const storeId = currentStore?.id ?? null;
      const [transactionsData, productsData] = await Promise.all([
        getAllTransactions(500, storeId),
        getAllProducts(storeId),
      ]);
      setTransactions(transactionsData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentStore?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const dailySales = useMemo(() => {
    const salesByDate: Record<string, number> = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today); date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      salesByDate[dateStr] = 0;
    }
    transactions.forEach(t => {
      const dateStr = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (salesByDate[dateStr] !== undefined) salesByDate[dateStr] += t.total;
    });
    return Object.entries(salesByDate).map(([date, totalSales]) => ({ date, totalSales }));
  }, [transactions]);

  const categorySales = useMemo(() => {
    const map: Record<string, { sales: number; count: number }> = {};
    transactions.forEach(t => {
      t.items.forEach((item: any) => {
        const product = products.find(p => p.id === item.productId);
        const cat = product?.category || 'Uncategorized';
        if (!map[cat]) map[cat] = { sales: 0, count: 0 };
        map[cat].sales += item.subtotal; map[cat].count += item.quantity;
      });
    });
    return Object.entries(map).map(([category, d]) => ({ category, totalSales: d.sales, itemsSold: d.count })).sort((a, b) => b.totalSales - a.totalSales).slice(0, 5);
  }, [transactions, products]);

  const stats = useMemo(() => {
    const totalSales = transactions.reduce((s, t) => s + t.total, 0);
    const transactionCount = transactions.length;
    return { totalSales, transactionCount, lowStockCount: products.filter(p => p.stock <= p.lowStockThreshold).length, averageTransaction: transactionCount > 0 ? totalSales / transactionCount : 0 };
  }, [transactions, products]);

  const analytics = useMemo(() => {
    const today = new Date();
    const lastWeek     = new Date(today.getTime() - 7  * 86400000);
    const previousWeek = new Date(today.getTime() - 14 * 86400000);
    const recentSales = transactions.filter(t => new Date(t.createdAt) >= lastWeek).reduce((s, t) => s + t.total, 0);
    const prevSales   = transactions.filter(t => { const d = new Date(t.createdAt); return d >= previousWeek && d < lastWeek; }).reduce((s, t) => s + t.total, 0);
    return { growthRate: prevSales > 0 ? ((recentSales - prevSales) / prevSales * 100).toFixed(1) : '0.0', topCategory: categorySales[0] };
  }, [categorySales, transactions]);

  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
  const tooltipStyle = { backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--card-foreground)' };

  if (loading) return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Loading {currentStore?.name ?? 'dashboard'}…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{currentStore?.name ?? 'All Stores'} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full shadow-sm">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-sm font-semibold text-foreground">Live</span>
        </div>
      </div>

      {stats.lowStockCount > 0 && (
        <Alert className="border-destructive/30 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            {stats.lowStockCount} product{stats.lowStockCount !== 1 ? 's are' : ' is'} running low on stock.{' '}
            <a href="/dashboard/inventory" className="font-semibold underline">View inventory</a>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(stats.totalSales),         sub: `↑ ${analytics.growthRate}% from last week`,            icon: <DollarSign   className="h-5 w-5 text-[var(--chart-1)]" />, iconBg: 'bg-[var(--chart-1)]/10' },
          { label: 'Transactions',  value: stats.transactionCount,                   sub: 'Total orders',                                          icon: <ShoppingCart className="h-5 w-5 text-[var(--chart-2)]" />, iconBg: 'bg-[var(--chart-2)]/10' },
          { label: 'Avg Order',     value: formatCurrency(stats.averageTransaction), sub: 'Per transaction',                                       icon: <Zap          className="h-5 w-5 text-[var(--chart-3)]" />, iconBg: 'bg-[var(--chart-3)]/10' },
          { label: 'Top Category',  value: analytics.topCategory?.category || 'N/A', sub: formatCurrency(analytics.topCategory?.totalSales || 0), icon: <TrendingUp   className="h-5 w-5 text-[var(--chart-4)]" />, iconBg: 'bg-[var(--chart-4)]/10' },
          { label: 'Stock Alert',   value: stats.lowStockCount,                      sub: 'Items low',                                             icon: <AlertCircle  className="h-5 w-5 text-destructive" />,       iconBg: 'bg-destructive/10' },
        ].map((m, i) => (
          <Card key={i} className="bg-card border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <div className={`w-9 h-9 rounded-xl ${m.iconBg} flex items-center justify-center`}>{m.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground truncate">{m.value}</div>
              <p className="text-xs mt-1 font-medium text-muted-foreground">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-foreground">Revenue Trend</CardTitle>
            <CardDescription className="text-muted-foreground">30-day sales performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={dailySales}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--chart-1)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--border)" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis stroke="var(--border)" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatChartValue(v)} />
                <Area type="monotone" dataKey="totalSales" stroke="var(--chart-1)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-foreground">Category Mix</CardTitle>
            <CardDescription className="text-muted-foreground">Sales distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {categorySales.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">No sales data for this store yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie data={categorySales} dataKey="totalSales" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {categorySales.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatChartValue(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Transactions</CardTitle>
          <CardDescription className="text-muted-foreground">Latest sales activity{currentStore ? ` — ${currentStore.name}` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No transactions yet{currentStore ? ` for ${currentStore.name}` : ''}</div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-muted border border-border rounded-xl hover:bg-accent/10 transition-colors">
                  <div>
                    <p className="font-semibold text-foreground">{t.transactionNumber}</p>
                    <p className="text-sm text-muted-foreground">{t.items.length} item{t.items.length !== 1 ? 's' : ''} • {t.paymentMethod}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatCurrency(t.total)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
// This is the only thing that matters: one line, role check, done.
export default function DashboardPage() {
  const { user } = useAuth();
  return user?.role === 'customer' ? <CustomerSupportView /> : <StaffDashboardView />;
}