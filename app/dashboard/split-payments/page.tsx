'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SplitPayment, type SplitPaymentTransaction } from '@/lib/split-payment';
import { useStore } from '@/lib/store-context';
import { Download, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

export default function SplitPaymentsPage() {
  const { currentStore } = useStore();
  const [transactions, setTransactions] = useState<SplitPaymentTransaction[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = () => {
    const allTransactions = SplitPayment.getAllTransactions().filter(
      t => t.storeId === currentStore?.id
    );
    setTransactions(allTransactions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  };

  const filteredTransactions = useMemo(() => {
    let results = transactions;

    if (dateFrom) {
      results = results.filter(t => new Date(t.createdAt) >= new Date(dateFrom));
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      results = results.filter(t => new Date(t.createdAt) <= endDate);
    }

    return results;
  }, [transactions, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const completed = filteredTransactions.filter(t => t.status === 'completed');
    
    return {
      totalTransactions: filteredTransactions.length,
      completedTransactions: completed.length,
      totalAmount: completed.reduce((sum, t) => sum + t.totalAmount, 0),
      avgTransaction: completed.length > 0 ? completed.reduce((sum, t) => sum + t.totalAmount, 0) / completed.length : 0,
      methodBreakdown: filteredTransactions.reduce((acc, t) => {
        t.payments.forEach(p => {
          if (!acc[p.method]) acc[p.method] = { count: 0, total: 0 };
          acc[p.method].count++;
          acc[p.method].total += p.amount;
        });
        return acc;
      }, {} as Record<string, { count: number; total: number }>),
    };
  }, [filteredTransactions]);

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'cash': return 'bg-green-600';
      case 'card': return 'bg-blue-600';
      case 'check': return 'bg-amber-600';
      case 'mobile': return 'bg-violet-600';
      default: return 'bg-slate-600';
    }
  };

  const exportReport = () => {
    const report = SplitPayment.generateSplitPaymentReport(
      dateFrom ? new Date(dateFrom) : new Date(0),
      dateTo ? new Date(dateTo) : new Date()
    );
    
    const csv = ['Split Payment Report\n'];
    csv.push(`Generated: ${new Date().toISOString()}\n`);
    csv.push(`Total Transactions,${report.totalTransactions}`);
    csv.push(`Total Amount,${report.totalAmount}\n`);
    csv.push('Payment Method,Count,Total\n');
    
    Object.entries(report.byMethod).forEach(([method, data]) => {
      csv.push(`${method},${data.count},${data.total}`);
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `split-payment-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400">
          Split Payments
        </h1>
        <p className="text-slate-400 mt-2">Track multi-method payment transactions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-950 to-cyan-900 border-cyan-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Total Transactions</CardTitle>
            <CreditCard className="h-5 w-5 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-300">{stats.totalTransactions}</div>
            <p className="text-xs text-cyan-400 mt-1">Split payments</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-950 to-green-900 border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Total Amount</CardTitle>
            <CreditCard className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-300">{formatCurrency(stats.totalAmount)}</div>
            <p className="text-xs text-green-400 mt-1">Total collected</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-950 to-violet-900 border-violet-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Average</CardTitle>
            <CreditCard className="h-5 w-5 text-violet-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-300">{formatCurrency(stats.avgTransaction)}</div>
            <p className="text-xs text-violet-400 mt-1">Per transaction</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-950 to-blue-900 border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Completed</CardTitle>
            <CreditCard className="h-5 w-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-300">{stats.completedTransactions}</div>
            <p className="text-xs text-blue-400 mt-1">Fully paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods Breakdown */}
      {Object.keys(stats.methodBreakdown).length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Payment Methods</CardTitle>
            <CardDescription className="text-slate-400">Breakdown by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(stats.methodBreakdown).map(([method, data]) => (
                <div key={method} className="p-3 bg-slate-700 rounded-lg border border-slate-600">
                  <Badge className={`${getMethodColor(method)} capitalize mb-2`}>
                    {method}
                  </Badge>
                  <p className="font-bold text-slate-100 text-lg">{data.count}</p>
                  <p className="text-xs text-slate-400">{formatCurrency(data.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Export */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Filters & Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-300">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={exportReport}
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700"
              >
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction List */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Transactions</CardTitle>
          <CardDescription className="text-slate-400">
            Showing {filteredTransactions.length} split payment transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No split payment transactions found
              </div>
            ) : (
              filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="p-3 bg-slate-700 rounded-lg border border-slate-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-bold text-slate-100">
                        Transaction {transaction.transactionId.substring(0, 8)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge className={transaction.status === 'completed' ? 'bg-green-600' : 'bg-amber-600'}>
                      {transaction.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {transaction.payments.map((payment, idx) => (
                      <Badge
                        key={idx}
                        className={`${getMethodColor(payment.method)} capitalize`}
                      >
                        {payment.method}: {formatCurrency(payment.amount)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm font-semibold text-cyan-300 mt-2">
                    Total: {formatCurrency(transaction.totalAmount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
