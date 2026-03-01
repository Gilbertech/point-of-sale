'use client';
// Place at: app/dashboard/worker/page.tsx
// Full worker management: Staff · Salary · Shifts · Attendance · Leave · Performance · Queries · Announcements

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search, Plus, Edit2, Trash2, X, Check, Briefcase, Calendar,
  CreditCard, Users, DollarSign, ShieldAlert, Clock, CalendarDays,
  Umbrella, TrendingUp, Bell, MessageCircleQuestion, User, Send,
  CheckCircle2, AlertCircle, Timer, LogIn, LogOut, Star, Pin,
  ChevronLeft, ChevronRight, Megaphone, AlertTriangle, Award,
  ChevronDown, ChevronUp, XCircle, Building2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useAuth } from '@/lib/auth-context';
import {
  getAllWorkers, createWorker, updateWorker, deleteWorker,
  getSalaryRecordsByWorker, createSalaryRecord, markSalaryPaid,
  createWorkerWithAccount,
} from '@/lib/supabase/workers-helper';
import { getAllStores } from '@/lib/supabase/stores-helper';
import type { Store } from '@/lib/supabase/stores-helper';
import { supabase } from '@/lib/supabase/client';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

type WorkerRole     = 'manager' | 'cashier' | 'inventory_staff';
type ShiftType      = 'morning' | 'afternoon' | 'evening' | 'night' | 'full_day';
type ShiftStatus    = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
type AttStatus      = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
type LeaveType      = 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'emergency' | 'compassionate';
type LeaveStatus    = 'pending' | 'approved' | 'rejected' | 'cancelled';
type Priority       = 'low' | 'medium' | 'high';
type QueryStatus    = 'open' | 'in-progress' | 'resolved';
type AnnCategory    = 'general' | 'urgent' | 'policy' | 'event' | 'training';

interface Worker {
  id: string; firstName: string; lastName: string; email: string; phone: string;
  role: WorkerRole; department: string; salary: number; status: 'active' | 'inactive';
  joinDate: string; storeId: string | null; userId: string | null; createdAt: Date;
}
interface SalaryRecord { id: string; workerId: string; month: string; amount: number; status: 'paid' | 'pending'; paidDate: string | null; notes: string; createdAt: Date; }
interface Shift { id: string; workerId: string; workerName: string; workerRole: string; date: string; startTime: string; endTime: string; shiftType: ShiftType; status: ShiftStatus; notes: string | null; createdAt: Date; }
interface AttRecord { id: string; workerId: string; workerName: string; workerRole: string; date: string; status: AttStatus; checkIn: string | null; checkOut: string | null; hoursWorked: number | null; notes: string | null; createdAt: Date; }
interface LeaveReq { id: string; workerId: string; workerName: string; workerRole: string; leaveType: LeaveType; startDate: string; endDate: string; days: number; reason: string; status: LeaveStatus; adminNotes: string | null; reviewedBy: string | null; createdAt: Date; }
interface Review { id: string; workerId: string; workerName: string; reviewerName: string; reviewPeriod: string; rating: number; punctuality: number | null; productivity: number | null; teamwork: number | null; communication: number | null; strengths: string | null; improvements: string | null; goals: string | null; createdAt: Date; }
interface WorkerQuery { id: string; workerId: string; submittedBy: string; submittedByRole: string; subject: string; message: string; category: string; priority: Priority; status: QueryStatus; adminReply: string | null; resolvedAt: Date | null; createdAt: Date; }
interface Announcement { id: string; title: string; message: string; category: AnnCategory; isPinned: boolean; expiresAt: Date | null; createdBy: string; createdAt: Date; }

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const ROLE_LABELS: Record<WorkerRole, string> = { manager: 'Manager', cashier: 'Cashier', inventory_staff: 'Inventory Staff' };
const ROLE_COLORS: Record<WorkerRole, string> = { manager: 'bg-purple-100 text-purple-800', cashier: 'bg-blue-100 text-blue-800', inventory_staff: 'bg-yellow-100 text-yellow-800' };

const SHIFT_COLORS: Record<ShiftType, string> = {
  morning: 'bg-amber-100 text-amber-800 border-amber-200', afternoon: 'bg-blue-100 text-blue-800 border-blue-200',
  evening: 'bg-purple-100 text-purple-800 border-purple-200', night: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  full_day: 'bg-green-100 text-green-800 border-green-200',
};
const SHIFT_STATUS_COLORS: Record<ShiftStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600', no_show: 'bg-red-100 text-red-800',
};
const SHIFT_DEFAULTS: Record<ShiftType, { start: string; end: string }> = {
  morning: { start: '06:00', end: '14:00' }, afternoon: { start: '14:00', end: '22:00' },
  evening: { start: '18:00', end: '23:00' }, night: { start: '22:00', end: '06:00' }, full_day: { start: '08:00', end: '17:00' },
};
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ATT_CONFIG: Record<AttStatus, { color: string; icon: React.ReactNode; label: string }> = {
  present:  { color: 'bg-green-100 text-green-800',   icon: <CheckCircle2 className="w-3 h-3" />, label: 'Present' },
  absent:   { color: 'bg-red-100 text-red-800',       icon: <XCircle      className="w-3 h-3" />, label: 'Absent' },
  late:     { color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle  className="w-3 h-3" />, label: 'Late' },
  half_day: { color: 'bg-orange-100 text-orange-800', icon: <Timer        className="w-3 h-3" />, label: 'Half Day' },
  on_leave: { color: 'bg-blue-100 text-blue-800',     icon: <Clock        className="w-3 h-3" />, label: 'On Leave' },
};

const LEAVE_COLORS: Record<LeaveType, string> = {
  annual: 'bg-blue-100 text-blue-800', sick: 'bg-red-100 text-red-800', maternity: 'bg-pink-100 text-pink-800',
  paternity: 'bg-purple-100 text-purple-800', unpaid: 'bg-gray-100 text-gray-700',
  emergency: 'bg-orange-100 text-orange-800', compassionate: 'bg-teal-100 text-teal-800',
};
const LEAVE_STATUS_CONFIG: Record<LeaveStatus, { color: string; icon: React.ReactNode }> = {
  pending:   { color: 'bg-yellow-100 text-yellow-800', icon: <Clock        className="w-3 h-3" /> },
  approved:  { color: 'bg-green-100 text-green-800',   icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected:  { color: 'bg-red-100 text-red-800',       icon: <XCircle      className="w-3 h-3" /> },
  cancelled: { color: 'bg-gray-100 text-gray-600',     icon: <XCircle      className="w-3 h-3" /> },
};

const PRIORITY_COLORS: Record<Priority, string> = { low: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-red-100 text-red-800' };
const QUERY_STATUS_COLORS: Record<QueryStatus, string> = { open: 'bg-blue-100 text-blue-800', 'in-progress': 'bg-yellow-100 text-yellow-800', resolved: 'bg-green-100 text-green-800' };
const QUERY_CATEGORIES = ['Payroll', 'Leave', 'Technical', 'Scheduling', 'Complaint', 'Other'];

const ANN_CONFIG: Record<AnnCategory, { color: string; icon: React.ReactNode }> = {
  general:   { color: 'bg-gray-100 text-gray-700',     icon: <Bell          className="w-3 h-3" /> },
  urgent:    { color: 'bg-red-100 text-red-800',       icon: <AlertTriangle className="w-3 h-3" /> },
  policy:    { color: 'bg-blue-100 text-blue-800',     icon: <Megaphone     className="w-3 h-3" /> },
  event:     { color: 'bg-green-100 text-green-800',   icon: <Bell          className="w-3 h-3" /> },
  training:  { color: 'bg-purple-100 text-purple-800', icon: <Bell          className="w-3 h-3" /> },
};

const EMPTY_WORKER = {
  firstName: '', lastName: '', email: '', phone: '',
  role: 'cashier' as WorkerRole, department: '', salary: 0,
  status: 'active' as const, joinDate: new Date().toISOString().split('T')[0],
  storeId: '',
};

// ══════════════════════════════════════════════════════════════════════════════
// ROLE SYNC HELPER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * When a worker's role changes, find the linked app_users record (by email)
 * and update it. Worker roles map to app_user roles 1-to-1 for manager/cashier.
 * inventory_staff has no app_user equivalent so we skip it.
 */
async function syncRoleToAppUser(email: string, newWorkerRole: WorkerRole) {
  const appUserRoleMap: Partial<Record<WorkerRole, string>> = {
    manager: 'manager',
    cashier: 'cashier',
  };
  const appRole = appUserRoleMap[newWorkerRole];
  if (!appRole) return; // inventory_staff has no login role equivalent

  await supabase
    .from('app_users')
    .update({ role: appRole })
    .eq('email', email);
}

// ══════════════════════════════════════════════════════════════════════════════
// CREDENTIALS MODAL
// ══════════════════════════════════════════════════════════════════════════════

function CredentialsModal({ email, password, name, onClose }: { email: string; password: string; name: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `Email: ${email}\nPassword: ${password}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(el);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" /> Worker Account Created
            </CardTitle>
            <CardDescription>Share these login credentials with {name}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-xl p-4 space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Login Email</p>
              <p className="text-sm font-mono font-semibold text-foreground bg-background rounded-lg px-3 py-2 border border-border">{email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Temporary Password</p>
              <p className="text-sm font-mono font-semibold text-foreground bg-background rounded-lg px-3 py-2 border border-border">{password}</p>
            </div>
          </div>
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              Please share these credentials securely and ask {name} to change their password after first login.
            </AlertDescription>
          </Alert>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleCopy}>
              {copied ? <><Check className="w-4 h-4 mr-2 text-green-600" />Copied!</> : 'Copy Credentials'}
            </Button>
            <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={onClose}>
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED UTILS
// ══════════════════════════════════════════════════════════════════════════════

function calcDays(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

function StarRating({ value, onChange, readOnly }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" onClick={() => !readOnly && onChange?.(i)}
          className={`${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
          <Star className={`w-4 h-4 ${i <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════════════════════

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <Card className="w-full max-w-lg bg-card border-border shadow-2xl my-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

// ─── Worker Modal ─────────────────────────────────────────────────────────────
function WorkerModal({
  worker,
  stores,
  onClose,
  onSave,
}: {
  worker: Worker | null;
  stores: Store[];
  onClose: () => void;
  onSave: (d: any) => Promise<void>;
}) {
  const [form, setForm] = useState(
    worker
      ? {
          firstName: worker.firstName,
          lastName: worker.lastName,
          email: worker.email,
          phone: worker.phone ?? '',
          role: worker.role,
          department: worker.department ?? '',
          salary: worker.salary,
          status: worker.status,
          joinDate: worker.joinDate,
          storeId: worker.storeId ?? '',
        }
      : EMPTY_WORKER
  );
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) { alert('Name and email required.'); return; }
    setSaving(true);
    await onSave({ ...form, storeId: form.storeId || null });
    setSaving(false);
  };

  return (
    <Modal title={worker ? 'Edit Worker' : 'Add Worker'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          {(['firstName', 'lastName'] as const).map(k => (
            <div key={k} className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground capitalize">
                {k === 'firstName' ? 'First Name *' : 'Last Name *'}
              </label>
              <Input value={form[k]} onChange={e => set(k, e.target.value)} className="border-border bg-input text-foreground" />
            </div>
          ))}
        </div>

        {/* Email / Phone / Department */}
        {[['Email *', 'email', 'email'], ['Phone', 'phone', 'tel'], ['Department', 'department', 'text']].map(([label, key, type]) => (
          <div key={key} className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">{label}</label>
            <Input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)} className="border-border bg-input text-foreground" />
          </div>
        ))}

        {/* Role / Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
              <option value="inventory_staff">Inventory Staff</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Salary / Join Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Monthly Salary</label>
            <Input type="number" min={0} value={form.salary} onChange={e => set('salary', Number(e.target.value))} className="border-border bg-input text-foreground" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Join Date</label>
            <Input type="date" value={form.joinDate} onChange={e => set('joinDate', e.target.value)} className="border-border bg-input text-foreground" />
          </div>
        </div>

        {/* ── Branch Assignment ── */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Assign to Branch
            <span className="font-normal text-muted-foreground/70">(optional)</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={form.storeId}
              onChange={e => set('storeId', e.target.value)}
              className="w-full pl-9 pr-4 h-10 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
            >
              <option value="">— No branch assigned —</option>
              {stores.filter(s => s.isActive).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.address ? ` — ${s.address}` : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Assigns this worker to a specific branch for scheduling and reporting.
          </p>
        </div>

        {worker && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 bg-muted/50 rounded-lg px-3 py-2">
            <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />
            Role changes sync automatically to the linked login account.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>
            {saving ? 'Saving...' : worker ? 'Save Changes' : 'Add Worker'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Shift Modal ──────────────────────────────────────────────────────────────
function ShiftModal({ workers, shift, onClose, onSuccess }: { workers: Worker[]; shift?: Shift | null; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ workerId: shift?.workerId ?? '', date: shift?.date ?? new Date().toISOString().split('T')[0], shiftType: (shift?.shiftType ?? 'morning') as ShiftType, startTime: shift?.startTime ?? '06:00', endTime: shift?.endTime ?? '14:00', status: (shift?.status ?? 'scheduled') as ShiftStatus, notes: shift?.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const onTypeChange = (t: ShiftType) => { const d = SHIFT_DEFAULTS[t]; setForm(p => ({ ...p, shiftType: t, startTime: d.start, endTime: d.end })); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.workerId || !form.date) { setError('Worker and date required.'); return; }
    setSaving(true); setError('');
    try {
      const w = workers.find(x => x.id === form.workerId);
      const payload = { worker_id: form.workerId, worker_name: w ? `${w.firstName} ${w.lastName}` : '', worker_role: w?.role ?? '', date: form.date, start_time: form.startTime, end_time: form.endTime, shift_type: form.shiftType, status: form.status, notes: form.notes || null };
      const { error: err } = shift ? await supabase.from('shifts').update(payload).eq('id', shift.id) : await supabase.from('shifts').insert([payload]);
      if (err) throw new Error(err.message);
      onSuccess(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={shift ? 'Edit Shift' : 'Schedule Shift'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Worker *</label>
          <select value={form.workerId} onChange={e => set('workerId', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select worker...</option>
            {workers.filter(w => w.status === 'active').map(w => <option key={w.id} value={w.id}>{w.firstName} {w.lastName} — {ROLE_LABELS[w.role]}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Date *</label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="border-border bg-input text-foreground" /></div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Shift Type</label>
            <select value={form.shiftType} onChange={e => onTypeChange(e.target.value as ShiftType)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring capitalize">
              {(Object.keys(SHIFT_DEFAULTS) as ShiftType[]).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Start</label><Input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} className="border-border bg-input text-foreground" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">End</label><Input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)} className="border-border bg-input text-foreground" /></div>
        </div>
        {shift && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              {['scheduled','completed','cancelled','no_show'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Notes</label><Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional..." className="border-border bg-input text-foreground" /></div>
        <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">{saving ? 'Saving...' : shift ? 'Update' : 'Schedule'}</Button></div>
      </form>
    </Modal>
  );
}

// ─── Attendance Modal ─────────────────────────────────────────────────────────
function AttModal({ workers, record, onClose, onSuccess }: { workers: Worker[]; record?: AttRecord | null; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ workerId: record?.workerId ?? '', date: record?.date ?? new Date().toISOString().split('T')[0], status: (record?.status ?? 'present') as AttStatus, checkIn: record?.checkIn ?? '', checkOut: record?.checkOut ?? '', notes: record?.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const hoursWorked = useMemo(() => {
    if (!form.checkIn || !form.checkOut) return null;
    const [sh, sm] = form.checkIn.split(':').map(Number); const [eh, em] = form.checkOut.split(':').map(Number);
    let m = (eh * 60 + em) - (sh * 60 + sm); if (m < 0) m += 1440;
    return Math.round(m / 60 * 100) / 100;
  }, [form.checkIn, form.checkOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.workerId || !form.date) { setError('Worker and date required.'); return; }
    setSaving(true); setError('');
    try {
      const w = workers.find(x => x.id === form.workerId);
      const payload = { worker_id: form.workerId, worker_name: w ? `${w.firstName} ${w.lastName}` : '', worker_role: w?.role ?? '', date: form.date, status: form.status, check_in: form.checkIn || null, check_out: form.checkOut || null, hours_worked: hoursWorked, notes: form.notes || null };
      const { error: err } = record ? await supabase.from('attendance').update(payload).eq('id', record.id) : await supabase.from('attendance').insert([payload]);
      if (err) throw new Error(err.message);
      onSuccess(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={record ? 'Edit Attendance' : 'Mark Attendance'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Worker *</label>
          <select value={form.workerId} onChange={e => set('workerId', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select worker...</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Date *</label><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="border-border bg-input text-foreground" /></div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value as AttStatus)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.keys(ATT_CONFIG) as AttStatus[]).map(s => <option key={s} value={s}>{ATT_CONFIG[s].label}</option>)}
            </select>
          </div>
        </div>
        {['present','late','half_day'].includes(form.status) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><LogIn className="w-3 h-3" />Check In</label><Input type="time" value={form.checkIn} onChange={e => set('checkIn', e.target.value)} className="border-border bg-input text-foreground" /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><LogOut className="w-3 h-3" />Check Out</label><Input type="time" value={form.checkOut} onChange={e => set('checkOut', e.target.value)} className="border-border bg-input text-foreground" /></div>
          </div>
        )}
        {hoursWorked != null && <div className="bg-muted rounded-lg p-2.5 text-sm text-muted-foreground">Hours worked: <span className="font-semibold text-foreground">{hoursWorked}h</span></div>}
        <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Notes</label><Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional..." className="border-border bg-input text-foreground" /></div>
        <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">{saving ? 'Saving...' : 'Save'}</Button></div>
      </form>
    </Modal>
  );
}

// ─── Leave Modal ──────────────────────────────────────────────────────────────
function LeaveModal({ user, workers, req, canManage, onClose, onSuccess }: { user: any; workers: Worker[]; req?: LeaveReq | null; canManage: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ workerId: req?.workerId ?? '', leaveType: (req?.leaveType ?? 'annual') as LeaveType, startDate: req?.startDate ?? '', endDate: req?.endDate ?? '', reason: req?.reason ?? '', status: (req?.status ?? 'pending') as LeaveStatus, adminNotes: req?.adminNotes ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const days = calcDays(form.startDate, form.endDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.workerId || !form.startDate || !form.endDate || !form.reason) { setError('All fields required.'); return; }
    if (new Date(form.endDate) < new Date(form.startDate)) { setError('End must be after start.'); return; }
    setSaving(true); setError('');
    try {
      const w = workers.find(x => x.id === form.workerId);
      const payload: any = { worker_id: form.workerId, worker_name: w ? `${w.firstName} ${w.lastName}` : '', worker_role: w?.role ?? '', leave_type: form.leaveType, start_date: form.startDate, end_date: form.endDate, days, reason: form.reason, status: form.status, admin_notes: form.adminNotes || null };
      if (canManage && form.status !== 'pending') payload.reviewed_by = `${user.firstName} ${user.lastName}`.trim();
      const { error: err } = req ? await supabase.from('leave_requests').update(payload).eq('id', req.id) : await supabase.from('leave_requests').insert([payload]);
      if (err) throw new Error(err.message);
      onSuccess(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={req ? 'Edit Leave Request' : 'Request Leave'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Worker *</label>
          <select value={form.workerId} onChange={e => set('workerId', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select worker...</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Leave Type</label>
            <select value={form.leaveType} onChange={e => set('leaveType', e.target.value as LeaveType)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring capitalize">
              {(Object.keys(LEAVE_COLORS) as LeaveType[]).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {canManage && req && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as LeaveStatus)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                {['pending','approved','rejected','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Start Date *</label><Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className="border-border bg-input text-foreground" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">End Date *</label><Input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className="border-border bg-input text-foreground" /></div>
        </div>
        {days > 0 && <div className="bg-muted rounded-lg p-2.5 text-sm text-muted-foreground">Duration: <span className="font-semibold text-foreground">{days} day{days !== 1 ? 's' : ''}</span></div>}
        <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Reason *</label><textarea rows={2} value={form.reason} onChange={e => set('reason', e.target.value)} className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" /></div>
        {canManage && <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Admin Notes</label><Input value={form.adminNotes} onChange={e => set('adminNotes', e.target.value)} placeholder="Optional..." className="border-border bg-input text-foreground" /></div>}
        <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">{saving ? 'Saving...' : 'Submit'}</Button></div>
      </form>
    </Modal>
  );
}

// ─── Query Modal ──────────────────────────────────────────────────────────────
function QueryModal({ user, workers, onClose, onSuccess }: { user: any; workers: Worker[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ workerId: '', subject: '', category: 'Payroll', message: '', priority: 'medium' as Priority });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.workerId || !form.subject || !form.message) { setError('Worker, subject and message required.'); return; }
    setSaving(true); setError('');
    try {
      const w = workers.find(x => x.id === form.workerId);
      const { error: err } = await supabase.from('worker_queries').insert([{
        worker_id: form.workerId,
        submitted_by: w ? `${w.firstName} ${w.lastName}` : `${user.firstName} ${user.lastName}`.trim(),
        submitted_by_role: w?.role ?? user.role,
        subject: form.subject, message: form.message, category: form.category, priority: form.priority, status: 'open',
      }]);
      if (err) throw new Error(err.message);
      onSuccess(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Submit Query" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Worker *</label>
          <select value={form.workerId} onChange={e => set('workerId', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select worker...</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Subject *</label><Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="e.g. Payroll discrepancy" className="border-border bg-input text-foreground" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              {QUERY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value as Priority)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Message *</label><textarea rows={3} value={form.message} onChange={e => set('message', e.target.value)} className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" /></div>
        <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">{saving ? 'Submitting...' : 'Submit Query'}</Button></div>
      </form>
    </Modal>
  );
}

// ─── Announcement Modal ───────────────────────────────────────────────────────
function AnnModal({ user, ann, onClose, onSuccess }: { user: any; ann?: Announcement | null; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ title: ann?.title ?? '', message: ann?.message ?? '', category: (ann?.category ?? 'general') as AnnCategory, isPinned: ann?.isPinned ?? false, expiresAt: ann?.expiresAt ? ann.expiresAt.toISOString().split('T')[0] : '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.message) { setError('Title and message required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { title: form.title, message: form.message, category: form.category, is_pinned: form.isPinned, expires_at: form.expiresAt || null, created_by: `${user.firstName} ${user.lastName}`.trim() };
      const { error: err } = ann ? await supabase.from('announcements').update(payload).eq('id', ann.id) : await supabase.from('announcements').insert([payload]);
      if (err) throw new Error(err.message);
      onSuccess(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={ann ? 'Edit Announcement' : 'New Announcement'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Title *</label><Input value={form.title} onChange={e => set('title', e.target.value)} className="border-border bg-input text-foreground" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring capitalize">
              {(Object.keys(ANN_CONFIG) as AnnCategory[]).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Expires</label><Input type="date" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} className="border-border bg-input text-foreground" /></div>
        </div>
        <div className="space-y-1.5"><label className="text-sm font-medium text-muted-foreground">Message *</label><textarea rows={3} value={form.message} onChange={e => set('message', e.target.value)} className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" /></div>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isPinned} onChange={e => set('isPinned', e.target.checked)} className="w-4 h-4" /><span className="text-sm text-foreground">Pin this announcement</span></label>
        <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">{saving ? 'Publishing...' : 'Publish'}</Button></div>
      </form>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

type Tab = 'staff' | 'salary' | 'shifts' | 'attendance' | 'leave' | 'performance' | 'queries' | 'announcements';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'staff',         label: 'Staff',         icon: <Users              className="w-4 h-4" /> },
  { key: 'salary',        label: 'Salary',         icon: <DollarSign         className="w-4 h-4" /> },
  { key: 'shifts',        label: 'Shifts',         icon: <CalendarDays       className="w-4 h-4" /> },
  { key: 'attendance',    label: 'Attendance',     icon: <Clock              className="w-4 h-4" /> },
  { key: 'leave',         label: 'Leave',          icon: <Umbrella           className="w-4 h-4" /> },
  { key: 'performance',   label: 'Performance',    icon: <TrendingUp         className="w-4 h-4" /> },
  { key: 'queries',       label: 'Queries',        icon: <MessageCircleQuestion className="w-4 h-4" /> },
  { key: 'announcements', label: 'Announcements',  icon: <Bell               className="w-4 h-4" /> },
];

export default function WorkersPage() {
  const { user } = useAuth();
  const isAdmin   = user?.role === 'super_admin' || user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canManage = isAdmin || isManager;

  if (!canManage) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <Alert className="max-w-md"><ShieldAlert className="h-4 w-4" /><AlertDescription>You don't have permission to access Worker Management.</AlertDescription></Alert>
      </div>
    );
  }

  const [tab, setTab] = useState<Tab>('staff');

  // ── Data ────────────────────────────────────────────────────────────────────
  const [workers,       setWorkers]       = useState<Worker[]>([]);
  const [stores,        setStores]        = useState<Store[]>([]);
  const [shifts,        setShifts]        = useState<Shift[]>([]);
  const [attRecords,    setAttRecords]    = useState<AttRecord[]>([]);
  const [leaveReqs,     setLeaveReqs]     = useState<LeaveReq[]>([]);
  const [reviews,       setReviews]       = useState<Review[]>([]);
  const [queries,       setQueries]       = useState<WorkerQuery[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);

  const [loading, setLoading] = useState(true);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState('');
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [editWorker,      setEditWorker]      = useState<Worker | null>(null);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [editShift,       setEditShift]       = useState<Shift | null>(null);
  const [showShiftModal,  setShowShiftModal]  = useState(false);
  const [editAtt,         setEditAtt]         = useState<AttRecord | null>(null);
  const [showAttModal,    setShowAttModal]    = useState(false);
  const [editLeave,       setEditLeave]       = useState<LeaveReq | null>(null);
  const [showLeaveModal,  setShowLeaveModal]  = useState(false);
  const [showQueryModal,  setShowQueryModal]  = useState(false);
  const [showAnnModal,    setShowAnnModal]    = useState(false);
  const [editAnn,         setEditAnn]         = useState<Announcement | null>(null);
  const [selectedWorker,  setSelectedWorker]  = useState<Worker | null>(null);
  const [loadingSalary,   setLoadingSalary]   = useState(false);
  const [selectedQuery,   setSelectedQuery]   = useState<WorkerQuery | null>(null);
  const [qReply,          setQReply]          = useState('');
  const [qReplying,       setQReplying]       = useState(false);
  const [shiftView,       setShiftView]       = useState<'week' | 'list'>('week');
  const [attDateFilter,   setAttDateFilter]   = useState(new Date().toISOString().split('T')[0]);
  const [expandedReview,  setExpandedReview]  = useState<string | null>(null);
  const [currentWeek,     setCurrentWeek]     = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d; });

  // ── Credentials modal state ─────────────────────────────────────────────────
  const [credsModal, setCredsModal] = useState<{ email: string; password: string; name: string } | null>(null);

  // ── Load all data ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [w, storesData, s, a, l, r, q, an] = await Promise.all([
        getAllWorkers(),
        getAllStores(),
        supabase.from('shifts').select('*').order('date').order('start_time'),
        supabase.from('attendance').select('*').order('date', { ascending: false }),
        supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('performance_reviews').select('*').order('created_at', { ascending: false }),
        supabase.from('worker_queries').select('*').order('created_at', { ascending: false }),
        supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      ]);
      setWorkers((w as any[]).map((x: any) => ({ id: x.id, firstName: x.firstName ?? x.first_name, lastName: x.lastName ?? x.last_name, email: x.email, phone: x.phone ?? "", role: x.role, department: x.department ?? "", salary: x.salary ?? 0, status: x.status ?? "active", joinDate: x.joinDate ?? x.join_date ?? "", storeId: x.storeId ?? x.store_id ?? null, userId: x.userId ?? x.user_id ?? null, createdAt: new Date(x.createdAt ?? x.created_at) })));
      setStores(storesData);
      setShifts((s.data || []).map((x: any) => ({ id: x.id, workerId: x.worker_id, workerName: x.worker_name, workerRole: x.worker_role, date: x.date, startTime: x.start_time, endTime: x.end_time, shiftType: x.shift_type, status: x.status, notes: x.notes, createdAt: new Date(x.created_at) })));
      setAttRecords((a.data || []).map((x: any) => ({ id: x.id, workerId: x.worker_id, workerName: x.worker_name, workerRole: x.worker_role, date: x.date, status: x.status, checkIn: x.check_in, checkOut: x.check_out, hoursWorked: x.hours_worked, notes: x.notes, createdAt: new Date(x.created_at) })));
      setLeaveReqs((l.data || []).map((x: any) => ({ id: x.id, workerId: x.worker_id, workerName: x.worker_name, workerRole: x.worker_role, leaveType: x.leave_type, startDate: x.start_date, endDate: x.end_date, days: x.days, reason: x.reason, status: x.status, adminNotes: x.admin_notes, reviewedBy: x.reviewed_by, createdAt: new Date(x.created_at) })));
      setReviews((r.data || []).map((x: any) => ({ id: x.id, workerId: x.worker_id, workerName: x.worker_name, reviewerName: x.reviewer_name, reviewPeriod: x.review_period, rating: x.rating, punctuality: x.punctuality, productivity: x.productivity, teamwork: x.teamwork, communication: x.communication, strengths: x.strengths, improvements: x.improvements, goals: x.goals, createdAt: new Date(x.created_at) })));
      setQueries((q.data || []).map((x: any) => ({ id: x.id, workerId: x.worker_id, submittedBy: x.submitted_by, submittedByRole: x.submitted_by_role, subject: x.subject, message: x.message, category: x.category, priority: x.priority, status: x.status, adminReply: x.admin_reply, resolvedAt: x.resolved_at ? new Date(x.resolved_at) : null, createdAt: new Date(x.created_at) })));
      setAnnouncements((an.data || []).map((x: any) => ({ id: x.id, title: x.title, message: x.message, category: x.category, isPinned: x.is_pinned, expiresAt: x.expires_at ? new Date(x.expires_at) : null, createdBy: x.created_by, createdAt: new Date(x.created_at) })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadSalary = async (w: Worker) => {
    setSelectedWorker(w); setLoadingSalary(true);
    try { setSalaryRecords(await getSalaryRecordsByWorker(w.id)); }
    catch (e) { console.error(e); }
    finally { setLoadingSalary(false); }
  };

  // ── Computed stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: workers.length, active: workers.filter(w => w.status === 'active').length,
    payroll: workers.filter(w => w.status === 'active').reduce((a, w) => a + w.salary, 0),
    openQueries: queries.filter(q => q.status === 'open').length,
    pendingLeave: leaveReqs.filter(l => l.status === 'pending').length,
    todayAtt: attRecords.filter(r => r.date === new Date().toISOString().split('T')[0]).length,
  }), [workers, queries, leaveReqs, attRecords]);

  const filteredWorkers = useMemo(() => {
    if (!search) return workers;
    const q = search.toLowerCase();
    return workers.filter(w => `${w.firstName} ${w.lastName} ${w.email} ${w.role}`.toLowerCase().includes(q));
  }, [workers, search]);

  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    shifts.forEach(s => { if (!map[s.date]) map[s.date] = []; map[s.date].push(s); });
    return map;
  }, [shifts]);

  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(currentWeek); d.setDate(d.getDate() + i); return d; });
  const todayStr = new Date().toISOString().split('T')[0];

  // Branch name helper
  const branchName = (storeId: string | null) => stores.find(s => s.id === storeId)?.name ?? null;

  // ── Worker CRUD ──────────────────────────────────────────────────────────────
  const handleSaveWorker = async (formData: any) => {
    try {
      if (editWorker) {
        // ── Detect role change before updating ──
        const roleChanged = editWorker.role !== formData.role;

        await updateWorker(editWorker.id, formData);

        // Keep app_users in sync (name, email, status, role)
        if (editWorker.userId) {
          await supabase
            .from('app_users')
            .update({
              first_name: formData.firstName,
              last_name:  formData.lastName,
              email:      formData.email,
              role:       formData.role,        // always keep in sync
              is_active:  formData.status === 'active',
            })
            .eq('id', editWorker.userId);
        }

        // Also sync by email in case userId link is missing
        if (roleChanged) {
          await syncRoleToAppUser(formData.email, formData.role);
        }
      } else {
        // New worker — create worker row + app_users login in one go
        const { worker, defaultPassword } = await createWorkerWithAccount({
          ...formData,
          storeId: formData.storeId || null,
        });

        setCredsModal({
          email:    worker.email,
          password: defaultPassword,
          name:     `${worker.firstName} ${worker.lastName}`,
        });
      }

      setShowWorkerModal(false);
      setEditWorker(null);
      await loadAll();
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  const handleDeleteWorker = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try { await deleteWorker(id); if (selectedWorker?.id === id) setSelectedWorker(null); await loadAll(); }
    catch (e) { alert(`Failed: ${e instanceof Error ? e.message : e}`); }
    finally { setDeletingId(null); }
  };

  // ── Query actions ────────────────────────────────────────────────────────────
  const handleQueryReply = async () => {
    if (!selectedQuery || !qReply.trim()) return;
    setQReplying(true);
    try {
      await supabase.from('worker_queries').update({ admin_reply: qReply, status: 'in-progress' }).eq('id', selectedQuery.id);
      setSelectedQuery(p => p ? { ...p, adminReply: qReply, status: 'in-progress' } : p);
      setQReply(''); await loadAll();
    } catch (e) { alert(`Failed: ${e}`); }
    finally { setQReplying(false); }
  };

  const handleQueryResolve = async (id: string) => {
    await supabase.from('worker_queries').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
    setSelectedQuery(p => p?.id === id ? { ...p, status: 'resolved' } : p);
    await loadAll();
  };

  // ── Leave approve/reject ─────────────────────────────────────────────────────
  const quickLeaveAction = async (id: string, status: 'approved' | 'rejected') => {
    await supabase.from('leave_requests').update({ status, reviewed_by: `${user!.firstName} ${user!.lastName}`.trim() }).eq('id', id);
    await loadAll();
  };

  // ── Performance review modal ─────────────────────────────────────────────────
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editReview, setEditReview] = useState<Review | null>(null);
  const [reviewForm, setReviewForm] = useState({ workerId: '', reviewPeriod: '', punctuality: 3, productivity: 3, teamwork: 3, communication: 3, strengths: '', improvements: '', goals: '' });
  const [reviewSaving, setReviewSaving] = useState(false);

  const avgRatingForm = Math.round((reviewForm.punctuality + reviewForm.productivity + reviewForm.teamwork + reviewForm.communication) / 4);

  const openReviewModal = (r?: Review | null) => {
    const now = new Date();
    if (r) {
      setReviewForm({ workerId: r.workerId, reviewPeriod: r.reviewPeriod, punctuality: r.punctuality ?? 3, productivity: r.productivity ?? 3, teamwork: r.teamwork ?? 3, communication: r.communication ?? 3, strengths: r.strengths ?? '', improvements: r.improvements ?? '', goals: r.goals ?? '' });
      setEditReview(r);
    } else {
      setReviewForm({ workerId: '', reviewPeriod: `Q${Math.ceil((now.getMonth()+1)/3)} ${now.getFullYear()}`, punctuality: 3, productivity: 3, teamwork: 3, communication: 3, strengths: '', improvements: '', goals: '' });
      setEditReview(null);
    }
    setShowReviewModal(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.workerId) { alert('Select a worker.'); return; }
    setReviewSaving(true);
    try {
      const w = workers.find(x => x.id === reviewForm.workerId);
      const payload = { worker_id: reviewForm.workerId, worker_name: w ? `${w.firstName} ${w.lastName}` : '', reviewer_name: `${user!.firstName} ${user!.lastName}`.trim(), review_period: reviewForm.reviewPeriod, rating: avgRatingForm, punctuality: reviewForm.punctuality, productivity: reviewForm.productivity, teamwork: reviewForm.teamwork, communication: reviewForm.communication, strengths: reviewForm.strengths || null, improvements: reviewForm.improvements || null, goals: reviewForm.goals || null };
      const { error: err } = editReview ? await supabase.from('performance_reviews').update(payload).eq('id', editReview.id) : await supabase.from('performance_reviews').insert([payload]);
      if (err) throw new Error(err.message);
      setShowReviewModal(false); await loadAll();
    } catch (e) { alert(`Failed: ${e instanceof Error ? e.message : e}`); }
    finally { setReviewSaving(false); }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-96">
      <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" /><p className="text-muted-foreground">Loading...</p></div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Credentials Modal */}
      {credsModal && (
        <CredentialsModal
          email={credsModal.email}
          password={credsModal.password}
          name={credsModal.name}
          onClose={() => setCredsModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" /> Worker Management
          </h1>
          <p className="text-muted-foreground mt-1">Full staff operations — schedule, attendance, payroll, and more</p>
        </div>
        <div className="flex gap-2">
          {tab === 'staff'         && <Button onClick={() => { setEditWorker(null); setShowWorkerModal(true); }} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="w-4 h-4" /> Add Worker</Button>}
          {tab === 'shifts'        && <Button onClick={() => { setEditShift(null); setShowShiftModal(true); }}  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="w-4 h-4" /> Add Shift</Button>}
          {tab === 'attendance'    && <Button onClick={() => { setEditAtt(null); setShowAttModal(true); }}      className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="w-4 h-4" /> Mark Attendance</Button>}
          {tab === 'leave'         && <Button onClick={() => { setEditLeave(null); setShowLeaveModal(true); }}  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="w-4 h-4" /> Request Leave</Button>}
          {tab === 'performance'   && <Button onClick={() => openReviewModal()}                                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="w-4 h-4" /> New Review</Button>}
          {tab === 'queries'       && <Button onClick={() => setShowQueryModal(true)}                          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="w-4 h-4" /> New Query</Button>}
          {tab === 'announcements' && <Button onClick={() => { setEditAnn(null); setShowAnnModal(true); }}     className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="w-4 h-4" /> Announce</Button>}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Staff',         value: stats.total,        color: 'text-foreground' },
          { label: 'Active',        value: stats.active,       color: 'text-green-600' },
          { label: 'Payroll/Mo',    value: formatCurrency(stats.payroll), color: 'text-primary' },
          { label: "Today's Att.",  value: stats.todayAtt,     color: 'text-blue-600' },
          { label: 'Open Queries',  value: stats.openQueries,  color: 'text-red-600' },
          { label: 'Pending Leave', value: stats.pendingLeave, color: 'text-yellow-600' },
        ].map((m, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${m.color}`}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: STAFF
         ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search workers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 border-border bg-input text-foreground" />
          </div>
          {filteredWorkers.length === 0 ? (
            <Card className="bg-card border-border"><CardContent className="text-center py-12 text-muted-foreground">{workers.length === 0 ? 'No workers yet. Add your first worker.' : 'No workers match your search.'}</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkers.map(w => {
                const branch = branchName(w.storeId);
                return (
                  <Card key={w.id} className="bg-card border-border hover:shadow-sm transition-shadow">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">{w.firstName[0]}{w.lastName[0]}</div>
                          <div>
                            <p className="font-semibold text-foreground">{w.firstName} {w.lastName}</p>
                            <Badge className={`${ROLE_COLORS[w.role]} text-xs mt-0.5`}>{ROLE_LABELS[w.role]}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={w.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}>{w.status}</Badge>
                          {w.userId && <Badge className="bg-primary/10 text-primary text-xs">Has Login</Badge>}
                        </div>
                      </div>
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        {w.department && <div className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" />{w.department}</div>}
                        <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />Since {w.joinDate}</div>
                        <div className="flex items-center gap-2 text-foreground font-medium"><CreditCard className="w-3.5 h-3.5" />{formatCurrency(w.salary)}/month</div>
                        {branch && (
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-blue-500" />
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">{branch}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditWorker(w); setShowWorkerModal(true); }}><Edit2 className="w-3.5 h-3.5 mr-1" />Edit</Button>
                        <Button size="sm" className="flex-1 bg-primary/10 text-primary hover:bg-primary/20 border-0" onClick={() => { loadSalary(w); setTab('salary'); }}><DollarSign className="w-3.5 h-3.5 mr-1" />Salary</Button>
                        <Button variant="ghost" size="sm" disabled={deletingId === w.id} onClick={() => handleDeleteWorker(w.id, `${w.firstName} ${w.lastName}`)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2">
                          {deletingId === w.id ? <span className="w-4 h-4 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin block" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: SALARY
         ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'salary' && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {workers.filter(w => w.status === 'active').map(w => (
              <Button key={w.id} size="sm" variant={selectedWorker?.id === w.id ? 'default' : 'outline'} onClick={() => loadSalary(w)} className="flex-shrink-0 gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">{w.firstName[0]}</span>
                {w.firstName} {w.lastName}
              </Button>
            ))}
          </div>
          {selectedWorker ? (
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">{selectedWorker.firstName} {selectedWorker.lastName}</CardTitle>
                    <CardDescription>{ROLE_LABELS[selectedWorker.role]} · {formatCurrency(selectedWorker.salary)}/month</CardDescription>
                  </div>
                  <Button size="sm" onClick={async () => {
                    const m = new Date().toISOString().slice(0,7);
                    if (salaryRecords.find(r => r.month === m)) { alert('Record for this month exists.'); return; }
                    await createSalaryRecord({ workerId: selectedWorker.id, month: m, amount: selectedWorker.salary, status: 'pending' });
                    await loadSalary(selectedWorker);
                  }} className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="w-4 h-4" />Add This Month</Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSalary ? <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" /></div> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border">
                        <tr>{['Month','Amount','Status','Paid Date','Action'].map(h => <th key={h} className={`py-3 px-4 font-semibold text-foreground ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {salaryRecords.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No records yet.</td></tr> : salaryRecords.map(rec => (
                          <tr key={rec.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 font-medium text-foreground">{rec.month}</td>
                            <td className="py-3 px-4 text-right font-bold text-foreground">{formatCurrency(rec.amount)}</td>
                            <td className="py-3 px-4"><Badge className={rec.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{rec.status}</Badge></td>
                            <td className="py-3 px-4 text-muted-foreground">{rec.paidDate ?? '—'}</td>
                            <td className="py-3 px-4">{rec.status === 'pending' && <Button size="sm" variant="outline" onClick={async () => { await markSalaryPaid(rec.id); await loadSalary(selectedWorker); }} className="gap-1 text-green-700 border-green-300 hover:bg-green-50"><Check className="w-3.5 h-3.5" />Mark Paid</Button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border"><CardContent className="text-center py-12 text-muted-foreground">Select a worker above to view salary records.</CardContent></Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: SHIFTS
         ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'shifts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button size="sm" variant={shiftView === 'week' ? 'default' : 'outline'} onClick={() => setShiftView('week')}><Calendar className="w-4 h-4 mr-1" />Week</Button>
              <Button size="sm" variant={shiftView === 'list' ? 'default' : 'outline'} onClick={() => setShiftView('list')}><Clock className="w-4 h-4 mr-1" />List</Button>
            </div>
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span>Scheduled: <strong className="text-foreground">{shifts.filter(s => s.status === 'scheduled').length}</strong></span>
              <span>Today: <strong className="text-foreground">{(shiftsByDate[todayStr] || []).length}</strong></span>
            </div>
          </div>

          {shiftView === 'week' && (
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-foreground text-base">Week of {currentWeek.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); }}><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); setCurrentWeek(d); }}>Today</Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); }}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-7 border-t border-border">
                  {weekDates.map((date, i) => {
                    const ds = date.toISOString().split('T')[0];
                    const dayShifts = shiftsByDate[ds] || [];
                    const isToday = ds === todayStr;
                    return (
                      <div key={i} className={`border-r border-border last:border-r-0 min-h-28 ${isToday ? 'bg-primary/5' : ''}`}>
                        <div className={`p-2 text-center border-b border-border ${isToday ? 'bg-primary/10' : ''}`}>
                          <p className="text-xs text-muted-foreground">{WEEK_DAYS[date.getDay()]}</p>
                          <p className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>{date.getDate()}</p>
                        </div>
                        <div className="p-1 space-y-1">
                          {dayShifts.map(s => (
                            <div key={s.id} className={`text-xs rounded px-1.5 py-1 border cursor-pointer hover:opacity-80 ${SHIFT_COLORS[s.shiftType]} ${s.status === 'cancelled' ? 'opacity-40 line-through' : ''}`}
                              onClick={() => { setEditShift(s); setShowShiftModal(true); }}>
                              <p className="font-medium truncate">{s.workerName.split(' ')[0]}</p>
                              <p className="opacity-70">{s.startTime}–{s.endTime}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {shiftView === 'list' && (
            <div className="space-y-2">
              {shifts.length === 0 ? <Card className="bg-card border-border"><CardContent className="text-center py-10 text-muted-foreground">No shifts scheduled.</CardContent></Card>
              : shifts.map(s => (
                <Card key={s.id} className="bg-card border-border">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-10 rounded-full ${SHIFT_COLORS[s.shiftType].split(' ')[0]}`} />
                      <div>
                        <div className="flex items-center gap-2"><p className="font-semibold text-foreground">{s.workerName}</p><Badge variant="outline" className="text-xs">{s.workerRole.replace(/_/g, ' ')}</Badge></div>
                        <p className="text-sm text-muted-foreground">{new Date(s.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {s.startTime}–{s.endTime}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={SHIFT_COLORS[s.shiftType]}>{s.shiftType.replace('_', ' ')}</Badge>
                      <Badge className={SHIFT_STATUS_COLORS[s.status]}>{s.status.replace('_', ' ')}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditShift(s); setShowShiftModal(true); }}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => { if (confirm('Delete shift?')) { await supabase.from('shifts').delete().eq('id', s.id); await loadAll(); } }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: ATTENDANCE
         ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center flex-wrap">
            <Input type="date" value={attDateFilter} onChange={e => setAttDateFilter(e.target.value)} className="border-border bg-input text-foreground w-auto" />
            <div className="flex gap-3 text-sm text-muted-foreground">
              {(['present','absent','late','on_leave'] as AttStatus[]).map(s => {
                const cnt = attRecords.filter(r => r.date === attDateFilter && r.status === s).length;
                return <span key={s}>{ATT_CONFIG[s].label}: <strong className="text-foreground">{cnt}</strong></span>;
              })}
            </div>
          </div>
          <div className="space-y-2">
            {attRecords.filter(r => r.date === attDateFilter).length === 0 ? (
              <Card className="bg-card border-border"><CardContent className="text-center py-10 text-muted-foreground">No attendance records for this date.</CardContent></Card>
            ) : attRecords.filter(r => r.date === attDateFilter).map(r => {
              const cfg = ATT_CONFIG[r.status];
              return (
                <Card key={r.id} className="bg-card border-border">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.color}`}>{cfg.icon}</div>
                      <div>
                        <div className="flex items-center gap-2"><p className="font-semibold text-foreground">{r.workerName}</p><Badge variant="outline" className="text-xs">{r.workerRole.replace(/_/g, ' ')}</Badge></div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {r.checkIn  && <span className="flex items-center gap-1"><LogIn  className="w-3 h-3" />{r.checkIn}</span>}
                          {r.checkOut && <span className="flex items-center gap-1"><LogOut className="w-3 h-3" />{r.checkOut}</span>}
                          {r.hoursWorked != null && <span>{r.hoursWorked}h worked</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`${cfg.color} flex items-center gap-1`}>{cfg.icon}{cfg.label}</Badge>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setEditAtt(r); setShowAttModal(true); }}>Edit</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: LEAVE
         ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'leave' && (
        <div className="space-y-3">
          <div className="flex gap-3 text-sm text-muted-foreground flex-wrap">
            <span>Pending: <strong className="text-yellow-600">{leaveReqs.filter(l => l.status === 'pending').length}</strong></span>
            <span>Approved: <strong className="text-green-600">{leaveReqs.filter(l => l.status === 'approved').length}</strong></span>
            <span>Rejected: <strong className="text-red-600">{leaveReqs.filter(l => l.status === 'rejected').length}</strong></span>
          </div>
          {leaveReqs.length === 0 ? <Card className="bg-card border-border"><CardContent className="text-center py-10 text-muted-foreground">No leave requests.</CardContent></Card>
          : leaveReqs.map(r => {
            const sc = LEAVE_STATUS_CONFIG[r.status];
            return (
              <Card key={r.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{r.workerName}</p>
                      <Badge className={`${LEAVE_COLORS[r.leaveType]} capitalize`}>{r.leaveType}</Badge>
                      <Badge className={`${sc.color} flex items-center gap-1`}>{sc.icon}{r.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(r.startDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(r.endDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · <strong>{r.days} day{r.days !== 1 ? 's' : ''}</strong>
                    </p>
                    <p className="text-sm text-foreground mt-1">{r.reason}</p>
                    {r.adminNotes && <p className="text-xs text-muted-foreground mt-1 italic">Admin: {r.adminNotes}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    {isAdmin && r.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" className="bg-green-600 text-white hover:bg-green-700 h-7 text-xs" onClick={() => quickLeaveAction(r.id, 'approved')}><CheckCircle2 className="w-3 h-3 mr-1" />Approve</Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-7 text-xs" onClick={() => quickLeaveAction(r.id, 'rejected')}><XCircle className="w-3 h-3 mr-1" />Reject</Button>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setEditLeave(r); setShowLeaveModal(true); }}>Edit</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: PERFORMANCE
         ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'performance' && (
        <div className="space-y-3">
          {reviews.length === 0 ? <Card className="bg-card border-border"><CardContent className="text-center py-10 text-muted-foreground">No reviews yet.</CardContent></Card>
          : reviews.map(r => (
            <Card key={r.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 cursor-pointer" onClick={() => setExpandedReview(expandedReview === r.id ? null : r.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><Award className="w-4 h-4 text-primary" /></div>
                    <div>
                      <p className="font-semibold text-foreground">{r.workerName}</p>
                      <p className="text-xs text-muted-foreground">{r.reviewPeriod} · By {r.reviewerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating value={r.rating} readOnly />
                    <Button variant="ghost" size="sm" className="text-xs" onClick={e => { e.stopPropagation(); openReviewModal(r); }}>Edit</Button>
                    {expandedReview === r.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {expandedReview === r.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {[['Punctuality', r.punctuality], ['Productivity', r.productivity], ['Teamwork', r.teamwork], ['Communication', r.communication]].map(([label, val]) => val != null && (
                        <div key={label as string} className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><StarRating value={val as number} readOnly /></div>
                      ))}
                    </div>
                    {r.strengths    && <div><p className="text-xs text-muted-foreground font-medium">Strengths</p><p className="text-sm text-foreground">{r.strengths}</p></div>}
                    {r.improvements && <div><p className="text-xs text-muted-foreground font-medium">Improvements</p><p className="text-sm text-foreground">{r.improvements}</p></div>}
                    {r.goals        && <div><p className="text-xs text-muted-foreground font-medium">Goals</p><p className="text-sm text-foreground">{r.goals}</p></div>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: QUERIES
         ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'queries' && (
        <div className={`grid gap-4 ${selectedQuery ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          <div className="space-y-2">
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span>Open: <strong className="text-blue-600">{queries.filter(q => q.status === 'open').length}</strong></span>
              <span>In Progress: <strong className="text-yellow-600">{queries.filter(q => q.status === 'in-progress').length}</strong></span>
              <span>Resolved: <strong className="text-green-600">{queries.filter(q => q.status === 'resolved').length}</strong></span>
            </div>
            {queries.length === 0 ? <Card className="bg-card border-border"><CardContent className="text-center py-10 text-muted-foreground">No queries yet.</CardContent></Card>
            : queries.map(q => (
              <Card key={q.id} onClick={() => setSelectedQuery(selectedQuery?.id === q.id ? null : q)}
                className={`bg-card cursor-pointer hover:shadow-sm transition-all ${selectedQuery?.id === q.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{q.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><User className="w-3 h-3 shrink-0" />{q.submittedBy} · <span className="capitalize">{q.submittedByRole.replace(/_/g,' ')}</span></p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`${QUERY_STATUS_COLORS[q.status]} flex items-center gap-1`}>{q.status}</Badge>
                      <Badge className={PRIORITY_COLORS[q.priority]}>{q.priority}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{q.message}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="outline">{q.category}</Badge>
                    <span>{q.createdAt.toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedQuery && (
            <Card className="bg-card border-border sticky top-6 h-fit">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="min-w-0">
                  <CardTitle className="text-foreground text-base truncate">{selectedQuery.subject}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">by {selectedQuery.submittedBy}</p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSelectedQuery(null)}><X className="w-4 h-4" /></Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Badge className={QUERY_STATUS_COLORS[selectedQuery.status]}>{selectedQuery.status}</Badge>
                  <Badge className={PRIORITY_COLORS[selectedQuery.priority]}>{selectedQuery.priority} priority</Badge>
                  <Badge variant="outline">{selectedQuery.category}</Badge>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-medium">Message</p>
                  <p className="text-sm text-foreground mt-1">{selectedQuery.message}</p>
                </div>
                {selectedQuery.adminReply && (
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                    <p className="text-xs text-primary font-semibold">Management Reply</p>
                    <p className="text-sm text-foreground mt-1">{selectedQuery.adminReply}</p>
                  </div>
                )}
                {selectedQuery.status === 'resolved' && (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl p-3 text-sm"><CheckCircle2 className="w-4 h-4 shrink-0" />This query has been resolved.</div>
                )}
                {isAdmin && selectedQuery.status !== 'resolved' && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <textarea value={qReply} onChange={e => setQReply(e.target.value)} placeholder="Type your reply..." rows={3}
                      className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                    <div className="flex gap-2">
                      <Button onClick={handleQueryReply} disabled={qReplying || !qReply.trim()} className="flex-1 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"><Send className="w-4 h-4" />{qReplying ? 'Sending...' : 'Reply'}</Button>
                      <Button onClick={() => handleQueryResolve(selectedQuery.id)} className="flex-1 gap-1 bg-green-600 text-white hover:bg-green-700"><CheckCircle2 className="w-4 h-4" />Resolve</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: ANNOUNCEMENTS
         ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'announcements' && (
        <div className="space-y-3">
          {announcements.length === 0 ? <Card className="bg-card border-border"><CardContent className="text-center py-10 text-muted-foreground">No announcements yet.</CardContent></Card>
          : announcements.map(a => {
            const cfg = ANN_CONFIG[a.category];
            const expired = a.expiresAt && a.expiresAt < new Date();
            return (
              <Card key={a.id} className={`bg-card border-border ${expired ? 'opacity-60' : ''} ${a.isPinned ? 'border-l-4 border-l-primary' : ''}`}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.isPinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                      <p className="font-semibold text-foreground">{a.title}</p>
                      <Badge className={`${cfg.color} flex items-center gap-1 capitalize`}>{cfg.icon}{a.category}</Badge>
                      {expired && <Badge className="bg-gray-100 text-gray-500 text-xs">Expired</Badge>}
                    </div>
                    <p className="text-sm text-foreground mt-2">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">By {a.createdBy} · {a.createdAt.toLocaleDateString()}{a.expiresAt && ` · Expires ${a.expiresAt.toLocaleDateString()}`}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setEditAnn(a); setShowAnnModal(true); }}>Edit</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={async () => { if (confirm('Delete?')) { await supabase.from('announcements').delete().eq('id', a.id); await loadAll(); } }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODALS
         ════════════════════════════════════════════════════════════════════════ */}
      {showWorkerModal && <WorkerModal worker={editWorker} stores={stores} onClose={() => { setShowWorkerModal(false); setEditWorker(null); }} onSave={handleSaveWorker} />}
      {showShiftModal  && <ShiftModal  workers={workers} shift={editShift} onClose={() => { setShowShiftModal(false); setEditShift(null); }} onSuccess={loadAll} />}
      {showAttModal    && <AttModal    workers={workers} record={editAtt}  onClose={() => { setShowAttModal(false);   setEditAtt(null);   }} onSuccess={loadAll} />}
      {showLeaveModal  && <LeaveModal  user={user} workers={workers} req={editLeave} canManage={canManage} onClose={() => { setShowLeaveModal(false); setEditLeave(null); }} onSuccess={loadAll} />}
      {showQueryModal  && <QueryModal  user={user} workers={workers} onClose={() => setShowQueryModal(false)} onSuccess={loadAll} />}
      {showAnnModal    && <AnnModal    user={user} ann={editAnn} onClose={() => { setShowAnnModal(false); setEditAnn(null); }} onSuccess={loadAll} />}

      {/* Performance Review Modal */}
      {showReviewModal && (
        <Modal title={editReview ? 'Edit Review' : 'Performance Review'} onClose={() => setShowReviewModal(false)}>
          <form onSubmit={handleSaveReview} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Worker *</label>
                <select value={reviewForm.workerId} onChange={e => setReviewForm(p => ({ ...p, workerId: e.target.value }))} className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select...</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Period</label>
                <Input value={reviewForm.reviewPeriod} onChange={e => setReviewForm(p => ({ ...p, reviewPeriod: e.target.value }))} placeholder="e.g. Q4 2024" className="border-border bg-input text-foreground" />
              </div>
            </div>
            <div className="bg-muted rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Performance Metrics</p>
              {(['punctuality','productivity','teamwork','communication'] as const).map(k => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground capitalize">{k}</span>
                  <StarRating value={reviewForm[k]} onChange={v => setReviewForm(p => ({ ...p, [k]: v }))} />
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm font-semibold text-foreground">Overall (auto)</span>
                <StarRating value={avgRatingForm} readOnly />
              </div>
            </div>
            {[['strengths','Strengths'],['improvements','Improvements'],['goals','Goals']].map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">{label}</label>
                <textarea rows={2} value={(reviewForm as any)[k]} onChange={e => setReviewForm(p => ({ ...p, [k]: e.target.value }))} className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            ))}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowReviewModal(false)} disabled={reviewSaving}>Cancel</Button>
              <Button type="submit" disabled={reviewSaving} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">{reviewSaving ? 'Saving...' : 'Save Review'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}