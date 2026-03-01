'use client';
// File: app/dashboard/users/page.tsx

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from '@/lib/supabase/auth-helper';
import { getAllStores } from '@/lib/supabase/stores-helper';
import type { Store } from '@/lib/supabase/stores-helper';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users, Plus, Search, Edit2, Trash2, X, Check,
  Shield, ShieldCheck, UserCheck, UserX, Eye, EyeOff,
  RefreshCw, AlertTriangle, ChevronUp, ChevronDown, Building2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'super_admin' | 'admin' | 'manager' | 'cashier' | 'inventory_staff';

interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  storeId: string | null;
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
}

interface UserFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  storeId: string;
  isActive: boolean;
}

type SortField = 'name' | 'email' | 'role' | 'isActive' | 'branch';
type SortDir   = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: { value: UserRole; label: string; color: string }[] = [
  { value: 'super_admin',     label: 'Super Admin',     color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'admin',           label: 'Admin',           color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'manager',         label: 'Manager',         color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'cashier',         label: 'Cashier',         color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'inventory_staff', label: 'Inventory Staff', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
];

const EMPTY_FORM: UserFormData = {
  email: '', password: '', firstName: '', lastName: '',
  role: 'cashier', storeId: '', isActive: true,
};

const roleColor = (role: UserRole) =>
  ROLES.find(r => r.value === role)?.color ?? 'bg-gray-100 text-gray-700 border-gray-200';
const roleLabel = (role: UserRole) =>
  ROLES.find(r => r.value === role)?.label ?? role;

// ─── Role sync helper ─────────────────────────────────────────────────────────

async function syncRoleToWorker(email: string, newRole: UserRole) {
  const map: Partial<Record<UserRole, string>> = {
    manager: 'manager', cashier: 'cashier', inventory_staff: 'inventory_staff',
  };
  const workerRole = map[newRole];
  if (!workerRole) return;
  await supabase.from('workers').update({ role: workerRole }).eq('email', email);
}

// ─── User Modal (responsive & scrollable) ────────────────────────────────────

interface UserModalProps {
  mode: 'create' | 'edit';
  initial?: AppUser | null;
  stores: Store[];
  onClose: () => void;
  onSave: (data: UserFormData, userId?: string) => Promise<void>;
  saving: boolean;
  error: string | null;
}

function UserModal({ mode, initial, stores, onClose, onSave, saving, error }: UserModalProps) {
  const [form, setForm] = useState<UserFormData>(
    initial
      ? {
          email: initial.email, password: '',
          firstName: initial.firstName, lastName: initial.lastName,
          role: initial.role, storeId: initial.storeId ?? '', isActive: initial.isActive,
        }
      : EMPTY_FORM
  );
  const [showPassword, setShowPassword] = useState(false);

  const set = (field: keyof UserFormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const canSubmit = form.email && form.firstName && form.lastName && (mode === 'edit' || form.password);

  return (
    /* Full-screen overlay — flex column so inner card can scroll */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/*
        Card:
        - Mobile  → slides up from bottom, full width, max 92vh tall, scrolls internally
        - Desktop → centered dialog, max-w-lg, max 90vh tall, scrolls internally
      */}
      <div className="relative z-10 w-full sm:max-w-lg flex flex-col bg-background border border-border
                      rounded-t-2xl sm:rounded-2xl shadow-2xl
                      max-h-[92vh] sm:max-h-[90vh] overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-blue-500 to-purple-500 shrink-0" />

        {/* ── HEADER (fixed, never scrolls away) ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border shrink-0">
          {/* Mobile drag handle */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-border sm:hidden" />
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              {mode === 'create' ? 'Add New User' : 'Edit User'}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {mode === 'create'
                ? 'Create a new account for your team'
                : `Editing ${initial?.firstName} ${initial?.lastName}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wide">First Name</label>
              <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Jane" className="h-10" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Last Name</label>
              <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Smith" className="h-10" />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Email</label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" className="h-10" />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Password
              {mode === 'edit' && (
                <span className="normal-case font-normal text-muted-foreground ml-1">(leave blank to keep)</span>
              )}
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder={mode === 'edit' ? '••••••••' : 'Min. 8 characters'}
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role grid — 2 cols on mobile, 3 on sm+ */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Role</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set('role', r.value)}
                  className={`px-2 py-2 rounded-lg text-xs sm:text-sm font-medium border-2 transition-all text-center ${
                    form.role === r.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground hover:bg-muted'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
              <RefreshCw className="w-3 h-3" />
              {mode === 'create'
                ? 'Manager / Cashier / Inventory Staff will auto-sync to Worker Management.'
                : 'Role changes will sync to the linked worker profile.'}
            </p>
          </div>

          {/* Branch */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Branch
              <span className="normal-case font-normal text-muted-foreground ml-1">(optional)</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={form.storeId}
                onChange={e => set('storeId', e.target.value)}
                className="w-full pl-9 pr-4 h-10 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
              >
                <option value="">— No branch (All access) —</option>
                {stores.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.address}</option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Super admins and admins can access all branches regardless of assignment.
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Account Active</p>
              <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
            </div>
            <button
              type="button"
              onClick={() => set('isActive', !form.isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.isActive ? 'bg-green-500' : 'bg-muted-foreground/30'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* ── FOOTER (fixed, never scrolls away) ── */}
        <div className="flex gap-3 px-4 sm:px-6 py-4 border-t border-border bg-background shrink-0">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>Cancel</Button>
          <Button
            onClick={() => onSave(form, initial?.id)}
            disabled={saving || !canSubmit}
            className="flex-1 gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {mode === 'create' ? 'Create User' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  user, onClose, onConfirm, deleting,
}: {
  user: AppUser; onClose: () => void; onConfirm: () => Promise<void>; deleting: boolean;
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
            <h3 className="text-lg font-bold text-foreground">Delete User?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This will permanently delete{' '}
              <span className="font-semibold text-foreground">{user.firstName} {user.lastName}</span>{' '}
              and their worker profile. This cannot be undone.
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const router = useRouter();

  const [users, setUsers]       = useState<AppUser[]>([]);
  const [stores, setStores]     = useState<Store[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing]   = useState(false);

  const [modalMode, setModalMode]     = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast]     = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState<UserRole | 'all'>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortField, setSortField]     = useState<SortField>('name');
  const [sortDir, setSortDir]         = useState<SortDir>('asc');

  useEffect(() => {
    if (!hasPermission('super_admin')) router.replace('/dashboard');
  }, [hasPermission, router]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [usersData, storesData] = await Promise.all([getAllUsers(), getAllStores()]);
      setUsers(usersData as AppUser[]);
      setStores(storesData);
    } catch {
      showToast('error', 'Failed to load data.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Sync stale users ──────────────────────────────────────────────────────

  const handleSyncUsers = useCallback(async () => {
    setSyncing(true);
    try {
      const res  = await fetch('/api/users/clean-stale', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showToast('error', data.error ?? 'Sync failed.'); return; }
      if (data.cleaned > 0)
        showToast('success', `Removed ${data.cleaned} stale user(s): ${data.cleanedEmails?.join(', ')}`);
      else
        showToast('success', 'All users are in sync.');
      loadData(true);
    } catch {
      showToast('error', 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }, [loadData]);

  // ── Sort helpers ──────────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const branchName = (storeId: string | null) =>
    storeId ? (stores.find(s => s.id === storeId)?.name ?? null) : null;

  // ── Filtered + sorted list ────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    let result = [...users];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q)  ||
        u.email.toLowerCase().includes(q)
      );
    }
    if (filterRole !== 'all')    result = result.filter(u => u.role === filterRole);
    if (filterBranch === 'unassigned') result = result.filter(u => !u.storeId);
    else if (filterBranch !== 'all')   result = result.filter(u => u.storeId === filterBranch);
    if (filterActive === 'active')   result = result.filter(u => u.isActive);
    if (filterActive === 'inactive') result = result.filter(u => !u.isActive);

    result.sort((a, b) => {
      let av = '', bv = '';
      switch (sortField) {
        case 'name':     av = `${a.firstName} ${a.lastName}`.toLowerCase(); bv = `${b.firstName} ${b.lastName}`.toLowerCase(); break;
        case 'email':    av = a.email;    bv = b.email;    break;
        case 'role':     av = a.role;     bv = b.role;     break;
        case 'isActive': av = String(a.isActive); bv = String(b.isActive); break;
        case 'branch':   av = branchName(a.storeId) ?? ''; bv = branchName(b.storeId) ?? ''; break;
      }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return result;
  }, [users, stores, search, filterRole, filterBranch, filterActive, sortField, sortDir]);

  const stats = useMemo(() => ({
    total:    users.length,
    active:   users.filter(u => u.isActive).length,
    byRole:   ROLES.map(r => ({ ...r, count: users.filter(u => u.role === r.value).length })),
  }), [users]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleSave = async (form: UserFormData, userId?: string) => {
    setSaving(true); setModalError(null);
    try {
      if (modalMode === 'create') {
        await createUser({
          email: form.email, password: form.password,
          firstName: form.firstName, lastName: form.lastName,
          role: form.role, storeId: form.storeId || null,
        });
        showToast('success', `${form.firstName} ${form.lastName} created.`);
      } else if (userId) {
        const updates: Parameters<typeof updateUser>[1] = {
          email: form.email, firstName: form.firstName, lastName: form.lastName,
          role: form.role, storeId: form.storeId || null, isActive: form.isActive,
        };
        if (form.password) updates.password = form.password;
        await updateUser(userId, updates);
        const original = users.find(u => u.id === userId);
        if (original && original.role !== form.role) await syncRoleToWorker(form.email, form.role);
        showToast('success', `${form.firstName} ${form.lastName} updated.`);
      }
      setModalMode(null); setEditingUser(null);
      loadData(true);
    } catch (err: any) {
      setModalError(err?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      showToast('success', `${deleteTarget.firstName} ${deleteTarget.lastName} deleted.`);
      setDeleteTarget(null);
      loadData(true);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (u: AppUser) => {
    try {
      await updateUser(u.id, { isActive: !u.isActive });
      showToast('success', `${u.firstName} is now ${!u.isActive ? 'active' : 'inactive'}.`);
      loadData(true);
    } catch {
      showToast('error', 'Failed to update status.');
    }
  };

  const openEdit   = (u: AppUser) => { setEditingUser(u); setModalMode('edit');   setModalError(null); };
  const openCreate = ()            => { setEditingUser(null); setModalMode('create'); setModalError(null); };
  const closeModal = ()            => { setModalMode(null); setEditingUser(null); setModalError(null); };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading user management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium max-w-xs sm:max-w-md ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success'
            ? <Check className="w-4 h-4 text-green-600 shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">User Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">Manage staff accounts, roles, and branch assignments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline" size="sm"
            onClick={handleSyncUsers} disabled={syncing || refreshing}
            className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 text-xs sm:text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => loadData(true)} disabled={refreshing || syncing}
            className="gap-2 text-xs sm:text-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreate} size="sm" className="gap-2 text-xs sm:text-sm">
            <Plus className="w-3.5 h-3.5" /> Add User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide">Total</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{stats.total}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide">Active</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1">{stats.active}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide">Branches</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">{stores.length}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">By Role</p>
            <div className="space-y-0.5">
              {stats.byRole.map(r => (
                <div key={r.value} className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{r.label}</span>
                  <span className="text-[10px] sm:text-xs font-bold text-foreground ml-1">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                className="h-9 px-2 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Branches</option>
                <option value="unassigned">Unassigned</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value as UserRole | 'all')}
                className="h-9 px-2 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Roles</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select
                value={filterActive}
                onChange={e => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                className="h-9 px-2 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0 px-4 sm:px-6">
          <CardTitle className="text-sm sm:text-base">
            {filteredUsers.length}{' '}
            <span className="font-normal text-muted-foreground">
              {filteredUsers.length === 1 ? 'user' : 'users'} found
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <Users className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No users found</p>
              <p className="text-muted-foreground text-sm mt-1">
                {search || filterRole !== 'all' || filterBranch !== 'all' || filterActive !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first user to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {([
                      { field: 'name'     as SortField, label: 'Name',   px: 'px-4 sm:px-6' },
                      { field: 'email'    as SortField, label: 'Email',  px: 'px-3 sm:px-4 hidden sm:table-cell' },
                      { field: 'role'     as SortField, label: 'Role',   px: 'px-3 sm:px-4' },
                      { field: 'branch'   as SortField, label: 'Branch', px: 'px-3 sm:px-4 hidden md:table-cell' },
                      { field: 'isActive' as SortField, label: 'Status', px: 'px-3 sm:px-4 hidden sm:table-cell' },
                    ]).map(col => (
                      <th key={col.field} className={`text-left ${col.px} py-3`}>
                        <button
                          onClick={() => toggleSort(col.field)}
                          className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                        >
                          {col.label} <SortIcon field={col.field} />
                        </button>
                      </th>
                    ))}
                    <th className="text-right px-4 sm:px-6 py-3">
                      <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map(u => {
                    const isMe   = u.id === currentUser?.id;
                    const branch = branchName(u.storeId);
                    return (
                      <tr key={u.id} className={`group transition-colors hover:bg-muted/30 ${!u.isActive ? 'opacity-60' : ''}`}>

                        {/* Name */}
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div
                              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0"
                              style={{
                                background: `hsl(${(u.firstName.charCodeAt(0) * 13) % 360}, 60%, 85%)`,
                                color:      `hsl(${(u.firstName.charCodeAt(0) * 13) % 360}, 60%, 30%)`,
                              }}
                            >
                              {u.firstName[0]}{u.lastName[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-foreground text-xs sm:text-sm truncate">{u.firstName} {u.lastName}</span>
                                {isMe && (
                                  <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-primary/10 text-primary uppercase">You</span>
                                )}
                              </div>
                              {/* Show email inline on mobile since email column is hidden */}
                              <p className="text-[10px] text-muted-foreground sm:hidden truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Email — hidden on mobile */}
                        <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">{u.email}</td>

                        {/* Role */}
                        <td className="px-3 sm:px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold border ${roleColor(u.role)}`}>
                            <Shield className="w-2.5 h-2.5" />
                            <span className="hidden sm:inline">{roleLabel(u.role)}</span>
                            <span className="sm:hidden">{roleLabel(u.role).split(' ')[0]}</span>
                          </span>
                        </td>

                        {/* Branch — hidden on mobile */}
                        <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                          {branch ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                              <Building2 className="w-2.5 h-2.5" />{branch}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">All</span>
                          )}
                        </td>

                        {/* Status — hidden on mobile */}
                        <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={isMe}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border transition-all ${
                              u.isActive
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                            } ${isMe ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          >
                            {u.isActive
                              ? <><UserCheck className="w-2.5 h-2.5" /> Active</>
                              : <><UserX className="w-2.5 h-2.5" /> Inactive</>}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => openEdit(u)}
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-primary/10 hover:text-primary"
                            >
                              <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setDeleteTarget(u)}
                              disabled={isMe}
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {modalMode && (
        <UserModal
          mode={modalMode}
          initial={editingUser}
          stores={stores}
          onClose={closeModal}
          onSave={handleSave}
          saving={saving}
          error={modalError}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}