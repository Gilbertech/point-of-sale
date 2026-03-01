'use client';
// app/dashboard/settings/page.tsx
// Calls refreshStores() after every branch CRUD so the sidebar and this page
// always show identical data from Supabase.

import { useState } from 'react';
import { useStore } from '@/lib/store-context';
import { useAuth } from '@/lib/auth-context';
import {
  createStore,
  updateStore,
  deleteStore,
  toggleStoreActive,
} from '@/lib/supabase/stores-helper';
import type { CreateStoreData } from '@/lib/supabase/stores-helper';
import type { Store } from '@/lib/store-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Save, Plus, MapPin, DollarSign, Lock, Building2, Phone, Mail,
  Edit2, Trash2, X, Check, RefreshCw, AlertTriangle,
  ToggleLeft, ToggleRight, ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreFormData {
  name: string; address: string; phone: string; email: string;
  taxRate: string; currency: string;
}

const EMPTY_STORE_FORM: StoreFormData = {
  name: '', address: '', phone: '', email: '', taxRate: '0.08', currency: 'KES',
};

// ─── Branch Form ──────────────────────────────────────────────────────────────

function BranchForm({
  mode, initial, onSave, onCancel, saving, error,
}: {
  mode: 'create' | 'edit';
  initial?: Store | null;
  onSave: (data: StoreFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<StoreFormData>(
    initial
      ? { name: initial.name, address: initial.address, phone: initial.phone,
          email: initial.email, taxRate: String(initial.taxRate), currency: initial.currency }
      : EMPTY_STORE_FORM
  );
  const set = (f: keyof StoreFormData, v: string) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            {mode === 'create' ? 'New Branch' : `Edit: ${initial?.name}`}
          </CardTitle>
          <button onClick={onCancel} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Branch Name <span className="text-destructive">*</span>
          </label>
          <Input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g., CBD Branch, Westlands Store" className="h-10" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Address <span className="text-destructive">*</span>
          </label>
          <Input value={form.address} onChange={e => set('address', e.target.value)}
            placeholder="Street address, city" className="h-10" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+254 7XX XXX XXX" className="h-10 pl-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="branch@store.com" className="h-10 pl-8" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Tax Rate</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type="number" step="0.01" min="0" max="1"
                value={form.taxRate} onChange={e => set('taxRate', e.target.value)}
                placeholder="0.08" className="h-10 pl-8" />
            </div>
            <p className="text-xs text-muted-foreground">
              {form.taxRate ? `${(parseFloat(form.taxRate) * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Currency</label>
            <select value={form.currency} onChange={e => set('currency', e.target.value)}
              className="w-full h-10 px-3 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="TZS">TZS — Tanzanian Shilling</option>
              <option value="UGX">UGX — Ugandan Shilling</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving || !form.name.trim() || !form.address.trim()} className="flex-1 gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {mode === 'create' ? 'Create Branch' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteBranchModal({ store, onClose, onConfirm, deleting }: {
  store: Store; onClose: () => void;
  onConfirm: () => Promise<void>; deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-background border border-border rounded-2xl shadow-2xl p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Delete Branch?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This will permanently delete{' '}
              <span className="font-semibold text-foreground">{store.name}</span>.
              Users assigned to this branch will become unassigned. This cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirm} className="flex-1 gap-2" disabled={deleting}>
              {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // ── Pull everything from StoreContext — single source of truth ───────────
  const {
    currentStore,
    stores,          // live list from Supabase via context
    loadingStores,
    selectStore,
    refreshStores,   // call this after any CRUD to sync sidebar + this page
  } = useStore();

  const { user } = useAuth();

  // Branch UI state
  const [branchPanel, setBranchPanel]     = useState<'create' | 'edit' | null>(null);
  const [editingStore, setEditingStore]   = useState<Store | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<Store | null>(null);
  const [savingBranch, setSavingBranch]   = useState(false);
  const [deletingBranch, setDeletingBranch] = useState(false);
  const [branchError, setBranchError]     = useState<string | null>(null);

  // System settings (local only — no DB table for these yet)
  const [systemSettings, setSystemSettings] = useState({
    businessName: 'My Retail Store',
    receiptFooter: 'Thank you for your purchase!',
    currencySymbol: 'KSh',
    enableLoyalty: true,
    requireEmail: true,
    autoPrintReceipts: false,
  });

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Branch CRUD ───────────────────────────────────────────────────────────

  const handleSaveBranch = async (form: StoreFormData) => {
    setSavingBranch(true);
    setBranchError(null);
    try {
      const payload: CreateStoreData = {
        name:     form.name.trim(),
        address:  form.address.trim(),
        phone:    form.phone.trim(),
        email:    form.email.trim(),
        taxRate:  parseFloat(form.taxRate) || 0.08,
        currency: form.currency,
      };

      if (branchPanel === 'create') {
        await createStore(payload);
        showToast('success', `Branch "${payload.name}" created successfully.`);
      } else if (editingStore) {
        await updateStore(editingStore.id, payload);
        showToast('success', `Branch "${payload.name}" updated successfully.`);
      }

      setBranchPanel(null);
      setEditingStore(null);
      // ← This re-fetches from DB and updates the sidebar selector too
      await refreshStores();
    } catch (err: any) {
      setBranchError(err?.message ?? 'Failed to save branch.');
    } finally {
      setSavingBranch(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!deleteTarget) return;
    setDeletingBranch(true);
    try {
      await deleteStore(deleteTarget.id);
      showToast('success', `Branch "${deleteTarget.name}" has been deleted.`);
      setDeleteTarget(null);
      // ← Sync sidebar
      await refreshStores();
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete branch.');
      setDeleteTarget(null);
    } finally {
      setDeletingBranch(false);
    }
  };

  const handleToggleActive = async (store: Store) => {
    try {
      await toggleStoreActive(store.id, !store.isActive);
      showToast('success', `${store.name} is now ${!store.isActive ? 'active' : 'inactive'}.`);
      // ← Sync sidebar
      await refreshStores();
    } catch {
      showToast('error', 'Failed to update branch status.');
    }
  };

  const handleStoreSwitch = (storeId: string) => {
    selectStore(storeId);   // updates context + localStorage
    const s = stores.find(x => x.id === storeId);
    if (s) showToast('success', `Switched to ${s.name}.`);
  };

  // ── Permission guard ──────────────────────────────────────────────────────
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Only administrators can manage settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border text-sm font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success'
            ? <Check className="w-4 h-4 text-green-600" />
            : <AlertTriangle className="w-4 h-4 text-red-600" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings & Administration</h1>
        <p className="text-muted-foreground mt-1">Manage branches, users, and system configuration</p>
      </div>

      {/* Current store indicator */}
      {currentStore && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Currently viewing</p>
              <p className="font-semibold text-foreground">{currentStore.name}</p>
            </div>
            {currentStore.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                <MapPin className="w-3 h-3" />{currentStore.address}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="branches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="branches">
            <Building2 className="w-4 h-4 mr-1.5" />
            Branches
          </TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* ── Branches Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="branches" className="space-y-4">
          {branchPanel === null && (
            <div className="flex justify-end">
              <Button onClick={() => { setBranchPanel('create'); setEditingStore(null); setBranchError(null); }} className="gap-2">
                <Plus className="w-4 h-4" /> Add Branch
              </Button>
            </div>
          )}

          {branchPanel !== null && (
            <BranchForm
              mode={branchPanel}
              initial={editingStore}
              onSave={handleSaveBranch}
              onCancel={() => { setBranchPanel(null); setEditingStore(null); setBranchError(null); }}
              saving={savingBranch}
              error={branchError}
            />
          )}

          {loadingStores ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : stores.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground">No branches yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first branch to get started</p>
                {branchPanel === null && (
                  <Button className="mt-4 gap-2" size="sm" onClick={() => setBranchPanel('create')}>
                    <Plus className="w-4 h-4" /> Add First Branch
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {stores.map(store => {
                const isCurrentStore = currentStore?.id === store.id;
                return (
                  <Card
                    key={store.id}
                    className={`transition-all ${
                      editingStore?.id === store.id ? 'border-primary ring-1 ring-primary/30' : 'hover:border-border/80'
                    } ${!store.isActive ? 'opacity-60' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">

                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          store.isActive ? 'bg-primary/10' : 'bg-muted'
                        }`}>
                          <Building2 className={`w-5 h-5 ${store.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">{store.name}</p>
                            {isCurrentStore && (
                              <Badge className="text-[10px] h-4 px-1.5">Active Store</Badge>
                            )}
                            {!store.isActive && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                                Disabled
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            {store.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">{store.address}</span>
                              </span>
                            )}
                            {store.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 shrink-0" />{store.phone}
                              </span>
                            )}
                            {store.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="truncate">{store.email}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3 shrink-0" />
                              {store.currency} · Tax {(store.taxRate * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isCurrentStore && store.isActive && (
                            <Button variant="outline" size="sm" onClick={() => handleStoreSwitch(store.id)} className="h-8 text-xs gap-1">
                              Switch <ChevronRight className="w-3 h-3" />
                            </Button>
                          )}
                          <button onClick={() => handleToggleActive(store)} title={store.isActive ? 'Disable' : 'Enable'}
                            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            {store.isActive
                              ? <ToggleRight className="w-4 h-4 text-green-600" />
                              : <ToggleLeft  className="w-4 h-4" />}
                          </button>
                          <button onClick={() => { setEditingStore(store); setBranchPanel('edit'); setBranchError(null); }}
                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(store)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── System Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>General configuration for your POS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Business Name</label>
                <Input value={systemSettings.businessName}
                  onChange={e => setSystemSettings({ ...systemSettings, businessName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Receipt Footer Text</label>
                <textarea
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={3}
                  value={systemSettings.receiptFooter}
                  onChange={e => setSystemSettings({ ...systemSettings, receiptFooter: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Currency Symbol</label>
                <Input value={systemSettings.currencySymbol}
                  onChange={e => setSystemSettings({ ...systemSettings, currencySymbol: e.target.value })}
                  className="max-w-[120px]" />
              </div>
              <div className="space-y-3 pt-2">
                <p className="text-sm font-semibold">Feature Toggles</p>
                {[
                  { key: 'enableLoyalty',      label: 'Enable Loyalty Program',   desc: 'Allow customers to earn and redeem points' },
                  { key: 'requireEmail',        label: 'Require Customer Email',   desc: 'Mandate email collection at checkout' },
                  { key: 'autoPrintReceipts',   label: 'Auto-Print Receipts',      desc: 'Automatically print receipt after each sale' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSystemSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        systemSettings[item.key as keyof typeof systemSettings] ? 'bg-green-500' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        systemSettings[item.key as keyof typeof systemSettings] ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
              <Button onClick={() => showToast('success', 'System settings saved successfully!')} className="w-full gap-2 mt-2">
                <Save className="w-4 h-4" /> Save System Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {deleteTarget && (
        <DeleteBranchModal
          store={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteBranch}
          deleting={deletingBranch}
        />
      )}
    </div>
  );
}