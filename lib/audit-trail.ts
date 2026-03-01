import { AuditLog } from './types';

// In-memory audit log store (replace with database in production)
let auditLogs: AuditLog[] = [];

// Load audit logs from localStorage
function loadAuditLogs() {
  try {
    const stored = localStorage.getItem('pos_audit_logs');
    if (stored) {
      auditLogs = JSON.parse(stored);
    }
  } catch {
    auditLogs = [];
  }
}

// Save audit logs to localStorage
function saveAuditLogs() {
  try {
    localStorage.setItem('pos_audit_logs', JSON.stringify(auditLogs));
  } catch {
    console.error('Failed to save audit logs');
  }
}

export function logAuditTrail(
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  storeId: string,
  changes?: Record<string, any>
): AuditLog {
  loadAuditLogs();

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

  auditLogs.push(auditLog);
  saveAuditLogs();

  return auditLog;
}

export function getAuditLogs(filters?: {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  storeId?: string;
}): AuditLog[] {
  loadAuditLogs();

  let results = [...auditLogs];

  if (filters?.userId) {
    results = results.filter(log => log.userId === filters.userId);
  }

  if (filters?.action) {
    results = results.filter(log => log.action === filters.action);
  }

  if (filters?.resource) {
    results = results.filter(log => log.resource === filters.resource);
  }

  if (filters?.storeId) {
    results = results.filter(log => log.storeId === filters.storeId);
  }

  if (filters?.startDate) {
    results = results.filter(log => log.createdAt >= filters.startDate!);
  }

  if (filters?.endDate) {
    results = results.filter(log => log.createdAt <= filters.endDate!);
  }

  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function clearAuditLogs() {
  auditLogs = [];
  localStorage.removeItem('pos_audit_logs');
}

export function getAuditLogStats(storeId: string) {
  loadAuditLogs();

  const storeLogs = auditLogs.filter(log => log.storeId === storeId);

  const actionCounts = storeLogs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const resourceCounts = storeLogs.reduce((acc, log) => {
    acc[log.resource] = (acc[log.resource] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalLogs: storeLogs.length,
    actionCounts,
    resourceCounts,
    lastLog: storeLogs[0] || null,
  };
}
