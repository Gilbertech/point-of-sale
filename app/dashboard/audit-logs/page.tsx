'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AuditLogger } from '@/lib/audit-logger';
import { Download, Filter, Search } from 'lucide-react';
import { useStore } from '@/lib/store-context';

export default function AuditLogsPage() {
  const { currentStore } = useStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchQuery, filterAction, filterUser, dateFrom, dateTo]);

  const loadLogs = () => {
    const allLogs = AuditLogger.getLogs({ storeId: currentStore?.id });
    setLogs(allLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const filterLogs = () => {
    let results = logs;

    if (searchQuery) {
      results = results.filter(log =>
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.userId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterAction) {
      results = results.filter(log => log.action === filterAction);
    }

    if (filterUser) {
      results = results.filter(log => log.userId === filterUser);
    }

    if (dateFrom) {
      results = results.filter(log => new Date(log.createdAt) >= new Date(dateFrom));
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      results = results.filter(log => new Date(log.createdAt) <= endDate);
    }

    setFilteredLogs(results);
  };

  const uniqueActions = useMemo(() => {
    return [...new Set(logs.map(l => l.action))];
  }, [logs]);

  const uniqueUsers = useMemo(() => {
    return [...new Set(logs.map(l => l.userId))];
  }, [logs]);

  const stats = useMemo(() => {
    return {
      totalLogs: logs.length,
      sales: logs.filter(l => l.action.includes('SALE')).length,
      productChanges: logs.filter(l => l.resource === 'product').length,
      userActions: logs.filter(l => l.resource === 'user').length,
    };
  }, [logs]);

  const getActionColor = (action: string) => {
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'bg-cyan-600';
    if (action.includes('SALE')) return 'bg-green-600';
    if (action.includes('PRODUCT') || action.includes('INVENTORY')) return 'bg-violet-600';
    if (action.includes('SETTINGS')) return 'bg-amber-600';
    if (action.includes('DELETE')) return 'bg-red-600';
    return 'bg-slate-600';
  };

  const exportAuditLog = () => {
    const csv = AuditLogger.exportLogs('csv');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-pink-400 to-rose-400">
          Audit Trail
        </h1>
        <p className="text-slate-400 mt-2">Complete activity log and compliance records</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-violet-950 to-violet-900 border-violet-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Total Events</CardTitle>
            <Filter className="h-5 w-5 text-violet-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-300">{stats.totalLogs}</div>
            <p className="text-xs text-violet-400 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-950 to-green-900 border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Sales Events</CardTitle>
            <Filter className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-300">{stats.sales}</div>
            <p className="text-xs text-green-400 mt-1">Transactions</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-950 to-cyan-900 border-cyan-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Product Changes</CardTitle>
            <Filter className="h-5 w-5 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-300">{stats.productChanges}</div>
            <p className="text-xs text-cyan-400 mt-1">Updates</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-950 to-amber-900 border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">User Actions</CardTitle>
            <Filter className="h-5 w-5 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-300">{stats.userActions}</div>
            <p className="text-xs text-amber-400 mt-1">Login/Logout</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Filter & Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm text-slate-300">Search</label>
              <Input
                placeholder="Search action, resource, user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-1 bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-slate-300">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300">User</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All Users</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300">From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-slate-300">To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                setSearchQuery('');
                setFilterAction('');
                setFilterUser('');
                setDateFrom('');
                setDateTo('');
              }}
              variant="outline"
              className="flex-1"
            >
              Clear Filters
            </Button>
            <Button
              onClick={exportAuditLog}
              className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Activity Log</CardTitle>
          <CardDescription className="text-slate-400">
            Showing {filteredLogs.length} of {logs.length} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No audit logs found
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-3 bg-slate-700 rounded-lg border border-slate-600 hover:border-slate-500 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                      <span className="text-xs text-slate-400">{log.resource}</span>
                    </div>
                    <p className="text-sm text-slate-200 mb-1">
                      <strong>User:</strong> {log.userId}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-violet-400 cursor-pointer hover:text-violet-300">
                          View Details
                        </summary>
                        <pre className="mt-2 p-2 bg-slate-900 rounded text-xs text-slate-300 overflow-x-auto">
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
