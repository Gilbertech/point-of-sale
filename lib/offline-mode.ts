// Offline Mode Support System
import { AuditLogger } from './audit-logger';

export interface OfflineTransaction {
  id: string;
  transactionId: string;
  data: Record<string, any>;
  timestamp: Date;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
  lastAttempt?: Date;
  error?: string;
}

const OFFLINE_TRANSACTIONS_KEY = 'pos_offline_transactions';
const OFFLINE_STATUS_KEY = 'pos_offline_status';

export class OfflineMode {
  static isOnline(): boolean {
    return typeof window !== 'undefined' && navigator.onLine;
  }

  static queueTransaction(
    transactionId: string,
    data: Record<string, any>,
    userId: string,
    storeId: string
  ): OfflineTransaction {
    const offlineTransaction: OfflineTransaction = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId,
      data,
      timestamp: new Date(),
      status: 'pending',
      attempts: 0,
    };

    this.saveTransaction(offlineTransaction);

    AuditLogger.log(
      userId,
      'TRANSACTION_QUEUED_OFFLINE',
      'transaction',
      transactionId,
      storeId,
      { offlineId: offlineTransaction.id }
    );

    return offlineTransaction;
  }

  static getPendingTransactions(): OfflineTransaction[] {
    const transactions = this.getAllTransactions();
    return transactions.filter(t => t.status === 'pending');
  }

  static markAsSynced(offlineId: string, userId: string, storeId: string): OfflineTransaction | null {
    const transaction = this.getTransaction(offlineId);
    if (!transaction) return null;

    transaction.status = 'synced';
    transaction.lastAttempt = new Date();
    this.saveTransaction(transaction);

    AuditLogger.log(
      userId,
      'OFFLINE_TRANSACTION_SYNCED',
      'transaction',
      transaction.transactionId,
      storeId,
      { offlineId }
    );

    return transaction;
  }

  static markAsFailed(offlineId: string, error: string, userId: string, storeId: string): OfflineTransaction | null {
    const transaction = this.getTransaction(offlineId);
    if (!transaction) return null;

    transaction.attempts++;
    transaction.status = transaction.attempts >= 3 ? 'failed' : 'pending';
    transaction.lastAttempt = new Date();
    transaction.error = error;
    this.saveTransaction(transaction);

    AuditLogger.log(
      userId,
      'OFFLINE_TRANSACTION_FAILED',
      'transaction',
      transaction.transactionId,
      storeId,
      { offlineId, error, attempts: transaction.attempts }
    );

    return transaction;
  }

  static getTransaction(id: string): OfflineTransaction | undefined {
    const transactions = this.getAllTransactions();
    return transactions.find(t => t.id === id);
  }

  static getAllTransactions(): OfflineTransaction[] {
    const stored = localStorage.getItem(OFFLINE_TRANSACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static getFailedTransactions(): OfflineTransaction[] {
    const transactions = this.getAllTransactions();
    return transactions.filter(t => t.status === 'failed');
  }

  static getSyncedTransactions(): OfflineTransaction[] {
    const transactions = this.getAllTransactions();
    return transactions.filter(t => t.status === 'synced');
  }

  static retryFailedTransaction(offlineId: string): OfflineTransaction | null {
    const transaction = this.getTransaction(offlineId);
    if (!transaction) return null;

    transaction.status = 'pending';
    transaction.attempts = 0;
    transaction.error = undefined;
    transaction.lastAttempt = undefined;
    this.saveTransaction(transaction);

    return transaction;
  }

  static getOfflineStatus(): {
    isOnline: boolean;
    pendingCount: number;
    syncedCount: number;
    failedCount: number;
    lastSync?: Date;
  } {
    const stored = localStorage.getItem(OFFLINE_STATUS_KEY);
    const status = stored ? JSON.parse(stored) : { lastSync: undefined };

    const transactions = this.getAllTransactions();

    return {
      isOnline: this.isOnline(),
      pendingCount: transactions.filter(t => t.status === 'pending').length,
      syncedCount: transactions.filter(t => t.status === 'synced').length,
      failedCount: transactions.filter(t => t.status === 'failed').length,
      lastSync: status.lastSync ? new Date(status.lastSync) : undefined,
    };
  }

  static recordSyncAttempt(): void {
    const status = {
      lastSync: new Date().toISOString(),
    };
    localStorage.setItem(OFFLINE_STATUS_KEY, JSON.stringify(status));
  }

  static exportOfflineData(): Record<string, any> {
    const transactions = this.getAllTransactions();
    const status = this.getOfflineStatus();

    return {
      exportDate: new Date().toISOString(),
      status,
      transactions,
      pending: transactions.filter(t => t.status === 'pending'),
      synced: transactions.filter(t => t.status === 'synced'),
      failed: transactions.filter(t => t.status === 'failed'),
    };
  }

  static clearSyncedTransactions(): number {
    const transactions = this.getAllTransactions();
    const pending = transactions.filter(t => t.status !== 'synced');
    localStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(pending));
    return transactions.length - pending.length;
  }

  static setupOfflineListener(callback: (isOnline: boolean) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  private static saveTransaction(transaction: OfflineTransaction): void {
    const transactions = this.getAllTransactions();
    const index = transactions.findIndex(t => t.id === transaction.id);
    if (index >= 0) {
      transactions[index] = transaction;
    } else {
      transactions.push(transaction);
    }
    localStorage.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(transactions));
  }
}
