'use client';
// app/dashboard/page.tsx — Sunrise Theme
// ✅ Customers → support portal  |  ✅ Staff → analytics dashboard

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context';
import {
  DollarSign, ShoppingCart, TrendingUp, AlertCircle, Activity, Zap,
  Search, Plus, X, CheckCircle2, Clock, Phone, Mail, MessageSquare,
  Camera, Upload, Paperclip, Image as ImageIcon, ArrowUpRight,
  ArrowDownRight, RefreshCw, Package, Layers, Award,
  BarChart2, ChevronRight, Flame, Eye,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { formatCurrency } from '@/lib/currency';
import { getAllTransactions } from '@/lib/supabase/transactions-helper';
import { getAllProducts } from '@/lib/supabase/products-helper';
import {
  getAllSupportTickets,
  createSupportTicket,
} from '@/lib/supabase/queries-support-helper';

// ─── Raw hex for SVG gradients ────────────────────────────────────────────────
const HEX = {
  primary:   '#f97316',
  secondary: '#8b5cf6',
  accent:    '#f59e0b',
  cyan:      '#06b6d4',
  emerald:   '#10b981',
  rose:      '#ef4444',
  border:    '#fed7aa',   // matches --border in Sunrise
};
const CHART_COLORS = [HEX.primary, HEX.secondary, HEX.cyan, HEX.accent, HEX.emerald];

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap');

  .db  { font-family:'Plus Jakarta Sans',sans-serif; background:var(--background); color:var(--foreground); min-height:100vh; }
  .db * { box-sizing:border-box; }

  .c { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); box-shadow:0 1px 3px rgba(249,115,22,.05),0 1px 2px rgba(0,0,0,.03); }
  .c-lift { transition:transform .2s,box-shadow .2s; }
  .c-lift:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(249,115,22,.1); }
  .c-hover:hover { background:var(--muted); }

  @keyframes fu { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  .fu  { animation:fu .4s ease forwards; opacity:0; }
  .fu1{animation-delay:.04s} .fu2{animation-delay:.09s} .fu3{animation-delay:.14s}
  .fu4{animation-delay:.19s} .fu5{animation-delay:.24s}

  @keyframes spin { to{transform:rotate(360deg)} }
  .spin { animation:spin .8s linear infinite; }

  .recharts-cartesian-grid-horizontal line,
  .recharts-cartesian-grid-vertical   line { stroke:var(--border) !important; }
  .recharts-xAxis .recharts-cartesian-axis-line,
  .recharts-yAxis .recharts-cartesian-axis-line { stroke:transparent !important; }
  .recharts-text { fill:var(--muted-foreground) !important; font-size:11px !important; font-family:'Plus Jakarta Sans' !important; }

  .badge-open { background:rgba(6,182,212,.12); color:#06b6d4; border:1px solid rgba(6,182,212,.25); }
  .badge-prog { background:rgba(245,158,11,.12); color:#f59e0b; border:1px solid rgba(245,158,11,.25); }
  .badge-done { background:rgba(16,185,129,.12); color:#10b981; border:1px solid rgba(16,185,129,.25); }
  .badge-pri  { background:rgba(249,115,22,.10); color:var(--primary); border:1px solid rgba(249,115,22,.22); }

  .progress-track { height:4px; background:var(--muted); border-radius:99px; overflow:hidden; }
  .progress-fill  { height:100%; border-radius:99px; transition:width 1s cubic-bezier(.34,1.56,.64,1); }

  input,textarea,select {
    background:var(--input); border:1px solid var(--border); color:var(--foreground);
    font-family:'Plus Jakarta Sans',sans-serif; border-radius:var(--radius-sm);
    outline:none; transition:border-color .15s;
  }
  input:focus,textarea:focus,select:focus { border-color:var(--ring); box-shadow:0 0 0 2px rgba(249,115,22,.15); }
  select option { background:var(--card); color:var(--foreground); }
  ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}
`;

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', boxShadow: '0 4px 12px rgba(249,115,22,.1)' }}>
      {label && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 700, color: p.color || p.stroke || 'var(--foreground)' }}>
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
  const id = `sp${color.replace(/\W/g, '')}`;
  return (
    <svg viewBox="0 0 100 50" style={{ width: 56, height: 22 }} preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity=".22" /><stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <polygon points={`0,100 ${pts} 100,100`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Shared types ─────────────────────────────────────────────────────────────
type TicketStatus = 'open' | 'in-progress' | 'resolved';
interface Ticket {
  id: string; customerName: string; customerPhone: string;
  subject: string; message: string; category: string;
  status: TicketStatus; reply: string | null; createdAt: Date; attachments?: string[];
}
const CATEGORIES = ['Receipt Issue', 'Refund', 'Returns', 'Loyalty Program', 'Product Quality', 'Other'];

const badgeClass = (s: TicketStatus) => s === 'open' ? 'badge-open' : s === 'in-progress' ? 'badge-prog' : 'badge-done';

// ─── Ticket Modal ─────────────────────────────────────────────────────────────
function TicketModal({ onClose, onSubmit, prefillName, prefillPhone }: {
  onClose: () => void;
  onSubmit: (d: any) => Promise<void>;
  prefillName?: string; prefillPhone?: string;
}) {
  const [form, setForm] = useState({ customerName: prefillName ?? '', customerPhone: prefillPhone ?? '', subject: '', category: 'Receipt Issue', message: '' });
  const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const isCustomer = !!prefillName;
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 4 - attachments.length).forEach(file => {
      const r = new FileReader(); r.onload = e => setAttachments(prev => [...prev, { file, preview: e.target?.result as string }]); r.readAsDataURL(file);
    });
  };

  const inp = (placeholder: string, key: string, type = 'text') => (
    <div>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 5, fontWeight: 500 }}>{placeholder}</p>
      <input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
        style={{ width: '100%', padding: '8px 12px', fontSize: 13 }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(28,25,23,0.5)', padding: 16 }}>
      <div className="c" style={{ width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--foreground)' }}>New Support Ticket</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>We'll respond within 24 hours</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><X size={13} /></button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Identity */}
          {isCustomer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{form.customerName.charAt(0).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--foreground)' }}>{form.customerName}</p>
                {form.customerPhone && <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{form.customerPhone}</p>}
              </div>
              <span className="badge-pri" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700, marginLeft: 'auto', flexShrink: 0 }}>✓ Auto-filled</span>
            </div>
          ) : (
            <>
              {inp('Customer Name *', 'customerName')}
              {inp('Phone Number', 'customerPhone', 'tel')}
            </>
          )}

          {inp('Subject *', 'subject')}

          <div>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 5, fontWeight: 500 }}>Category</p>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: 13 }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 5, fontWeight: 500 }}>Message *</p>
            <textarea rows={4} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Describe your issue in detail…"
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, resize: 'none' }} />
          </div>

          {/* Attachments */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>Attachments <span style={{ fontWeight: 400 }}>(optional, max 4)</span></p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ icon: <Camera size={12} />, label: 'Camera', ref: cameraRef }, { icon: <Upload size={12} />, label: 'Upload', ref: fileRef }].map(b => (
                  <button key={b.label} onClick={() => b.ref.current?.click()} disabled={attachments.length >= 4}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 8px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted-foreground)', cursor: 'pointer', opacity: attachments.length >= 4 ? 0.4 : 1 }}>
                    {b.icon}{b.label}
                  </button>
                ))}
              </div>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
            {attachments.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {attachments.map((a, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', border: '1px solid var(--border)' }}>
                    {a.file.type.startsWith('image/') ? <img src={a.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--muted)' }}><Paperclip size={14} color="var(--muted-foreground)" /></div>}
                    <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: HEX.rose, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><X size={10} /></button>
                  </div>
                ))}
                {attachments.length < 4 && <button onClick={() => fileRef.current?.click()} style={{ aspectRatio: '1', borderRadius: 8, border: '2px dashed var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><Plus size={16} /></button>}
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center', cursor: 'pointer' }}>
                <ImageIcon size={22} color="var(--muted-foreground)" style={{ margin: '0 auto 6px' }} />
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Add photos of receipts, products, etc.</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius)', background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button disabled={saving} onClick={async () => {
              if (!form.customerName || !form.subject || !form.message) { alert('Name, subject and message are required.'); return; }
              setSaving(true); await onSubmit({ ...form, attachments: attachments.map(a => a.file) }); setSaving(false); onClose();
            }} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius)', background: 'var(--primary)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: saving ? 0.6 : 1, boxShadow: '0 2px 8px rgba(249,115,22,0.28)' }}>
              {saving ? 'Creating…' : 'Create Ticket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Customer Support View ────────────────────────────────────────────────────
function CustomerSupportView() {
  const { user } = useAuth();
  const { currentStore } = useStore();
  const name  = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || '';
  const phone = (user as any)?.phone ?? '';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TicketStatus>('all');

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try { const d = await getAllSupportTickets(); setTickets(d.filter((t: Ticket) => t.customerName === name)); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [name]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleCreate = async (data: any) => {
    if (!currentStore?.id) { alert('No store selected.'); return; }
    try { await createSupportTicket({ ...data, storeId: currentStore.id }); await loadTickets(); }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'Unknown'}`); }
  };

  const filtered = useMemo(() => {
    let r = [...tickets];
    if (search) r = r.filter(t => t.subject.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== 'all') r = r.filter(t => t.status === filterStatus);
    return r;
  }, [tickets, search, filterStatus]);

  const stats = useMemo(() => ({
    open: tickets.filter(t => t.status === 'open').length,
    prog: tickets.filter(t => t.status === 'in-progress').length,
    done: tickets.filter(t => t.status === 'resolved').length,
  }), [tickets]);

  if (loading) return (
    <div className="db" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <style>{CSS}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', margin: '0 auto 14px' }} className="spin" />
        <p style={{ fontWeight: 600, color: 'var(--foreground)' }}>Loading your tickets…</p>
      </div>
    </div>
  );

  return (
    <div className="db" style={{ padding: 24 }}>
      <style>{CSS}</style>
      {/* Sunrise bar */}
      <div style={{ height: 3, background: 'linear-gradient(90deg,var(--primary),var(--accent),var(--secondary))', marginBottom: 24, borderRadius: 99 }} />

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div className="fu fu1" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Space Grotesk',sans-serif", letterSpacing: '-0.02em' }}>My Support Tickets</h1>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginTop: 4 }}>Logged in as <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{name}</span></p>
          </div>
          <button onClick={() => setShowModal(true)} disabled={!currentStore}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--primary)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(249,115,22,0.28)', opacity: !currentStore ? 0.5 : 1 }}>
            <Plus size={15} /> New Ticket
          </button>
        </div>

        {!currentStore && (
          <div className="fu fu1" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: HEX.rose, fontSize: 13 }}>
            <AlertCircle size={15} /> No store selected. Please select a branch from the sidebar.
          </div>
        )}

        {/* Stat cards */}
        <div className="fu fu2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Open',        val: stats.open, color: HEX.cyan,    icon: <AlertCircle size={17} /> },
            { label: 'In Progress', val: stats.prog, color: HEX.accent,  icon: <Clock size={17} /> },
            { label: 'Resolved',    val: stats.done, color: HEX.emerald, icon: <CheckCircle2 size={17} /> },
          ].map((m, i) => (
            <div key={i} className="c c-lift" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>{m.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${m.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>{m.icon}</div>
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Space Grotesk',sans-serif" }}>{m.val}</p>
            </div>
          ))}
        </div>

        {/* Contact strip */}
        <div className="fu fu2 c" style={{ padding: '12px 20px', marginBottom: 20, background: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {[
            { icon: <Phone size={13} />, label: 'Support', val: '+254 800 000 100' },
            { icon: <Mail size={13} />, label: 'Email', val: 'support@shop.co.ke' },
            { icon: <MessageSquare size={13} />, label: 'Hours', val: 'Mon–Sat, 8AM–6PM' },
          ].map(c => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--primary)' }}>{c.icon}</span>
              <span style={{ color: 'var(--muted-foreground)', fontWeight: 500 }}>{c.label}:</span>
              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{c.val}</span>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="fu fu3 c" style={{ padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…"
              style={{ width: '100%', padding: '8px 12px 8px 34px', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'open', 'in-progress', 'resolved'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding: '5px 13px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', border: 'none', transition: 'all .15s',
                  background: filterStatus === s ? 'var(--primary)' : 'var(--muted)',
                  color: filterStatus === s ? 'white' : 'var(--muted-foreground)',
                  boxShadow: filterStatus === s ? '0 2px 6px rgba(249,115,22,0.25)' : 'none' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket list + detail panel */}
        <div className="fu fu4" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.length === 0 ? (
              <div className="c" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14 }}>
                {tickets.length === 0 ? 'No tickets yet. Click "New Ticket" to get help.' : 'No tickets match your filters.'}
              </div>
            ) : filtered.map(t => (
              <div key={t.id} onClick={() => setSelected(t)} className="c c-hover"
                style={{ padding: '14px 16px', cursor: 'pointer', transition: 'all .15s', outline: selected?.id === t.id ? `2px solid var(--primary)` : 'none', outlineOffset: -1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>{t.subject}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{t.category}</p>
                  </div>
                  <span className={badgeClass(t.status)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600, flexShrink: 0 }}>{t.status}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.message}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {t.attachments?.length ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}><Paperclip size={11} />{t.attachments.length}</span> : null}
                    {t.reply && <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>↩ Reply received</span>}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{t.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="c" style={{ padding: 20, position: 'sticky', top: 20, alignSelf: 'start' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '.05em' }}>TICKET #{selected.id.slice(0, 8).toUpperCase()}</p>
                  <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--foreground)', marginTop: 4 }}>{selected.subject}</p>
                </div>
                <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><X size={12} /></button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                <span className={badgeClass(selected.status)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>{selected.status}</span>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)', fontWeight: 500 }}>{selected.category}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 12 }}>{selected.createdAt.toLocaleString()}</p>
              <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 12 }}>
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 5, fontWeight: 700, letterSpacing: '.06em' }}>YOUR MESSAGE</p>
                <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6 }}>{selected.message}</p>
              </div>
              {selected.attachments?.length ? (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 7, fontWeight: 700 }}>ATTACHMENTS</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {selected.attachments.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', display: 'block' }}>
                        <img src={url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {selected.reply ? (
                <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                  <p style={{ fontSize: 10, color: 'var(--primary)', marginBottom: 5, fontWeight: 700, letterSpacing: '.06em' }}>SUPPORT REPLY</p>
                  <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6 }}>{selected.reply}</p>
                </div>
              ) : (
                <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: 14, textAlign: 'center' }}>
                  <Clock size={16} color="var(--muted-foreground)" style={{ margin: '0 auto 6px' }} />
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Awaiting response from support team</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showModal && <TicketModal onClose={() => setShowModal(false)} onSubmit={handleCreate} prefillName={name} prefillPhone={phone} />}
    </div>
  );
}

// ─── Staff Dashboard View ─────────────────────────────────────────────────────
function StaffDashboardView() {
  const { currentStore } = useStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const sid = currentStore?.id ?? null;
      const [t, p] = await Promise.all([getAllTransactions(500, sid), getAllProducts(sid)]);
      setTransactions(t); setProducts(p); setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [currentStore?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const daily = useMemo(() => {
    const b: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); b[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0; }
    transactions.forEach(t => { const k = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); if (b[k] !== undefined) b[k] += t.total; });
    return Object.entries(b).map(([date, totalSales]) => ({ date, totalSales }));
  }, [transactions]);

  const catSales = useMemo(() => {
    const map: Record<string, { sales: number; count: number }> = {};
    transactions.forEach(t => t.items.forEach((item: any) => {
      const p = products.find(p => p.id === item.productId);
      const cat = p?.category || 'Other';
      if (!map[cat]) map[cat] = { sales: 0, count: 0 };
      map[cat].sales += item.subtotal; map[cat].count += item.quantity;
    }));
    return Object.entries(map).map(([category, d]) => ({ category, totalSales: d.sales })).sort((a, b) => b.totalSales - a.totalSales).slice(0, 5);
  }, [transactions, products]);

  const stats = useMemo(() => {
    const totalSales = transactions.reduce((s, t) => s + t.total, 0);
    const count = transactions.length;
    const last7 = new Date(Date.now() - 7 * 86400000), prev7 = new Date(Date.now() - 14 * 86400000);
    const thisPeriod = transactions.filter(t => new Date(t.createdAt) >= last7).reduce((s, t) => s + t.total, 0);
    const prevPeriod = transactions.filter(t => { const d = new Date(t.createdAt); return d >= prev7 && d < last7; }).reduce((s, t) => s + t.total, 0);
    return {
      totalSales, count, avgOrder: count > 0 ? totalSales / count : 0,
      growth: prevPeriod > 0 ? ((thisPeriod - prevPeriod) / prevPeriod * 100) : 0,
      lowStock: products.filter(p => p.stock <= p.lowStockThreshold).length,
      topCat: catSales[0],
    };
  }, [transactions, products, catSales]);

  const sparkRev = useMemo(() => daily.slice(-10).map(d => d.totalSales), [daily]);

  if (loading) return (
    <div className="db" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <style>{CSS}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', margin: '0 auto 14px' }} className="spin" />
        <p style={{ fontWeight: 600, color: 'var(--foreground)' }}>Loading {currentStore?.name ?? 'dashboard'}…</p>
      </div>
    </div>
  );

  return (
    <div className="db" style={{ padding: 24 }}>
      <style>{CSS}</style>
      {/* Sunrise bar */}
      <div style={{ height: 3, background: 'linear-gradient(90deg,var(--primary),var(--accent),var(--secondary))', marginBottom: 24, borderRadius: 99 }} />

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div className="fu fu1" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span className="badge-pri" style={{ fontSize: 11, padding: '2px 10px', borderRadius: 99, fontWeight: 700 }}>● LIVE</span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Updated {lastUpdated.toLocaleTimeString()}</span>
            </div>
            <h1 style={{ fontSize: 29, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Space Grotesk',sans-serif", letterSpacing: '-0.02em' }}>Dashboard</h1>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginTop: 4 }}>
              {currentStore?.name ?? 'All Stores'} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {stats.lowStock > 0 && (
              <a href="/dashboard/inventory" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', color: HEX.rose, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                <AlertCircle size={13} /> {stats.lowStock} low stock
              </a>
            )}
            <button onClick={() => loadData(true)} className="c" style={{ width: 37, height: 37, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', opacity: refreshing ? 0.5 : 1 }}>
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="fu fu2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Revenue', value: formatCurrency(stats.totalSales), sub: `${stats.growth >= 0 ? '↑' : '↓'} ${Math.abs(stats.growth).toFixed(1)}% vs last week`, color: HEX.primary,   icon: <DollarSign size={15} />,   spark: sparkRev,    pos: stats.growth >= 0 },
            { label: 'Transactions',  value: stats.count,                       sub: 'Total orders',                                                                          color: HEX.cyan,      icon: <ShoppingCart size={15} />, spark: daily.slice(-10).map(d => d.totalSales > 0 ? 1 : 0), pos: true },
            { label: 'Avg Order',     value: formatCurrency(stats.avgOrder),    sub: 'Per transaction',                                                                       color: HEX.accent,    icon: <Zap size={15} />,          spark: Array.from({length:10},()=>stats.avgOrder*(0.8+Math.random()*0.4)), pos: true },
            { label: 'Top Category',  value: stats.topCat?.category || '—',     sub: formatCurrency(stats.topCat?.totalSales || 0),                                           color: HEX.secondary, icon: <TrendingUp size={15} />,   spark: Array.from({length:10},(_,i)=>i+1), pos: true },
            { label: 'Stock Alerts',  value: stats.lowStock,                    sub: 'Items need reorder',                                                                    color: HEX.rose,      icon: <Package size={15} />,      spark: Array.from({length:10},()=>stats.lowStock*(0.5+Math.random())), pos: false },
          ].map((m, i) => (
            <div key={i} className="c c-lift" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -22, right: -22, width: 76, height: 76, borderRadius: '50%', background: `radial-gradient(circle,${m.color}14 0%,transparent 70%)` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `${m.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>{m.icon}</div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: m.pos ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: m.pos ? HEX.emerald : HEX.rose }}>
                  {m.pos ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Space Grotesk',sans-serif", marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>{m.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, opacity: .7 }}>{m.sub}</p>
                </div>
                <Spark data={m.spark} color={m.color} />
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="fu fu3" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="c" style={{ padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>Revenue Trend</p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>30-day performance</p>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gDb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={HEX.primary} stopOpacity=".16" />
                    <stop offset="100%" stopColor={HEX.primary} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="totalSales" stroke={HEX.primary} strokeWidth={2.5} fill="url(#gDb)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="c" style={{ padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>Category Mix</p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>Sales distribution</p>
            </div>
            {catSales.length === 0 ? (
              <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={catSales} dataKey="totalSales" nameKey="category" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={3}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: HEX.border }}>
                    {catSales.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<Tip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="fu fu4 c" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>Recent Transactions</p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>Latest activity{currentStore ? ` — ${currentStore.name}` : ''}</p>
            </div>
            <a href="/dashboard/reports" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
              Full analytics <ChevronRight size={13} />
            </a>
          </div>
          {transactions.length === 0 ? (
            <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No transactions yet{currentStore ? ` for ${currentStore.name}` : ''}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transactions.slice(0, 5).map((t, i) => (
                <div key={t.id} className="c-hover" style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius)', transition: 'background .12s', background: 'var(--muted)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 800, fontSize: 11 }}>#{i + 1}</div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--foreground)' }}>{t.transactionNumber}</p>
                      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{t.items.length} item{t.items.length !== 1 ? 's' : ''} · {t.paymentMethod}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)', fontFamily: "'Space Grotesk',sans-serif" }}>{formatCurrency(t.total)}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{new Date(t.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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