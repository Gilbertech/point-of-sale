// Session and Activity Logging System
import { AuditLog } from './types';

interface SessionLog {
  sessionId: string;
  userId: string;
  loginTime: Date;
  logoutTime?: Date;
  duration?: number; // in minutes
  storeId: string;
  ipAddress?: string;
  status: 'active' | 'expired' | 'manual_logout';
  activityCount: number;
  lastActivityTime: Date;
}

interface ActivityLog {
  id: string;
  sessionId: string;
  userId: string;
  action: string;
  timestamp: Date;
  details?: Record<string, any>;
}

const SESSION_LOGS_KEY = 'pos_session_logs';
const ACTIVITY_LOGS_KEY = 'pos_activity_logs';

export class SessionLogger {
  static createSessionLog(sessionId: string, userId: string, storeId: string): SessionLog {
    const log: SessionLog = {
      sessionId,
      userId,
      loginTime: new Date(),
      storeId,
      status: 'active',
      activityCount: 0,
      lastActivityTime: new Date(),
    };
    
    this.saveSessionLog(log);
    return log;
  }

  static endSessionLog(sessionId: string, status: 'expired' | 'manual_logout' = 'manual_logout'): SessionLog | null {
    const logs = this.getAllSessionLogs();
    const sessionLog = logs.find(log => log.sessionId === sessionId);
    
    if (!sessionLog) return null;

    sessionLog.logoutTime = new Date();
    sessionLog.status = status;
    sessionLog.duration = Math.round(
      (sessionLog.logoutTime.getTime() - sessionLog.loginTime.getTime()) / 60000
    );

    const updatedLogs = logs.map(log => log.sessionId === sessionId ? sessionLog : log);
    localStorage.setItem(SESSION_LOGS_KEY, JSON.stringify(updatedLogs));

    return sessionLog;
  }

  static logActivity(sessionId: string, userId: string, action: string, details?: Record<string, any>): ActivityLog {
    const activity: ActivityLog = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      userId,
      action,
      timestamp: new Date(),
      details,
    };

    const activities = this.getAllActivityLogs();
    activities.push(activity);
    localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(activities));

    // Update activity count in session log
    const logs = this.getAllSessionLogs();
    const sessionLog = logs.find(log => log.sessionId === sessionId);
    if (sessionLog) {
      sessionLog.activityCount++;
      sessionLog.lastActivityTime = new Date();
      const updatedLogs = logs.map(log => log.sessionId === sessionId ? sessionLog : log);
      localStorage.setItem(SESSION_LOGS_KEY, JSON.stringify(updatedLogs));
    }

    return activity;
  }

  static getSessionLog(sessionId: string): SessionLog | undefined {
    const logs = this.getAllSessionLogs();
    return logs.find(log => log.sessionId === sessionId);
  }

  static getAllSessionLogs(): SessionLog[] {
    const stored = localStorage.getItem(SESSION_LOGS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static getSessionActivities(sessionId: string): ActivityLog[] {
    const logs = this.getAllActivityLogs();
    return logs.filter(log => log.sessionId === sessionId);
  }

  static getAllActivityLogs(): ActivityLog[] {
    const stored = localStorage.getItem(ACTIVITY_LOGS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static getSessionsByUser(userId: string): SessionLog[] {
    const logs = this.getAllSessionLogs();
    return logs.filter(log => log.userId === userId);
  }

  static getActiveSessions(): SessionLog[] {
    const logs = this.getAllSessionLogs();
    return logs.filter(log => log.status === 'active');
  }

  static clearOldLogs(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const sessions = this.getAllSessionLogs().filter(log => new Date(log.loginTime) > cutoffDate);
    const activities = this.getAllActivityLogs().filter(log => new Date(log.timestamp) > cutoffDate);

    localStorage.setItem(SESSION_LOGS_KEY, JSON.stringify(sessions));
    localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(activities));
  }

  static exportSessionReport(startDate: Date, endDate: Date): SessionLog[] {
    const logs = this.getAllSessionLogs();
    return logs.filter(log => {
      const logDate = new Date(log.loginTime);
      return logDate >= startDate && logDate <= endDate;
    });
  }
}
