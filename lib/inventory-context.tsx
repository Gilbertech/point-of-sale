'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Product, InventoryLog } from './types';


interface InventoryContextType {
  products: Product[];
  inventoryLogs: InventoryLog[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, quantity: number, type: 'purchase' | 'sale' | 'adjustment' | 'return', reason?: string, userId?: string) => void;
  searchProducts: (query: string) => Product[];
  getProductsByCategory: (category: string) => Product[];
  getLowStockProducts: () => Product[];
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);

  const addProduct = useCallback((product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setProducts(prev => [...prev, newProduct]);
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p
      )
    );
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const adjustStock = useCallback(
    (productId: string, quantity: number, type: 'purchase' | 'sale' | 'adjustment' | 'return', reason?: string, userId?: string) => {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const newStock = Math.max(0, product.stock + quantity);
      updateProduct(productId, { stock: newStock });

      const log: InventoryLog = {
        id: `log-${Date.now()}`,
        productId,
        quantity,
        type,
        reason,
        storeId: product.storeId,
        createdBy: userId || 'system',
        createdAt: new Date(),
      };

      setInventoryLogs(prev => [...prev, log]);
    },
    [products, updateProduct]
  );

  const searchProducts = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.sku.toLowerCase().includes(lowerQuery) ||
      p.barcode?.toLowerCase().includes(lowerQuery)
    );
  }, [products]);

  const getProductsByCategory = useCallback((category: string) => {
    return products.filter(p => p.category === category);
  }, [products]);

  const getLowStockProducts = useCallback(() => {
    return products.filter(p => p.stock <= p.lowStockThreshold);
  }, [products]);

  return (
    <InventoryContext.Provider
      value={{
        products,
        inventoryLogs,
        addProduct,
        updateProduct,
        deleteProduct,
        adjustStock,
        searchProducts,
        getProductsByCategory,
        getLowStockProducts,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
