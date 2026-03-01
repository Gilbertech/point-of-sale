'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Transaction, CartItem } from './types';


interface SalesContextType {
  transactions: Transaction[];
  currentCart: CartItem[];
  addToCart: (productId: string, quantity: number, price: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartItem: (productId: string, quantity: number) => void;
  clearCart: () => void;
  completeTransaction: (transaction: Omit<Transaction, 'id'>) => Transaction;
  getTransactions: (storeId: string) => Transaction[];
  refundTransaction: (transactionId: string) => void;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export function SalesProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [currentCart, setCurrentCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((productId: string, quantity: number, price: number) => {
    setCurrentCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { productId, quantity, price }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCurrentCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const updateCartItem = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCurrentCart(prev =>
        prev.map(item =>
          item.productId === productId ? { ...item, quantity } : item
        )
      );
    }
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCurrentCart([]);
  }, []);

  const completeTransaction = useCallback((transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `trans-${Date.now()}`,
    };

    setTransactions(prev => [...prev, newTransaction]);
    setCurrentCart([]);

    return newTransaction;
  }, []);

  const getTransactions = useCallback((storeId: string) => {
    return transactions.filter(t => t.storeId === storeId);
  }, [transactions]);

  const refundTransaction = useCallback((transactionId: string) => {
    setTransactions(prev =>
      prev.map(t =>
        t.id === transactionId ? { ...t, status: 'refunded' } : t
      )
    );
  }, []);

  return (
    <SalesContext.Provider
      value={{
        transactions,
        currentCart,
        addToCart,
        removeFromCart,
        updateCartItem,
        clearCart,
        completeTransaction,
        getTransactions,
        refundTransaction,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const context = useContext(SalesContext);
  if (!context) {
    throw new Error('useSales must be used within a SalesProvider');
  }
  return context;
}
