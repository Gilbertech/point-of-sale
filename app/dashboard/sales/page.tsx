'use client';
// app/dashboard/sales/page.tsx
// ✅ Full split payment support — writes to split_payment_transactions
// ✅ Filters products by currentStore.id
// ✅ transaction_items receives store_id
// ✅ Better error surfacing

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store-context';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ShoppingCart, Plus, Minus, X, SplitSquareVertical, CreditCard } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { formatCurrency } from '@/lib/currency';
import { getAllProducts, updateProductSimple } from '@/lib/supabase/products-helper';
import { getAllCustomers } from '@/lib/supabase/customers-helper';
import { supabase } from '@/lib/supabase/client';

// ─── Types ─────────────────────────────────────────────────────────────────────

type PaymentMethod = 'cash' | 'card' | 'mpesa' | 'check' | 'other';

interface SplitEntry {
  method: PaymentMethod;
  amount: string; // string so input is controlled cleanly
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash:  'Cash',
  card:  'Card',
  mpesa: 'M-Pesa',
  check: 'Cheque',
  other: 'Other',
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const e = error as any;
    const parts: string[] = [];
    if (e.message) parts.push(e.message);
    if (e.details) parts.push(`Details: ${e.details}`);
    if (e.hint)    parts.push(`Hint: ${e.hint}`);
    if (e.code)    parts.push(`Code: ${e.code}`);
    if (parts.length > 0) return parts.join(' | ');
    return JSON.stringify(error);
  }
  if (typeof error === 'string') return error;
  return 'Unknown error — check browser console for details';
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const { currentStore } = useStore();
  const { user } = useAuth();

  const [products, setProducts]               = useState<any[]>([]);
  const [customers, setCustomers]             = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [cart, setCart]                       = useState<Array<{ productId: string; quantity: number }>>([]);
  const [searchQuery, setSearchQuery]         = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [discount, setDiscount]               = useState(0);

  // ── Payment mode ─────────────────────────────────────────────────────────────
  const [paymentMode, setPaymentMode]         = useState<'single' | 'split'>('single');
  const [singleMethod, setSingleMethod]       = useState<PaymentMethod>('cash');

  // Split payment entries — start with 2 rows
  const [splitEntries, setSplitEntries]       = useState<SplitEntry[]>([
    { method: 'cash',  amount: '' },
    { method: 'mpesa', amount: '' },
  ]);

  // ── Load data ─────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const storeId = currentStore?.id ?? null;
      const [productsData, customersData] = await Promise.all([
        getAllProducts(storeId),
        getAllCustomers(),
      ]);
      setProducts(productsData);
      setCustomers(customersData);
      setCart([]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentStore?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived values ────────────────────────────────────────────────────────────

  const categories = useMemo(() => [...new Set(products.map(p => p.category))], [products]);

  const filteredProducts = useMemo(() => {
    let results = products;
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower)
      );
    }
    if (selectedCategory) results = results.filter(p => p.category === selectedCategory);
    return results;
  }, [products, searchQuery, selectedCategory]);

  const cartItems = useMemo(() =>
    cart.map(item => {
      const product = products.find(p => p.id === item.productId);
      return product ? { ...item, product } : null;
    }).filter(Boolean),
  [cart, products]);

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item!.product.price * item!.quantity), 0);
    // Prices are tax-inclusive — no tax added on top
    const total    = subtotal - discount;
    return { subtotal, tax: 0, discount, total: Math.max(0, total) };
  }, [cartItems, discount]);

  // How much of the total has been allocated in split entries
  const splitAllocated = useMemo(() =>
    splitEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
  [splitEntries]);

  const splitRemaining = totals.total - splitAllocated;
  const splitValid     = paymentMode === 'single' || Math.abs(splitRemaining) < 0.01;

  // ── Cart operations ───────────────────────────────────────────────────────────

  const addToCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) removeFromCart(productId);
    else setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const handleBarcodeScan = (sku: string, barcode: string) => {
    const product = products.find(p =>
      p.sku.toLowerCase() === sku.toLowerCase() ||
      p.barcode?.toLowerCase() === barcode.toLowerCase()
    );
    if (product) addToCart(product.id);
    else alert(`Product not found: ${sku}`);
  };

  // ── Split entry helpers ───────────────────────────────────────────────────────

  const updateSplitEntry = (index: number, field: 'method' | 'amount', value: string) => {
    setSplitEntries(prev => prev.map((e, i) =>
      i === index ? { ...e, [field]: value } : e
    ));
  };

  const addSplitEntry = () => {
    setSplitEntries(prev => [...prev, { method: 'cash', amount: '' }]);
  };

  const removeSplitEntry = (index: number) => {
    setSplitEntries(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-fill the last split entry with the remaining amount
  const autoFillRemaining = (index: number) => {
    const otherTotal = splitEntries
      .filter((_, i) => i !== index)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const remaining = Math.max(0, totals.total - otherTotal);
    updateSplitEntry(index, 'amount', remaining.toFixed(2));
  };

  // ── Checkout ──────────────────────────────────────────────────────────────────

  const handleCheckout = async () => {
    if (cart.length === 0)    { alert('Cart is empty'); return; }
    if (!currentStore?.id)    { alert('No branch selected. Please select a branch before making a sale.'); return; }
    if (!splitValid)          { alert(`Split amounts don't add up. Remaining: ${formatCurrency(splitRemaining)}`); return; }

    // Validate split entries have amounts
    if (paymentMode === 'split') {
      const filled = splitEntries.filter(e => Number(e.amount) > 0);
      if (filled.length < 2)  { alert('Please enter at least 2 payment amounts for a split payment.'); return; }
    }

    try {
      const transactionNumber = `TXN${Date.now().toString().slice(-8)}`;
      const storeId           = currentStore.id;

      // Verify cashier exists in app_users
      let resolvedCashierId: string | null = user?.id ?? null;
      if (resolvedCashierId) {
        const { data: userRow } = await supabase
          .from('app_users').select('id').eq('id', resolvedCashierId).maybeSingle();
        if (!userRow) resolvedCashierId = null;
      }

      // Determine primary payment method label
      const primaryMethod = paymentMode === 'single'
        ? singleMethod
        : (splitEntries.reduce((a, b) => Number(a.amount) >= Number(b.amount) ? a : b).method);

      // 1. Insert transaction header
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .insert([{
          transaction_number: transactionNumber,
          subtotal:           totals.subtotal,
          tax:                0,
          discount:           totals.discount,
          total:              totals.total,
          payment_method:     paymentMode === 'split' ? 'split' : singleMethod,
          customer_id:        selectedCustomer || null,
          store_id:           storeId,
          cashier_id:         resolvedCashierId,
          status:             'completed',
        }])
        .select()
        .single();

      if (txnErr) { console.error('[Checkout] txn error:', txnErr); throw txnErr; }

      // 2. Insert transaction items
      const itemRows = cartItems.map(item => ({
        transaction_id: txn.id,
        product_id:     item!.productId,
        product_name:   item!.product.name,
        quantity:       item!.quantity,
        price:          item!.product.price,
        subtotal:       item!.product.price * item!.quantity,
        store_id:       storeId,
      }));

      const { error: itemsErr } = await supabase.from('transaction_items').insert(itemRows);
      if (itemsErr) {
        await supabase.from('transactions').delete().eq('id', txn.id);
        throw itemsErr;
      }

      // 3. ✅ If split payment — write to split_payment_transactions
      if (paymentMode === 'split') {
        const validEntries = splitEntries
          .filter(e => Number(e.amount) > 0)
          .map(e => ({ method: e.method, amount: Number(e.amount) }));

        const { error: splitErr } = await supabase
          .from('split_payment_transactions')
          .insert([{
            transaction_id: txn.id,
            store_id:       storeId,
            payments:       validEntries,   // jsonb array
            total_amount:   totals.total,
            status:         'completed',
          }]);

        if (splitErr) {
          // Non-fatal — transaction is saved, just log the split record failure
          console.warn('[Checkout] split_payment_transactions insert failed:', splitErr.message);
        }
      }

      // 4. Deduct stock
      for (const item of cartItems) {
        if (item) await updateProductSimple(item.productId, { stock: item.product.stock - item.quantity });
      }

      // 5. Success
      const customerName = selectedCustomer
        ? customers.find(c => c.id === selectedCustomer)?.firstName
        : 'Walk-in';

      const paymentSummary = paymentMode === 'split'
        ? splitEntries
            .filter(e => Number(e.amount) > 0)
            .map(e => `${PAYMENT_LABELS[e.method]}: ${formatCurrency(Number(e.amount))}`)
            .join('\n')
        : `${PAYMENT_LABELS[singleMethod]}: ${formatCurrency(totals.total)}`;

      alert(`✅ Transaction Completed!\n\nReceipt #${transactionNumber}\nTotal: ${formatCurrency(totals.total)}\n\nPayment:\n${paymentSummary}\n\nCustomer: ${customerName}`);

      // Reset
      setCart([]);
      setDiscount(0);
      setSelectedCustomer('');
      setPaymentMode('single');
      setSingleMethod('cash');
      setSplitEntries([{ method: 'cash', amount: '' }, { method: 'mpesa', amount: '' }]);
      loadData();

    } catch (error) {
      console.error('[Checkout] Full error:', error);
      alert(`Failed to complete transaction:\n\n${extractErrorMessage(error)}`);
    }
  };

  const lowStockWarnings = useMemo(() =>
    cartItems.filter(item => item && item.product.stock - item.quantity < 0),
  [cartItems]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading POS — {currentStore?.name ?? 'selecting store'}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Point of Sale</h1>
        <p className="text-muted-foreground mt-1">
          {currentStore ? `Processing sales for ${currentStore.name}` : 'No branch selected'}
        </p>
      </div>

      {!currentStore && (
        <Alert variant="destructive">
          <AlertDescription>
            ⚠️ No branch selected. Please select a branch from the sidebar before making a sale.
          </AlertDescription>
        </Alert>
      )}

      <BarcodeScanner onScan={handleBarcodeScan} />

      {lowStockWarnings.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>⚠️ Warning: Some items in cart exceed available stock</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Products ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Products</CardTitle>
              <CardDescription>{products.length} products at {currentStore?.name ?? '—'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search products..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant={selectedCategory === null ? 'default' : 'outline'} size="sm"
                  onClick={() => setSelectedCategory(null)}>All</Button>
                {categories.map(cat => (
                  <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} size="sm"
                    onClick={() => setSelectedCategory(cat)}>{cat}</Button>
                ))}
              </div>
              {products.length === 0 && currentStore ? (
                <div className="text-center py-12 text-muted-foreground">No products found for {currentStore.name}</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredProducts.map(product => (
                    <div key={product.id}
                      className="border border-border rounded-lg p-3 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => addToCart(product.id)}>
                      <p className="font-semibold text-sm line-clamp-2">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="font-bold text-primary">{formatCurrency(product.price)}</p>
                        <Badge variant={product.stock > 0 ? 'default' : 'destructive'}>{product.stock} stock</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Cart + Checkout ── */}
        <div className="space-y-4">

          {/* Cart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Cart
              </CardTitle>
              <CardDescription>{cart.length} items</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Cart is empty</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cartItems.map(item => {
                    if (!item) return null;
                    return (
                      <div key={item.productId} className="p-3 border border-border rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)} ea</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)}
                            className="h-6 w-6 p-0"><X className="w-4 h-4" /></Button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 bg-muted rounded">
                            <Button variant="ghost" size="sm" onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="h-6 w-6 p-0"><Minus className="w-3 h-3" /></Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button variant="ghost" size="sm" onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="h-6 w-6 p-0"><Plus className="w-3 h-3" /></Button>
                          </div>
                          <p className="font-semibold text-sm">{formatCurrency(item.product.price * item.quantity)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
            <CardContent>
              <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Walk-in Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Order Summary + Payment */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">

              {/* Totals — prices are tax & discount inclusive */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Discount:</span>
                    <span>-{formatCurrency(totals.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-muted-foreground italic">
                  <span>Tax included in prices</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                  <span>Total:</span><span>{formatCurrency(totals.total)}</span>
                </div>
              </div>

              {/* Discount */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">Discount Amount</label>
                <Input type="number" min="0" value={discount}
                  onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                  placeholder="0.00" />
              </div>

              {/* ── Payment Mode Toggle ── */}
              <div className="space-y-2">
                <label className="text-xs font-semibold">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={paymentMode === 'single' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentMode('single')}
                    className="gap-2"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Single
                  </Button>
                  <Button
                    variant={paymentMode === 'split' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentMode('split')}
                    className="gap-2"
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5" /> Split
                  </Button>
                </div>
              </div>

              {/* Single payment */}
              {paymentMode === 'single' && (
                <select value={singleMethod} onChange={e => setSingleMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {Object.entries(PAYMENT_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              )}

              {/* ── Split payment entries ── */}
              {paymentMode === 'split' && (
                <div className="space-y-3 p-3 bg-muted rounded-lg border border-border">
                  <p className="text-xs font-semibold text-foreground/70">Split across payment methods:</p>

                  {splitEntries.map((entry, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <select
                        value={entry.method}
                        onChange={e => updateSplitEntry(index, 'method', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {Object.entries(PAYMENT_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.amount}
                          onChange={e => updateSplitEntry(index, 'amount', e.target.value)}
                          onFocus={() => !entry.amount && autoFillRemaining(index)}
                          placeholder="0.00"
                          className="pr-8 text-sm"
                        />
                      </div>
                      {splitEntries.length > 2 && (
                        <Button variant="ghost" size="sm" onClick={() => removeSplitEntry(index)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* Add row */}
                  <Button variant="outline" size="sm" onClick={addSplitEntry} className="w-full gap-2 text-xs">
                    <Plus className="w-3 h-3" /> Add Payment Method
                  </Button>

                  {/* Running total indicator */}
                  <div className={`text-xs font-semibold flex justify-between pt-1 border-t border-border ${
                    Math.abs(splitRemaining) < 0.01 ? 'text-green-600' :
                    splitRemaining > 0 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    <span>
                      {Math.abs(splitRemaining) < 0.01
                        ? '✓ Fully allocated'
                        : splitRemaining > 0
                        ? `Still needed:`
                        : `Over by:`}
                    </span>
                    {Math.abs(splitRemaining) >= 0.01 && (
                      <span>{formatCurrency(Math.abs(splitRemaining))}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Checkout buttons */}
              <Button
                onClick={handleCheckout}
                disabled={cart.length === 0 || !currentStore || !splitValid}
                className="w-full bg-green-600 text-white hover:bg-green-700 text-lg py-6 font-semibold"
              >
                Complete Sale
              </Button>
              <Button onClick={() => setCart([])} variant="outline" className="w-full" disabled={cart.length === 0}>
                Clear Cart
              </Button>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}