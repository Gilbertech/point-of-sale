'use client';
// app/dashboard/page.tsx
// ✅ Premium redesigned dashboard
// ✅ Customers see Support Tickets view
// ✅ Staff see rich analytics dashboard

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
  Search, Plus, X, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight,
  Phone, Mail, MessageSquare, Camera, Upload, Paperclip, Image as ImageIcon,
  Package, Users, BarChart3, RefreshCw, Store,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { formatCurrency, formatChartValue } from '@/lib/currency';
import { getAllTransactions } from '@/lib/supabase/transactions-helper';
import { getAllProducts } from '@/lib/supabase/products-helper';
import {
  getAllSupportTickets,
  createSupportTicket,
} from '@/lib/supabase/queries-support-helper';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  open: 'bg-blue-100 text-blue-700 border border-blue-200',
  'in-progress': 'bg-amber-100 text-amber-700 border border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
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
  const fileRef = useRef<HTMLInputElement>(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10 border-b border-border pb-4">
          <CardTitle className="text-foreground text-lg">New Support Ticket</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full"><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {isCustomer ? (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                {form.customerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{form.customerName}</p>
                {form.customerPhone && <p className="text-xs text-muted-foreground">{form.customerPhone}</p>}
              </div>
              <span className="ml-auto text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">✓ You</span>
            </div>
          ) : (
            <>
              {([['Customer Name *', 'customerName', 'text'], ['Phone Number', 'customerPhone', 'tel']] as [string, string, string][]).map(([label, key, type]) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
                  <Input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)} className="rounded-xl" />
                </div>
              ))}
            </>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject *</label>
            <Input value={form.subject} onChange={e => set('subject', e.target.value)} className="rounded-xl" placeholder="Brief description of your issue" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-ring">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message *</label>
            <textarea rows={4} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Describe your issue in detail..." className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attachments <span className="font-normal normal-case">(max 4)</span></label>
              <div className="flex gap-2">
                <button type="button" onClick={() => cameraRef.current?.click()} disabled={attachments.length >= 4} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-muted text-muted-foreground hover:bg-accent disabled:opacity-40 transition">
                  <Camera className="w-3.5 h-3.5" /> Camera
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={attachments.length >= 4} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-muted text-muted-foreground hover:bg-accent disabled:opacity-40 transition">
                  <Upload className="w-3.5 h-3.5" /> Upload
                </button>
              </div>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={e => handleFileAdd(e.target.files)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileAdd(e.target.files)} />
            {attachments.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {attachments.map((att, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden aspect-square border border-border">
                    {att.file.type.startsWith('image/') ? <img src={att.preview} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><Paperclip className="w-5 h-5 text-muted-foreground" /></div>}
                    <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition">
                <ImageIcon className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Add photos of receipts, products, etc.</p>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 rounded-xl" disabled={saving}
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

// ─── Customer Support View ────────────────────────────────────────────────────
function CustomerSupportView() {
  const { user } = useAuth();
  const { currentStore } = useStore();
  const autofillName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || '';
  const autofillPhone = (user as any)?.phone ?? '';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TicketStatus>('all');

  useEffect(() => { loadTickets(); }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await getAllSupportTickets();
      setTickets(data.filter((t: SupportTicket) => t.customerName === autofillName));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleCreate = async (data: any) => {
    if (!currentStore?.id) { alert('No store selected.'); return; }
    try { await createSupportTicket({ ...data, storeId: currentStore.id }); await loadTickets(); }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`); }
  };

  const filtered = useMemo(() => {
    let res = [...tickets];
    if (searchQuery) { const q = searchQuery.toLowerCase(); res = res.filter(t => t.subject.toLowerCase().includes(q)); }
    if (filterStatus !== 'all') res = res.filter(t => t.status === filterStatus);
    return res;
  }, [tickets, searchQuery, filterStatus]);

  const stats = useMemo(() => ({
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in-progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  }), [tickets]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-96">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground text-sm">Loading your tickets...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Support Tickets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Logged in as {autofillName}</p>
        </div>
        <Button onClick={() => setShowModal(true)} disabled={!currentStore} className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Open', value: stats.open, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Resolved', value: stats.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
        ].map(m => (
          <div key={m.label} className={`${m.bg} border rounded-2xl p-4`}>
            <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
            <p className={`text-3xl font-bold mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {(['all', 'open', 'in-progress', 'resolved'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition ${filterStatus === s ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{s}</button>
          ))}
        </div>
      </div>
      <div className={`grid gap-4 ${selected ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed border-border">
              {tickets.length === 0 ? '📭 No tickets yet. Click "New Ticket" to get help.' : 'No tickets match your filters.'}
            </div>
          ) : filtered.map(t => (
            <div key={t.id} onClick={() => setSelected(t)} className={`bg-card rounded-2xl border p-4 cursor-pointer hover:shadow-sm transition-all ${selected?.id === t.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.message}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLORS[t.status]}`}>{t.status}</span>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {t.reply && <span className="text-primary font-medium">↩ Reply received</span>}
                  {t.attachments && t.attachments.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{t.attachments.length}</span>}
                </div>
                <span>{t.createdAt.toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
        {selected && (
          <div className="bg-card rounded-2xl border border-border p-5 sticky top-6 h-fit space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-mono">#{selected.id.slice(0, 8).toUpperCase()}</p>
                <p className="font-semibold text-foreground mt-0.5">{selected.subject}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">{selected.category}</span>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Your message</p>
              <p className="text-sm text-foreground">{selected.message}</p>
            </div>
            {selected.reply ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <p className="text-xs text-primary font-semibold mb-1">Support Reply</p>
                <p className="text-sm text-foreground">{selected.reply}</p>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Awaiting response from support team</p>
              </div>
            )}
          </div>
        )}
      </div>
      {showModal && <TicketModal onClose={() => setShowModal(false)} onSubmit={handleCreate} prefillName={autofillName} prefillPhone={autofillPhone} />}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, trend, trendUp }: {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; trend?: string; trendUp?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {trend && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
              {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend}
            </span>
          )}
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Staff Dashboard ──────────────────────────────────────────────────────────
function StaffDashboardView() {
  const { currentStore } = useStore();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
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
      setLoading(false); setRefreshing(false);
    }
  }, [currentStore?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalSales = transactions.reduce((s, t) => s + t.total, 0);
    const count = transactions.length;
    const today = new Date().toDateString();
    const todayTxns = transactions.filter(t => new Date(t.createdAt).toDateString() === today);
    const todaySales = todayTxns.reduce((s, t) => s + t.total, 0);
    const lowStock = products.filter(p => p.stock <= (p.lowStockThreshold ?? 5));
    return {
      totalSales, count, todaySales, todayCount: todayTxns.length,
      avgOrder: count > 0 ? totalSales / count : 0,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.slice(0, 3),
    };
  }, [transactions, products]);

  const growth = useMemo(() => {
    const now = Date.now();
    const week = 7 * 86400000;
    const thisWeek = transactions.filter(t => now - new Date(t.createdAt).getTime() < week).reduce((s, t) => s + t.total, 0);
    const lastWeek = transactions.filter(t => { const d = now - new Date(t.createdAt).getTime(); return d >= week && d < 2 * week; }).reduce((s, t) => s + t.total, 0);
    const pct = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100).toFixed(1) : null;
    return { pct, up: pct ? Number(pct) >= 0 : true };
  }, [transactions]);

  const dailySales = useMemo(() => {
    const map: Record<string, number> = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      map[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0;
    }
    transactions.forEach(t => {
      const k = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (map[k] !== undefined) map[k] += t.total;
    });
    return Object.entries(map).map(([date, totalSales]) => ({ date, totalSales }));
  }, [transactions]);

  const hourly = useMemo(() => {
    const map: Record<number, number> = {};
    for (let i = 0; i < 24; i++) map[i] = 0;
    const today = new Date().toDateString();
    transactions.filter(t => new Date(t.createdAt).toDateString() === today).forEach(t => {
      const h = new Date(t.createdAt).getHours();
      map[h] = (map[h] || 0) + t.total;
    });
    return Object.entries(map).map(([h, v]) => ({ hour: `${h}:00`, sales: v })).filter(d => d.sales > 0 || (Number(d.hour.split(':')[0]) >= 7 && Number(d.hour.split(':')[0]) <= 21));
  }, [transactions]);

  const categorySales = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      t.items?.forEach((item: any) => {
        const product = products.find(p => p.id === item.productId);
        const cat = product?.category || 'Uncategorized';
        map[cat] = (map[cat] || 0) + item.subtotal;
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [transactions, products]);

  const paymentMix = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => { const m = t.paymentMethod || 'other'; map[m] = (map[m] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const recentTxns = useMemo(() => transactions.slice(0, 8), [transactions]);

  const CHART_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
  const tooltipStyle = { backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--card-foreground)', fontSize: '12px' };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground text-sm">Loading {currentStore?.name ?? 'dashboard'}…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top hero bar ── */}
      <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 px-6 py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-primary-foreground/70 text-sm font-medium">{greeting}, {user?.firstName ?? 'there'} 👋</p>
            <h1 className="text-2xl font-bold text-primary-foreground mt-0.5">
              {currentStore?.name ?? 'All Stores'}
            </h1>
            <p className="text-primary-foreground/60 text-xs mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats.lowStockCount > 0 && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 text-red-200" />
                <span className="text-red-100 text-xs font-semibold">{stats.lowStockCount} low stock</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-primary-foreground text-xs font-semibold">Live</span>
            </div>
            <button onClick={() => loadData(true)} disabled={refreshing} className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-2 transition">
              <RefreshCw className={`w-4 h-4 text-primary-foreground ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Today's quick stats inside hero */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: "Today's Sales", value: formatCurrency(stats.todaySales), sub: `${stats.todayCount} transactions` },
            { label: 'Total Revenue', value: formatCurrency(stats.totalSales), sub: 'All time' },
            { label: 'Avg Order', value: formatCurrency(stats.avgOrder), sub: 'Per transaction' },
            { label: 'Products', value: products.length, sub: `${stats.lowStockCount} low stock` },
          ].map(s => (
            <div key={s.label} className="bg-white/10 border border-white/15 rounded-xl px-4 py-3">
              <p className="text-primary-foreground/60 text-xs">{s.label}</p>
              <p className="text-primary-foreground font-bold text-lg leading-tight mt-0.5">{s.value}</p>
              <p className="text-primary-foreground/50 text-xs mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Revenue trend */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Revenue Trend</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
              </div>
              {growth.pct && (
                <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${growth.up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {growth.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(Number(growth.pct))}% vs last week
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailySales}>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={60} tickFormatter={v => formatChartValue(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatChartValue(v), 'Sales']} />
                <Area type="monotone" dataKey="totalSales" stroke="#f97316" strokeWidth={2.5} fill="url(#grad1)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category pie */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-foreground">Category Mix</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Sales by category</p>
            </div>
            {categorySales.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={categorySales} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                      {categorySales.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatChartValue(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {categorySales.slice(0, 4).map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground truncate max-w-[100px]">{c.name}</span>
                      </div>
                      <span className="font-semibold text-foreground">{formatChartValue(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Today's hourly + payment mix ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Hourly today */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-foreground">Today's Activity</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Sales by hour — {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </div>
            {hourly.every(h => h.sales === 0) ? (
              <div className="h-36 flex items-center justify-center text-muted-foreground text-sm">No sales recorded today yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hourly} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={50} tickFormatter={v => formatChartValue(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatChartValue(v), 'Sales']} />
                  <Bar dataKey="sales" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment method mix */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-foreground">Payment Methods</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Transaction breakdown</p>
            </div>
            {paymentMix.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-muted-foreground text-sm">No transactions yet</div>
            ) : (
              <div className="space-y-3 mt-2">
                {paymentMix.map((p, i) => {
                  const total = paymentMix.reduce((s, x) => s + x.value, 0);
                  const pct = Math.round((p.value / total) * 100);
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-foreground font-medium capitalize">{p.name}</span>
                        <span className="text-muted-foreground text-xs">{p.value} txns · {pct}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Transactions + Low Stock ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Recent transactions */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Recent Transactions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Latest sales activity</p>
              </div>
              <a href="/dashboard/receipts" className="text-xs text-primary font-medium hover:underline">View all →</a>
            </div>
            {recentTxns.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No transactions yet for {currentStore?.name}</div>
            ) : (
              <div className="space-y-2">
                {recentTxns.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ShoppingCart className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground font-mono">{t.transactionNumber}</p>
                        <p className="text-xs text-muted-foreground">{t.items?.length ?? 0} items · <span className="capitalize">{t.paymentMethod}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatCurrency(t.total)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low stock alerts */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Stock Alerts</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{stats.lowStockCount} items need attention</p>
              </div>
              <a href="/dashboard/inventory" className="text-xs text-primary font-medium hover:underline">Manage →</a>
            </div>
            {stats.lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-foreground">All stocked up!</p>
                <p className="text-xs text-muted-foreground">No low stock items</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.lowStockItems.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-red-600">{p.stock} left · min {p.lowStockThreshold ?? 5}</p>
                    </div>
                  </div>
                ))}
                {stats.lowStockCount > 3 && (
                  <a href="/dashboard/inventory" className="block text-center text-xs text-muted-foreground hover:text-primary py-1">
                    +{stats.lowStockCount - 3} more items →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  return user?.role === 'customer' ? <CustomerSupportView /> : <StaffDashboardView />;
}