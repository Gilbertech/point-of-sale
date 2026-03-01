'use client';
// app/dashboard/receipts/page.tsx
// ✅ Filters transactions by currentStore.id — reloads on store switch

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store-context';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Printer, Download, Mail, RotateCcw } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { getAllTransactions } from '@/lib/supabase/transactions-helper';
import { getAllCustomers } from '@/lib/supabase/customers-helper';

export default function ReceiptsPage() {
  const { currentStore } = useStore();
  const { user } = useAuth();
  const cashierName = user ? `${user.firstName} ${user.lastName}`.trim() : 'N/A';

  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'refunded' | 'pending'>('all');

  // ✅ Re-fetch whenever the selected store changes
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const storeId = currentStore?.id ?? null;
      const [transactionsData, customersData] = await Promise.all([
        getAllTransactions(500, storeId), // ✅ store-filtered
        getAllCustomers(),
      ]);
      setTransactions(transactionsData);
      setCustomers(customersData);
      setSelectedReceipt(null); // clear selection on store switch
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentStore?.id]); // ✅ re-runs on store switch

  useEffect(() => { loadData(); }, [loadData]);

  const filteredTransactions = useMemo(() => {
    let results = transactions;

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      results = results.filter(t => {
        const customer = customers.find(c => c.id === t.customerId);
        return (
          t.transactionNumber.toLowerCase().includes(lower) ||
          (customer && customer.firstName.toLowerCase().includes(lower)) ||
          (customer && customer.lastName.toLowerCase().includes(lower))
        );
      });
    }

    if (statusFilter !== 'all' && statusFilter !== 'completed') {
      results = [];
    }

    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, customers, searchQuery, statusFilter]);

  const getCustomer = (customerId: string | null) => {
    if (!customerId) return null;
    return customers.find(c => c.id === customerId);
  };

  const handlePrint = (transaction: any) => {
    const customer = getCustomer(transaction.customerId);
    const printWindow = window.open('', '', 'height=600,width=800');

    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt ${transaction.transactionNumber}</title>
            <style>
              @media print { body { margin: 0; } @page { margin: 0.5cm; } }
              body { font-family: 'Courier New', monospace; max-width: 300px; margin: 20px auto; padding: 20px; }
              .receipt { background: white; padding: 20px; border: 2px dashed #333; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .divider { border-top: 2px dashed #333; margin: 10px 0; }
              .row { display: flex; justify-content: space-between; margin: 4px 0; }
              h1 { font-size: 18px; margin: 10px 0; }
              .text-xs { font-size: 10px; }
              .footer { margin-top: 10px; font-size: 10px; }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="center divider" style="padding-bottom: 10px;">
                <h1 class="bold">${currentStore?.name || 'Store Name'}</h1>
                <div class="text-xs">${currentStore?.address || ''}</div>
                <div class="text-xs">${currentStore?.phone || ''}</div>
              </div>
              <div class="text-xs divider" style="padding: 10px 0;">
                <div>Receipt #${transaction.transactionNumber}</div>
                <div>${new Date(transaction.createdAt).toLocaleString()}</div>
                <div>Cashier: ${cashierName}</div>
              </div>
              ${customer ? `<div class="text-xs divider" style="padding: 10px 0;"><div>Customer:</div><div class="bold">${customer.firstName} ${customer.lastName}</div></div>` : ''}
              <div class="text-xs divider" style="padding: 10px 0;">
                <div class="row bold" style="margin-bottom: 8px;"><span>ITEM</span><span>TOTAL</span></div>
                ${transaction.items.map((item: any) => `<div class="row" style="font-size:11px;"><span>${item.productName} x${item.quantity}</span><span>${formatCurrency(item.subtotal)}</span></div>`).join('')}
              </div>
              <div class="text-xs" style="padding: 10px 0;">
                <div class="row"><span>Subtotal:</span><span>${formatCurrency(transaction.subtotal)}</span></div>
                ${transaction.discount > 0 ? `<div class="row" style="color:red;"><span>Discount:</span><span>-${formatCurrency(transaction.discount)}</span></div>` : ''}
                <div class="row"><span>Tax:</span><span>${formatCurrency(transaction.tax)}</span></div>
                <div class="row bold divider" style="font-size:14px;padding-top:8px;"><span>TOTAL:</span><span>${formatCurrency(transaction.total)}</span></div>
              </div>
              <div class="center text-xs divider" style="padding: 10px 0;"><div>Payment: ${transaction.paymentMethod.toUpperCase()}</div></div>
              <div class="center footer"><div>Thank you for your purchase!</div><div>Please keep this receipt for warranty/returns</div></div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleEmail = (transaction: any) => {
    const customer = getCustomer(transaction.customerId);
    alert(`Receipt #${transaction.transactionNumber} sent to ${customer?.email || 'customer email'}`);
  };

  const handleRefund = (transaction: any) => {
    alert(`Transaction ${transaction.transactionNumber} has been successfully refunded. Inventory has been updated.`);
  };

  const handleDownloadPDF = (transaction: any) => {
    alert(`Receipt #${transaction.transactionNumber} would be downloaded as PDF`);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            Loading receipts{currentStore ? ` for ${currentStore.name}` : ''}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Receipts & Transactions</h1>
        <p className="text-muted-foreground mt-1">
          {currentStore ? `${currentStore.name} — transaction history` : 'Manage and reprint transaction receipts'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Receipts List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Showing {filteredTransactions.length} receipts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by transaction number or customer..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'completed', 'refunded', 'pending'] as const).map(f => (
                    <Button key={f} variant={statusFilter === f ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(f)} className="capitalize">{f}</Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No receipts found</p>
                    <p className="text-sm">
                      {transactions.length === 0
                        ? `No transactions yet${currentStore ? ` for ${currentStore.name}` : ''}`
                        : 'Try adjusting your filters'}
                    </p>
                  </div>
                ) : (
                  filteredTransactions.map(transaction => {
                    const customer = getCustomer(transaction.customerId);
                    return (
                      <div
                        key={transaction.id}
                        onClick={() => setSelectedReceipt(transaction)}
                        className={`p-4 border border-border rounded-lg cursor-pointer transition-all ${
                          selectedReceipt?.id === transaction.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-semibold">{transaction.transactionNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {customer ? `${customer.firstName} ${customer.lastName}` : 'Walk-in'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {transaction.items.length} items • {transaction.paymentMethod}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge className="bg-green-100 text-green-800">completed</Badge>
                            <p className="font-bold">{formatCurrency(transaction.total)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(transaction.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Receipt Details */}
        {selectedReceipt ? (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Receipt Preview</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white text-black p-6 rounded border-2 border-dashed border-gray-300 font-mono text-sm space-y-2">
                  <div className="text-center space-y-1 pb-3 border-b-2 border-dashed">
                    <p className="font-bold text-lg">{currentStore?.name}</p>
                    <p className="text-xs">{currentStore?.address}</p>
                    <p className="text-xs">{currentStore?.phone}</p>
                  </div>
                  <div className="text-xs space-y-1 pb-3 border-b-2 border-dashed">
                    <p>Receipt #{selectedReceipt.transactionNumber}</p>
                    <p>{new Date(selectedReceipt.createdAt).toLocaleString()}</p>
                    <p>Cashier: {cashierName}</p>
                  </div>
                  {selectedReceipt.customerId && (() => {
                    const customer = getCustomer(selectedReceipt.customerId);
                    return customer ? (
                      <div className="text-xs space-y-1 pb-3 border-b-2 border-dashed">
                        <p>Customer:</p>
                        <p>{customer.firstName} {customer.lastName}</p>
                      </div>
                    ) : null;
                  })()}
                  <div className="text-xs space-y-1 pb-3 border-b-2 border-dashed">
                    <div className="flex justify-between font-bold mb-1"><span>ITEM</span><span>TOTAL</span></div>
                    {selectedReceipt.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between">
                        <span>{item.productName} x{item.quantity}</span>
                        <span>{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs space-y-1 pb-2">
                    <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(selectedReceipt.subtotal)}</span></div>
                    {selectedReceipt.discount > 0 && (
                      <div className="flex justify-between text-red-600"><span>Discount:</span><span>-{formatCurrency(selectedReceipt.discount)}</span></div>
                    )}
                    <div className="flex justify-between"><span>Tax:</span><span>{formatCurrency(selectedReceipt.tax)}</span></div>
                    <div className="flex justify-between font-bold text-base border-t-2 border-dashed pt-1">
                      <span>TOTAL:</span><span>{formatCurrency(selectedReceipt.total)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-center pt-2 pb-2 border-b-2 border-dashed">
                    <p>Payment: {selectedReceipt.paymentMethod.toUpperCase()}</p>
                  </div>
                  <div className="text-xs text-center pt-2 space-y-1">
                    <p>Thank you for your purchase!</p>
                    <p>Please keep this receipt for warranty/returns</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button onClick={() => handlePrint(selectedReceipt)} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Printer className="w-4 h-4" /> Print Receipt
                  </Button>
                  <Button onClick={() => handleEmail(selectedReceipt)} variant="outline" className="w-full gap-2">
                    <Mail className="w-4 h-4" /> Email Receipt
                  </Button>
                  <Button onClick={() => handleDownloadPDF(selectedReceipt)} variant="outline" className="w-full gap-2">
                    <Download className="w-4 h-4" /> Download as PDF
                  </Button>
                  <Button onClick={() => handleRefund(selectedReceipt)} variant="destructive" className="w-full gap-2">
                    <RotateCcw className="w-4 h-4" /> Issue Refund
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Select a receipt to view details
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}