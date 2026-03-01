'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { SessionLogger } from '@/lib/session-logger';
import { CashDrawer } from '@/lib/cash-drawer';
import { AuditLogger } from '@/lib/audit-logger';
import { LogOut, Clock, DollarSign, AlertCircle, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SessionsPage() {
  const { user } = useAuth();
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [cashDrawers, setCashDrawers] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = () => {
    setSessionLogs(SessionLogger.getAllSessionLogs());
    setAuditLogs(AuditLogger.getAllLogs());
    setCashDrawers(CashDrawer.getAllSessions());
  };

  const activeSessions = useMemo(() => {
    return sessionLogs.filter(s => s.status === 'active');
  }, [sessionLogs]);

  const todaysSessions = useMemo(() => {
    const today = new Date().toDateString();
    return sessionLogs.filter(s => new Date(s.loginTime).toDateString() === today);
  }, [sessionLogs]);

  const sessionStats = useMemo(() => {
    return {
      totalSessions: sessionLogs.length,
      activeSessions: activeSessions.length,
      totalDuration: sessionLogs.reduce((sum, s) => sum + (s.duration || 0), 0),
      avgDuration: sessionLogs.length > 0 ? sessionLogs.reduce((sum, s) => sum + (s.duration || 0), 0) / sessionLogs.length : 0,
    };
  }, [sessionLogs, activeSessions]);

  const handleEndSession = (sessionId: string) => {
    SessionLogger.endSessionLog(sessionId, 'manual_logout');
    loadSessionData();
  };

  const exportSessionReport = () => {
    const today = new Date();
    const report = SessionLogger.exportSessionReport(
      new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      today
    );
    const csv = generateSessionCSV(report);
    downloadCSV(csv, 'session-report.csv');
  };

  const exportAuditReport = () => {
    const csv = AuditLogger.exportLogs('csv');
    downloadCSV(csv, 'audit-trail.csv');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-cyan-400 to-pink-400">
          Session Management
        </h1>
        <p className="text-slate-400 mt-2">Track active sessions and user activity</p>
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-violet-950 to-violet-900 border-violet-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Total Sessions</CardTitle>
            <Clock className="h-5 w-5 text-violet-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-300">{sessionStats.totalSessions}</div>
            <p className="text-xs text-violet-400 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-950 to-cyan-900 border-cyan-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Active Now</CardTitle>
            <AlertCircle className="h-5 w-5 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-300">{sessionStats.activeSessions}</div>
            <p className="text-xs text-cyan-400 mt-1">Live sessions</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-950 to-green-900 border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Avg Duration</CardTitle>
            <Clock className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-300">{sessionStats.avgDuration.toFixed(0)}m</div>
            <p className="text-xs text-green-400 mt-1">Average</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-950 to-amber-900 border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Today's Sessions</CardTitle>
            <Clock className="h-5 w-5 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-300">{todaysSessions.length}</div>
            <p className="text-xs text-amber-400 mt-1">Sessions today</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Active Sessions</CardTitle>
            <CardDescription className="text-slate-400">Currently logged in users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeSessions.map((session) => (
                <div key={session.sessionId} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-slate-600">
                  <div>
                    <p className="font-semibold text-slate-100">{session.userId}</p>
                    <p className="text-xs text-slate-400">
                      Logged in: {new Date(session.loginTime).toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-slate-400">
                      Activities: {session.activityCount}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleEndSession(session.sessionId)}
                    className="gap-2 bg-red-600 hover:bg-red-700"
                  >
                    <LogOut className="w-4 h-4" />
                    End Session
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Options */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Reports & Export</CardTitle>
          <CardDescription className="text-slate-400">Download session and audit logs</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={exportSessionReport}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Download className="w-4 h-4" />
            Export Session Report
          </Button>
          <Button
            onClick={exportAuditReport}
            className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <Download className="w-4 h-4" />
            Export Audit Trail
          </Button>
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Sessions</CardTitle>
          <CardDescription className="text-slate-400">Last 10 sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-600">
                <tr>
                  <th className="text-left py-2 text-slate-300">User ID</th>
                  <th className="text-left py-2 text-slate-300">Login Time</th>
                  <th className="text-left py-2 text-slate-300">Duration</th>
                  <th className="text-left py-2 text-slate-300">Status</th>
                  <th className="text-left py-2 text-slate-300">Activities</th>
                </tr>
              </thead>
              <tbody>
                {sessionLogs.slice(-10).reverse().map((session) => (
                  <tr key={session.sessionId} className="border-b border-slate-700">
                    <td className="py-2 text-slate-200">{session.userId}</td>
                    <td className="py-2 text-slate-400">{new Date(session.loginTime).toLocaleString()}</td>
                    <td className="py-2 text-slate-400">{session.duration ? `${session.duration}m` : '-'}</td>
                    <td className="py-2">
                      <Badge className={session.status === 'active' ? 'bg-green-600' : 'bg-gray-600'}>
                        {session.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-slate-200">{session.activityCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function generateSessionCSV(sessions: any[]): string {
  const headers = ['Session ID', 'User ID', 'Login Time', 'Logout Time', 'Duration (min)', 'Status', 'Activities'];
  const rows = sessions.map(s => [
    s.sessionId,
    s.userId,
    new Date(s.loginTime).toISOString(),
    s.logoutTime ? new Date(s.logoutTime).toISOString() : '-',
    s.duration || '-',
    s.status,
    s.activityCount,
  ]);
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
