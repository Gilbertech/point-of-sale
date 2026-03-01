'use client';
// lib/store-context.tsx
// Single source of truth for the "active store" across the whole app.
//
// Behaviour:
// • super_admin / admin  → can freely pick any store; selection persisted to localStorage
// • manager / cashier / inventory_staff / customer
//     → always locked to the store assigned in their app_users.store_id;
//       they CANNOT call selectStore (it no-ops for them)
// • On login, auth-context already writes pos_selected_store = user.storeId for workers.
//   This context reads that value on mount so the correct branch shows immediately.

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getAllStores } from '@/lib/supabase/stores-helper';
import { useAuth } from '@/lib/auth-context';

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoreContextType {
  currentStore:   Store | null;
  stores:         Store[];
  loadingStores:  boolean;
  /** Only usable by super_admin / admin — no-ops for everyone else */
  selectStore:    (storeId: string) => void;
  refreshStores:  () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const LS_KEY = 'pos_selected_store';

// Roles that are allowed to freely switch stores
const CAN_SWITCH_STORE = new Set(['super_admin', 'admin']);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [stores,        setStores]        = useState<Store[]>([]);
  const [currentStore,  setCurrentStore]  = useState<Store | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);

  // ── Load stores from Supabase ─────────────────────────────────────────────

  const loadStores = useCallback(async () => {
    setLoadingStores(true);
    try {
      const data = await getAllStores();
      setStores(data);
      return data;
    } catch (err) {
      console.error('[StoreContext] Failed to load stores:', err);
      return [] as Store[];
    } finally {
      setLoadingStores(false);
    }
  }, []);

  // ── Resolve which store to show after stores are loaded ───────────────────

  const resolveCurrentStore = useCallback(
    (allStores: Store[]) => {
      if (!user || allStores.length === 0) {
        setCurrentStore(null);
        return;
      }

      const active = allStores.filter(s => s.isActive);

      if (CAN_SWITCH_STORE.has(user.role)) {
        // Admins: restore last-selected store from localStorage
        const saved = typeof window !== 'undefined'
          ? localStorage.getItem(LS_KEY)
          : null;
        const found = saved ? active.find(s => s.id === saved) : null;
        // Fall back to first active store if saved one no longer exists
        setCurrentStore(found ?? active[0] ?? null);
      } else {
        // Workers: always use their assigned store_id
        const assigned = user.storeId
          ? allStores.find(s => s.id === user.storeId) ?? null
          : null;
        setCurrentStore(assigned);

        // Keep localStorage in sync so page refreshes work correctly
        if (assigned && typeof window !== 'undefined') {
          localStorage.setItem(LS_KEY, assigned.id);
        }
      }
    },
    [user]
  );

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadStores().then(resolveCurrentStore);
  }, [loadStores, resolveCurrentStore]);

  // ── Re-resolve if user changes (login / logout) ───────────────────────────

  useEffect(() => {
    if (stores.length > 0) resolveCurrentStore(stores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Public API: switch store (admins only) ────────────────────────────────

  const selectStore = useCallback(
    (storeId: string) => {
      if (!user || !CAN_SWITCH_STORE.has(user.role)) {
        console.warn('[StoreContext] selectStore called by non-admin role — ignored');
        return;
      }
      const store = stores.find(s => s.id === storeId);
      if (!store) return;
      setCurrentStore(store);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_KEY, storeId);
      }
    },
    [user, stores]
  );

  // ── Refresh (called after branch CRUD in settings) ────────────────────────

  const refreshStores = useCallback(async () => {
    const fresh = await loadStores();
    resolveCurrentStore(fresh);
  }, [loadStores, resolveCurrentStore]);

  return (
    <StoreContext.Provider
      value={{ currentStore, stores, loadingStores, selectStore, refreshStores }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}