'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, AlertCircle, TrendingDown, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProductForm } from '@/components/dialogs/product-form';
import { formatCurrency } from '@/lib/currency';
import {
  getAllProducts,
  createProductSimple,
  updateProductSimple,
} from '@/lib/supabase/products-helper';
import { useStore } from '@/lib/store-context'; // ✅ use existing context

export default function InventoryPage() {
  const { currentStore } = useStore(); // ✅ reads the store selected in sidebar
  const currentStoreId = currentStore?.id ?? null;
  const storeError = !currentStore
    ? 'No store selected. Please select a store from the sidebar.'
    : null;

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'all' | 'low-stock'>('all');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Reload products whenever the active store changes
  useEffect(() => {
    loadProducts(currentStoreId);
  }, [currentStoreId]);

  const loadProducts = async (storeId?: string | null) => {
    setLoading(true);
    try {
      const data = await getAllProducts(storeId);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Failed to load products. Please check your database connection.');
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    return [...new Set(products.map(p => p.category))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let results = products;

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        p.sku.toLowerCase().includes(lower)
      );
    }

    if (selectedCategory) {
      results = results.filter(p => p.category === selectedCategory);
    }

    if (viewType === 'low-stock') {
      results = results.filter(p => p.stock <= p.lowStockThreshold);
    }

    return results;
  }, [searchQuery, selectedCategory, viewType, products]);

  const stats = useMemo(() => {
    const lowStockCount = products.filter(p => p.stock <= p.lowStockThreshold).length;
    const totalValue = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
    const outOfStock = products.filter(p => p.stock === 0).length;
    return { lowStockCount, totalValue, outOfStock };
  }, [products]);

  const handleProductSubmit = async (productData: any) => {
    if (!currentStoreId) {
      alert('No store selected. Please select a store from the sidebar first.');
      return;
    }

    try {
      if (editingProduct) {
        const updated = await updateProductSimple(editingProduct.id, {
          name: productData.name,
          category: productData.category,
          price: Number(productData.price),
          cost: Number(productData.cost),
          stock: Number(productData.stock),
          lowStockThreshold: Number(productData.lowStockThreshold),
          barcode: productData.barcode,
        });

        if (updated) {
          alert('Product updated successfully!');
          loadProducts(currentStoreId);
        }
      } else {
        const newProduct = await createProductSimple({
          sku: productData.sku,
          name: productData.name,
          category: productData.category,
          price: Number(productData.price),
          cost: Number(productData.cost),
          stock: Number(productData.stock),
          lowStockThreshold: Number(productData.lowStockThreshold),
          barcode: productData.barcode,
          storeId: currentStoreId, // ✅ auto-injected from sidebar selection
        });

        if (newProduct) {
          alert('Product created successfully!');
          loadProducts(currentStoreId);
        }
      }

      setShowProductForm(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving product:', error);
      alert(`Failed to save product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Manage your product catalog and stock levels</p>
          {currentStore && (
            <p className="text-xs text-muted-foreground mt-1">
              Store: <span className="font-medium text-primary">{currentStore.name}</span>
            </p>
          )}
        </div>
        <Button
          onClick={() => {
            setEditingProduct(null);
            setShowProductForm(true);
          }}
          disabled={!currentStoreId}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      {/* Store Error */}
      {storeError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{storeError}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">{products.length} products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Needs reordering</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.outOfStock}</div>
            <p className="text-xs text-muted-foreground">Unavailable items</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockCount > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {stats.lowStockCount} items are below minimum stock threshold. Consider reordering.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('all')}
            >
              All Products ({products.length})
            </Button>
            <Button
              variant={viewType === 'low-stock' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('low-stock')}
            >
              Low Stock ({stats.lowStockCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>Showing {filteredProducts.length} products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Product</th>
                  <th className="text-left py-3 px-4 font-semibold">SKU</th>
                  <th className="text-left py-3 px-4 font-semibold">Category</th>
                  <th className="text-right py-3 px-4 font-semibold">Price</th>
                  <th className="text-right py-3 px-4 font-semibold">Cost</th>
                  <th className="text-right py-3 px-4 font-semibold">Stock</th>
                  <th className="text-center py-3 px-4 font-semibold">Status</th>
                  <th className="text-center py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    let statusColor = 'bg-green-100 text-green-800';
                    let statusText = 'In Stock';

                    if (product.stock === 0) {
                      statusColor = 'bg-red-100 text-red-800';
                      statusText = 'Out of Stock';
                    } else if (product.stock <= product.lowStockThreshold) {
                      statusColor = 'bg-yellow-100 text-yellow-800';
                      statusText = 'Low Stock';
                    }

                    return (
                      <tr key={product.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 font-medium">{product.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{product.sku}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{product.category}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold">{formatCurrency(product.price)}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(product.cost)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-semibold">{product.stock}</span>
                          <span className="text-muted-foreground text-xs ml-1">/ {product.lowStockThreshold} min</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={statusColor}>{statusText}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingProduct(product);
                              setShowProductForm(true);
                            }}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Product Form Modal */}
      {showProductForm && (
        <ProductForm
          onClose={() => {
            setShowProductForm(false);
            setEditingProduct(null);
          }}
          onSubmit={handleProductSubmit}
          initialProduct={editingProduct}
        />
      )}
    </div>
  );
}