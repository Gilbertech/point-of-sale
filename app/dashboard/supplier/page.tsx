'use client';
// File: app/dashboard/supplier/page.tsx
// Comprehensive supplier management — profile cards, order history, performance,
// contact log, documents, spend analytics, and full CRUD.

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search, Plus, Edit2, Trash2, X, Truck, TrendingUp, Check,
  MapPin, Package, Store, Phone, Mail, Globe, Star, FileText,
  ChevronDown, ChevronUp, BarChart2, Calendar, DollarSign,
  MessageSquare, Clock, ExternalLink, ShoppingCart, AlertTriangle,
  CheckCircle2, XCircle, Filter, ArrowUpDown, Building2, Hash,
  Paperclip, Send, Eye, MoreVertical, Activity, Zap, Award,
  RefreshCw, Download,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context';
import {
  getAllSuppliers, createSupplier, updateSupplier, deleteSupplier,
} from '@/lib/supabase/suppliers-helper';
import { getAllStores } from '@/lib/supabase/stores-helper';
import { supabase } from '@/lib/supabase/client';
import type { Store as StoreType } from '@/lib/supabase/stores-helper';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface Supplier {
  id: string; name: string; contactPerson: string; email: string;
  phone: string; address: string; city: string; country: string;
  category: string; status: 'active' | 'inactive';
  totalOrders: number; totalSpent: number; lastOrderDate: string | null;
  notes: string; storeId: string | null; createdAt: Date;
  website?: string; taxPin?: string; paymentTerms?: string;
  leadTimeDays?: number; minOrderValue?: number; rating?: number;
  bankName?: string; bankAccount?: string; bankBranch?: string;
}

interface SupplierOrder {
  id: string; supplierId: string; orderNumber: string; orderDate: string;
  expectedDate: string; deliveredDate: string | null; status: 'pending' | 'ordered' | 'delivered' | 'cancelled' | 'partial';
  items: { productName: string; qty: number; unitPrice: number; total: number }[];
  totalAmount: number; notes: string; createdAt: Date;
}

interface ContactLog {
  id: string; supplierId: string; type: 'call' | 'email' | 'meeting' | 'whatsapp';
  subject: string; notes: string; contactedBy: string; contactedAt: Date;
}

type Tab = 'overview' | 'orders' | 'contacts' | 'analytics';

const CATEGORIES = [
  'Produce', 'Beverages', 'Dry Goods', 'Dairy',
  'Meat & Poultry', 'Household', 'Stationery', 'Electronics', 'Other',
];

const PAYMENT_TERMS = ['Cash on Delivery', 'Net 7', 'Net 14', 'Net 30', 'Net 60', 'Prepaid'];

const ORDER_STATUS_CONFIG = {
  pending:   { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
  ordered:   { color: 'bg-blue-100 text-blue-800',    icon: <ShoppingCart className="w-3 h-3" /> },
  delivered: { color: 'bg-green-100 text-green-800',  icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { color: 'bg-red-100 text-red-800',      icon: <XCircle className="w-3 h-3" /> },
  partial:   { color: 'bg-orange-100 text-orange-800',icon: <AlertTriangle className="w-3 h-3" /> },
};

const CONTACT_TYPE_CONFIG = {
  call:     { color: 'bg-green-100 text-green-800',  icon: <Phone className="w-3 h-3" /> },
  email:    { color: 'bg-blue-100 text-blue-800',    icon: <Mail className="w-3 h-3" /> },
  meeting:  { color: 'bg-purple-100 text-purple-800',icon: <MessageSquare className="w-3 h-3" /> },
  whatsapp: { color: 'bg-teal-100 text-teal-800',    icon: <MessageSquare className="w-3 h-3" /> },
};

// ══════════════════════════════════════════════════════════════════════════════
// STAR RATING
// ══════════════════════════════════════════════════════════════════════════════

function StarRating({ value, onChange, readOnly }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" onClick={() => !readOnly && onChange?.(i)} className={readOnly ? 'cursor-default' : 'cursor-pointer'}>
          <Star className={`w-4 h-4 ${i <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL WRAPPER
// ══════════════════════════════════════════════════════════════════════════════

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <Card className={`w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} bg-card border-border shadow-2xl my-4`}>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <CardTitle className="text-foreground">{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="pt-4 max-h-[75vh] overflow-y-auto">{children}</CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUPPLIER FORM MODAL — comprehensive fields
// ══════════════════════════════════════════════════════════════════════════════

function SupplierModal({ supplier, currentStore, stores, isAdmin, onClose, onSave }: {
  supplier: Supplier | null; currentStore: StoreType | null; stores: StoreType[];
  isAdmin: boolean; onClose: () => void; onSave: (d: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    // Basic
    name: supplier?.name ?? '', contactPerson: supplier?.contactPerson ?? '',
    email: supplier?.email ?? '', phone: supplier?.phone ?? '',
    address: supplier?.address ?? '', city: supplier?.city ?? '',
    country: supplier?.country ?? 'Kenya', category: supplier?.category ?? 'Dry Goods',
    status: supplier?.status ?? 'active' as 'active' | 'inactive',
    // ── Always use currentStore — no manual branch selection ──
    notes: supplier?.notes ?? '', storeId: currentStore?.id ?? '',
    website: supplier?.website ?? '', taxPin: supplier?.taxPin ?? '',
    // Commercial
    paymentTerms: supplier?.paymentTerms ?? 'Net 30',
    leadTimeDays: supplier?.leadTimeDays ?? 7,
    minOrderValue: supplier?.minOrderValue ?? 0,
    rating: supplier?.rating ?? 0,
    // Banking
    bankName: supplier?.bankName ?? '', bankAccount: supplier?.bankAccount ?? '',
    bankBranch: supplier?.bankBranch ?? '',
    // Stats (admin only)
    totalSpent: supplier?.totalSpent ?? 0,
    lastOrderDate: supplier?.lastOrderDate ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<'basic' | 'commercial' | 'banking'>('basic');
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.contactPerson || !form.phone) {
      alert('Name, contact person and phone are required.'); return;
    }
    setSaving(true);
    // Always assign to currentStore — storeId not user-editable
    await onSave({ ...form, storeId: currentStore?.id ?? null });
    setSaving(false);
  };

  const SECTIONS = [
    { key: 'basic', label: 'Basic Info' },
    { key: 'commercial', label: 'Commercial' },
    { key: 'banking', label: 'Banking' },
  ] as const;

  return (
    <Modal title={supplier ? 'Edit Supplier' : 'Add New Supplier'} onClose={onClose} wide>
      {/* Branch indicator — auto-assigned from currentStore, no manual selection */}
      <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 mb-4">
        <Store className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Branch (auto-assigned)</p>
          <p className="text-sm font-semibold text-foreground truncate">
            {currentStore?.name ?? 'No branch selected — supplier will be unassigned'}
          </p>
        </div>
        {currentStore && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${section === s.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── BASIC INFO ── */}
      {section === 'basic' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Supplier Name *</label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Contact Person *</label>
              <Input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone *</label>
              <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Website</label>
              <Input type="url" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Address</label>
              <Input value={form.address} onChange={e => set('address', e.target.value)} className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <Input value={form.city} onChange={e => set('city', e.target.value)} className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Country</label>
              <Input value={form.country} onChange={e => set('country', e.target.value)} className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">KRA PIN / Tax ID</label>
              <Input value={form.taxPin} onChange={e => set('taxPin', e.target.value)} placeholder="A00000000B" className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Supplier Rating</label>
              <div className="flex items-center gap-2 h-10">
                <StarRating value={form.rating} onChange={v => set('rating', v)} />
              </div>
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          </div>
        </div>
      )}

      {/* ── COMMERCIAL ── */}
      {section === 'commercial' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Payment Terms</label>
              <select value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                {PAYMENT_TERMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Lead Time (Days)</label>
              <Input type="number" min={0} value={form.leadTimeDays} onChange={e => set('leadTimeDays', Number(e.target.value))} className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Min Order Value (KES)</label>
              <Input type="number" min={0} value={form.minOrderValue} onChange={e => set('minOrderValue', Number(e.target.value))} className="border-border bg-input text-foreground" />
            </div>
            {isAdmin && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Total Spent (KES)</label>
                  <Input type="number" min={0} value={form.totalSpent} onChange={e => set('totalSpent', Number(e.target.value))} className="border-border bg-input text-foreground" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Last Order Date</label>
                  <Input type="date" value={form.lastOrderDate} onChange={e => set('lastOrderDate', e.target.value)} className="border-border bg-input text-foreground" />
                </div>
              </>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1"><Zap className="w-3 h-3" />Commercial Summary</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded p-2">
                <p className="text-xs text-muted-foreground">Terms</p>
                <p className="text-sm font-bold text-foreground">{form.paymentTerms}</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-muted-foreground">Lead Time</p>
                <p className="text-sm font-bold text-foreground">{form.leadTimeDays}d</p>
              </div>
              <div className="bg-white rounded p-2">
                <p className="text-xs text-muted-foreground">Min Order</p>
                <p className="text-sm font-bold text-foreground">{formatCurrency(form.minOrderValue)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BANKING ── */}
      {section === 'banking' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
            <p className="text-xs text-blue-700">Banking details are used for payment processing and reconciliation. Keep this information confidential.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Bank Name</label>
              <Input value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder="e.g. KCB, Equity" className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Account Number</label>
              <Input value={form.bankAccount} onChange={e => set('bankAccount', e.target.value)} className="border-border bg-input text-foreground" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Branch</label>
              <Input value={form.bankBranch} onChange={e => set('bankBranch', e.target.value)} placeholder="e.g. Westlands" className="border-border bg-input text-foreground" />
            </div>
          </div>
          {form.bankAccount && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Banking details recorded</p>
              <p className="text-xs text-green-700 mt-0.5">{form.bankName} · {form.bankAccount} · {form.bankBranch}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-4 mt-4 border-t border-border">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving…' : supplier ? 'Save Changes' : 'Add Supplier'}
        </Button>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ORDER MODAL
// ══════════════════════════════════════════════════════════════════════════════

function OrderModal({ supplier, order, storeId, onClose, onSuccess }: {
  supplier: Supplier; order?: SupplierOrder | null; storeId: string | null;
  onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    orderNumber: order?.orderNumber ?? `PO-${Date.now().toString().slice(-6)}`,
    orderDate: order?.orderDate ?? new Date().toISOString().split('T')[0],
    expectedDate: order?.expectedDate ?? '',
    deliveredDate: order?.deliveredDate ?? '',
    status: order?.status ?? 'pending' as SupplierOrder['status'],
    notes: order?.notes ?? '',
    items: order?.items ?? [{ productName: '', qty: 1, unitPrice: 0, total: 0 }],
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const updateItem = (i: number, k: string, v: any) => {
    const items = [...form.items];
    items[i] = { ...items[i], [k]: v };
    if (k === 'qty' || k === 'unitPrice') {
      items[i].total = items[i].qty * items[i].unitPrice;
    }
    setForm(p => ({ ...p, items }));
  };

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { productName: '', qty: 1, unitPrice: 0, total: 0 }] }));
  const removeItem = (i: number) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const totalAmount = form.items.reduce((a, i) => a + i.total, 0);

  const handleSubmit = async () => {
    if (!form.orderDate) { alert('Order date required.'); return; }
    setSaving(true);
    try {
      const payload = {
        supplier_id: supplier.id,
        order_number: form.orderNumber,
        order_date: form.orderDate,
        expected_date: form.expectedDate || null,
        delivered_date: form.deliveredDate || null,
        status: form.status,
        items: form.items,
        total_amount: totalAmount,
        notes: form.notes || null,
        store_id: storeId,
      };
      const { error } = order
        ? await supabase.from('supplier_orders').update(payload).eq('id', order.id)
        : await supabase.from('supplier_orders').insert([payload]);
      if (error) throw new Error(error.message);
      onSuccess(); onClose();
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : e}`); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={order ? 'Edit Purchase Order' : 'New Purchase Order'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">PO Number</label>
            <Input value={form.orderNumber} onChange={e => set('orderNumber', e.target.value)} className="border-border bg-input text-foreground font-mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              {['pending','ordered','delivered','cancelled','partial'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Order Date</label>
            <Input type="date" value={form.orderDate} onChange={e => set('orderDate', e.target.value)} className="border-border bg-input text-foreground" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Expected Delivery</label>
            <Input type="date" value={form.expectedDate} onChange={e => set('expectedDate', e.target.value)} className="border-border bg-input text-foreground" />
          </div>
          {form.status === 'delivered' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Delivered Date</label>
              <Input type="date" value={form.deliveredDate} onChange={e => set('deliveredDate', e.target.value)} className="border-border bg-input text-foreground" />
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Items</label>
            <Button type="button" size="sm" variant="outline" onClick={addItem} className="text-xs h-7"><Plus className="w-3 h-3 mr-1" />Add Item</Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Product</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground w-16">Qty</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground w-28">Unit Price</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground w-28">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="py-1.5 px-2">
                      <Input value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} placeholder="Product name" className="h-8 text-xs border-0 bg-transparent p-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                    </td>
                    <td className="py-1.5 px-2">
                      <Input type="number" min={1} value={item.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} className="h-8 text-xs text-center border-0 bg-transparent p-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 w-12" />
                    </td>
                    <td className="py-1.5 px-2">
                      <Input type="number" min={0} value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} className="h-8 text-xs text-right border-0 bg-transparent p-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                    </td>
                    <td className="py-1.5 px-3 text-right text-xs font-medium text-foreground">{formatCurrency(item.total)}</td>
                    <td className="py-1.5 px-1">
                      {form.items.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeItem(i)}><X className="w-3 h-3" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted border-t border-border">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-xs font-semibold text-right text-muted-foreground">TOTAL</td>
                  <td className="py-2 px-3 text-right text-sm font-bold text-foreground">{formatCurrency(totalAmount)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : order ? 'Update Order' : 'Create PO'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTACT LOG MODAL
// ══════════════════════════════════════════════════════════════════════════════

function ContactLogModal({ supplier, storeId, user, onClose, onSuccess }: {
  supplier: Supplier; storeId: string | null; user: any;
  onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    type: 'call' as ContactLog['type'], subject: '',
    notes: '', contactedAt: new Date().toISOString().slice(0, 16),
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.subject || !form.notes) { alert('Subject and notes required.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('supplier_contacts').insert([{
        supplier_id: supplier.id,
        type: form.type,
        subject: form.subject,
        notes: form.notes,
        contacted_by: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email,
        contacted_at: new Date(form.contactedAt).toISOString(),
        store_id: storeId,
      }]);
      if (error) throw new Error(error.message);
      onSuccess(); onClose();
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : e}`); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Log Contact" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Contact Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="call">📞 Phone Call</option>
              <option value="email">✉️ Email</option>
              <option value="meeting">🤝 Meeting</option>
              <option value="whatsapp">💬 WhatsApp</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date & Time</label>
            <Input type="datetime-local" value={form.contactedAt} onChange={e => set('contactedAt', e.target.value)} className="border-border bg-input text-foreground" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Subject *</label>
          <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="e.g. Price negotiation for Q1" className="border-border bg-input text-foreground" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notes *</label>
          <textarea rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="What was discussed, agreed, or actioned..."
            className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none resize-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Log Contact'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUPPLIER DETAIL PANEL
// ══════════════════════════════════════════════════════════════════════════════

function SupplierDetailPanel({ supplier, stores, storeId, user, isAdmin, canEdit, onEdit, onClose, onRefresh }: {
  supplier: Supplier; stores: StoreType[]; storeId: string | null;
  user: any; isAdmin: boolean; canEdit: boolean;
  onEdit: () => void; onClose: () => void; onRefresh: () => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [contacts, setContacts] = useState<ContactLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editOrder, setEditOrder] = useState<SupplierOrder | null>(null);

  const storeName = stores.find(s => s.id === supplier.storeId)?.name;

  const loadSupplierData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, contactsRes] = await Promise.all([
        supabase.from('supplier_orders').select('*').eq('supplier_id', supplier.id).order('order_date', { ascending: false }),
        supabase.from('supplier_contacts').select('*').eq('supplier_id', supplier.id).order('contacted_at', { ascending: false }),
      ]);
      setOrders((ordersRes.data || []).map((o: any) => ({
        id: o.id, supplierId: o.supplier_id, orderNumber: o.order_number,
        orderDate: o.order_date, expectedDate: o.expected_date,
        deliveredDate: o.delivered_date, status: o.status,
        items: o.items || [], totalAmount: o.total_amount || 0,
        notes: o.notes || '', createdAt: new Date(o.created_at),
      })));
      setContacts((contactsRes.data || []).map((c: any) => ({
        id: c.id, supplierId: c.supplier_id, type: c.type,
        subject: c.subject, notes: c.notes,
        contactedBy: c.contacted_by, contactedAt: new Date(c.contacted_at),
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [supplier.id]);

  useEffect(() => { loadSupplierData(); }, [loadSupplierData]);

  const orderStats = useMemo(() => ({
    total: orders.length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    pending: orders.filter(o => ['pending','ordered'].includes(o.status)).length,
    totalSpend: orders.filter(o => o.status === 'delivered').reduce((a, o) => a + o.totalAmount, 0),
    avgOrderValue: orders.length > 0 ? orders.reduce((a, o) => a + o.totalAmount, 0) / orders.length : 0,
  }), [orders]);

  // Monthly spend for sparkline
  const monthlySpend = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter(o => o.status === 'delivered').forEach(o => {
      const m = o.orderDate.slice(0, 7);
      map[m] = (map[m] || 0) + o.totalAmount;
    });
    return Object.entries(map).sort().slice(-6);
  }, [orders]);

  const TABS_CONFIG = [
    { key: 'overview', label: 'Overview' },
    { key: 'orders',   label: `Orders${orders.length > 0 ? ` (${orders.length})` : ''}` },
    { key: 'contacts', label: `Contacts${contacts.length > 0 ? ` (${contacts.length})` : ''}` },
    { key: 'analytics', label: 'Analytics' },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-start justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-bold text-lg flex items-center justify-center shrink-0">
            {supplier.name.slice(0,2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-foreground text-base leading-tight">{supplier.name}</h2>
            <p className="text-sm text-muted-foreground">{supplier.contactPerson}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={`text-xs ${supplier.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                {supplier.status}
              </Badge>
              <Badge variant="outline" className="text-xs">{supplier.category}</Badge>
              {storeName && <Badge className="bg-primary/10 text-primary text-xs">{storeName}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Edit2 className="w-3.5 h-3.5" /></Button>}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border px-4">
        {TABS_CONFIG.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)}
            className={`text-xs font-medium py-2.5 px-3 border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Orders',    value: orderStats.total,                        icon: <ShoppingCart className="w-4 h-4" />, color: 'text-blue-600' },
                { label: 'Delivered', value: orderStats.delivered,                    icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-600' },
                { label: 'Total Spent', value: formatCurrency(supplier.totalSpent),   icon: <DollarSign className="w-4 h-4" />,   color: 'text-primary' },
              ].map((m, i) => (
                <div key={i} className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className={`flex justify-center mb-1 ${m.color}`}>{m.icon}</div>
                  <p className={`text-base font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Contact info */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</p>
              <div className="space-y-1.5">
                {supplier.phone && (
                  <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors group">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />{supplier.phone}
                  </a>
                )}
                {supplier.email && (
                  <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors group">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />{supplier.email}
                  </a>
                )}
                {supplier.website && (
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors group">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />{supplier.website}<ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
                {(supplier.city || supplier.address) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />{[supplier.address, supplier.city, supplier.country].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Commercial details */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Commercial</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Payment Terms', value: supplier.paymentTerms ?? '—' },
                  { label: 'Lead Time', value: supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : '—' },
                  { label: 'Min Order', value: supplier.minOrderValue ? formatCurrency(supplier.minOrderValue) : '—' },
                  { label: 'Last Order', value: supplier.lastOrderDate ?? '—' },
                ].map((f, i) => (
                  <div key={i} className="bg-muted/40 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">{f.label}</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating */}
            {(supplier.rating ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supplier Rating</p>
                <StarRating value={supplier.rating ?? 0} readOnly />
              </div>
            )}

            {/* Notes */}
            {supplier.notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>
                <p className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">{supplier.notes}</p>
              </div>
            )}

            {/* Banking (admin only) */}
            {isAdmin && supplier.bankName && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Banking</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
                  <p className="font-semibold text-blue-900">{supplier.bankName}</p>
                  <p className="text-blue-700 text-xs mt-0.5">{supplier.bankAccount} · {supplier.bankBranch}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS ── */}
        {tab === 'orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Pending: <strong className="text-yellow-600">{orderStats.pending}</strong></span>
                <span>Delivered: <strong className="text-green-600">{orderStats.delivered}</strong></span>
              </div>
              {canEdit && (
                <Button size="sm" onClick={() => { setEditOrder(null); setShowOrderModal(true); }} className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs">
                  <Plus className="w-3 h-3" />New PO
                </Button>
              )}
            </div>
            {loading ? (
              <div className="text-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
            ) : orders.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No orders yet. Create your first purchase order.</div>
            ) : (
              orders.map(o => {
                const sc = ORDER_STATUS_CONFIG[o.status];
                return (
                  <div key={o.id} className="border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => { setEditOrder(o); setShowOrderModal(true); }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono font-semibold text-foreground text-sm">{o.orderNumber}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{o.orderDate} · {o.items.length} item{o.items.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`${sc.color} flex items-center gap-1 text-xs`}>{sc.icon}{o.status}</Badge>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(o.totalAmount)}</p>
                      </div>
                    </div>
                    {o.expectedDate && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />Expected: {o.expectedDate}
                        {o.deliveredDate && <span className="text-green-600 ml-1">· Delivered: {o.deliveredDate}</span>}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── CONTACTS ── */}
        {tab === 'contacts' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              {canEdit && (
                <Button size="sm" onClick={() => setShowContactModal(true)} className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs">
                  <Plus className="w-3 h-3" />Log Contact
                </Button>
              )}
            </div>
            {loading ? (
              <div className="text-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No contact history yet.</div>
            ) : (
              contacts.map(c => {
                const cfg = CONTACT_TYPE_CONFIG[c.type];
                return (
                  <div key={c.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Badge className={`${cfg.color} flex items-center gap-1 text-xs shrink-0`}>{cfg.icon}{c.type}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm">{c.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.notes}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          <span>{c.contactedBy}</span>
                          <span>{c.contactedAt.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && (
          <div className="space-y-4">
            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Lifetime Spend',   value: formatCurrency(supplier.totalSpent),              icon: <DollarSign className="w-4 h-4" />,  color: 'text-primary',    bg: 'bg-primary/10' },
                { label: 'Avg Order Value',  value: formatCurrency(orderStats.avgOrderValue),         icon: <BarChart2 className="w-4 h-4" />,    color: 'text-blue-600',   bg: 'bg-blue-50' },
                { label: 'Total Orders',     value: orderStats.total,                                 icon: <ShoppingCart className="w-4 h-4" />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { label: 'Fulfillment Rate', value: orderStats.total > 0 ? `${Math.round(orderStats.delivered / orderStats.total * 100)}%` : '—', icon: <Award className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-50' },
              ].map((m, i) => (
                <div key={i} className={`${m.bg} rounded-lg p-3`}>
                  <div className={`${m.color} mb-1`}>{m.icon}</div>
                  <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Monthly spend chart */}
            {monthlySpend.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Spend (Last 6 months)</p>
                <div className="space-y-1.5">
                  {(() => {
                    const max = Math.max(...monthlySpend.map(([,v]) => v), 1);
                    return monthlySpend.map(([month, amount]) => (
                      <div key={month} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-14 shrink-0">{month.slice(5)} {month.slice(0,4)}</span>
                        <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                            style={{ width: `${Math.max((amount / max) * 100, 4)}%` }}
                          >
                            <span className="text-[9px] text-primary-foreground font-medium whitespace-nowrap">{formatCurrency(amount)}</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Order status breakdown */}
            {orders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Status Breakdown</p>
                <div className="space-y-1">
                  {Object.entries(ORDER_STATUS_CONFIG).map(([status, cfg]) => {
                    const count = orders.filter(o => o.status === status).length;
                    if (count === 0) return null;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <Badge className={`${cfg.color} flex items-center gap-1 text-xs capitalize`}>{cfg.icon}{status}</Badge>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(count / orders.length) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-foreground w-4 text-right">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {orders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No order data yet. Create purchase orders to see analytics.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showOrderModal && (
        <OrderModal
          supplier={supplier} order={editOrder} storeId={storeId}
          onClose={() => { setShowOrderModal(false); setEditOrder(null); }}
          onSuccess={() => { loadSupplierData(); onRefresh(); }}
        />
      )}
      {showContactModal && (
        <ContactLogModal
          supplier={supplier} storeId={storeId} user={user}
          onClose={() => setShowContactModal(false)}
          onSuccess={loadSupplierData}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function SuppliersPage() {
  const { user } = useAuth();
  const { currentStore } = useStore();
  const storeId = currentStore?.id ?? null;

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin      = ['super_admin', 'admin'].includes(user?.role ?? '');
  const canEdit      = ['super_admin', 'admin', 'manager'].includes(user?.role ?? '');

  const [suppliers, setSuppliers]           = useState<Supplier[]>([]);
  const [stores, setStores]                 = useState<StoreType[]>([]);
  const [loading, setLoading]               = useState(true);
  const [searchQuery, setSearchQuery]       = useState('');
  const [filterStatus, setFilterStatus]     = useState<'all' | 'active' | 'inactive'>('all');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showModal, setShowModal]           = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [sortBy, setSortBy]                 = useState<'name' | 'totalSpent' | 'lastOrder'>('name');
  const [viewMode, setViewMode]             = useState<'table' | 'cards'>('table');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [suppliersData, storesData] = await Promise.all([getAllSuppliers(), getAllStores()]);
      setSuppliers(suppliersData as Supplier[]);
      setStores(storesData);
    } catch { alert('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (formData: any) => {
    try {
      if (editingSupplier) {
        const updated = await updateSupplier(editingSupplier.id, {
          ...formData, storeId: formData.storeId || null,
          lastOrderDate: formData.lastOrderDate || null,
        });
        // If we're viewing this supplier, refresh it
        if (selectedSupplier?.id === editingSupplier.id) {
          setSelectedSupplier(updated as unknown as Supplier);
        }
      } else {
        await createSupplier({ ...formData, storeId: formData.storeId || null });
      }
      setShowModal(false); setEditingSupplier(null);
      loadData();
    } catch (e) { alert(`Failed to save: ${e instanceof Error ? e.message : e}`); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isSuperAdmin) { alert('Only Super Admins can delete suppliers.'); return; }
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteSupplier(id);
      if (selectedSupplier?.id === id) setSelectedSupplier(null);
      await loadData();
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : e}`); }
    finally { setDeletingId(null); }
  };

  const categories = useMemo(() => [...new Set(suppliers.map(s => s.category))], [suppliers]);

  const filtered = useMemo(() => {
    let res = [...suppliers];
    // Filter by current store (non-admins only see their branch's suppliers)
    if (!isAdmin && storeId) {
      res = res.filter(s => s.storeId === storeId || s.storeId === null);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      res = res.filter(s => s.name.toLowerCase().includes(q) || s.contactPerson?.toLowerCase().includes(q) || s.phone?.includes(q) || s.city?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') res = res.filter(s => s.status === filterStatus);
    if (filterCategory) res = res.filter(s => s.category === filterCategory);
    // Sort
    if (sortBy === 'totalSpent') res.sort((a, b) => b.totalSpent - a.totalSpent);
    else if (sortBy === 'lastOrder') res.sort((a, b) => (b.lastOrderDate ?? '').localeCompare(a.lastOrderDate ?? ''));
    else res.sort((a, b) => a.name.localeCompare(b.name));
    return res;
  }, [suppliers, searchQuery, filterStatus, filterCategory, sortBy, storeId, isAdmin]);

  const stats = useMemo(() => ({
    total:      suppliers.length,
    active:     suppliers.filter(s => s.status === 'active').length,
    totalSpent: suppliers.reduce((a, s) => a + s.totalSpent, 0),
    categories: new Set(suppliers.map(s => s.category)).size,
  }), [suppliers]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading suppliers…</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <Truck className="w-7 h-7 text-primary" /> Suppliers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentStore ? `${currentStore.name} — supplier management` : 'Manage all suppliers and vendors'}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditingSupplier(null); setShowModal(true); }}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 self-start">
            <Plus className="w-4 h-4" /> Add Supplier
          </Button>
        )}
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Suppliers', value: stats.total,                      icon: <Truck       className="w-5 h-5" />, color: 'text-foreground',  bg: 'bg-muted/60' },
          { label: 'Active',          value: stats.active,                     icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Total Spent',     value: formatCurrency(stats.totalSpent), icon: <DollarSign  className="w-5 h-5" />, color: 'text-primary',     bg: 'bg-primary/10' },
          { label: 'Categories',      value: stats.categories,                 icon: <Package     className="w-5 h-5" />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((m, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center ${m.color} shrink-0`}>{m.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── MAIN LAYOUT (list + detail) ── */}
      <div className={`flex gap-5 ${selectedSupplier ? 'flex-col lg:flex-row' : ''}`}>

        {/* ── LEFT: filters + list ── */}
        <div className={`${selectedSupplier ? 'lg:w-[55%]' : 'w-full'} space-y-4`}>

          {/* Filters */}
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-3 space-y-3 px-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search suppliers…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 border-border bg-input text-foreground h-9 text-sm" />
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                  className="h-9 px-3 text-xs border border-border bg-input text-foreground rounded-md focus:outline-none">
                  <option value="name">Sort: Name</option>
                  <option value="totalSpent">Sort: Spend</option>
                  <option value="lastOrder">Sort: Last Order</option>
                </select>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['all', 'active', 'inactive'] as const).map(s => (
                  <Button key={s} size="sm" variant={filterStatus === s ? 'default' : 'outline'} onClick={() => setFilterStatus(s)} className="capitalize text-xs h-7">{s}</Button>
                ))}
                {categories.length > 0 && <div className="w-px bg-border mx-0.5" />}
                {categories.map(cat => (
                  <Button key={cat} size="sm" variant={filterCategory === cat ? 'default' : 'outline'} onClick={() => setFilterCategory(filterCategory === cat ? null : cat)} className="text-xs h-7">{cat}</Button>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Showing {filtered.length} of {suppliers.length} suppliers</span>
                <div className="flex gap-1">
                  <Button size="sm" variant={viewMode === 'table' ? 'default' : 'outline'} className="h-6 w-6 p-0" onClick={() => setViewMode('table')}>
                    <ArrowUpDown className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant={viewMode === 'cards' ? 'default' : 'outline'} className="h-6 w-6 p-0" onClick={() => setViewMode('cards')}>
                    <BarChart2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table view */}
          {viewMode === 'table' && (
            <Card className="bg-card border-border">
              <CardContent className="px-0 py-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        {['Supplier', 'Contact', 'Category', 'Terms', 'Spent', 'Status', ''].map(h => (
                          <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                          {suppliers.length === 0 ? 'No suppliers yet.' : 'No suppliers match your filters.'}
                        </td></tr>
                      ) : filtered.map(s => {
                        const storeName = stores.find(st => st.id === s.storeId)?.name;
                        const isSelected = selectedSupplier?.id === s.id;
                        return (
                          <tr key={s.id} onClick={() => setSelectedSupplier(isSelected ? null : s)}
                            className={`border-b border-border cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'}`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                  {s.name.slice(0,2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground text-xs">{s.name}</p>
                                  {(s.city || storeName) && (
                                    <p className="text-[10px] text-muted-foreground">{[s.city, storeName].filter(Boolean).join(' · ')}</p>
                                  )}
                                  {(s.rating ?? 0) > 0 && <StarRating value={s.rating ?? 0} readOnly />}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 hidden md:table-cell">
                              <p className="text-xs text-foreground">{s.contactPerson}</p>
                              <p className="text-[10px] text-muted-foreground">{s.phone}</p>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                            </td>
                            <td className="py-3 px-4 hidden lg:table-cell">
                              <span className="text-xs text-muted-foreground">{s.paymentTerms ?? '—'}</span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-xs font-semibold text-foreground">{formatCurrency(s.totalSpent)}</p>
                              {s.lastOrderDate && <p className="text-[10px] text-muted-foreground">{s.lastOrderDate}</p>}
                            </td>
                            <td className="py-3 px-4">
                              <Badge className={`text-[10px] ${s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>{s.status}</Badge>
                            </td>
                            <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingSupplier(s); setShowModal(true); }}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                )}
                                {isSuperAdmin && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={deletingId === s.id} onClick={() => handleDelete(s.id, s.name)}>
                                    {deletingId === s.id ? <span className="w-3 h-3 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin block" /> : <Trash2 className="w-3 h-3" />}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cards view */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.length === 0 ? (
                <div className="col-span-3 text-center py-12 text-muted-foreground">No suppliers match your filters.</div>
              ) : filtered.map(s => {
                const storeName = stores.find(st => st.id === s.storeId)?.name;
                const isSelected = selectedSupplier?.id === s.id;
                return (
                  <Card key={s.id} onClick={() => setSelectedSupplier(isSelected ? null : s)}
                    className={`bg-card cursor-pointer hover:shadow-md transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">{s.name.slice(0,2).toUpperCase()}</div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{s.name}</p>
                            <Badge variant="outline" className="text-[10px] mt-0.5">{s.category}</Badge>
                          </div>
                        </div>
                        <Badge className={`text-[10px] ${s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>{s.status}</Badge>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{s.contactPerson} · {s.phone}</div>
                        {s.city && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{s.city}</div>}
                        {storeName && <div className="flex items-center gap-1.5 text-primary"><Store className="w-3 h-3" />{storeName}</div>}
                      </div>
                      {(s.rating ?? 0) > 0 && <StarRating value={s.rating ?? 0} readOnly />}
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total Spent</p>
                          <p className="text-sm font-bold text-foreground">{formatCurrency(s.totalSpent)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Last Order</p>
                          <p className="text-xs text-muted-foreground">{s.lastOrderDate ?? '—'}</p>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => { setEditingSupplier(s); setShowModal(true); }}>
                            <Edit2 className="w-3 h-3 mr-1" />Edit
                          </Button>
                          {isSuperAdmin && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={deletingId === s.id} onClick={() => handleDelete(s.id, s.name)}>
                              {deletingId === s.id ? <span className="w-3 h-3 border border-destructive rounded-full animate-spin block" /> : <Trash2 className="w-3 h-3" />}
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: detail panel ── */}
        {selectedSupplier && (
          <div className="lg:w-[45%] lg:sticky lg:top-6 lg:self-start">
            <SupplierDetailPanel
              supplier={selectedSupplier}
              stores={stores}
              storeId={storeId}
              user={user}
              isAdmin={isAdmin}
              canEdit={canEdit}
              onEdit={() => { setEditingSupplier(selectedSupplier); setShowModal(true); }}
              onClose={() => setSelectedSupplier(null)}
              onRefresh={loadData}
            />
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      {showModal && (
        <SupplierModal
          supplier={editingSupplier}
          currentStore={currentStore}
          stores={stores}
          isAdmin={isAdmin}
          onClose={() => { setShowModal(false); setEditingSupplier(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}