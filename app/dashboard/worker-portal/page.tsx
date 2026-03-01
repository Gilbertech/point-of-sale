'use client';
// Place at: app/worker-portal/page.tsx
// ✅ Matches Sunrise theme exactly (coral primary, amber accent, cream background)
// ✅ Layout mirrors Worker Management page 1:1 (stat cards, tab bar, content area)
// ✅ Same sidebar header, card system, badge styles as main dashboard
// ✅ Clock in/out, leave application, announcements bell, all 6 tabs

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/currency';
import {
  Bell, LogIn, LogOut, Calendar, DollarSign, Clock, Umbrella,
  TrendingUp, CheckCircle2, XCircle, AlertCircle, Pin, X,
  Star, User, Building2, Send, Users, ChevronDown, ChevronUp,
  Store, Award,
} from 'lucide-react';
import { Badge }                                    from '@/components/ui/badge';
import { Button }                                   from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input }                                    from '@/components/ui/input';
import { Alert, AlertDescription }                  from '@/components/ui/alert';

// ── Types ─────────────────────────────────────────────────────────────────────
type LeaveType   = 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'emergency' | 'compassionate';
type AnnCategory = 'general' | 'urgent' | 'policy' | 'event' | 'training';
type Tab         = 'home' | 'shifts' | 'attendance' | 'leave' | 'salary' | 'performance';

interface Worker       { id: string; firstName: string; lastName: string; role: string; department: string; salary: number; storeId: string | null; storeName?: string; }
interface Shift        { id: string; date: string; startTime: string; endTime: string; shiftType: string; status: string; }
interface AttRecord    { id: string; date: string; status: string; checkIn: string | null; checkOut: string | null; hoursWorked: number | null; }
interface LeaveReq     { id: string; leaveType: LeaveType; startDate: string; endDate: string; days: number; reason: string; status: string; adminNotes: string | null; createdAt: Date; }
interface SalaryRecord { id: string; month: string; amount: number; status: string; paidDate: string | null; }
interface Review       { id: string; reviewPeriod: string; rating: number; punctuality: number | null; productivity: number | null; teamwork: number | null; communication: number | null; strengths: string | null; improvements: string | null; goals: string | null; createdAt: Date; }
interface Announcement { id: string; title: string; message: string; category: AnnCategory; isPinned: boolean; expiresAt: Date | null; createdBy: string; createdAt: Date; isRead: boolean; }

// ── Sunrise-matched badge colours ─────────────────────────────────────────────
// These mirror the same Tailwind classes used in the main worker management page
const STATUS_BADGE: Record<string, string> = {
  present:   'bg-green-100 text-green-800',
  absent:    'bg-red-100 text-red-800',
  late:      'bg-yellow-100 text-yellow-800',
  half_day:  'bg-orange-100 text-orange-800',
  on_leave:  'bg-blue-100 text-blue-800',
  pending:   'bg-yellow-100 text-yellow-800',
  approved:  'bg-green-100 text-green-800',
  rejected:  'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  paid:      'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  no_show:   'bg-red-100 text-red-800',
};

const SHIFT_TYPE_BADGE: Record<string, string> = {
  morning:   'bg-amber-100 text-amber-800',
  afternoon: 'bg-sky-100 text-sky-800',
  evening:   'bg-purple-100 text-purple-800',
  night:     'bg-indigo-100 text-indigo-800',
  full_day:  'bg-green-100 text-green-800',
};

const SHIFT_BAR: Record<string, string> = {
  morning:   'bg-amber-400',
  afternoon: 'bg-sky-400',
  evening:   'bg-purple-400',
  night:     'bg-indigo-400',
  full_day:  'bg-green-400',
};

const ANN_BADGE: Record<AnnCategory, string> = {
  general:  'bg-orange-100 text-orange-800',
  urgent:   'bg-red-100 text-red-800',
  policy:   'bg-blue-100 text-blue-800',
  event:    'bg-green-100 text-green-800',
  training: 'bg-purple-100 text-purple-800',
};

const ANN_EMOJI: Record<AnnCategory, string> = {
  general: '📢', urgent: '🚨', policy: '📋', event: '🎉', training: '🎓',
};

const LEAVE_TYPES: LeaveType[] = ['annual','sick','maternity','paternity','unpaid','emergency','compassionate'];

function calcDays(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

// ── Sub-components defined at module level (prevents remount on re-render) ────

function StatusBadge({ label }: { label: string }) {
  const cls = STATUS_BADGE[label] ?? SHIFT_TYPE_BADGE[label] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {label.replace(/_/g, ' ')}
    </span>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-4 h-4 ${i <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

// ── TABS config ───────────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'home',        label: 'Home',        icon: <User       className="w-4 h-4" /> },
  { key: 'shifts',      label: 'Shifts',      icon: <Calendar   className="w-4 h-4" /> },
  { key: 'attendance',  label: 'Attendance',  icon: <Clock      className="w-4 h-4" /> },
  { key: 'leave',       label: 'Leave',       icon: <Umbrella   className="w-4 h-4" /> },
  { key: 'salary',      label: 'Salary',      icon: <DollarSign className="w-4 h-4" /> },
  { key: 'performance', label: 'Performance', icon: <TrendingUp className="w-4 h-4" /> },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function WorkerPortalPage() {
  const router              = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [worker,        setWorker]        = useState<Worker | null>(null);
  const [shifts,        setShifts]        = useState<Shift[]>([]);
  const [attRecords,    setAttRecords]    = useState<AttRecord[]>([]);
  const [leaveReqs,     setLeaveReqs]     = useState<LeaveReq[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [reviews,       setReviews]       = useState<Review[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState<Tab>('home');

  // Clock
  const [clockLoading, setClockLoading] = useState(false);
  const [todayAtt,     setTodayAtt]     = useState<AttRecord | null>(null);

  // Leave form
  const [showLeaveForm,   setShowLeaveForm]   = useState(false);
  const [leaveForm,       setLeaveForm]       = useState({ leaveType: 'annual' as LeaveType, startDate: '', endDate: '', reason: '' });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError,      setLeaveError]      = useState('');

  // Notifications
  const [showNotifs, setShowNotifs] = useState(false);

  // Performance expand
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  const todayStr    = new Date().toISOString().split('T')[0];
  const leaveDays   = calcDays(leaveForm.startDate, leaveForm.endDate);
  const unreadCount = useMemo(() => announcements.filter(a => !a.isRead).length, [announcements]);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role === 'super_admin' || user.role === 'admin') { router.push('/dashboard'); return; }
  }, [user, authLoading, router]);

  // ── Load all data ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: workerRow } = await supabase
        .from('workers').select('*, stores(name)').eq('user_id', user.id).maybeSingle();
      if (!workerRow) { setLoading(false); return; }

      const w: Worker = {
        id: workerRow.id,
        firstName: workerRow.first_name,
        lastName:  workerRow.last_name,
        role:       workerRow.role,
        department: workerRow.department ?? '',
        salary:     workerRow.salary ?? 0,
        storeId:    workerRow.store_id,
        storeName:  workerRow.stores?.name,
      };
      setWorker(w);

      const sid = w.storeId;
      const [sR, aR, lR, salR, revR, annR, rdsR] = await Promise.all([
        supabase.from('shifts')              .select('*').eq('worker_id', w.id).order('date', { ascending: false }).limit(60),
        supabase.from('attendance')          .select('*').eq('worker_id', w.id).order('date', { ascending: false }).limit(60),
        supabase.from('leave_requests')      .select('*').eq('worker_id', w.id).order('created_at', { ascending: false }),
        supabase.from('salary_records')      .select('*').eq('worker_id', w.id).order('month',      { ascending: false }),
        supabase.from('performance_reviews') .select('*').eq('worker_id', w.id).order('created_at', { ascending: false }),
        sid
          ? supabase.from('announcements').select('*').eq('store_id', sid).order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
          : supabase.from('announcements').select('*')                    .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('announcement_reads').select('announcement_id').eq('worker_id', w.id),
      ]);

      const readIds = new Set((rdsR.data || []).map((r: any) => r.announcement_id));

      setShifts        ((sR  .data||[]).map((x:any) => ({ id:x.id, date:x.date, startTime:x.start_time, endTime:x.end_time, shiftType:x.shift_type, status:x.status })));
      setAttRecords    ((aR  .data||[]).map((x:any) => ({ id:x.id, date:x.date, status:x.status, checkIn:x.check_in, checkOut:x.check_out, hoursWorked:x.hours_worked })));
      setLeaveReqs     ((lR  .data||[]).map((x:any) => ({ id:x.id, leaveType:x.leave_type, startDate:x.start_date, endDate:x.end_date, days:x.days, reason:x.reason, status:x.status, adminNotes:x.admin_notes, createdAt:new Date(x.created_at) })));
      setSalaryRecords ((salR.data||[]).map((x:any) => ({ id:x.id, month:x.month, amount:x.amount, status:x.status, paidDate:x.paid_date })));
      setReviews       ((revR.data||[]).map((x:any) => ({ id:x.id, reviewPeriod:x.review_period, rating:x.rating, punctuality:x.punctuality, productivity:x.productivity, teamwork:x.teamwork, communication:x.communication, strengths:x.strengths, improvements:x.improvements, goals:x.goals, createdAt:new Date(x.created_at) })));
      setAnnouncements ((annR.data||[]).map((x:any) => ({ id:x.id, title:x.title, message:x.message, category:x.category, isPinned:x.is_pinned, expiresAt:x.expires_at?new Date(x.expires_at):null, createdBy:x.created_by, createdAt:new Date(x.created_at), isRead:readIds.has(x.id) })));

      const todayRec = (aR.data||[]).find((x:any) => x.date === todayStr);
      setTodayAtt(todayRec ? { id:todayRec.id, date:todayRec.date, status:todayRec.status, checkIn:todayRec.check_in, checkOut:todayRec.check_out, hoursWorked:todayRec.hours_worked } : null);
    } catch (e) { console.error('[WorkerPortal]', e); }
    finally { setLoading(false); }
  }, [user?.id, todayStr]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Clock in / out ──────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    if (!worker) return;
    setClockLoading(true);
    try {
      const now = new Date().toTimeString().slice(0,5);
      const { data, error } = await supabase.from('attendance').insert([{
        worker_id: worker.id, worker_name: `${worker.firstName} ${worker.lastName}`,
        worker_role: worker.role, date: todayStr, status: 'present', check_in: now, store_id: worker.storeId,
      }]).select().single();
      if (error) throw error;
      setTodayAtt({ id: data.id, date: todayStr, status: 'present', checkIn: now, checkOut: null, hoursWorked: null });
    } catch (e:any) { alert(`Clock in failed: ${e?.message}`); }
    finally { setClockLoading(false); }
  };

  const handleClockOut = async () => {
    if (!worker || !todayAtt) return;
    setClockLoading(true);
    try {
      const now = new Date().toTimeString().slice(0,5);
      const [sh, sm] = (todayAtt.checkIn ?? '00:00').split(':').map(Number);
      const [eh, em] = now.split(':').map(Number);
      let mins = (eh*60+em) - (sh*60+sm); if (mins < 0) mins += 1440;
      const hours = Math.round(mins/60*100)/100;
      const { error } = await supabase.from('attendance').update({ check_out: now, hours_worked: hours }).eq('id', todayAtt.id);
      if (error) throw error;
      setTodayAtt(p => p ? { ...p, checkOut: now, hoursWorked: hours } : p);
    } catch (e:any) { alert(`Clock out failed: ${e?.message}`); }
    finally { setClockLoading(false); }
  };

  // ── Announcements ───────────────────────────────────────────────────────────
  const markRead = async (annId: string) => {
    if (!worker) return;
    setAnnouncements(prev => prev.map(a => a.id === annId ? { ...a, isRead: true } : a));
    await supabase.from('announcement_reads').upsert([{ announcement_id: annId, worker_id: worker.id }], { onConflict: 'announcement_id,worker_id' });
  };

  const markAllRead = async () => {
    if (!worker) return;
    const unread = announcements.filter(a => !a.isRead);
    setAnnouncements(prev => prev.map(a => ({ ...a, isRead: true })));
    if (unread.length > 0) {
      await supabase.from('announcement_reads').upsert(
        unread.map(a => ({ announcement_id: a.id, worker_id: worker.id })),
        { onConflict: 'announcement_id,worker_id' }
      );
    }
  };

  // ── Leave submit ────────────────────────────────────────────────────────────
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker) return;
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) { setLeaveError('All fields are required.'); return; }
    if (new Date(leaveForm.endDate) < new Date(leaveForm.startDate)) { setLeaveError('End date must be after start date.'); return; }
    setLeaveSubmitting(true); setLeaveError('');
    try {
      const { error } = await supabase.from('leave_requests').insert([{
        worker_id: worker.id, worker_name: `${worker.firstName} ${worker.lastName}`,
        worker_role: worker.role, leave_type: leaveForm.leaveType,
        start_date: leaveForm.startDate, end_date: leaveForm.endDate,
        days: leaveDays, reason: leaveForm.reason, status: 'pending', store_id: worker.storeId,
      }]);
      if (error) throw error;
      setShowLeaveForm(false);
      setLeaveForm({ leaveType: 'annual', startDate: '', endDate: '', reason: '' });
      await loadData();
    } catch (e:any) { setLeaveError(e?.message ?? 'Failed to submit.'); }
    finally { setLeaveSubmitting(false); }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const upcomingShifts = useMemo(() => shifts.filter(s => s.date >= todayStr && s.status === 'scheduled').slice(0,5), [shifts, todayStr]);
  const pendingLeave   = useMemo(() => leaveReqs.filter(l => l.status === 'pending').length, [leaveReqs]);
  const totalHours     = useMemo(() => attRecords.reduce((s,r) => s+(r.hoursWorked??0), 0), [attRecords]);
  const presentDays    = useMemo(() => attRecords.filter(r => r.status==='present'||r.status==='late').length, [attRecords]);
  const latestSalary   = salaryRecords[0] ?? null;
  const now            = new Date();
  const greeting       = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-sm w-full text-center bg-card border-border">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="font-bold text-xl text-foreground">No worker profile found</h2>
            <p className="text-muted-foreground text-sm">Your account isn't linked to a worker profile yet. Contact your manager.</p>
            <Button variant="outline" onClick={() => router.push('/login')}>Back to login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — matches Worker Management layout exactly
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">

      {/* ── Notification dropdown overlay ── */}
      {showNotifs && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
      )}

      {/* ── Page header — matches "Worker Management" header row ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            My Workspace
          </h1>
          <p className="text-muted-foreground mt-1">
            {greeting}, {worker.firstName}!
            {worker.storeName ? ` · ${worker.storeName}` : ''}
          </p>
        </div>

        {/* Right side: Bell + Clock button */}
        <div className="flex items-center gap-3">

          {/* Notification bell */}
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowNotifs(v => !v)}
              className="relative border-border"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {/* Dropdown */}
            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">Announcements</p>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary hover:text-primary/80 font-medium">
                        Mark all read
                      </button>
                    )}
                    <button onClick={() => setShowNotifs(false)}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-border">
                  {announcements.length === 0 ? (
                    <div className="px-4 py-8 text-center text-muted-foreground text-sm">No announcements yet</div>
                  ) : announcements.map(a => (
                    <div key={a.id} onClick={() => markRead(a.id)}
                      className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${!a.isRead ? 'bg-muted/30' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-base mt-0.5 flex-shrink-0">{ANN_EMOJI[a.category]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {!a.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                            <p className={`text-sm font-medium truncate ${!a.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{a.title}</p>
                            {a.isPinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">{a.createdAt.toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Clock in/out — always visible in header */}
          {!todayAtt ? (
            <Button onClick={handleClockIn} disabled={clockLoading} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <LogIn className="w-4 h-4" />{clockLoading ? 'Loading…' : 'Clock In'}
            </Button>
          ) : !todayAtt.checkOut ? (
            <Button onClick={handleClockOut} disabled={clockLoading} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              <LogOut className="w-4 h-4" />{clockLoading ? 'Loading…' : 'Clock Out'}
            </Button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border border-border text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-600" />Done for today
            </div>
          )}
        </div>
      </div>

      {/* ── Stat cards — same 6-column grid as Worker Management ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Days Present',    value: presentDays,                                             color: 'text-foreground' },
          { label: 'Hours Logged',    value: `${totalHours.toFixed(1)}h`,                             color: 'text-primary'    },
          { label: 'Upcoming Shifts', value: upcomingShifts.length,                                   color: 'text-foreground' },
          { label: 'Pending Leaves',  value: pendingLeave,                                            color: 'text-yellow-600' },
          { label: 'All Leaves',      value: leaveReqs.length,                                        color: 'text-foreground' },
          { label: 'Latest Salary',   value: latestSalary ? formatCurrency(latestSalary.amount) : '—', color: 'text-primary'   },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tab bar — exact same style as Worker Management ── */}
      <div className="flex border-b border-border gap-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          HOME TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'home' && (
        <div className="space-y-4">

          {/* Clock status card */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Today's Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  {todayAtt ? (
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground">Clocked In</p>
                        <p className="text-2xl font-bold text-foreground">{todayAtt.checkIn}</p>
                      </div>
                      {todayAtt.checkOut && (
                        <div>
                          <p className="text-xs text-muted-foreground">Clocked Out</p>
                          <p className="text-2xl font-bold text-foreground">{todayAtt.checkOut}</p>
                        </div>
                      )}
                      {todayAtt.hoursWorked != null && (
                        <div>
                          <p className="text-xs text-muted-foreground">Hours Worked</p>
                          <p className="text-2xl font-bold text-primary">{todayAtt.hoursWorked}h</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">You haven't clocked in today.</p>
                  )}
                </div>
                <StatusBadge label={todayAtt?.status ?? 'absent'} />
              </div>
            </CardContent>
          </Card>

          {/* Upcoming shifts */}
          {upcomingShifts.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Upcoming Shifts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingShifts.map(s => (
                  <div key={s.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-10 rounded-full ${SHIFT_BAR[s.shiftType] ?? 'bg-primary'}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(s.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.startTime} – {s.endTime}</p>
                      </div>
                    </div>
                    <StatusBadge label={s.shiftType} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pinned unread announcements */}
          {announcements.filter(a => a.isPinned && !a.isRead).length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Pin className="w-5 h-5 text-primary" /> Pinned Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {announcements.filter(a => a.isPinned && !a.isRead).map(a => (
                  <div key={a.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{ANN_EMOJI[a.category]}</span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground text-sm">{a.title}</p>
                            <Badge className={ANN_BADGE[a.category]}>{a.category}</Badge>
                          </div>
                          <p className="text-muted-foreground text-sm mt-1">{a.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">By {a.createdBy} · {a.createdAt.toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button onClick={() => markRead(a.id)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Branch info */}
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                  {worker.firstName[0]}{worker.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{worker.firstName} {worker.lastName}</p>
                  <p className="text-sm text-muted-foreground capitalize">{worker.role.replace(/_/g,' ')}{worker.department ? ` · ${worker.department}` : ''}</p>
                </div>
                {worker.storeName && (
                  <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg border border-border">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm text-foreground font-medium">{worker.storeName}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SHIFTS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'shifts' && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Upcoming: <strong className="text-foreground">{upcomingShifts.length}</strong></span>
            <span>Total: <strong className="text-foreground">{shifts.length}</strong></span>
          </div>
          {shifts.length === 0 ? (
            <Card className="bg-card border-border"><CardContent className="text-center py-12 text-muted-foreground">No shifts assigned yet.</CardContent></Card>
          ) : shifts.map(s => (
            <Card key={s.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-10 rounded-full ${SHIFT_BAR[s.shiftType] ?? 'bg-primary'}`} />
                  <div>
                    <p className="font-semibold text-foreground">
                      {new Date(s.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-muted-foreground">{s.startTime} – {s.endTime}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label={s.shiftType} />
                  <StatusBadge label={s.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ATTENDANCE TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'attendance' && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
            <span>Present: <strong className="text-green-600">{presentDays}</strong></span>
            <span>Late: <strong className="text-yellow-600">{attRecords.filter(r => r.status==='late').length}</strong></span>
            <span>Absent: <strong className="text-destructive">{attRecords.filter(r => r.status==='absent').length}</strong></span>
            <span>Total Hours: <strong className="text-primary">{totalHours.toFixed(1)}h</strong></span>
          </div>
          {attRecords.length === 0 ? (
            <Card className="bg-card border-border"><CardContent className="text-center py-12 text-muted-foreground">No attendance records yet.</CardContent></Card>
          ) : attRecords.map(r => (
            <Card key={r.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">
                    {new Date(r.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {(r.checkIn || r.checkOut) && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      {r.checkIn  && <span className="flex items-center gap-1"><LogIn  className="w-3 h-3 text-green-600" />{r.checkIn}</span>}
                      {r.checkOut && <span className="flex items-center gap-1"><LogOut className="w-3 h-3 text-amber-600" />{r.checkOut}</span>}
                      {r.hoursWorked != null && <span className="font-semibold text-foreground">{r.hoursWorked}h</span>}
                    </div>
                  )}
                </div>
                <StatusBadge label={r.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LEAVE TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'leave' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Pending: <strong className="text-yellow-600">{leaveReqs.filter(l=>l.status==='pending').length}</strong></span>
              <span>Approved: <strong className="text-green-600">{leaveReqs.filter(l=>l.status==='approved').length}</strong></span>
              <span>Rejected: <strong className="text-destructive">{leaveReqs.filter(l=>l.status==='rejected').length}</strong></span>
            </div>
            <Button onClick={() => setShowLeaveForm(v => !v)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Umbrella className="w-4 h-4" /> Apply for Leave
            </Button>
          </div>

          {/* Leave form */}
          {showLeaveForm && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground">New Leave Application</CardTitle>
              </CardHeader>
              <CardContent>
                {leaveError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{leaveError}</AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleLeaveSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Leave Type</label>
                      <select value={leaveForm.leaveType} onChange={e => setLeaveForm(p => ({ ...p, leaveType: e.target.value as LeaveType }))}
                        className="w-full h-10 px-3 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring capitalize">
                        {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Duration</label>
                      <div className="h-10 px-3 flex items-center border border-border rounded-md bg-muted text-sm text-foreground">
                        {leaveDays > 0 ? `${leaveDays} day${leaveDays !== 1 ? 's' : ''}` : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Start Date *</label>
                      <Input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(p => ({ ...p, startDate: e.target.value }))} className="border-border bg-input text-foreground" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">End Date *</label>
                      <Input type="date" value={leaveForm.endDate}  onChange={e => setLeaveForm(p => ({ ...p, endDate: e.target.value }))}  className="border-border bg-input text-foreground" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Reason *</label>
                    <textarea rows={3} value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                      placeholder="Briefly explain your reason…"
                      className="w-full px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={leaveSubmitting} className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                      <Send className="w-4 h-4" />{leaveSubmitting ? 'Submitting…' : 'Submit Application'}
                    </Button>
                    <Button type="button" variant="outline" className="border-border" onClick={() => setShowLeaveForm(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {leaveReqs.length === 0 && !showLeaveForm ? (
            <Card className="bg-card border-border"><CardContent className="text-center py-12 text-muted-foreground">No leave requests yet.</CardContent></Card>
          ) : leaveReqs.map(r => (
            <Card key={r.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize border-border">{r.leaveType}</Badge>
                    <StatusBadge label={r.status} />
                  </div>
                  <p className="text-sm text-foreground mt-2">
                    {new Date(r.startDate+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} –{' '}
                    {new Date(r.endDate  +'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    <span className="text-muted-foreground ml-2 text-xs">({r.days} day{r.days!==1?'s':''})</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>
                  {r.adminNotes && (
                    <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />Manager: {r.adminNotes}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex-shrink-0">{r.createdAt.toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SALARY TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'salary' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Base salary: <strong className="text-foreground">{formatCurrency(worker.salary)}/month</strong>
            </div>
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      {['Month','Amount','Status','Paid Date'].map(h => (
                        <th key={h} className={`py-3 px-4 font-semibold text-foreground ${h==='Amount'?'text-right':'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salaryRecords.length === 0 ? (
                      <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">No salary records yet.</td></tr>
                    ) : salaryRecords.map(r => (
                      <tr key={r.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">{r.month}</td>
                        <td className="py-3 px-4 text-right font-bold text-primary">{formatCurrency(r.amount)}</td>
                        <td className="py-3 px-4"><StatusBadge label={r.status} /></td>
                        <td className="py-3 px-4 text-muted-foreground">{r.paidDate ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PERFORMANCE TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'performance' && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <Card className="bg-card border-border"><CardContent className="text-center py-12 text-muted-foreground">No reviews yet.</CardContent></Card>
          ) : reviews.map(r => (
            <Card key={r.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 cursor-pointer"
                  onClick={() => setExpandedReview(expandedReview === r.id ? null : r.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Award className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{r.reviewPeriod}</p>
                      <p className="text-xs text-muted-foreground">{r.createdAt.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StarRow value={r.rating} />
                    {expandedReview === r.id
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {expandedReview === r.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {([['Punctuality',r.punctuality],['Productivity',r.productivity],['Teamwork',r.teamwork],['Communication',r.communication]] as [string,number|null][]).map(([label,val]) => val != null && (
                        <div key={label} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                          <span className="text-sm text-muted-foreground">{label}</span>
                          <StarRow value={val} />
                        </div>
                      ))}
                    </div>
                    {r.strengths    && <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Strengths</p><p className="text-sm text-foreground">{r.strengths}</p></div>}
                    {r.improvements && <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Areas to Improve</p><p className="text-sm text-foreground">{r.improvements}</p></div>}
                    {r.goals        && <div><p className="text-xs text-muted-foreground font-medium mb-0.5">Goals</p><p className="text-sm text-foreground">{r.goals}</p></div>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}