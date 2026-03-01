'use client';
// app/dashboard/reports/page.tsx
// ✅ Filters transactions + products by currentStore.id — reloads on store switch

import React from 'react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { Download, TrendingUp, DollarSign, Package, ShoppingCart, Upload, Activity } from 'lucide-react';
import { exportToCSV, exportToJSON } from '@/lib/export-utils';
import { formatCurrency, formatChartValue } from '@/lib/currency';
import { getAllTransactions } from '@/lib/supabase/transactions-helper';
import { getAllProducts } from '@/lib/supabase/products-helper';

export default function ReportsPage() {
  const { currentStore } = useStore();
  const [reportType, setReportType] = useState<'sales' | 'products' | 'customers' | 'categories'>('sales');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Re-fetch whenever the selected store changes
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const storeId = currentStore?.id ?? null;
      const [transactionsData, productsData] = await Promise.all([
        getAllTransactions(1000, storeId), // ✅ store-filtered
        getAllProducts(storeId),           // ✅ store-filtered
      ]);
      setTransactions(transactionsData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading reports data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentStore?.id]); // ✅ re-runs on store switch

  useEffect(() => { loadData(); }, [loadData]);

  const dailySales = useMemo(() => {
    const salesByDate: Record<string, number> = {};
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      salesByDate[dateStr] = 0;
    }
    transactions.forEach(t => {
      const dateStr = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (salesByDate[dateStr] !== undefined) salesByDate[dateStr] += t.total;
    });
    return Object.entries(salesByDate).map(([date, totalSales]) => ({ date, totalSales }));
  }, [transactions]);

  const productSales = useMemo(() => {
    const map: Record<string, any> = {};
    transactions.forEach(t => {
      t.items.forEach((item: any) => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          if (!map[item.productId]) map[item.productId] = { productId: item.productId, productName: product.name, quantitySold: 0, revenue: 0, cost: 0 };
          map[item.productId].quantitySold += item.quantity;
          map[item.productId].revenue += item.subtotal;
          map[item.productId].cost += product.cost * item.quantity;
        }
      });
    });
    return Object.values(map).map(p => ({ ...p, profit: p.revenue - p.cost }));
  }, [transactions, products]);

  const categorySales = useMemo(() => {
    const map: Record<string, { sales: number; count: number }> = {};
    transactions.forEach(t => {
      t.items.forEach((item: any) => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const cat = product.category || 'Uncategorized';
          if (!map[cat]) map[cat] = { sales: 0, count: 0 };
          map[cat].sales += item.subtotal;
          map[cat].count += item.quantity;
        }
      });
    });
    return Object.entries(map)
      .map(([category, d]) => ({ category, totalSales: d.sales, itemsSold: d.count }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [transactions, products]);

  const financialMetrics = useMemo(() => {
    const totalRevenue = transactions.reduce((s, t) => s + t.total, 0);
    const totalCost = transactions.reduce((s, t) => s + t.items.reduce((is: number, item: any) => {
      const p = products.find(p => p.id === item.productId);
      return is + (p ? p.cost * item.quantity : 0);
    }, 0), 0);
    const profit = totalRevenue - totalCost;
    return {
      totalRevenue, totalCost, profit,
      profitMargin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
      avgOrderValue: transactions.length > 0 ? totalRevenue / transactions.length : 0,
      totalOrders: transactions.length,
      totalProducts: products.length,
    };
  }, [transactions, products]);

  const topProducts = useMemo(() => [...productSales].sort((a, b) => b.revenue - a.revenue).slice(0, 5), [productSales]);

  const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--card-foreground)',
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      exportToCSV(productSales.map(p => ({ Product: p.productName, 'Qty Sold': p.quantitySold, Revenue: formatCurrency(p.revenue), Cost: formatCurrency(p.cost), Profit: formatCurrency(p.profit), 'Margin %': `${((p.profit / p.revenue) * 100).toFixed(1)}%` })), `POS-Report-${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      exportToJSON({ generatedAt: new Date().toISOString(), store: currentStore?.name, metrics: financialMetrics, products: productSales, sales: dailySales, categories: categorySales }, `POS-Report-${new Date().toISOString().split('T')[0]}.json`);
    }
    alert(`Report exported as ${format.toUpperCase()}!`);
  };

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = (e.target?.result as string).split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).filter(l => l.trim()).map(line => {
        const obj: any = {};
        line.split(',').forEach((v, i) => { obj[headers[i]] = v?.trim(); });
        return obj;
      });
      setCsvData(data);
      alert(`Successfully imported ${data.length} records!`);
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            Loading reports{currentStore ? ` for ${currentStore.name}` : ''}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics & Reports</h1>
          <p className="text-muted-foreground mt-1">
            {currentStore ? `${currentStore.name} — business intelligence` : 'Advanced business intelligence and data analysis'}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full shadow-sm">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-sm font-semibold text-foreground">Real-time</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue',   value: formatCurrency(financialMetrics.totalRevenue), sub: 'All time',                                           icon: <DollarSign   className="h-5 w-5 text-[var(--chart-1)]" />, iconBg: 'bg-[var(--chart-1)]/10' },
          { label: 'Gross Profit',    value: formatCurrency(financialMetrics.profit),        sub: `${financialMetrics.profitMargin.toFixed(1)}% margin`, icon: <TrendingUp   className="h-5 w-5 text-[var(--chart-2)]" />, iconBg: 'bg-[var(--chart-2)]/10' },
          { label: 'Avg Order Value', value: formatCurrency(financialMetrics.avgOrderValue), sub: `${financialMetrics.totalOrders} orders`,              icon: <ShoppingCart className="h-5 w-5 text-[var(--chart-3)]" />, iconBg: 'bg-[var(--chart-3)]/10' },
          { label: 'Total Cost',      value: formatCurrency(financialMetrics.totalCost),     sub: 'COGS',                                               icon: <Package      className="h-5 w-5 text-[var(--chart-4)]" />, iconBg: 'bg-[var(--chart-4)]/10' },
        ].map((m, i) => (
          <Card key={i} className="bg-card border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <div className={`w-9 h-9 rounded-xl ${m.iconBg} flex items-center justify-center`}>{m.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{m.value}</div>
              <p className="text-xs mt-1 font-medium text-muted-foreground">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls & Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader><CardTitle className="text-foreground">Report Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Report Type</label>
              <select value={reportType} onChange={e => setReportType(e.target.value as any)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="sales">Sales Analysis</option>
                <option value="products">Product Performance</option>
                <option value="customers">Customer Insights</option>
                <option value="categories">Category Analysis</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Date Range</label>
              <select value={dateRange} onChange={e => setDateRange(e.target.value as any)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Export Data</label>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleExport('csv')} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground flex-1">
                  <Download className="w-4 h-4" /> CSV
                </Button>
                <Button size="sm" onClick={() => handleExport('json')} className="gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground flex-1">
                  <Download className="w-4 h-4" /> JSON
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader><CardTitle className="text-foreground">Import Data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Import CSV File</label>
              <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-primary/40 rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                <Upload className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Click to upload CSV or drag & drop</span>
              </label>
              <p className="text-xs text-muted-foreground">Supported: CSV files for sales, inventory, or customer data</p>
            </div>
            {csvData.length > 0 && (
              <div className="p-3 bg-accent/20 border border-accent/30 rounded-xl">
                <p className="text-sm text-accent-foreground font-medium">✓ Imported {csvData.length} records</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-foreground">Revenue Trend</CardTitle>
            <CardDescription className="text-muted-foreground">Daily sales performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailySales}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--chart-1)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--border)" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis stroke="var(--border)" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatChartValue(v)} />
                <Area type="monotone" dataKey="totalSales" stroke="var(--chart-1)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-foreground">Sales by Category</CardTitle>
            <CardDescription className="text-muted-foreground">Revenue distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {categorySales.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No sales data{currentStore ? ` for ${currentStore.name}` : ''} yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categorySales} dataKey="totalSales" nameKey="category" cx="50%" cy="50%" outerRadius={100}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {categorySales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatChartValue(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-foreground">Top 5 Products by Revenue</CardTitle>
          <CardDescription className="text-muted-foreground">Best performing products</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No product data available yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topProducts} layout="horizontal" margin={{ top: 5, right: 30, left: 300, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--border)" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis dataKey="productName" type="category" width={290} stroke="var(--border)" tick={{ fontSize: 12, fill: 'var(--foreground)' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatChartValue(v)} />
                <Legend />
                <Bar dataKey="revenue" fill="var(--chart-1)" name="Revenue" radius={[0, 4, 4, 0]} />
                <Bar dataKey="profit"  fill="var(--chart-2)" name="Profit"  radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Product Table */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-foreground">Product Performance Detail</CardTitle>
          <CardDescription className="text-muted-foreground">Individual product metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {productSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No sales data available yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Product</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Qty Sold</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Revenue</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Cost</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Profit</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {productSales.map((product) => {
                    const margin = product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0;
                    return (
                      <tr key={product.productId} className="border-b border-border hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">{product.productName}</td>
                        <td className="py-3 px-4 text-right text-foreground">{product.quantitySold}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[var(--chart-3)]">{formatCurrency(product.revenue)}</td>
                        <td className="py-3 px-4 text-right text-destructive">{formatCurrency(product.cost)}</td>
                        <td className="py-3 px-4 text-right font-semibold text-[var(--chart-1)]">{formatCurrency(product.profit)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            margin >= 50 ? 'bg-[var(--chart-3)]/15 text-[var(--chart-3)]' :
                            margin >= 25 ? 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]' :
                                          'bg-destructive/15 text-destructive'
                          }`}>{margin.toFixed(1)}%</span>
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

      {/* Financial Summary */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-foreground">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Orders',     value: financialMetrics.totalOrders },
              { label: 'Total SKUs',       value: financialMetrics.totalProducts },
              { label: 'Profit Margin',    value: `${financialMetrics.profitMargin.toFixed(1)}%` },
              { label: 'Avg. Profit/Order', value: financialMetrics.totalOrders > 0 ? formatCurrency(financialMetrics.profit / financialMetrics.totalOrders) : formatCurrency(0) },
            ].map((s, i) => (
              <div key={i} className="space-y-1">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}