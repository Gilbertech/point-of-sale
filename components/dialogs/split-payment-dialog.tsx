'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { SplitPayment, type PaymentMethod } from '@/lib/split-payment';
import { formatCurrency } from '@/lib/currency';

interface SplitPaymentDialogProps {
  totalAmount: number;
  onClose: () => void;
  onSubmit: (payments: PaymentMethod[]) => void;
}

export function SplitPaymentDialog({ totalAmount, onClose, onSubmit }: SplitPaymentDialogProps) {
  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'check' | 'mobile' | 'other'>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = totalAmount - totalPaid;
  const isComplete = Math.abs(remainingAmount) < 0.01;

  const handleAddPayment = () => {
    if (!amount || Number(amount) <= 0) return;

    const payment: PaymentMethod = {
      method: selectedMethod,
      amount: Number(amount),
      ...(reference && { reference }),
    };

    setPayments([...payments, payment]);
    setAmount('');
    setReference('');
  };

  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleAutoSplit = () => {
    if (payments.length === 0) return;
    
    const breakdown = SplitPayment.calculatePaymentBreakdown(
      totalAmount,
      payments.map(p => p.method)
    );

    const autoPayments: PaymentMethod[] = payments.map(p => ({
      ...p,
      amount: breakdown[p.method],
    }));

    setPayments(autoPayments);
  };

  const handleSubmit = () => {
    if (!isComplete) {
      alert(`Please collect remaining amount: ${formatCurrency(remainingAmount)}`);
      return;
    }
    onSubmit(payments);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-w-md w-full space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Split Payment</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Display */}
        <div className="space-y-2 p-3 bg-slate-700 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Total Amount:</span>
            <span className="font-bold text-violet-300">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Paid:</span>
            <span className="font-bold text-green-300">{formatCurrency(totalPaid)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Remaining:</span>
            <span className={`font-bold ${remainingAmount > 0.01 ? 'text-amber-300' : 'text-green-300'}`}>
              {formatCurrency(remainingAmount)}
            </span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200">Payment Method</label>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="check">Check</option>
            <option value="mobile">Mobile Money</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-200">Amount</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            max={remainingAmount}
            className="bg-slate-700 border-slate-600 text-white"
          />
        </div>

        {/* Reference (for card/check) */}
        {(selectedMethod === 'card' || selectedMethod === 'check') && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">
              {selectedMethod === 'card' ? 'Card Number (Last 4)' : 'Check Number'}
            </label>
            <Input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={selectedMethod === 'card' ? '1234' : 'Check #'}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
        )}

        {/* Add Payment Button */}
        <Button
          onClick={handleAddPayment}
          disabled={!amount || Number(amount) <= 0}
          className="w-full gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Payment
        </Button>

        {/* Added Payments */}
        {payments.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">Payments</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {payments.map((payment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-slate-700 rounded-lg border border-slate-600"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-cyan-600 text-white capitalize">
                        {payment.method}
                      </Badge>
                      <span className="font-semibold text-slate-100">
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                    {payment.reference && (
                      <p className="text-xs text-slate-400">Ref: {payment.reference}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemovePayment(index)}
                    className="text-slate-400 hover:text-red-400 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {payments.length > 1 && (
              <Button
                onClick={handleAutoSplit}
                variant="outline"
                className="w-full text-sm bg-transparent"
              >
                Auto-Split Remaining
              </Button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 bg-transparent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isComplete}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            Complete Split Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
