'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface CashierSession {
  id: string;
  cashierId: string;
  cashierName: string;
  startTime: Date;
  endTime?: Date;
  totalSales: number;
  transactionCount: number;
  status: 'active' | 'closed';
}

interface CashierSessionContextType {
  currentSession: CashierSession | null;
  allSessions: CashierSession[];
  startSession: (cashierId: string, cashierName: string) => void;
  endSession: () => void;
  recordTransaction: (amount: number) => void;
  getActiveCashiers: () => CashierSession[];
}

const CashierSessionContext = createContext<CashierSessionContextType | undefined>(undefined);

export function CashierSessionProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(null);
  const [allSessions, setAllSessions] = useState<CashierSession[]>([]);

  const startSession = useCallback((cashierId: string, cashierName: string) => {
    const newSession: CashierSession = {
      id: `session-${Date.now()}`,
      cashierId,
      cashierName,
      startTime: new Date(),
      totalSales: 0,
      transactionCount: 0,
      status: 'active',
    };
    setCurrentSession(newSession);
    setAllSessions(prev => [...prev, newSession]);
  }, []);

  const endSession = useCallback(() => {
    if (currentSession) {
      setCurrentSession(prev =>
        prev
          ? {
              ...prev,
              endTime: new Date(),
              status: 'closed',
            }
          : null
      );
      setAllSessions(prev =>
        prev.map(s =>
          s.id === currentSession.id
            ? {
                ...s,
                endTime: new Date(),
                status: 'closed',
              }
            : s
        )
      );
    }
  }, [currentSession]);

  const recordTransaction = useCallback(
    (amount: number) => {
      if (currentSession) {
        setCurrentSession(prev =>
          prev
            ? {
                ...prev,
                totalSales: prev.totalSales + amount,
                transactionCount: prev.transactionCount + 1,
              }
            : null
        );
        setAllSessions(prev =>
          prev.map(s =>
            s.id === currentSession.id
              ? {
                  ...s,
                  totalSales: s.totalSales + amount,
                  transactionCount: s.transactionCount + 1,
                }
              : s
          )
        );
      }
    },
    [currentSession]
  );

  const getActiveCashiers = useCallback(() => {
    return allSessions.filter(s => s.status === 'active');
  }, [allSessions]);

  return (
    <CashierSessionContext.Provider
      value={{
        currentSession,
        allSessions,
        startSession,
        endSession,
        recordTransaction,
        getActiveCashiers,
      }}
    >
      {children}
    </CashierSessionContext.Provider>
  );
}

export function useCashierSession() {
  const context = useContext(CashierSessionContext);
  if (!context) {
    throw new Error('useCashierSession must be used within CashierSessionProvider');
  }
  return context;
}
