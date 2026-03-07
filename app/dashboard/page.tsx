'use client';
// app/dashboard/page.tsx — Editorial Magazine Dashboard · Sunrise Theme
// ✅ Customers → support portal  |  ✅ Staff → editorial dashboard

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context';
import {
  DollarSign, ShoppingCart, TrendingUp, AlertCircle, Zap,
  Search, Plus, X, CheckCircle2, Clock, Phone, Mail, MessageSquare,
  Camera, Upload, Paperclip, Image as ImageIcon, ArrowUpRight,
  ArrowDownRight, RefreshCw, Package, ChevronRight, ChevronUp,
  BarChart2, Activity, Flame,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { formatCurrency } from '@/lib/currency';
import { getAllTransactions } from '@/lib/supabase/transactions-helper';
import { getAllProducts } from '@/lib/supabase/products-helper';
import { getAllSupportTickets, createSupportTicket } from '@/lib/supabase/queries-support-helper';

// ─── Hex values (for SVG + shadows) ─────────────────────────────────────────
const H = {
  coral:   '#f97316',
  amber:   '#f59e0b',
  violet:  '#8b5cf6',
  cyan:    '#06b6d4',
  emerald: '#10b981',
  rose:    '#ef4444',
  cream:   '#fffbf5',
  warm:    '#fed7aa',
};
const SERIES = [H.coral, H.violet, H.cyan, H.amber, H.emerald];

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,900;1,9..144,300;1,9..144,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

/* ── Reset & root */
.db,  .db * { box-sizing: border-box; }
.db {
  font-family: 'DM Sans', sans-serif;
  background: var(--background);
  color: var(--foreground);
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* ── Paper texture overlay */
.db::before {
  content: '';
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
  opacity: 0.6;
}

/* ── Diagonal background accent */
.db::after {
  content: '';
  position: fixed;
  top: -40%;
  right: -20%;
  width: 70vw;
  height: 140vh;
  background: linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(245,158,11,0.03) 40%, rgba(139,92,246,0.04) 100%);
  transform: rotate(-12deg);
  pointer-events: none;
  z-index: 0;
  border-radius: 40px;
}

/* ── All content above overlays */
.db > * { position: relative; z-index: 1; }

/* ── Display font */
.font-display { font-family: 'Fraunces', Georgia, serif; }
.font-display-i { font-family: 'Fraunces', Georgia, serif; font-style: italic; }

/* ── Card base */
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.card-paper {
  background: #fffdf9;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 2px 8px rgba(249,115,22,0.06), 0 1px 2px rgba(0,0,0,0.03);
}

/* ── Coral stripe accent (left border) */
.stripe-coral  { border-left: 3px solid var(--primary); }
.stripe-violet { border-left: 3px solid var(--secondary); }
.stripe-amber  { border-left: 3px solid var(--accent); }
.stripe-cyan   { border-left: 3px solid ${H.cyan}; }

/* ── Hover lift */
.lift { transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s; }
.lift:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(249,115,22,0.1), 0 2px 4px rgba(0,0,0,0.05); }

/* ── Pill tag */
.pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600;
}
.pill-coral  { background: rgba(249,115,22,0.1);  color: var(--primary); border: 1px solid rgba(249,115,22,0.2); }
.pill-green  { background: rgba(16,185,129,0.1);  color: ${H.emerald};   border: 1px solid rgba(16,185,129,0.2); }
.pill-red    { background: rgba(239,68,68,0.1);   color: ${H.rose};      border: 1px solid rgba(239,68,68,0.2); }
.pill-amber  { background: rgba(245,158,11,0.1);  color: var(--accent);  border: 1px solid rgba(245,158,11,0.2); }
.pill-violet { background: rgba(139,92,246,0.1);  color: var(--secondary); border: 1px solid rgba(139,92,246,0.2); }
.pill-cyan   { background: rgba(6,182,212,0.1);   color: ${H.cyan};      border: 1px solid rgba(6,182,212,0.2); }

/* ── Divider (warm) */
.divider { height: 1px; background: var(--border); }
.divider-v { width: 1px; background: var(--border); align-self: stretch; }

/* ── Stagger-in animation */
@keyframes slideUp { from { opacity:0; transform: translateY(18px); } to { opacity:1; transform:none; } }
.in  { animation: slideUp .5s cubic-bezier(.16,1,.3,1) both; }
.d1  { animation-delay: .05s } .d2  { animation-delay: .1s }
.d3  { animation-delay: .15s } .d4  { animation-delay: .2s }
.d5  { animation-delay: .25s } .d6  { animation-delay: .3s }
.d7  { animation-delay: .35s }

/* ── Ticker line at top */
@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.ticker-inner { animation: ticker 28s linear infinite; white-space: nowrap; display: inline-flex; gap: 0; }
.ticker-inner:hover { animation-play-state: paused; }

/* ── Spin */
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }

/* ── Progress bar */
.pb-track { height: 3px; background: var(--muted); border-radius: 99px; overflow: hidden; }
.pb-fill  { height: 100%; border-radius: 99px; transition: width 1.2s cubic-bezier(.34,1.56,.64,1); }

/* ── Recharts overrides */
.recharts-cartesian-grid line { stroke: var(--border) !important; }
.recharts-cartesian-axis-line { stroke: transparent !important; }
.recharts-text { fill: var(--muted-foreground) !important; font-size: 10px !important; font-family: 'DM Sans' !important; }

/* ── Table hover */
.tr-hover:hover { background: var(--muted); }

/* ── Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

/* ── Input */
input, textarea, select {
  font-family: 'DM Sans', sans-serif;
  background: var(--input); border: 1px solid var(--border);
  color: var(--foreground); outline: none;
  border-radius: var(--radius-sm); transition: border-color .15s, box-shadow .15s;
}
input:focus, textarea:focus, select:focus {
  border-color: var(--ring); box-shadow: 0 0 0 3px rgba(249,115,22,.12);
}
select option { background: var(--card); }

/* ── Runline / rule */
.rule { display: flex; align-items: center; gap: 12px; }
.rule::before, .rule::after { content:''; flex:1; height:1px; background: var(--border); }

/* ── Number highlight */
.hero-num {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 900;
  line-height: 0.9;
  letter-spacing: -0.04em;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 60%, var(--secondary) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Hatched pattern card accent */
.hatch {
  background-image: repeating-linear-gradient(
    45deg,
    rgba(249,115,22,0.06) 0px, rgba(249,115,22,0.06) 1px,
    transparent 1px, transparent 8px
  );
}
`;

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', boxShadow: '0 4px 16px rgba(249,115,22,.12)', fontFamily: "'DM Sans', sans-serif" }}>
      {label && <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 4, fontWeight: 500 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 700, color: p.color || p.stroke || H.coral }}>
          {p.name}: {typeof p.value === 'number' && p.value > 99 ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Tiny sparkline ───────────────────────────────────────────────────────────
function Spark({ data, color, h = 32 }: { data: number[]; color: string; h?: number }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
  const id = `sk${color.replace(/\W/g, '')}`;
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: h }} preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity=".2" /><stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <polygon points={`0,100 ${pts} 100,100`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ to, prefix = '', suffix = '', decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = performance.now(), dur = 1100, from = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      setVal(from + (to - from) * ease);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [to]);
  return <>{prefix}{val.toFixed(decimals)}{suffix}</>;
}

// ─── Shared support types ─────────────────────────────────────────────────────
type TStatus = 'open' | 'in-progress' | 'resolved';
interface Ticket { id: string; customerName: string; customerPhone: string; subject: string; message: string; category: string; status: TStatus; reply: string | null; createdAt: Date; attachments?: string[]; }
const CATS = ['Receipt Issue', 'Refund', 'Returns', 'Loyalty Program', 'Product Quality', 'Other'];

// ─── Ticket Modal (Sunrise styled) ───────────────────────────────────────────
function TicketModal({ onClose, onSubmit, prefillName, prefillPhone }: {
  onClose: () => void;
  onSubmit: (d: any) => Promise<void>;
  prefillName?: string; prefillPhone?: string;
}) {
  const [form, setForm] = useState({ customerName: prefillName ?? '', customerPhone: prefillPhone ?? '', subject: '', category: 'Receipt Issue', message: '' });
  const [atts, setAtts] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const fRef = useRef<HTMLInputElement>(null);
  const cRef = useRef<HTMLInputElement>(null);
  const isC = !!prefillName;
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, 4 - atts.length).forEach(f => { const r = new FileReader(); r.onload = e => setAtts(p => [...p, { file: f, preview: e.target?.result as string }]); r.readAsDataURL(f); });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(28,25,23,.55)', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(249,115,22,.15)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>Open a Ticket</p>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>We respond within 24 hours</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><X size={13} /></button>
        </div>
        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isC ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(249,115,22,.06)', border: '1px solid rgba(249,115,22,.18)', borderRadius: 'var(--radius)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: H.coral, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0, fontFamily: "'Fraunces', serif" }}>{form.customerName.charAt(0).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--foreground)' }}>{form.customerName}</p>
                {form.customerPhone && <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{form.customerPhone}</p>}
              </div>
              <span className="pill pill-coral" style={{ marginLeft: 'auto', flexShrink: 0 }}>✓ Verified</span>
            </div>
          ) : (
            ['Customer Name *|customerName|text', 'Phone|customerPhone|tel'].map(s => {
              const [label, key, type] = s.split('|');
              return (
                <div key={key}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 5, letterSpacing: '.04em' }}>{label.toUpperCase()}</p>
                  <input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)} style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} />
                </div>
              );
            })
          )}
          {['Subject *|subject|text', 'Message *|message|textarea'].map(s => {
            const [label, key, type] = s.split('|');
            return (
              <div key={key}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 5, letterSpacing: '.04em' }}>{label.toUpperCase()}</p>
                {type === 'textarea'
                  ? <textarea rows={4} value={(form as any)[key]} onChange={e => set(key, e.target.value)} placeholder="Describe in detail…" style={{ width: '100%', padding: '9px 12px', fontSize: 13, resize: 'none' }} />
                  : <input type="text" value={(form as any)[key]} onChange={e => set(key, e.target.value)} style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} />
                }
              </div>
            );
          })}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 5, letterSpacing: '.04em' }}>CATEGORY</p>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {/* Attachments */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '.04em' }}>ATTACHMENTS <span style={{ fontWeight: 400 }}>(max 4)</span></p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ icon: <Camera size={11} />, l: 'Camera', ref: cRef }, { icon: <Upload size={11} />, l: 'Upload', ref: fRef }].map(b => (
                  <button key={b.l} onClick={() => b.ref.current?.click()} disabled={atts.length >= 4} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 9px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted-foreground)', cursor: 'pointer', opacity: atts.length >= 4 ? .4 : 1 }}>{b.icon}{b.l}</button>
                ))}
              </div>
            </div>
            <input ref={fRef} type="file" multiple accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
            <input ref={cRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
            {atts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {atts.map((a, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', border: '1px solid var(--border)' }}>
                    {a.file.type.startsWith('image/') ? <img src={a.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--muted)' }}><Paperclip size={14} color="var(--muted-foreground)" /></div>}
                    <button onClick={() => setAtts(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 3, right: 3, width: 17, height: 17, borderRadius: '50%', background: H.rose, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><X size={9} /></button>
                  </div>
                ))}
                {atts.length < 4 && <button onClick={() => fRef.current?.click()} style={{ aspectRatio: '1', borderRadius: 8, border: '2px dashed var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><Plus size={15} /></button>}
              </div>
            ) : (
              <div onClick={() => fRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center', cursor: 'pointer' }}>
                <ImageIcon size={20} color="var(--muted-foreground)" style={{ margin: '0 auto 5px' }} />
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Drop receipts, photos here</p>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius)', background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-foreground)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button disabled={saving} onClick={async () => {
              if (!form.customerName || !form.subject || !form.message) { alert('Name, subject and message are required.'); return; }
              setSaving(true); await onSubmit({ ...form, attachments: atts.map(a => a.file) }); setSaving(false); onClose();
            }} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius)', background: H.coral, border: 'none', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: saving ? .6 : 1, boxShadow: `0 4px 12px ${H.coral}44` }}>
              {saving ? 'Sending…' : 'Submit Ticket'}
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
  const [filterStatus, setFilter] = useState<'all' | TStatus>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await getAllSupportTickets(); setTickets(d.filter((t: Ticket) => t.customerName === name)); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [name]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: any) => {
    if (!currentStore?.id) { alert('No store selected.'); return; }
    try { await createSupportTicket({ ...data, storeId: currentStore.id }); await load(); }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : 'Unknown'}`); }
  };

  const filtered = useMemo(() => {
    let r = [...tickets];
    if (search) r = r.filter(t => t.subject.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== 'all') r = r.filter(t => t.status === filterStatus);
    return r;
  }, [tickets, search, filterStatus]);

  const stats = { open: tickets.filter(t => t.status === 'open').length, prog: tickets.filter(t => t.status === 'in-progress').length, done: tickets.filter(t => t.status === 'resolved').length };

  const statusBadge = (s: TStatus) => {
    const map = { 'open': 'pill-cyan', 'in-progress': 'pill-amber', 'resolved': 'pill-green' };
    return <span className={`pill ${map[s]}`}>{s}</span>;
  };

  if (loading) return (
    <div className="db" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <style>{CSS}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${H.coral}`, borderTopColor: 'transparent', margin: '0 auto 14px' }} className="spin" />
        <p className="font-display" style={{ fontSize: 18, color: 'var(--foreground)' }}>Loading…</p>
      </div>
    </div>
  );

  return (
    <div className="db" style={{ padding: 24 }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Masthead */}
        <div className="in d1" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, paddingBottom: 20, borderBottom: '2px solid var(--foreground)' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', color: 'var(--muted-foreground)', marginBottom: 6 }}>SUPPORT CENTRE</p>
            <h1 className="font-display" style={{ fontSize: 42, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1, letterSpacing: '-0.02em' }}>
              Hello,<br />
              <span style={{ fontStyle: 'italic', color: H.coral }}>{name.split(' ')[0] || 'there'}</span>
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <button onClick={() => setShowModal(true)} disabled={!currentStore}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: H.coral, border: 'none', borderRadius: 'var(--radius)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: `0 4px 16px ${H.coral}40`, opacity: !currentStore ? .5 : 1 }}>
              <Plus size={14} /> Open Ticket
            </button>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted-foreground)' }}>
              {[{ icon: <Phone size={12} />, val: '+254 800 000 100' }, { icon: <Mail size={12} />, val: 'support@shop.co.ke' }, { icon: <Clock size={12} />, val: 'Mon–Sat 8–6PM' }].map((c, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{c.icon}{c.val}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="in d2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, marginBottom: 32, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {[
            { label: 'Open', val: stats.open, color: H.cyan, icon: <AlertCircle size={20} /> },
            { label: 'In Progress', val: stats.prog, color: H.amber, icon: <Clock size={20} /> },
            { label: 'Resolved', val: stats.done, color: H.emerald, icon: <CheckCircle2 size={20} /> },
          ].map((m, i) => (
            <div key={i} style={{ background: 'var(--card)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${m.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>{m.icon}</div>
              <div>
                <p className="font-display" style={{ fontSize: 32, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1 }}>{m.val}</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 3, fontWeight: 500 }}>{m.label} Tickets</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="in d3" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…" style={{ width: '100%', padding: '9px 12px 9px 34px', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all','open','in-progress','resolved'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', textTransform: 'capitalize', background: filterStatus === s ? H.coral : 'var(--muted)', color: filterStatus === s ? 'white' : 'var(--muted-foreground)', boxShadow: filterStatus === s ? `0 2px 8px ${H.coral}44` : 'none', transition: 'all .15s' }}>{s}</button>
            ))}
          </div>
        </div>

        {/* List + detail */}
        <div className="in d4" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.length === 0 ? (
              <div className="card" style={{ padding: '44px 20px', textAlign: 'center' }}>
                <p className="font-display-i" style={{ fontSize: 20, color: 'var(--muted-foreground)' }}>{tickets.length === 0 ? 'No tickets yet — open one above' : 'Nothing matches'}</p>
              </div>
            ) : filtered.map(t => (
              <div key={t.id} onClick={() => setSelected(t)} className="card lift" style={{ padding: '14px 18px', cursor: 'pointer', outline: selected?.id === t.id ? `2px solid ${H.coral}` : 'none', outlineOffset: -1, borderLeft: selected?.id === t.id ? `4px solid ${H.coral}` : '4px solid transparent', transition: 'all .15s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>{t.subject}</p>
                  {statusBadge(t.status)}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.message}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span>{t.category}</span>
                    {t.attachments?.length ? <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Paperclip size={10} />{t.attachments.length}</span> : null}
                    {t.reply && <span style={{ color: H.coral, fontWeight: 600 }}>↩ Reply</span>}
                  </div>
                  <span>{t.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="card" style={{ padding: '20px 22px', position: 'sticky', top: 20, alignSelf: 'start', borderTop: `4px solid ${H.coral}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 10, letterSpacing: '.08em', color: 'var(--muted-foreground)', fontWeight: 600 }}>#{selected.id.slice(0, 8).toUpperCase()}</p>
                  <p className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', marginTop: 2 }}>{selected.subject}</p>
                </div>
                <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><X size={12} /></button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {statusBadge(selected.status)}
                <span className="pill" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>{selected.category}</span>
              </div>
              <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 12 }}>
                <p style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--muted-foreground)', marginBottom: 5, fontWeight: 600 }}>YOUR MESSAGE</p>
                <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.65 }}>{selected.message}</p>
              </div>
              {selected.attachments?.length ? (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 10, letterSpacing: '.06em', color: 'var(--muted-foreground)', marginBottom: 7, fontWeight: 600 }}>ATTACHMENTS</p>
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
                <div style={{ background: `rgba(249,115,22,.06)`, border: `1px solid rgba(249,115,22,.18)`, borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                  <p style={{ fontSize: 10, letterSpacing: '.06em', color: H.coral, fontWeight: 700, marginBottom: 5 }}>SUPPORT REPLY</p>
                  <p style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.65 }}>{selected.reply}</p>
                </div>
              ) : (
                <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: 14, textAlign: 'center' }}>
                  <Clock size={15} color="var(--muted-foreground)" style={{ margin: '0 auto 5px' }} />
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Awaiting support team</p>
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

// ─── Staff Dashboard ──────────────────────────────────────────────────────────
function StaffDashboardView() {
  const { currentStore } = useStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ts, setTs] = useState(new Date());

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const sid = currentStore?.id ?? null;
      const [t, p] = await Promise.all([getAllTransactions(500, sid), getAllProducts(sid)]);
      setTransactions(t); setProducts(p); setTs(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [currentStore?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data
  const daily = useMemo(() => {
    const b: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); b[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0; }
    transactions.forEach(t => { const k = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); if (b[k] !== undefined) b[k] += t.total; });
    return Object.entries(b).map(([date, v]) => ({ date, v }));
  }, [transactions]);

  const catData = useMemo(() => {
    const m: Record<string, number> = {};
    transactions.forEach(t => t.items.forEach((item: any) => {
      const p = products.find(p => p.id === item.productId);
      const c = p?.category || 'Other'; m[c] = (m[c] || 0) + item.subtotal;
    }));
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [transactions, products]);

  const topProducts = useMemo(() => {
    const m: Record<string, any> = {};
    transactions.forEach(t => t.items.forEach((item: any) => {
      const p = products.find(p => p.id === item.productId); if (!p) return;
      if (!m[item.productId]) m[item.productId] = { name: p.name, rev: 0, qty: 0 };
      m[item.productId].rev += item.subtotal; m[item.productId].qty += item.quantity;
    }));
    return Object.values(m).sort((a, b) => b.rev - a.rev).slice(0, 5);
  }, [transactions, products]);

  const stats = useMemo(() => {
    const rev = transactions.reduce((s, t) => s + t.total, 0);
    const cnt = transactions.length;
    const last7  = new Date(Date.now() - 7  * 86400000);
    const prev7  = new Date(Date.now() - 14 * 86400000);
    const thisPeriod = transactions.filter(t => new Date(t.createdAt) >= last7).reduce((s, t) => s + t.total, 0);
    const prevPeriod = transactions.filter(t => { const d = new Date(t.createdAt); return d >= prev7 && d < last7; }).reduce((s, t) => s + t.total, 0);
    const today = transactions.filter(t => new Date(t.createdAt).toDateString() === new Date().toDateString()).reduce((s, t) => s + t.total, 0);
    return {
      rev, cnt, today,
      aov: cnt > 0 ? rev / cnt : 0,
      growth: prevPeriod > 0 ? ((thisPeriod - prevPeriod) / prevPeriod * 100) : 0,
      lowStock: products.filter(p => p.stock <= p.lowStockThreshold).length,
      topCat: catData[0],
    };
  }, [transactions, products, catData]);

  const sparkRev = useMemo(() => daily.slice(-10).map(d => d.v), [daily]);
  const weekData = useMemo(() => {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const buckets: Record<number, number> = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
    transactions.forEach(t => { const dow = new Date(t.createdAt).getDay(); buckets[dow === 0 ? 6 : dow - 1] += t.total; });
    return days.map((d, i) => ({ day: d, value: buckets[i] }));
  }, [transactions]);

  if (loading) return (
    <div className="db" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <style>{CSS}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${H.coral}`, borderTopColor: 'transparent', margin: '0 auto 16px' }} className="spin" />
        <p className="font-display-i" style={{ fontSize: 22, color: 'var(--foreground)' }}>Crunching numbers…</p>
        <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>{currentStore?.name}</p>
      </div>
    </div>
  );

  const isPositive = stats.growth >= 0;
  const today = new Date();

  return (
    <div className="db">
      <style>{CSS}</style>

      {/* ── Ticker bar ─────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--foreground)', overflow: 'hidden', height: 34, display: 'flex', alignItems: 'center' }}>
        <div className="ticker-inner" style={{ color: 'var(--background)', fontSize: 11, fontWeight: 600, letterSpacing: '.08em' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} style={{ paddingRight: 40 }}>
              {i % 2 === 0
                ? `✦ TOTAL REVENUE  ${formatCurrency(stats.rev)}  ·  AVG ORDER  ${formatCurrency(stats.aov)}  ·  TRANSACTIONS  ${stats.cnt}  ·  TODAY  ${formatCurrency(stats.today)}`
                : `✦ ${stats.lowStock > 0 ? `⚠ ${stats.lowStock} LOW STOCK  ·  ` : ''}TOP CATEGORY  ${stats.topCat?.name?.toUpperCase() ?? 'N/A'}  ·  WEEK GROWTH  ${isPositive ? '+' : ''}${stats.growth.toFixed(1)}%`}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: '28px 28px 48px', maxWidth: 1440, margin: '0 auto' }}>

        {/* ── Masthead ──────────────────────────────────────────────────── */}
        <header className="in d1" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'end', marginBottom: 28, paddingBottom: 24, borderBottom: '2px solid var(--foreground)' }}>
          <div>
            {/* Issue line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, fontSize: 11, fontWeight: 600, letterSpacing: '.1em', color: 'var(--muted-foreground)' }}>
              <span>VOL. 1</span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--muted-foreground)', display: 'inline-block' }} />
              <span>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--muted-foreground)', display: 'inline-block' }} />
              <span>{currentStore?.name?.toUpperCase() ?? 'ALL STORES'}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <button onClick={() => loadData(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.08em' }}>
                <RefreshCw size={11} className={refreshing ? 'spin' : ''} /> REFRESH
              </button>
            </div>
            {/* Giant headline */}
            <h1 className="font-display" style={{ fontSize: 'clamp(48px, 8vw, 96px)', fontWeight: 900, lineHeight: .9, letterSpacing: '-0.03em', color: 'var(--foreground)', marginBottom: 10 }}>
              Daily<br />
              <span style={{ fontStyle: 'italic', color: H.coral }}>Report</span>
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', maxWidth: 420, lineHeight: 1.6 }}>
              Real-time business intelligence for <strong style={{ color: 'var(--foreground)' }}>{currentStore?.name ?? 'all stores'}</strong>. Updated {ts.toLocaleTimeString()}.
            </p>
          </div>

          {/* Hero revenue block */}
          <div className="hatch" style={{ textAlign: 'right', padding: '20px 24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', minWidth: 260 }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', color: 'var(--muted-foreground)', marginBottom: 6 }}>ALL-TIME REVENUE</p>
            <p className="hero-num" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>
              <Counter to={stats.rev} prefix="KSh " decimals={0} />
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
              <span className={`pill ${isPositive ? 'pill-green' : 'pill-red'}`} style={{ fontSize: 12 }}>
                {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(stats.growth).toFixed(1)}% vs last week
              </span>
            </div>
            <div style={{ height: 60, marginTop: 12 }}>
              <Spark data={sparkRev} color={H.coral} h={60} />
            </div>
          </div>
        </header>

        {/* ── Section A: three-column KPI band ────────────────────────── */}
        <div className="in d2" style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr 1px 1fr', gap: 0, marginBottom: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--border)' }}>
          {[
            { label: "TODAY'S SALES",  value: formatCurrency(stats.today), sub: `${transactions.filter(t=>new Date(t.createdAt).toDateString()===new Date().toDateString()).length} orders`, color: H.coral,   icon: <Flame size={18}/> },
            { label: 'TRANSACTIONS',   value: stats.cnt,                   sub: 'Total all time',                                                                                          color: H.amber,   icon: <ShoppingCart size={18}/> },
            { label: 'AVG ORDER',      value: formatCurrency(stats.aov),   sub: 'Per transaction',                                                                                        color: H.violet,  icon: <Zap size={18}/> },
            { label: 'STOCK ALERTS',   value: stats.lowStock,              sub: 'Items below threshold',                                                                                  color: stats.lowStock > 0 ? H.rose : H.emerald, icon: <Package size={18}/> },
          ].map((m, i) => (
            <div key={i} style={{ background: 'var(--card)', padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted-foreground)' }}>{m.label}</p>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `${m.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>{m.icon}</div>
              </div>
              <p className="font-display" style={{ fontSize: 28, fontWeight: 900, color: 'var(--foreground)', lineHeight: 1, letterSpacing: '-0.02em' }}>{m.value}</p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 5, fontWeight: 500 }}>{m.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Section B: editorial asymmetric grid ────────────────────── */}
        <div className="in d3" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>

          {/* Left: big area chart */}
          <div className="card-paper stripe-coral" style={{ padding: '22px 22px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted-foreground)', marginBottom: 4 }}>30-DAY REVENUE CURVE</p>
                <p className="font-display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)' }}>Sales Performance</p>
              </div>
              <span className="pill pill-coral">30 days</span>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={daily} margin={{ top: 5, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={H.coral} stopOpacity=".2" />
                    <stop offset="100%" stopColor={H.coral} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="v" stroke={H.coral} strokeWidth={2.5} fill="url(#ga)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Right: weekly bar + category donut stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Weekly bar chart */}
            <div className="card-paper stripe-amber" style={{ padding: '18px 18px 10px', flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted-foreground)', marginBottom: 4 }}>WEEKLY PATTERN</p>
              <p className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>By Day of Week</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={weekData} margin={{ top: 0, right: 0, bottom: 0, left: -30 }} barSize={24}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="value" name="Sales" radius={[4, 4, 0, 0]}>
                    {weekData.map((e, i) => <Cell key={i} fill={e.value === Math.max(...weekData.map(d => d.value)) ? H.coral : H.warm} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown */}
            <div className="card-paper stripe-violet" style={{ padding: '18px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted-foreground)', marginBottom: 4 }}>CATEGORY SPLIT</p>
              <p className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', marginBottom: 12 }}>Top Categories</p>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flexShrink: 0 }}>
                  <ResponsiveContainer width={90} height={90}>
                    <PieChart>
                      <Pie data={catData.length ? catData : [{ name: 'None', value: 1 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={26} outerRadius={42} paddingAngle={3}>
                        {(catData.length ? catData : [{ name: 'None', value: 1 }]).map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                      </Pie>
                      <Tooltip content={<Tip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {(catData.length ? catData : []).slice(0, 4).map((c, i) => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: SERIES[i % SERIES.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)' }}>{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                  {catData.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No data yet</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section C: top products + recent transactions ────────────── */}
        <div className="in d4" style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 16, marginBottom: 16 }}>

          {/* Top products — magazine leaderboard style */}
          <div className="card-paper" style={{ padding: '22px 22px 8px', borderTop: `4px solid ${H.violet}` }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted-foreground)', marginBottom: 4 }}>PRODUCT RANKINGS</p>
            <p className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16 }}>Top Sellers</p>

            {topProducts.length === 0
              ? <p className="font-display-i" style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>No data yet</p>
              : topProducts.map((p, i) => {
                const pct = (p.rev / (topProducts[0]?.rev || 1)) * 100;
                const medals = ['I', 'II', 'III', 'IV', 'V'];
                return (
                  <div key={p.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
                      <span className="font-display" style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? H.coral : 'var(--muted-foreground)', minWidth: 20 }}>{medals[i]}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', flexShrink: 0 }}>{formatCurrency(p.rev)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="pb-track" style={{ flex: 1 }}>
                        <div className="pb-fill" style={{ width: `${pct}%`, background: i === 0 ? `linear-gradient(90deg,${H.coral},${H.amber})` : `${SERIES[i]}88` }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>{p.qty} sold</span>
                    </div>
                    {i < topProducts.length - 1 && <div className="divider" style={{ marginTop: 12 }} />}
                  </div>
                );
              })}
          </div>

          {/* Recent transactions — editorial table */}
          <div className="card-paper" style={{ padding: '22px 22px 8px', borderTop: `4px solid ${H.cyan}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted-foreground)', marginBottom: 4 }}>TRANSACTION LOG</p>
                <p className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)' }}>Recent Sales</p>
              </div>
              <a href="/dashboard/reports" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: H.coral, fontWeight: 700, textDecoration: 'none', paddingTop: 20 }}>
                Full report <ChevronRight size={13} />
              </a>
            </div>

            {transactions.length === 0
              ? <p className="font-display-i" style={{ color: 'var(--muted-foreground)', fontSize: 15, padding: '20px 0' }}>No transactions yet</p>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--foreground)' }}>
                      {['#', 'Transaction', 'Items', 'Method', 'Time', 'Amount'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', padding: '6px 10px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted-foreground)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 6).map((t, i) => (
                      <tr key={t.id} className="tr-hover" style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}>
                        <td style={{ padding: '10px', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', fontFamily: "'Fraunces', serif", fontStyle: 'italic' }}>{i + 1}</td>
                        <td style={{ padding: '10px', fontWeight: 600, color: 'var(--foreground)' }}>{t.transactionNumber}</td>
                        <td style={{ padding: '10px', color: 'var(--muted-foreground)' }}>{t.items.length}</td>
                        <td style={{ padding: '10px' }}><span className="pill pill-coral" style={{ fontSize: 10, padding: '2px 8px' }}>{t.paymentMethod}</span></td>
                        <td style={{ padding: '10px', color: 'var(--muted-foreground)', fontSize: 12 }}>{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: H.coral, fontFamily: "'Fraunces', serif", fontSize: 14 }}>{formatCurrency(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
        </div>

        {/* ── Section D: stock health footer strip ────────────────────── */}
        {products.length > 0 && (
          <div className="in d5 card-paper" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted-foreground)', marginBottom: 2 }}>INVENTORY STATUS</p>
              <p className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>{products.length} SKUs tracked</p>
            </div>
            <div className="divider-v" />
            {[
              { label: 'Healthy',       val: products.filter(p => p.stock > p.lowStockThreshold * 2).length, color: H.emerald },
              { label: 'Low Stock',     val: products.filter(p => p.stock > 0 && p.stock <= p.lowStockThreshold).length, color: H.amber },
              { label: 'Out of Stock',  val: products.filter(p => p.stock === 0).length, color: H.rose },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', align: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, marginTop: 4, flexShrink: 0 }} />
                <div>
                  <p className="font-display" style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>{s.label}</p>
                </div>
              </div>
            ))}
            {stats.lowStock > 0 && (
              <>
                <div className="divider-v" />
                <a href="/dashboard/inventory" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(239,68,68,.08)', border: `1px solid rgba(239,68,68,.2)`, borderRadius: 'var(--radius)', color: H.rose, fontSize: 12, fontWeight: 700, textDecoration: 'none', marginLeft: 'auto' }}>
                  <AlertCircle size={13} /> View Low Stock Items
                </a>
              </>
            )}
          </div>
        )}

        {/* ── Footer rule ─────────────────────────────────────────────── */}
        <div className="in d6" style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p className="font-display-i" style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>End of report · {ts.toLocaleString()}</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="/dashboard/reports" style={{ fontSize: 12, fontWeight: 600, color: H.coral, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>Analytics Studio <ChevronRight size={12} /></a>
            <a href="/dashboard/inventory" style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textDecoration: 'none' }}>Inventory</a>
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