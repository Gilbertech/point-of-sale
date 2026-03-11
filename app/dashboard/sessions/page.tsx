'use client';
// app/dashboard/sessions/page.tsx
// Reads from Supabase `user_sessions` + `app_users` tables — real data, works across all devices.
//
// ONE-TIME SETUP (run split-payments-sessions-setup.sql in Supabase SQL Editor first)

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { LogOut, Clock, AlertCircle, Download, RefreshCw, Users, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserSession {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  storeId: string | null;
  loginAt: string;
  logoutAt: string | null;
  durationMinutes: number | null;
  status: 'active' | 'ended';
  logoutReason: string | null;
  activityCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function minutesToDuration(mins: number | null): string {
  if (mins == null) return '-';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const { user } = useAuth();

  const [sessions, setSessions]   = useState<UserSession[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [endingId, setEndingId]   = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // ── Load sessions from Supabase ─────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('user_sessions')
        .select(`
          id, user_id, login_at, logout_at, duration_minutes,
          status, logout_reason, activity_count, store_id,
          app_users ( first_name, last_name, role )
        `)
        .order('login_at', { ascending: false })
        .limit(200);

      if (err) { setError(err.message); return; }

      setSessions((data || []).map((row: any) => {
        const u = row.app_users;
        return {
          id:              row.id,
          userId:          row.user_id,
          userName:        u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || row.user_id : row.user_id,
          userRole:        u?.role ?? 'unknown',
          storeId:         row.store_id ?? null,
          loginAt:         row.login_at,
          logoutAt:        row.logout_at ?? null,
          durationMinutes: row.duration_minutes ?? null,
          status:          row.status ?? 'ended',
          logoutReason:    row.logout_reason ?? null,
          activityCount:   row.activity_count ?? 0,
        };
      }));
    } catch (e) {
      setError('Failed to load session data.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const active = useMemo(() => sessions.filter(s => s.status === 'active'), [sessions]);
  const today  = useMemo(() => {
    const d = new Date().toDateString();
    return sessions.filter(s => new Date(s.loginAt).toDateString() === d);
  }, [sessions]);

  const stats = useMemo(() => {
    const ended    = sessions.filter(s => s.durationMinutes != null);
    const totalMins = ended.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
    return {
      total:   sessions.length,
      active:  active.length,
      today:   today.length,
      avgMins: ended.length > 0 ? Math.round(totalMins / ended.length) : 0,
    };
  }, [sessions, active, today]);

  // ── End a session ───────────────────────────────────────────────────────────

  const handleEndSession = async (sessionId: string) => {
    setEndingId(sessionId);
    try {
      const now         = new Date().toISOString();
      const session     = sessions.find(s => s.id === sessionId);
      const loginTime   = session ? new Date(session.loginAt).getTime() : Date.now();
      const durationMins = Math.round((Date.now() - loginTime) / 60000);

      const { error: err } = await supabase
        .from('user_sessions')
        .update({
          status:           'ended',
          logout_at:        now,
          duration_minutes: durationMins,
          logout_reason:    'admin_forced',
        })
        .eq('id', sessionId);

      if (err) { setError(err.message); return; }

      setSuccessMsg('Session ended.');
      setTimeout(() => setSuccessMsg(''), 3000);
      await load();
    } finally {
      setEndingId(null);
    }
  };

  // ── CSV Export ──────────────────────────────────────────────────────────────

  const exportSessions = () => {
    const rows = [
      ['Session ID', 'User', 'Role', 'Login Time', 'Logout Time', 'Duration', 'Status', 'Activities'],
      ...sessions.map(s => [
        s.id,
        s.userName,
        s.userRole,
        new Date(s.loginAt).toISOString(),
        s.logoutAt ? new Date(s.logoutAt).toISOString() : '-',
        minutesToDuration(s.durationMinutes),
        s.status,
        s.activityCount,
      ]),
    ];
    downloadCSV(rows.map(r => r.join(',')).join('\n'), `sessions-${new Date().toISOString().split('T')[0]}.csv`);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400">
            Session Management
          </h1>
          <p className="text-slate-400 mt-2">Track active sessions and user activity</p>
        </div>
        <Button
          onClick={load}
          variant="outline"
          size="sm"
          className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-700"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
          ⚠ {error} — Run <code className="font-mono text-xs">split-payments-sessions-setup.sql</code> in Supabase if the table doesn't exist yet.
        </div>
      )}
      {successMsg && (
        <Alert className="bg-green-900/30 border-green-700">
          <AlertDescription className="text-green-300">{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions',   value: stats.total,  sub: 'All time',       color: 'violet', Icon: Clock       },
          { label: 'Active Now',        value: stats.active, sub: 'Live sessions',  color: 'cyan',   Icon: AlertCircle },
          { label: "Today's Sessions", value: stats.today,  sub: 'Sessions today', color: 'amber',  Icon: Users       },
          { label: 'Avg Duration',     value: minutesToDuration(stats.avgMins), sub: 'Average session', color: 'green', Icon: Activity },
        ].map(({ label, value, sub, color, Icon }) => (
          <Card key={label} className={`bg-gradient-to-br from-${color}-950 to-${color}-900 border-${color}-800`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-200">{label}</CardTitle>
              <Icon className={`h-5 w-5 text-${color}-400`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold text-${color}-300`}>{value}</div>
              <p className={`text-xs text-${color}-400 mt-1`}>{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active sessions */}
      {active.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Active Sessions</CardTitle>
            <CardDescription className="text-slate-400">Currently logged in users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {active.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-slate-600">
                  <div>
                    <p className="font-semibold text-slate-100">{s.userName}</p>
                    <p className="text-xs text-slate-400 capitalize">{s.userRole}</p>
                    <p className="text-xs text-slate-400">
                      Logged in: {new Date(s.loginAt).toLocaleTimeString()} · Activities: {s.activityCount}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleEndSession(s.id)}
                    disabled={endingId === s.id}
                    className="gap-2 bg-red-600 hover:bg-red-700"
                  >
                    <LogOut className="w-4 h-4" />
                    {endingId === s.id ? 'Ending...' : 'End Session'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Reports & Export</CardTitle>
          <CardDescription className="text-slate-400">Download session logs</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportSessions} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
            <Download className="w-4 h-4" />
            Export Session Report
          </Button>
        </CardContent>
      </Card>

      {/* Recent sessions table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Sessions</CardTitle>
          <CardDescription className="text-slate-400">Last 20 sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No sessions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-600">
                  <tr>
                    {['User', 'Role', 'Login Time', 'Duration', 'Status', 'Activities'].map(h => (
                      <th key={h} className="text-left py-2 text-slate-300 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 20).map(s => (
                    <tr key={s.id} className="border-b border-slate-700">
                      <td className="py-2 text-slate-200 pr-4">{s.userName}</td>
                      <td className="py-2 text-slate-400 pr-4 capitalize">{s.userRole}</td>
                      <td className="py-2 text-slate-400 pr-4">{new Date(s.loginAt).toLocaleString()}</td>
                      <td className="py-2 text-slate-400 pr-4">{minutesToDuration(s.durationMinutes)}</td>
                      <td className="py-2 pr-4">
                        <Badge className={s.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-slate-200">{s.activityCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}