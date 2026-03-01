// Split Payment Support System
import { AuditLogger } from './audit-logger';

export interface PaymentMethod {
  method: 'cash' | 'card' | 'check' | 'mobile' | 'other';
  amount: number;
  reference?: string; // for card/check reference numbers
}

export interface SplitPaymentTransaction {
  id: string;
  transactionId: string;
  totalAmount: number;
  payments: PaymentMethod[];
  status: 'completed' | 'partial' | 'pending';
  createdAt: Date;
  createdBy: string;
  storeId: string;
}

const SPLIT_PAYMENTS_KEY = 'pos_split_payments';

export class SplitPayment {
  static createSplitPayment(
    transactionId: string,
    totalAmount: number,
    userId: string,
    storeId: string,
    payments: PaymentMethod[]
  ): SplitPaymentTransaction | { error: string } {
    // Validate payment amounts
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    
    if (Math.abs(totalPaid - totalAmount) > 0.01) {
      return { error: `Payment total (${totalPaid}) does not match transaction total (${totalAmount})` };
    }

    const splitPayment: SplitPaymentTransaction = {
      id: `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId,
      totalAmount,
      payments,
      status: 'completed',
      createdAt: new Date(),
      createdBy: userId,
      storeId,
    };

    this.saveTransaction(splitPayment);

    // Log each payment method
    payments.forEach((payment, index) => {
      AuditLogger.log(
        userId,
        'SPLIT_PAYMENT_RECEIVED',
        'split_payment',
        splitPayment.id,
        storeId,
        {
          paymentNumber: index + 1,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
        }
      );
    });

    return splitPayment;
  }

  static addPayment(
    splitPaymentId: string,
    payment: PaymentMethod,
    userId: string,
    storeId: string
  ): SplitPaymentTransaction | null {
    const transaction = this.getTransaction(splitPaymentId);
    if (!transaction) return null;

    transaction.payments.push(payment);
    const totalPaid = transaction.payments.reduce((sum, p) => sum + p.amount, 0);
    
    if (totalPaid >= transaction.totalAmount) {
      transaction.status = 'completed';
    } else if (totalPaid > 0) {
      transaction.status = 'partial';
    }

    this.saveTransaction(transaction);

    AuditLogger.log(
      userId,
      'SPLIT_PAYMENT_ADDED',
      'split_payment',
      splitPaymentId,
      storeId,
      {
        method: payment.method,
        amount: payment.amount,
        totalPaid,
      }
    );

    return transaction;
  }

  static getTransaction(id: string): SplitPaymentTransaction | undefined {
    const transactions = this.getAllTransactions();
    return transactions.find(t => t.id === id);
  }

  static getTransactionByOriginal(transactionId: string): SplitPaymentTransaction | undefined {
    const transactions = this.getAllTransactions();
    return transactions.find(t => t.transactionId === transactionId);
  }

  static getAllTransactions(): SplitPaymentTransaction[] {
    const stored = localStorage.getItem(SPLIT_PAYMENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static validatePaymentAmount(amount: number, expectedTotal: number, tolerance: number = 0.01): boolean {
    return Math.abs(amount - expectedTotal) <= tolerance;
  }

  static calculatePaymentBreakdown(totalAmount: number, methods: string[]): Record<string, number> {
    const perMethod = totalAmount / methods.length;
    const breakdown: Record<string, number> = {};
    
    methods.forEach((method, index) => {
      if (index === methods.length - 1) {
        // Last method gets the remainder to handle rounding
        breakdown[method] = totalAmount - (perMethod * (methods.length - 1));
      } else {
        breakdown[method] = perMethod;
      }
    });

    return breakdown;
  }

  static generateSplitPaymentReport(startDate: Date, endDate: Date): {
    totalTransactions: number;
    totalAmount: number;
    byMethod: Record<string, { count: number; total: number }>;
  } {
    const transactions = this.getAllTransactions().filter(t => {
      const tDate = new Date(t.createdAt);
      return tDate >= startDate && tDate <= endDate;
    });

    const report = {
      totalTransactions: transactions.length,
      totalAmount: 0,
      byMethod: {} as Record<string, { count: number; total: number }>,
    };

    transactions.forEach(t => {
      report.totalAmount += t.totalAmount;
      t.payments.forEach(p => {
        if (!report.byMethod[p.method]) {
          report.byMethod[p.method] = { count: 0, total: 0 };
        }
        report.byMethod[p.method].count++;
        report.byMethod[p.method].total += p.amount;
      });
    });

    return report;
  }

  private static saveTransaction(transaction: SplitPaymentTransaction): void {
    const transactions = this.getAllTransactions();
    const index = transactions.findIndex(t => t.id === transaction.id);
    if (index >= 0) {
      transactions[index] = transaction;
    } else {
      transactions.push(transaction);
    }
    localStorage.setItem(SPLIT_PAYMENTS_KEY, JSON.stringify(transactions));
  }
}
