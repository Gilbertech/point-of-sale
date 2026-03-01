// Audit Trail Logging System
import { AuditLog } from './types';

const AUDIT_LOGS_KEY = 'pos_audit_logs';

export class AuditLogger {
  static log(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    storeId: string,
    changes?: Record<string, any>
  ): AuditLog {
    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      action,
      resource,
      resourceId,
      changes,
      storeId,
      createdAt: new Date(),
    };

    this.saveLogs([auditLog]);
    return auditLog;
  }

  static logSale(userId: string, transactionId: string, storeId: string, amount: number): AuditLog {
    return this.log(userId, 'SALE_COMPLETED', 'transaction', transactionId, storeId, { amount });
  }

  static logRefund(userId: string, transactionId: string, storeId: string, amount: number): AuditLog {
    return this.log(userId, 'SALE_REFUNDED', 'transaction', transactionId, storeId, { amount });
  }

  static logProductCreated(userId: string, productId: string, storeId: string, productData: Record<string, any>): AuditLog {
    return this.log(userId, 'PRODUCT_CREATED', 'product', productId, storeId, productData);
  }

  static logProductUpdated(userId: string, productId: string, storeId: string, changes: Record<string, any>): AuditLog {
    return this.log(userId, 'PRODUCT_UPDATED', 'product', productId, storeId, changes);
  }

  static logProductDeleted(userId: string, productId: string, storeId: string): AuditLog {
    return this.log(userId, 'PRODUCT_DELETED', 'product', productId, storeId);
  }

  static logInventoryAdjustment(userId: string, productId: string, storeId: string, quantity: number, reason: string): AuditLog {
    return this.log(userId, 'INVENTORY_ADJUSTED', 'inventory', productId, storeId, { quantity, reason });
  }

  static logCashDrawerOpen(userId: string, storeId: string, amount: number): AuditLog {
    return this.log(userId, 'CASH_DRAWER_OPENED', 'cash_drawer', 'drawer_1', storeId, { amount });
  }

  static logCashDrawerClose(userId: string, storeId: string, amount: number): AuditLog {
    return this.log(userId, 'CASH_DRAWER_CLOSED', 'cash_drawer', 'drawer_1', storeId, { amount });
  }

  static logUserLogin(userId: string, storeId: string): AuditLog {
    return this.log(userId, 'USER_LOGIN', 'user', userId, storeId);
  }

  static logUserLogout(userId: string, storeId: string): AuditLog {
    return this.log(userId, 'USER_LOGOUT', 'user', userId, storeId);
  }

  static logSettingsChange(userId: string, storeId: string, changes: Record<string, any>): AuditLog {
    return this.log(userId, 'SETTINGS_CHANGED', 'settings', 'store_settings', storeId, changes);
  }

  static getLogs(filters?: { userId?: string; action?: string; resource?: string; storeId?: string; startDate?: Date; endDate?: Date }): AuditLog[] {
    const logs = this.getAllLogs();

    if (!filters) return logs;

    return logs.filter(log => {
      if (filters.userId && log.userId !== filters.userId) return false;
      if (filters.action && log.action !== filters.action) return false;
      if (filters.resource && log.resource !== filters.resource) return false;
      if (filters.storeId && log.storeId !== filters.storeId) return false;
      if (filters.startDate && new Date(log.createdAt) < filters.startDate) return false;
      if (filters.endDate && new Date(log.createdAt) > filters.endDate) return false;
      return true;
    });
  }

  static getAllLogs(): AuditLog[] {
    const stored = localStorage.getItem(AUDIT_LOGS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static getLogsByUser(userId: string): AuditLog[] {
    return this.getLogs({ userId });
  }

  static getLogsByResource(resource: string, resourceId: string): AuditLog[] {
    const logs = this.getAllLogs();
    return logs.filter(log => log.resource === resource && log.resourceId === resourceId);
  }

  static getLogsByDateRange(startDate: Date, endDate: Date): AuditLog[] {
    return this.getLogs({ startDate, endDate });
  }

  static clearOldLogs(daysToKeep: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const logs = this.getAllLogs().filter(log => new Date(log.createdAt) > cutoffDate);
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
  }

  static exportLogs(format: 'json' | 'csv' = 'json'): string {
    const logs = this.getAllLogs();
    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    } else {
      const headers = ['ID', 'User', 'Action', 'Resource', 'Resource ID', 'Store', 'Date'];
      const rows = logs.map(log => [
        log.id,
        log.userId,
        log.action,
        log.resource,
        log.resourceId,
        log.storeId,
        new Date(log.createdAt).toISOString(),
      ]);
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      return csv;
    }
  }

  private static saveLogs(newLogs: AuditLog[]): void {
    const existing = this.getAllLogs();
    const combined = [...existing, ...newLogs];
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(combined));
  }
}
