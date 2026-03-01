// Audit Log System for tracking all POS operations
export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  module: 'sales' | 'inventory' | 'customers' | 'reports' | 'settings';
  description: string;
  changes?: Record<string, { before: any; after: any }>;
  metadata?: Record<string, any>;
}

class AuditLogger {
  private logs: AuditLog[] = [];
  private maxLogs = 1000;

  log(auditLog: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const log: AuditLog = {
      ...auditLog,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    this.logs.push(log);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to localStorage for persistence
    this.saveLogs();
    console.log('[Audit Log]', log);

    return log;
  }

  getLogs(filters?: { module?: string; userId?: string; action?: string }): AuditLog[] {
    if (!filters) return this.logs;

    return this.logs.filter(log => {
      if (filters.module && log.module !== filters.module) return false;
      if (filters.userId && log.userId !== filters.userId) return false;
      if (filters.action && log.action !== filters.action) return false;
      return true;
    });
  }

  private saveLogs(): void {
    try {
      localStorage.setItem('pos_audit_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save audit logs:', error);
    }
  }

  loadLogs(): void {
    try {
      const saved = localStorage.getItem('pos_audit_logs');
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  }

  clearLogs(): void {
    this.logs = [];
    localStorage.removeItem('pos_audit_logs');
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const auditLogger = new AuditLogger();

// Initialize on import
if (typeof window !== 'undefined') {
  auditLogger.loadLogs();
}
