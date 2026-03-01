'use client';

import { AlertCircle, CheckCircle, AlertTriangle, Database, Users, Package, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MOCK_PRODUCTS, MOCK_CUSTOMERS, MOCK_TRANSACTIONS } from '@/lib/mock-data';

export function SystemHealth() {
  const lowStockItems = MOCK_PRODUCTS.filter(p => p.stock <= p.lowStockThreshold).length;
  const outOfStockItems = MOCK_PRODUCTS.filter(p => p.stock === 0).length;

  const healthStatus = {
    inventory: outOfStockItems === 0 ? 'healthy' : 'warning',
    customers: MOCK_CUSTOMERS.length > 0 ? 'healthy' : 'error',
    transactions: MOCK_TRANSACTIONS.length > 0 ? 'healthy' : 'warning',
    database: 'healthy',
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const HealthItem = ({ icon: Icon, label, value, status, badge }: any) => (
    <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${getStatusColor(status)}`}>
      <div className="flex items-center gap-3">
        {getStatusIcon(status)}
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{value}</p>
        </div>
      </div>
      {badge && <div className="flex gap-1 flex-wrap justify-end">{badge}</div>}
    </div>
  );

  return (
    <Card className="col-span-1 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg text-foreground">System Health</CardTitle>
        <CardDescription>Real-time system status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <HealthItem
          icon={Package}
          label="Inventory"
          value={`${MOCK_PRODUCTS.length} products`}
          status={healthStatus.inventory}
          badge={
            <>
              {outOfStockItems > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {outOfStockItems} Out
                </Badge>
              )}
              {lowStockItems > 0 && (
                <Badge className="bg-amber-100 text-amber-800 text-xs">
                  {lowStockItems} Low
                </Badge>
              )}
            </>
          }
        />

        <HealthItem
          icon={Users}
          label="Customers"
          value={`${MOCK_CUSTOMERS.length} registered`}
          status={healthStatus.customers}
          badge={<Badge className="bg-primary/10 text-primary text-xs">{MOCK_CUSTOMERS.length}</Badge>}
        />

        <HealthItem
          icon={ShoppingCart}
          label="Transactions"
          value={`${MOCK_TRANSACTIONS.length} processed`}
          status={healthStatus.transactions}
          badge={<Badge className="bg-blue-100 text-blue-900 text-xs">{MOCK_TRANSACTIONS.length}</Badge>}
        />

        <HealthItem
          icon={Database}
          label="Database"
          value="Connected & Synced"
          status={healthStatus.database}
          badge={<Badge className="bg-green-100 text-green-800 text-xs">Ready</Badge>}
        />
      </CardContent>
    </Card>
  );
}
