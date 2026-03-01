// Backup and Restore System for POS Data
import { MOCK_PRODUCTS, MOCK_CUSTOMERS, MOCK_TRANSACTIONS, MOCK_STORES, MOCK_USERS } from './mock-data';

export interface BackupData {
  version: string;
  timestamp: string;
  data: {
    products: typeof MOCK_PRODUCTS;
    customers: typeof MOCK_CUSTOMERS;
    transactions: typeof MOCK_TRANSACTIONS;
    stores: typeof MOCK_STORES;
    users: typeof MOCK_USERS;
  };
  metadata: {
    totalProducts: number;
    totalCustomers: number;
    totalTransactions: number;
    totalStores: number;
  };
}

class BackupManager {
  private backups: BackupData[] = [];
  private maxBackups = 10;

  createBackup(): BackupData {
    const backup: BackupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      data: {
        products: MOCK_PRODUCTS,
        customers: MOCK_CUSTOMERS,
        transactions: MOCK_TRANSACTIONS,
        stores: MOCK_STORES,
        users: MOCK_USERS,
      },
      metadata: {
        totalProducts: MOCK_PRODUCTS.length,
        totalCustomers: MOCK_CUSTOMERS.length,
        totalTransactions: MOCK_TRANSACTIONS.length,
        totalStores: MOCK_STORES.length,
      },
    };

    this.backups.push(backup);

    // Keep only recent backups
    if (this.backups.length > this.maxBackups) {
      this.backups = this.backups.slice(-this.maxBackups);
    }

    this.saveBackups();
    return backup;
  }

  getBackups(): BackupData[] {
    return this.backups;
  }

  exportBackup(backupIndex: number = -1): string {
    const backup = this.backups[backupIndex] || this.backups[this.backups.length - 1];
    if (!backup) {
      throw new Error('No backup found');
    }
    return JSON.stringify(backup, null, 2);
  }

  downloadBackup(backupIndex: number = -1): void {
    const backup = this.backups[backupIndex] || this.backups[this.backups.length - 1];
    if (!backup) {
      throw new Error('No backup found');
    }

    const data = JSON.stringify(backup, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pos-backup-${backup.timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  restoreBackup(backupIndex: number): void {
    const backup = this.backups[backupIndex];
    if (!backup) {
      throw new Error('Backup not found');
    }

    // In real implementation, this would update the database
    console.log('Restoring backup from', backup.timestamp);
  }

  private saveBackups(): void {
    try {
      localStorage.setItem('pos_backups', JSON.stringify(this.backups));
    } catch (error) {
      console.error('Failed to save backups:', error);
    }
  }

  private loadBackups(): void {
    try {
      const saved = localStorage.getItem('pos_backups');
      if (saved) {
        this.backups = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  }
}

export const backupManager = new BackupManager();

// Initialize on import
if (typeof window !== 'undefined') {
  backupManager['loadBackups']();
}
