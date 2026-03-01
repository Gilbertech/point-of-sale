'use client';
// app/dashboard/sales/page.tsx
// ✅ Filters products by currentStore.id — reloads on store switch
// ✅ transaction_items receives store_id (fixes NOT NULL constraint)
// ✅ Fixed: "Unknown error" for cashiers — better error surfacing + safe throw

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store-context';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ShoppingCart, Plus, Minus, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { formatCurrency } from '@/lib/currency';
import { getAllProducts, updateProductSimple } from '@/lib/supabase/products-helper';
import { getAllCustomers } from '@/lib/supabase/customers-helper';
import { supabase } from '@/lib/supabase/client';

export default function SalesPage() {
  const { currentStore } = useStore();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'check' | 'other'>('cash');
  const [discount, setDiscount] = useState(0);

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

  const cartItems = useMemo(() => {
    return cart.map(item => {
      const product = products.find(p => p.id === item.productId);
      return product ? { ...item, product } : null;
    }).filter(Boolean);
  }, [cart, products]);

  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => {
      if (!item) return sum;
      return sum + (item.product.price * item.quantity);
    }, 0);
    const tax = (subtotal - discount) * (currentStore?.taxRate || 0.08);
    const total = subtotal + tax - discount;
    return { subtotal, tax, discount, total };
  }, [cartItems, discount, currentStore?.taxRate]);

  const addToCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) removeFromCart(productId);
    else setCart(prev => prev.map(item => item.productId === productId ? { ...item, quantity } : item));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const handleBarcodeScan = (sku: string, barcode: string) => {
    const product = products.find(p =>
      p.sku.toLowerCase() === sku.toLowerCase() ||
      p.barcode?.toLowerCase() === barcode.toLowerCase()
    );
    if (product) addToCart(product.id);
    else alert(`Product not found: ${sku}`);
  };

  // ✅ KEY FIX: Helper to extract a readable message from any thrown value
  const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) {
      const e = error as any;
      // Supabase errors have .message and optionally .details / .hint / .code
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

  const handleCheckout = async () => {
    if (cart.length === 0) { alert('Cart is empty'); return; }
    if (!currentStore?.id) {
      alert('No store selected. Please select a branch before completing a sale.');
      return;
    }

    try {
      const transactionNumber = `TXN${Date.now().toString().slice(-8)}`;
      const storeId = currentStore.id;

      // ✅ FIX: cashier_id must exist in app_users. If the cashier's auth.uid is
      // not yet in app_users (common for newly-invited cashiers), skip it to avoid
      // FK violation. The column should be nullable in your schema.
      let resolvedCashierId: string | null = user?.id ?? null;
      if (resolvedCashierId) {
        const { data: userRow } = await supabase
          .from('app_users')
          .select('id')
          .eq('id', resolvedCashierId)
          .maybeSingle();
        if (!userRow) {
          console.warn(`[Checkout] cashier ${resolvedCashierId} not found in app_users — setting cashier_id to null`);
          resolvedCashierId = null;
        }
      }

      // 1. Insert transaction header
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .insert([{
          transaction_number: transactionNumber,
          subtotal: totals.subtotal,
          tax: totals.tax,
          discount: totals.discount,
          total: totals.total,
          payment_method: paymentMethod,
          customer_id: selectedCustomer || null,
          store_id: storeId,
          cashier_id: resolvedCashierId, // ✅ safe, verified value
          status: 'completed',
        }])
        .select()
        .single();

      if (txnErr) {
        // ✅ Surface the real Supabase error instead of throwing a plain Error
        console.error('[Checkout] Transaction insert error:', txnErr);
        throw txnErr; // throw the raw Supabase error object
      }

      // 2. Insert transaction items
      const itemRows = cartItems.map(item => ({
        transaction_id: txn.id,
        product_id: item!.productId,
        product_name: item!.product.name,
        quantity: item!.quantity,
        price: item!.product.price,
        subtotal: item!.product.price * item!.quantity,
        store_id: storeId,
      }));

      const { error: itemsErr } = await supabase.from('transaction_items').insert(itemRows);
      if (itemsErr) {
        console.error('[Checkout] Transaction items insert error:', itemsErr);
        // Rollback the header to keep DB consistent
        await supabase.from('transactions').delete().eq('id', txn.id);
        throw itemsErr;
      }

      // 3. Deduct stock
      for (const item of cartItems) {
        if (item) await updateProductSimple(item.productId, { stock: item.product.stock - item.quantity });
      }

      const customerName = selectedCustomer
        ? customers.find(c => c.id === selectedCustomer)?.firstName
        : 'Walk-in';

      alert(`Transaction Completed!\n\nReceipt #${transactionNumber}\nTotal: ${formatCurrency(totals.total)}\nPayment: ${paymentMethod.toUpperCase()}\n\nCustomer: ${customerName}`);

      setCart([]);
      setDiscount(0);
      setSelectedCustomer('');
      setPaymentMethod('cash');
      loadData();
    } catch (error) {
      console.error('[Checkout] Full error object:', error);
      // ✅ Now shows the real Supabase error message to the user
      alert(`Failed to complete transaction:\n\n${extractErrorMessage(error)}`);
    }
  };

  const lowStockWarnings = useMemo(() => cartItems.filter(item => item && item.product.stock - item.quantity < 0), [cartItems]);

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
        {/* Products */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Products</CardTitle>
              <CardDescription>{products.length} products at {currentStore?.name ?? '—'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant={selectedCategory === null ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(null)}>All</Button>
                {categories.map(category => (
                  <Button key={category} variant={selectedCategory === category ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(category)}>{category}</Button>
                ))}
              </div>
              {products.length === 0 && currentStore ? (
                <div className="text-center py-12 text-muted-foreground">No products found for {currentStore.name}</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="border border-border rounded-lg p-3 hover:bg-muted transition-colors cursor-pointer" onClick={() => addToCart(product.id)}>
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

        {/* Cart */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><ShoppingCart className="w-5 h-5" />Cart</CardTitle>
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
                          <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)} className="h-6 w-6 p-0"><X className="w-4 h-4" /></Button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 bg-muted rounded">
                            <Button variant="ghost" size="sm" onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="h-6 w-6 p-0"><Minus className="w-3 h-3" /></Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button variant="ghost" size="sm" onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="h-6 w-6 p-0"><Plus className="w-3 h-3" /></Button>
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

          <Card>
            <CardHeader><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
            <CardContent>
              <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Walk-in Customer</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>{customer.firstName} {customer.lastName}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(totals.subtotal)}</span></div>
                <div className="flex justify-between"><span>Discount:</span><span className="text-destructive">-{formatCurrency(totals.discount)}</span></div>
                <div className="flex justify-between"><span>Tax ({((currentStore?.taxRate || 0.08) * 100).toFixed(0)}%):</span><span>{formatCurrency(totals.tax)}</span></div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                  <span>Total:</span><span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold">Discount Amount</label>
                <Input type="number" min="0" value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value)))} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <Button onClick={handleCheckout} disabled={cart.length === 0 || !currentStore} className="w-full bg-green-600 text-white hover:bg-green-700 text-lg py-6 font-semibold">
                Complete Sale
              </Button>
              <Button onClick={() => setCart([])} variant="outline" className="w-full" disabled={cart.length === 0}>Clear Cart</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}