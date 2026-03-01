'use client';
// File: app/dashboard/supplier/page.tsx

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Edit2, Trash2, X,
  Truck, TrendingUp, Check, MapPin, Package, Store,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useAuth } from '@/lib/auth-context';
import {
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '@/lib/supabase/suppliers-helper';
import { getAllStores } from '@/lib/supabase/stores-helper';
import type { Store as StoreType } from '@/lib/supabase/stores-helper';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  category: string;
  status: 'active' | 'inactive';
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  notes: string;
  storeId: string | null;   // ← which store this supplier belongs to
  createdAt: Date;
}

type SupplierFormData = {
  name: string; contactPerson: string; email: string; phone: string;
  address: string; city: string; country: string; category: string;
  status: 'active' | 'inactive'; notes: string;
  storeId: string;
  // super_admin editable
  totalSpent: number; lastOrderDate: string;
};

const CATEGORIES = [
  'Produce', 'Beverages', 'Dry Goods', 'Dairy',
  'Meat & Poultry', 'Household', 'Stationery', 'Other',
];

// ─── Supplier Modal ───────────────────────────────────────────────────────────

function SupplierModal({
  supplier, isSuperAdmin, currentStoreId, stores, onClose, onSave,
}: {
  supplier: Supplier | null;
  isSuperAdmin: boolean;
  currentStoreId: string | null;
  stores: StoreType[];
  onClose: () => void;
  onSave: (data: SupplierFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<SupplierFormData>(
    supplier
      ? {
          name: supplier.name, contactPerson: supplier.contactPerson,
          email: supplier.email ?? '', phone: supplier.phone ?? '',
          address: supplier.address ?? '', city: supplier.city ?? '',
          country: supplier.country ?? 'Kenya', category: supplier.category,
          status: supplier.status, notes: supplier.notes,
          storeId: supplier.storeId ?? currentStoreId ?? '',
          totalSpent: supplier.totalSpent,
          lastOrderDate: supplier.lastOrderDate ?? '',
        }
      : {
          name: '', contactPerson: '', email: '', phone: '',
          address: '', city: '', country: 'Kenya', category: 'Dry Goods',
          status: 'active', notes: '',
          // ← auto-fill with current store when creating
          storeId: currentStoreId ?? '',
          totalSpent: 0, lastOrderDate: '',
        }
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof SupplierFormData, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.contactPerson || !form.phone) {
      alert('Name, contact person and phone are required.'); return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  // Resolved store name for display
  const selectedStoreName = stores.find(s => s.id === form.storeId)?.name ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-lg flex flex-col bg-card border border-border
                      rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden">

        {/* Drag handle (mobile) */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-border sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border shrink-0 mt-2 sm:mt-0">
          <CardTitle className="text-foreground text-base sm:text-lg">
            {supplier ? 'Edit Supplier' : 'Add New Supplier'}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Current Store indicator ── */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Store className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Assigning to Store</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {selectedStoreName ?? 'All Stores / Unassigned'}
                </p>
              </div>
              {/* Super admin can override the store */}
              {isSuperAdmin && (
                <select
                  value={form.storeId}
                  onChange={e => set('storeId', e.target.value)}
                  className="text-xs h-8 px-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring max-w-[130px]"
                >
                  <option value="">All Stores</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            {/* Basic info fields */}
            {([
              ['Supplier Name *', 'name', 'text'],
              ['Contact Person *', 'contactPerson', 'text'],
              ['Email', 'email', 'email'],
              ['Phone *', 'phone', 'tel'],
              ['Address', 'address', 'text'],
              ['City', 'city', 'text'],
              ['Country', 'country', 'text'],
            ] as [string, keyof SupplierFormData, string][]).map(([label, key, type]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <Input
                  type={type}
                  value={form[key] as string}
                  onChange={e => set(key, e.target.value)}
                  className="border-border bg-input text-foreground h-9 text-sm"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value as 'active' | 'inactive')}
                  className="w-full h-9 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>

            {/* Super admin only */}
            
              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Fields</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Total Spent (KES)</label>
                    <Input
                      type="number" min={0}
                      value={form.totalSpent}
                      onChange={e => set('totalSpent', Number(e.target.value))}
                      className="border-border bg-input text-foreground h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Last Order Date</label>
                    <Input
                      type="date"
                      value={form.lastOrderDate}
                      onChange={e => set('lastOrderDate', e.target.value)}
                      className="border-border bg-input text-foreground h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            
          </form>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-4 sm:px-6 py-4 border-t border-border bg-card shrink-0">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleSubmit as any}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
          >
            {saving ? 'Saving…' : supplier ? 'Save Changes' : 'Add Supplier'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin      = ['super_admin', 'admin'].includes(user?.role ?? '');
  const canEdit      = ['super_admin', 'admin', 'manager'].includes(user?.role ?? '');

  // ── Current store (auto-detected from user profile) ──────────────────────
  const currentStoreId = user?.storeId ?? null;

  const [suppliers, setSuppliers]           = useState<Supplier[]>([]);
  const [stores, setStores]                 = useState<StoreType[]>([]);
  const [loading, setLoading]               = useState(true);
  const [searchQuery, setSearchQuery]       = useState('');
  const [filterStatus, setFilterStatus]     = useState<'all' | 'active' | 'inactive'>('all');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  // Super admin can see all stores; others default to their own store
  const [filterStore, setFilterStore]       = useState<string>(
    isSuperAdmin ? 'all' : (user?.storeId ?? 'all')
  );
  const [showModal, setShowModal]           = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId]         = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // When user loads, set default filter to their store
  useEffect(() => {
    if (!isSuperAdmin && user?.storeId) {
      setFilterStore(user.storeId);
    }
  }, [user, isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [suppliersData, storesData] = await Promise.all([
        getAllSuppliers(),
        getAllStores(),
      ]);
      setSuppliers(suppliersData as Supplier[]);
      setStores(storesData);
    } catch (err) {
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: SupplierFormData) => {
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: formData.name,
          contactPerson: formData.contactPerson,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          category: formData.category,
          status: formData.status,
          notes: formData.notes,
          storeId: formData.storeId || null,
          
            totalSpent: formData.totalSpent,
            lastOrderDate: formData.lastOrderDate || null,
          
        });
      } else {
        await createSupplier({
          ...formData,
          storeId: formData.storeId || null,
        });
      }
      setShowModal(false);
      setEditingSupplier(null);
      loadData();
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isSuperAdmin) { alert('Only Super Admins can delete suppliers.'); return; }
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteSupplier(id);
      await loadData();
    } catch (err) {
      alert(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const categories = useMemo(() => [...new Set(suppliers.map(s => s.category))], [suppliers]);

  // Current store name for display
  const currentStoreName = useMemo(
    () => stores.find(s => s.id === currentStoreId)?.name ?? null,
    [stores, currentStoreId]
  );

  const filtered = useMemo(() => {
    let res = [...suppliers];
    // Store filter
    if (filterStore !== 'all') {
      res = res.filter(s => s.storeId === filterStore);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      res = res.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.contactPerson?.toLowerCase().includes(q) ||
        s.phone?.includes(q)
      );
    }
    if (filterStatus !== 'all')   res = res.filter(s => s.status === filterStatus);
    if (filterCategory) res = res.filter(s => s.category === filterCategory);
    return res;
  }, [suppliers, searchQuery, filterStatus, filterCategory, filterStore]);

  const stats = useMemo(() => ({
    total:      filtered.length,
    active:     filtered.filter(s => s.status === 'active').length,
    totalSpent: filtered.reduce((a, s) => a + s.totalSpent, 0),
  }), [filtered]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading suppliers…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Suppliers</h1>
          {/* Auto-detected store badge */}
          {currentStoreName ? (
            <div className="flex items-center gap-1.5 mt-1">
              <Store className="w-3.5 h-3.5 text-primary" />
              <p className="text-sm text-muted-foreground">
                Viewing: <span className="font-semibold text-primary">{currentStoreName}</span>
                {isSuperAdmin && (
                  <span className="text-xs text-muted-foreground ml-1">(can switch below)</span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Manage your product suppliers and vendors</p>
          )}
        </div>
        {canEdit && (
          <Button
            onClick={() => { setEditingSupplier(null); setShowModal(true); }}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 self-start"
            size="sm"
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </Button>
        )}
      </div>

      {/* Stats — scoped to current filter */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Suppliers',    value: stats.total,                      icon: <Truck      className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--chart-1)]" />, iconBg: 'bg-[var(--chart-1)]/10' },
          { label: 'Active',       value: stats.active,                     icon: <Check      className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--chart-2)]" />, iconBg: 'bg-[var(--chart-2)]/10' },
          { label: 'Total Spent',  value: formatCurrency(stats.totalSpent), icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--chart-3)]" />, iconBg: 'bg-[var(--chart-3)]/10' },
        ].map((m, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3 sm:px-4 sm:pt-4 sm:pb-2">
              <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl ${m.iconBg} flex items-center justify-center`}>{m.icon}</div>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
              <div className="text-lg sm:text-2xl font-bold text-foreground">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-4 space-y-3 px-3 sm:px-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, contact or phone…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 border-border bg-input text-foreground h-9 text-sm"
            />
          </div>

          {/* Store switcher — super admin / admin only */}
          {isAdmin && stores.length > 0 && (
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-muted-foreground shrink-0" />
              <select
                value={filterStore}
                onChange={e => setFilterStore(e.target.value)}
                className="flex-1 h-9 px-3 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Stores</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {(['all', 'active', 'inactive'] as const).map(s => (
              <Button key={s} size="sm" variant={filterStatus === s ? 'default' : 'outline'} onClick={() => setFilterStatus(s)} className="capitalize text-xs h-7">
                {s}
              </Button>
            ))}
            {categories.length > 0 && <div className="w-px bg-border mx-0.5" />}
            {categories.map(cat => (
              <Button key={cat} size="sm" variant={filterCategory === cat ? 'default' : 'outline'} onClick={() => setFilterCategory(filterCategory === cat ? null : cat)} className="text-xs h-7">
                {cat}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-foreground text-sm sm:text-base">Suppliers</CardTitle>
          <CardDescription>Showing {filtered.length} of {suppliers.length} suppliers</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  {[
                    'Supplier', 'Contact', 'Category',
                    'Total Spent', 'Last Order', 'Status',
                    ...(canEdit ? ['Actions'] : []),
                  ].map(h => (
                    <th key={h} className={`py-2.5 px-3 sm:px-4 font-semibold text-foreground text-xs sm:text-sm ${h === 'Actions' || h === 'Status' ? 'text-center' : 'text-left'} ${['Contact', 'Category'].includes(h) ? 'hidden sm:table-cell' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="text-center py-12 text-muted-foreground text-sm">
                      {suppliers.length === 0
                        ? 'No suppliers yet. Add your first supplier.'
                        : 'No suppliers match your filters.'}
                    </td>
                  </tr>
                ) : filtered.map(s => {
                  const storeName = stores.find(st => st.id === s.storeId)?.name;
                  return (
                    <tr key={s.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-3 sm:px-4">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">{s.name}</p>
                        {s.city && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" />{s.city}{s.country ? `, ${s.country}` : ''}
                          </p>
                        )}
                        {storeName && (
                          <p className="text-[10px] text-primary flex items-center gap-0.5 mt-0.5">
                            <Store className="w-2.5 h-2.5" />{storeName}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:px-4 hidden sm:table-cell">
                        <p className="text-foreground text-xs">{s.contactPerson}</p>
                        {s.phone && <p className="text-[10px] text-muted-foreground mt-0.5">{s.phone}</p>}
                      </td>
                      <td className="py-3 px-3 sm:px-4 hidden sm:table-cell">
                        <Badge variant="outline" className="flex items-center gap-1 w-fit text-[10px]">
                          <Package className="w-2.5 h-2.5" />{s.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 sm:px-4 font-semibold text-foreground text-xs sm:text-sm">{formatCurrency(s.totalSpent)}</td>
                      <td className="py-3 px-3 sm:px-4 text-muted-foreground text-[10px] sm:text-xs">{s.lastOrderDate ?? '—'}</td>
                      <td className="py-3 px-3 sm:px-4 text-center">
                        <Badge className={`text-[10px] ${s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                          {s.status}
                        </Badge>
                      </td>
                      {canEdit && (
                        <td className="py-3 px-3 sm:px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => { setEditingSupplier(s); setShowModal(true); }}>
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                disabled={deletingId === s.id}
                                onClick={() => handleDelete(s.id, s.name)}
                              >
                                {deletingId === s.id
                                  ? <span className="w-3 h-3 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin block" />
                                  : <Trash2 className="w-3 h-3" />}
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showModal && (
        <SupplierModal
          supplier={editingSupplier}
          isSuperAdmin={isSuperAdmin}
          currentStoreId={currentStoreId}
          stores={stores}
          onClose={() => { setShowModal(false); setEditingSupplier(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}