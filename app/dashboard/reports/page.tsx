'use client';
// app/dashboard/reports/page.tsx — Premium Analytics · Sunrise Theme

import React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store-context';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, ComposedChart,
} from 'recharts';
import {
  Download, TrendingUp, DollarSign, Package, ShoppingCart, Activity,
  ArrowUpRight, ArrowDownRight, Target, Zap, BarChart2,
  PieChart as PieIcon, RefreshCw, Eye, Award, Layers, Clock, Flame,
} from 'lucide-react';
import { exportToCSV, exportToJSON } from '@/lib/export-utils';
import { formatCurrency, formatChartValue } from '@/lib/currency';
import { getAllTransactions } from '@/lib/supabase/transactions-helper';
import { getAllProducts } from '@/lib/supabase/products-helper';

// ─── Raw hex for SVG gradients (CSS vars can't be used inside SVG stopColor) ─
const HEX = {
  primary:   '#f97316',   // coral
  secondary: '#8b5cf6',   // violet
  accent:    '#f59e0b',   // amber
  cyan:      '#06b6d4',
  emerald:   '#10b981',
  rose:      '#ef4444',
};
const CHART_COLORS = [HEX.primary, HEX.secondary, HEX.cyan, HEX.accent, HEX.emerald];

// ─── Global styles (Sunrise CSS vars throughout) ─────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap');

  .rp { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--background); color: var(--foreground); min-height: 100vh; }
  .rp * { box-sizing: border-box; }

  .c {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: 0 1px 3px rgba(249,115,22,0.05), 0 1px 2px rgba(0,0,0,0.03);
  }
  .c-lift { transition: transform 0.2s, box-shadow 0.2s; }
  .c-lift:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(249,115,22,0.1); }

  .tab { padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 600; border: 1px solid var(--border); cursor: pointer; transition: all 0.15s; background: var(--card); color: var(--muted-foreground); }
  .tab:hover { border-color: var(--primary); color: var(--primary); }
  .tab-on { background: var(--primary) !important; color: var(--primary-foreground) !important; border-color: var(--primary) !important; box-shadow: 0 2px 8px rgba(249,115,22,0.28); }

  .rpill { padding: 5px 13px; border-radius: 99px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; }
  .rpill-on  { background: var(--primary); color: white; }
  .rpill-off { background: transparent; color: var(--muted-foreground); }
  .rpill-off:hover { background: var(--muted); color: var(--foreground); }

  .progress-track { height: 4px; background: var(--muted); border-radius: 99px; overflow: hidden; }
  .progress-fill  { height: 100%; border-radius: 99px; transition: width 1s cubic-bezier(0.34,1.56,0.64,1); }

  @keyframes fu { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
  .fu  { animation: fu 0.4s ease forwards; opacity:0; }
  .fu1 { animation-delay:.04s } .fu2 { animation-delay:.09s } .fu3 { animation-delay:.14s }
  .fu4 { animation-delay:.19s } .fu5 { animation-delay:.24s }

  @keyframes spin { to { transform:rotate(360deg); } }
  .spin { animation: spin 0.8s linear infinite; }

  .recharts-cartesian-grid-horizontal line,
  .recharts-cartesian-grid-vertical   line { stroke: var(--border) !important; }
  .recharts-xAxis .recharts-cartesian-axis-line,
  .recharts-yAxis .recharts-cartesian-axis-line { stroke: transparent !important; }
  .recharts-text { fill: var(--muted-foreground) !important; font-size: 11px !important; font-family: 'Plus Jakarta Sans' !important; }

  .tbl-row:hover { background: var(--muted); }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

  .badge-g { background: rgba(16,185,129,0.12);  color:#10b981; border:1px solid rgba(16,185,129,0.25); border-radius:99px; }
  .badge-a { background: rgba(245,158,11,0.12);  color:#f59e0b; border:1px solid rgba(245,158,11,0.25); border-radius:99px; }
  .badge-r { background: rgba(239,68,68,0.12);   color:#ef4444; border:1px solid rgba(239,68,68,0.25);  border-radius:99px; }
  .badge-p { background: rgba(249,115,22,0.10);  color:var(--primary); border:1px solid rgba(249,115,22,0.22); border-radius:99px; }
`;

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
  const id = `sp${color.replace(/\W/g, '')}`;
  return (
    <svg viewBox="0 0 100 50" style={{ width: 60, height: 24 }} preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity=".25" /><stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <polygon points={`0,100 ${pts} 100,100`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Donut gauge ──────────────────────────────────────────────────────────────
function Gauge({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(value / Math.max(max, 1), 1);
  const r = 32, c = 40, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--muted)" strokeWidth="7" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
        <text x={c} y={c + 5} textAnchor="middle" fill="var(--foreground)" fontSize="12" fontWeight="700">{Math.round(pct * 100)}%</text>
      </svg>
      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>{label}</p>
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', boxShadow: '0 4px 16px rgba(249,115,22,0.1)' }}>
      {label && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 700, color: p.color || p.stroke || 'var(--foreground)' }}>
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Section header ───────────────────────────────────────────────────────────
function SH({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>{icon}</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>{title}</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{sub}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { currentStore } = useStore();
  const [dateRange, setDateRange] = useState<'7d'|'30d'|'90d'|'all'>('30d');
  const [tab, setTab] = useState<'overview'|'products'|'categories'|'forecast'>('overview');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const sid = currentStore?.id ?? null;
      const [t, p] = await Promise.all([getAllTransactions(1000, sid), getAllProducts(sid)]);
      setTransactions(t); setProducts(p); setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [currentStore?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const filt = useMemo(() => {
    if (dateRange === 'all') return transactions;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cut = new Date(Date.now() - days * 86400000);
    return transactions.filter(t => new Date(t.createdAt) >= cut);
  }, [transactions, dateRange]);

  const metrics = useMemo(() => {
    const rev = filt.reduce((s, t) => s + t.total, 0);
    const cost = filt.reduce((s, t) => s + t.items.reduce((is: number, item: any) => {
      const p = products.find(p => p.id === item.productId);
      return is + (p ? p.cost * item.quantity : 0);
    }, 0), 0);
    const profit = rev - cost;
    const orders = filt.length;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const prevRev = dateRange !== 'all' ? transactions.filter(t => {
      const d = new Date(t.createdAt);
      return d >= new Date(Date.now() - days * 2 * 86400000) && d < new Date(Date.now() - days * 86400000);
    }).reduce((s, t) => s + t.total, 0) : 0;
    const growth = prevRev > 0 ? ((rev - prevRev) / prevRev * 100) : 0;
    const items = filt.reduce((s, t) => s + t.items.reduce((is: number, i: any) => is + i.quantity, 0), 0);
    return { rev, cost, profit, orders, growth, items, margin: rev > 0 ? profit/rev*100 : 0, aov: orders > 0 ? rev/orders : 0 };
  }, [filt, transactions, products, dateRange]);

  const daily = useMemo(() => {
    const n = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
    const b: Record<string, { rev: number; orders: number }> = {};
    for (let i = n-1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate()-i); b[d.toLocaleDateString('en-US',{month:'short',day:'numeric'})] = {rev:0,orders:0}; }
    filt.forEach(t => { const k = new Date(t.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}); if (b[k]) { b[k].rev += t.total; b[k].orders++; } });
    return Object.entries(b).map(([date,d])=>({date,revenue:d.rev,orders:d.orders}));
  }, [filt, dateRange]);

  const hourly = useMemo(() => {
    const h: Record<number,number> = {}; for (let i=0;i<24;i++) h[i]=0;
    filt.forEach(t => h[new Date(t.createdAt).getHours()]++);
    return Object.entries(h).map(([hr,count])=>({hour:`${hr}h`,count}));
  }, [filt]);

  const prodPerf = useMemo(() => {
    const map: Record<string,any> = {};
    filt.forEach(t => t.items.forEach((item: any) => {
      const p = products.find(p => p.id === item.productId); if (!p) return;
      if (!map[item.productId]) map[item.productId] = {name:p.name,qty:0,revenue:0,cost:0,category:p.category||'Other'};
      map[item.productId].qty += item.quantity;
      map[item.productId].revenue += item.subtotal;
      map[item.productId].cost += p.cost * item.quantity;
    }));
    return Object.values(map).map(p=>({...p,profit:p.revenue-p.cost,margin:p.revenue>0?(p.revenue-p.cost)/p.revenue*100:0})).sort((a,b)=>b.revenue-a.revenue);
  }, [filt, products]);

  const catData = useMemo(() => {
    const map: Record<string,number> = {};
    filt.forEach(t => t.items.forEach((item: any) => {
      const p = products.find(p => p.id === item.productId);
      const c = p?.category||'Other'; map[c]=(map[c]||0)+item.subtotal;
    }));
    return Object.entries(map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  }, [filt, products]);

  const stock = useMemo(() => ({
    healthy: products.filter(p=>p.stock>p.lowStockThreshold*2).length,
    low:     products.filter(p=>p.stock>0&&p.stock<=p.lowStockThreshold).length,
    crit:    products.filter(p=>p.stock===0).length,
    total:   products.length,
  }), [products]);

  const forecast = useMemo(() => {
    const r = daily.slice(-7), avg = r.reduce((s,d)=>s+d.revenue,0)/Math.max(r.length,1);
    const trend = r.length>1 ? (r[r.length-1].revenue-r[0].revenue)/r.length : 0;
    return Array.from({length:7},(_,i)=>({
      date: (()=>{const d=new Date();d.setDate(d.getDate()+i+1);return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});})(),
      projected: Math.max(0,avg+trend*i), low: Math.max(0,avg+trend*i-avg*0.2), high: Math.max(0,avg+trend*i+avg*0.2),
    }));
  }, [daily]);

  const sparkRev  = useMemo(() => daily.slice(-10).map(d=>d.revenue), [daily]);
  const sparkOrd  = useMemo(() => daily.slice(-10).map(d=>d.orders),  [daily]);

  const handleExport = (fmt: 'csv'|'json') => {
    if (fmt === 'csv') exportToCSV(prodPerf.map(p=>({Product:p.name,Category:p.category,Qty:p.qty,Revenue:formatCurrency(p.revenue),Profit:formatCurrency(p.profit),'Margin%':`${p.margin.toFixed(1)}%`})),`report-${new Date().toISOString().split('T')[0]}.csv`);
    else exportToJSON({store:currentStore?.name,metrics,products:prodPerf,categories:catData,forecast},`report-${new Date().toISOString().split('T')[0]}.json`);
  };

  if (loading) return (
    <div className="rp" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
      <style>{CSS}</style>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,borderRadius:'50%',border:'3px solid var(--primary)',borderTopColor:'transparent',margin:'0 auto 14px'}} className="spin"/>
        <p style={{fontWeight:600,color:'var(--foreground)'}}>Building your analytics…</p>
        <p style={{fontSize:12,color:'var(--muted-foreground)',marginTop:4}}>{currentStore?.name??'All Stores'}</p>
      </div>
    </div>
  );

  return (
    <div className="rp">
      <style>{CSS}</style>
      {/* Sunrise gradient bar */}
      <div style={{height:3,background:'linear-gradient(90deg,var(--primary),var(--accent),var(--secondary))'}}/>

      <div style={{maxWidth:1440,margin:'0 auto',padding:'24px 24px 40px'}}>

        {/* Header */}
        <div className="fu fu1" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,marginBottom:28,flexWrap:'wrap'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span className="badge-p" style={{fontSize:11,padding:'2px 10px',fontWeight:700}}>● LIVE</span>
              <span style={{fontSize:12,color:'var(--muted-foreground)'}}>Updated {lastUpdated.toLocaleTimeString()}</span>
            </div>
            <h1 style={{fontSize:29,fontWeight:800,color:'var(--foreground)',fontFamily:"'Space Grotesk',sans-serif",letterSpacing:'-0.02em',lineHeight:1.1}}>Analytics Studio</h1>
            <p style={{color:'var(--muted-foreground)',fontSize:13,marginTop:4}}>{currentStore?.name??'All Stores'} · {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <div className="c" style={{display:'flex',alignItems:'center',padding:4,gap:2}}>
              {(['7d','30d','90d','all'] as const).map(r=>(
                <button key={r} onClick={()=>setDateRange(r)} className={`rpill ${dateRange===r?'rpill-on':'rpill-off'}`}>{r==='all'?'All time':r}</button>
              ))}
            </div>
            <button onClick={()=>loadData(true)} className="c" style={{width:37,height:37,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted-foreground)',opacity:refreshing?0.5:1}}>
              <RefreshCw size={14} className={refreshing?'spin':''}/>
            </button>
            <button onClick={()=>handleExport('csv')} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'var(--primary)',border:'none',borderRadius:'var(--radius)',color:'white',fontWeight:700,fontSize:12,cursor:'pointer',boxShadow:'0 2px 8px rgba(249,115,22,0.28)'}}>
              <Download size={13}/> Export CSV
            </button>
            <button onClick={()=>handleExport('json')} className="c" style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',border:'none',cursor:'pointer',color:'var(--muted-foreground)',fontWeight:600,fontSize:12}}>
              <Download size={13}/> JSON
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="fu fu2" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:20}}>
          {[
            {label:'Total Revenue',  value:formatCurrency(metrics.rev),    sub:`${metrics.growth>=0?'↑':'↓'} ${Math.abs(metrics.growth).toFixed(1)}% vs prior`,  color:HEX.primary,   icon:<DollarSign size={15}/>,   spark:sparkRev, pos:metrics.growth>=0},
            {label:'Gross Profit',   value:formatCurrency(metrics.profit), sub:`${metrics.margin.toFixed(1)}% margin`,                                             color:HEX.secondary, icon:<TrendingUp size={15}/>,   spark:sparkRev.map(v=>v*0.35), pos:true},
            {label:'Orders',         value:metrics.orders,                  sub:`${metrics.items} items sold`,                                                     color:HEX.cyan,      icon:<ShoppingCart size={15}/>, spark:sparkOrd, pos:true},
            {label:'Avg Order Value',value:formatCurrency(metrics.aov),    sub:'Per transaction',                                                                  color:HEX.accent,    icon:<Zap size={15}/>,          spark:Array.from({length:10},()=>metrics.aov*(0.7+Math.random()*0.6)), pos:true},
          ].map((m,i)=>(
            <div key={i} className="c c-lift" style={{padding:'18px',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:-24,right:-24,width:80,height:80,borderRadius:'50%',background:`radial-gradient(circle,${m.color}1a 0%,transparent 70%)`}}/>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                <div style={{width:32,height:32,borderRadius:10,background:`${m.color}15`,display:'flex',alignItems:'center',justifyContent:'center',color:m.color}}>{m.icon}</div>
                <span style={{display:'flex',alignItems:'center',gap:3,fontSize:11,fontWeight:700,padding:'2px 7px',borderRadius:99,background:m.pos?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)',color:m.pos?HEX.emerald:HEX.rose}}>
                  {m.pos?<ArrowUpRight size={10}/>:<ArrowDownRight size={10}/>}
                </span>
              </div>
              <div style={{fontSize:25,fontWeight:800,color:'var(--foreground)',fontFamily:"'Space Grotesk',sans-serif",marginBottom:6}}>{m.value}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <p style={{fontSize:12,color:'var(--muted-foreground)',fontWeight:600}}>{m.label}</p>
                  <p style={{fontSize:11,color:'var(--muted-foreground)',marginTop:2,opacity:.7}}>{m.sub}</p>
                </div>
                <Spark data={m.spark} color={m.color}/>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="fu fu2" style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
          {([
            {id:'overview',   label:'Overview',   icon:<BarChart2 size={12}/>},
            {id:'products',   label:'Products',   icon:<Package size={12}/>},
            {id:'categories', label:'Categories', icon:<PieIcon size={12}/>},
            {id:'forecast',   label:'Forecast',   icon:<Target size={12}/>},
          ] as const).map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className={`tab${tab===t.id?' tab-on':''}`}>
              <span style={{display:'flex',alignItems:'center',gap:5}}>{t.icon}{t.label}</span>
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab==='overview' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="fu fu3" style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
              {/* Revenue + orders combo */}
              <div className="c" style={{padding:20}}>
                <SH icon={<TrendingUp size={14}/>} title="Revenue Trend" sub={`Last ${dateRange==='all'?'all time':dateRange} · ${filt.length} transactions`}/>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={daily} margin={{top:5,right:5,bottom:0,left:0}}>
                    <defs>
                      <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={HEX.primary} stopOpacity=".18"/><stop offset="100%" stopColor={HEX.primary} stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="0"/>
                    <XAxis dataKey="date" tick={{fontSize:10}} tickLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                    <Tooltip content={<Tip/>}/>
                    <Area type="monotone" dataKey="revenue" stroke={HEX.primary} strokeWidth={2.5} fill="url(#gR)" name="Revenue"/>
                    <Bar dataKey="orders" fill={HEX.accent} fillOpacity={.5} radius={[3,3,0,0]} name="Orders"/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {/* Peak hours */}
              <div className="c" style={{padding:20}}>
                <SH icon={<Clock size={14}/>} title="Peak Hours" sub="Order volume by hour"/>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={hourly} margin={{top:5,right:0,bottom:0,left:-20}}>
                    <CartesianGrid strokeDasharray="0"/>
                    <XAxis dataKey="hour" tick={{fontSize:9}} tickLine={false} interval={3}/>
                    <YAxis tick={{fontSize:9}} tickLine={false}/>
                    <Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Orders" radius={[3,3,0,0]}>
                      {hourly.map((e,i)=><Cell key={i} fill={e.count===Math.max(...hourly.map(h=>h.count))?HEX.primary:'#fed7aa'}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="fu fu4" style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:16}}>
              {/* Stock gauges */}
              <div className="c" style={{padding:20}}>
                <SH icon={<Layers size={14}/>} title="Inventory Health" sub={`${products.length} total SKUs`}/>
                <div style={{display:'flex',justifyContent:'space-around',margin:'10px 0 14px'}}>
                  <Gauge value={stock.healthy} max={stock.total} color={HEX.emerald} label="Healthy"/>
                  <Gauge value={stock.low}     max={stock.total} color={HEX.accent}  label="Low"/>
                  <Gauge value={stock.crit}    max={stock.total} color={HEX.rose}    label="Critical"/>
                </div>
                {[
                  {label:'In Stock',     val:stock.healthy, color:HEX.emerald},
                  {label:'Low Stock',    val:stock.low,     color:HEX.accent},
                  {label:'Out of Stock', val:stock.crit,    color:HEX.rose},
                ].map(s=>(
                  <div key={s.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:s.color}}/>
                      <span style={{fontSize:12,color:'var(--muted-foreground)'}}>{s.label}</span>
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--foreground)'}}>{s.val} SKUs</span>
                  </div>
                ))}
              </div>

              {/* Top products leaderboard */}
              <div className="c" style={{padding:20}}>
                <SH icon={<Award size={14}/>} title="Top Revenue Drivers" sub="Best performing products"/>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {prodPerf.slice(0,5).map((p,i)=>{
                    const pct=(p.revenue/(prodPerf[0]?.revenue||1))*100;
                    return (
                      <div key={p.name}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                            <span style={{fontSize:15}}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                            <span style={{fontSize:13,fontWeight:600,color:'var(--foreground)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                            <span style={{fontSize:11,color:'var(--muted-foreground)',flexShrink:0}}>{p.qty} sold</span>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:8}}>
                            <span style={{fontSize:13,fontWeight:800,color:'var(--foreground)',fontFamily:"'Space Grotesk',sans-serif"}}>{formatCurrency(p.revenue)}</span>
                            <span className={p.margin>=40?'badge-g':p.margin>=20?'badge-a':'badge-r'} style={{fontSize:10,padding:'2px 7px',fontWeight:700}}>{p.margin.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="progress-track"><div className="progress-fill" style={{width:`${pct}%`,background:`linear-gradient(90deg,${CHART_COLORS[i]},${CHART_COLORS[i]}99)`}}/></div>
                      </div>
                    );
                  })}
                  {prodPerf.length===0&&<p style={{textAlign:'center',color:'var(--muted-foreground)',fontSize:13,padding:'20px 0'}}>No sales data yet</p>}
                </div>
              </div>
            </div>

            {/* Financial summary */}
            <div className="fu fu5 c" style={{padding:'18px 24px'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
                {[
                  {label:'Total Cost (COGS)',    value:formatCurrency(metrics.cost),  sub:'Cost of goods sold', color:HEX.rose},
                  {label:'Profit Margin',        value:`${metrics.margin.toFixed(1)}%`, sub:'Gross margin',    color:HEX.emerald},
                  {label:'Items Sold',           value:metrics.items.toLocaleString(), sub:'Units this period',color:HEX.cyan},
                  {label:'Revenue / Active Day', value:formatCurrency(metrics.rev/Math.max(daily.filter(d=>d.revenue>0).length,1)), sub:'Avg active day', color:HEX.primary},
                ].map((s,i)=>(
                  <div key={i} style={{padding:'0 20px',borderLeft:i>0?'1px solid var(--border)':'none'}}>
                    <p style={{fontSize:11,color:'var(--muted-foreground)',marginBottom:4,fontWeight:500}}>{s.label}</p>
                    <p style={{fontSize:21,fontWeight:800,color:s.color,fontFamily:"'Space Grotesk',sans-serif"}}>{s.value}</p>
                    <p style={{fontSize:11,color:'var(--muted-foreground)',marginTop:2,opacity:.6}}>{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ PRODUCTS ══ */}
        {tab==='products' && (
          <div className="fu fu3" style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="c" style={{padding:20}}>
              <SH icon={<BarChart2 size={14}/>} title="Revenue vs Profit by Product" sub="Top 10 by revenue"/>
              {prodPerf.length===0?<p style={{textAlign:'center',color:'var(--muted-foreground)',padding:'40px 0'}}>No data yet</p>:(
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={prodPerf.slice(0,10)} layout="vertical" margin={{left:0,right:20,top:5,bottom:5}}>
                    <CartesianGrid strokeDasharray="0" horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:10}} tickLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                    <YAxis dataKey="name" type="category" width={140} tick={{fontSize:11}} tickLine={false}/>
                    <Tooltip content={<Tip/>}/>
                    <Bar dataKey="revenue" fill={HEX.primary}   fillOpacity={.85} radius={[0,4,4,0]} name="Revenue"/>
                    <Bar dataKey="profit"  fill={HEX.secondary} fillOpacity={.85} radius={[0,4,4,0]} name="Profit"/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="c" style={{overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
                <SH icon={<Package size={14}/>} title="Product Performance Table" sub={`${prodPerf.length} products`}/>
              </div>
              {prodPerf.length===0?<p style={{textAlign:'center',color:'var(--muted-foreground)',padding:'40px 0',fontSize:13}}>No sales data yet</p>:(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',fontSize:13,borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:'var(--muted)'}}>
                        {['Product','Category','Qty','Revenue','Cost','Profit','Margin'].map(h=>(
                          <th key={h} style={{textAlign:h==='Product'||h==='Category'?'left':'right',padding:'10px 16px',fontSize:11,fontWeight:700,color:'var(--muted-foreground)',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {prodPerf.map(p=>(
                        <tr key={p.name} className="tbl-row" style={{borderBottom:'1px solid var(--border)',transition:'background .12s'}}>
                          <td style={{padding:'10px 16px',fontWeight:600,color:'var(--foreground)'}}>{p.name}</td>
                          <td style={{padding:'10px 16px',color:'var(--muted-foreground)',fontSize:12}}>{p.category}</td>
                          <td style={{padding:'10px 16px',textAlign:'right',color:'var(--foreground)'}}>{p.qty}</td>
                          <td style={{padding:'10px 16px',textAlign:'right',fontWeight:700,color:HEX.primary}}>{formatCurrency(p.revenue)}</td>
                          <td style={{padding:'10px 16px',textAlign:'right',color:HEX.rose}}>{formatCurrency(p.cost)}</td>
                          <td style={{padding:'10px 16px',textAlign:'right',fontWeight:700,color:'var(--foreground)'}}>{formatCurrency(p.profit)}</td>
                          <td style={{padding:'10px 16px',textAlign:'right'}}>
                            <span className={p.margin>=50?'badge-g':p.margin>=25?'badge-a':'badge-r'} style={{fontSize:11,padding:'2px 8px',fontWeight:700}}>{p.margin.toFixed(1)}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ CATEGORIES ══ */}
        {tab==='categories' && (
          <div className="fu fu3" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div className="c" style={{padding:20}}>
              <SH icon={<PieIcon size={14}/>} title="Revenue by Category" sub="Distribution"/>
              {catData.length===0?<p style={{textAlign:'center',color:'var(--muted-foreground)',padding:'60px 0',fontSize:13}}>No data</p>:(
                <ResponsiveContainer width="100%" height={290}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={105} paddingAngle={3}
                      label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={{stroke:'var(--border)'}}>
                      {catData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip content={<Tip/>}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="c" style={{padding:20}}>
              <SH icon={<BarChart2 size={14}/>} title="Category Comparison" sub="Ranked by revenue"/>
              <div style={{display:'flex',flexDirection:'column',gap:13,marginTop:8}}>
                {catData.slice(0,8).map((c,i)=>(
                  <div key={c.name}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:10,height:10,borderRadius:3,background:CHART_COLORS[i%CHART_COLORS.length]}}/>
                        <span style={{fontSize:13,color:'var(--foreground)',fontWeight:500}}>{c.name}</span>
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:'var(--foreground)',fontFamily:"'Space Grotesk',sans-serif"}}>{formatCurrency(c.value)}</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill" style={{width:`${(c.value/(catData[0]?.value||1))*100}%`,background:CHART_COLORS[i%CHART_COLORS.length]}}/></div>
                  </div>
                ))}
                {catData.length===0&&<p style={{textAlign:'center',color:'var(--muted-foreground)',fontSize:13}}>No data yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* ══ FORECAST ══ */}
        {tab==='forecast' && (
          <div className="fu fu3" style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="c" style={{padding:20,borderTop:`3px solid ${HEX.secondary}`}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
                <SH icon={<Target size={14}/>} title="7-Day Revenue Forecast" sub="Based on historical trend extrapolation"/>
                <span style={{fontSize:11,padding:'3px 10px',borderRadius:99,background:'rgba(139,92,246,0.1)',color:HEX.secondary,border:'1px solid rgba(139,92,246,0.22)',fontWeight:700,flexShrink:0}}>AI Projection</span>
              </div>
              <ResponsiveContainer width="100%" height={270}>
                <ComposedChart data={[...daily.slice(-14),...forecast.map(f=>({date:f.date,revenue:0,projected:f.projected,low:f.low,high:f.high}))]} margin={{top:5,right:20,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="gAct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={HEX.primary} stopOpacity=".16"/><stop offset="100%" stopColor={HEX.primary} stopOpacity="0"/>
                    </linearGradient>
                    <linearGradient id="gPrj" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={HEX.secondary} stopOpacity=".18"/><stop offset="100%" stopColor={HEX.secondary} stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0"/>
                  <XAxis dataKey="date" tick={{fontSize:10}} tickLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                  <Tooltip content={<Tip/>}/>
                  <Area type="monotone" dataKey="revenue"   stroke={HEX.primary}   strokeWidth={2.5} fill="url(#gAct)" name="Actual"/>
                  <Area type="monotone" dataKey="projected" stroke={HEX.secondary} strokeWidth={2} strokeDasharray="5 3" fill="url(#gPrj)" name="Projected"/>
                  <Area type="monotone" dataKey="high" stroke="transparent" fill={HEX.secondary} fillOpacity={.05} name="Upper"/>
                  <Area type="monotone" dataKey="low"  stroke="transparent" fill={HEX.secondary} fillOpacity={.05} name="Lower"/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {[
                {label:'Projected 7-Day', value:formatCurrency(forecast.reduce((s,f)=>s+f.projected,0)), icon:<TrendingUp size={15}/>, color:HEX.secondary},
                {label:'Best Case',       value:formatCurrency(forecast.reduce((s,f)=>s+f.high,0)),      icon:<Flame size={15}/>,     color:HEX.emerald},
                {label:'Conservative',    value:formatCurrency(forecast.reduce((s,f)=>s+f.low,0)),       icon:<Eye size={15}/>,       color:HEX.accent},
              ].map((s,i)=>(
                <div key={i} className="c" style={{padding:'16px',display:'flex',alignItems:'center',gap:14}}>
                  <div style={{width:38,height:38,borderRadius:11,background:`${s.color}15`,display:'flex',alignItems:'center',justifyContent:'center',color:s.color,flexShrink:0}}>{s.icon}</div>
                  <div>
                    <p style={{fontSize:11,color:'var(--muted-foreground)',fontWeight:500}}>{s.label}</p>
                    <p style={{fontSize:19,fontWeight:800,color:'var(--foreground)',fontFamily:"'Space Grotesk',sans-serif"}}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="c" style={{padding:'13px 18px',background:'var(--muted)'}}>
              <p style={{fontSize:12,color:'var(--muted-foreground)',lineHeight:1.7}}>
                ⚠️ Forecast uses a linear trend model based on your last 7 days of actual sales. Confidence bands represent ±20% variance. Connect external factors via the API integration for higher accuracy.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}