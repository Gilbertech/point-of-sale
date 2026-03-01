export interface CashDrawerSession {
  id: string;
  cashierId: string;
  storeId: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  variance?: number;
  openedAt: Date;
  closedAt?: Date;
  status: 'open' | 'closed';
  notes?: string;
  transactions: string[]; // transaction IDs
}

interface CashDrawerStore {
  [key: string]: CashDrawerSession;
}

let cashDrawerSessions: CashDrawerStore = {};

function loadCashDrawers() {
  try {
    const stored = localStorage.getItem('pos_cash_drawers');
    if (stored) {
      cashDrawerSessions = JSON.parse(stored);
    }
  } catch {
    cashDrawerSessions = {};
  }
}

function saveCashDrawers() {
  try {
    localStorage.setItem('pos_cash_drawers', JSON.stringify(cashDrawerSessions));
  } catch {
    console.error('Failed to save cash drawer sessions');
  }
}

export function openCashDrawer(
  cashierId: string,
  storeId: string,
  openingAmount: number
): CashDrawerSession {
  loadCashDrawers();

  const sessionId = `drawer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const session: CashDrawerSession = {
    id: sessionId,
    cashierId,
    storeId,
    openingAmount,
    openedAt: new Date(),
    status: 'open',
    transactions: [],
  };

  cashDrawerSessions[sessionId] = session;
  saveCashDrawers();

  // Log to audit trail
  try {
    const { AuditLogger } = require('./audit-logger');
    AuditLogger.log(cashierId, 'CASH_DRAWER_OPENED', 'cash_drawer', sessionId, storeId, {
      openingAmount,
    });
  } catch {
    console.log('Audit logging not yet initialized');
  }

  return session;
}

export function closeCashDrawer(
  sessionId: string,
  closingAmount: number,
  notes?: string
): CashDrawerSession | null {
  loadCashDrawers();

  const session = cashDrawerSessions[sessionId];
  if (!session) return null;

  const expectedAmount = session.openingAmount;
  const variance = closingAmount - expectedAmount;

  session.closingAmount = closingAmount;
  session.expectedAmount = expectedAmount;
  session.variance = variance;
  session.closedAt = new Date();
  session.status = 'closed';
  session.notes = notes;

  cashDrawerSessions[sessionId] = session;
  saveCashDrawers();

  // Log to audit trail
  try {
    const { AuditLogger } = require('./audit-logger');
    AuditLogger.log(session.cashierId, 'CASH_DRAWER_CLOSED', 'cash_drawer', sessionId, session.storeId, {
      openingAmount: session.openingAmount,
      closingAmount,
      variance,
      notes,
    });
  } catch {
    console.log('Audit logging not yet initialized');
  }

  return session;
}

export function getCashDrawerSession(sessionId: string): CashDrawerSession | null {
  loadCashDrawers();
  return cashDrawerSessions[sessionId] || null;
}

export function getActiveCashDrawer(cashierId: string): CashDrawerSession | null {
  loadCashDrawers();

  for (const key in cashDrawerSessions) {
    const session = cashDrawerSessions[key];
    if (session.cashierId === cashierId && session.status === 'open') {
      return session;
    }
  }
  return null;
}

export function addTransactionToDrawer(sessionId: string, transactionId: string): boolean {
  loadCashDrawers();

  const session = cashDrawerSessions[sessionId];
  if (!session) return false;

  if (!session.transactions.includes(transactionId)) {
    session.transactions.push(transactionId);
    saveCashDrawers();
  }

  return true;
}

export function getCashDrawerHistory(
  cashierId: string,
  storeId: string,
  limit?: number
): CashDrawerSession[] {
  loadCashDrawers();

  let results = Object.values(cashDrawerSessions).filter(
    session => session.cashierId === cashierId && session.storeId === storeId
  );

  results.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

  if (limit) {
    results = results.slice(0, limit);
  }

  return results;
}

export function getAllSessions(): CashDrawerSession[] {
  loadCashDrawers();
  return Object.values(cashDrawerSessions);
}

export function getCashDrawerStats(storeId: string) {
  loadCashDrawers();

  const sessions = Object.values(cashDrawerSessions).filter(s => s.storeId === storeId);
  const closedSessions = sessions.filter(s => s.status === 'closed');

  const totalVariance = closedSessions.reduce((sum, s) => sum + (s.variance || 0), 0);
  const avgVariance = closedSessions.length > 0 ? totalVariance / closedSessions.length : 0;
  const overages = closedSessions.filter(s => (s.variance || 0) > 0).length;
  const shortages = closedSessions.filter(s => (s.variance || 0) < 0).length;

  return {
    totalSessions: sessions.length,
    activeSessions: sessions.filter(s => s.status === 'open').length,
    closedSessions: closedSessions.length,
    totalVariance,
    avgVariance,
    overages,
    shortages,
  };
}

export function clearCashDrawers() {
  cashDrawerSessions = {};
  localStorage.removeItem('pos_cash_drawers');
}

// Export as namespace object
export const CashDrawer = {
  openCashDrawer,
  closeCashDrawer,
  getCashDrawerSession,
  getActiveCashDrawer,
  addTransactionToDrawer,
  getCashDrawerHistory,
  getAllSessions,
  getCashDrawerStats,
  clearCashDrawers,
};