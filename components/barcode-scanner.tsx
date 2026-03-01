'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Barcode, AlertCircle, CheckCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (sku: string, barcode: string) => void;
  disabled?: boolean;
}

export function BarcodeScanner({ onScan, disabled }: BarcodeScannerProps) {
  const [scanMode, setScanMode] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [lastScan, setLastScan] = useState<{ value: string; timestamp: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (scanMode) {
      inputRef.current?.focus();
    }
  }, [scanMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+B or Cmd+B to toggle scan mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setScanMode(!scanMode);
        setScannedValue('');
      }

      // Enter in scan mode triggers the scan
      if (scanMode && e.key === 'Enter' && scannedValue.trim()) {
        e.preventDefault();
        handleScan();
      }

      // Escape to exit scan mode
      if (e.key === 'Escape' && scanMode) {
        setScanMode(false);
        setScannedValue('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scanMode, scannedValue]);

  const handleScan = () => {
    if (!scannedValue.trim()) return;

    // Clear timeout for automatic reset
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Store last scan
    setLastScan({ value: scannedValue, timestamp: Date.now() });

    // Emit the scan (it could be either SKU or barcode)
    onScan(scannedValue, scannedValue);

    // Reset after a short delay
    scanTimeoutRef.current = setTimeout(() => {
      setScannedValue('');
      inputRef.current?.focus();
    }, 500);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Barcode className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">Barcode Scanner</span>
        </div>
        <Badge variant={scanMode ? 'default' : 'secondary'}>
          {scanMode ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      </div>

      {!scanMode && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Press <kbd className="rounded bg-muted px-2 py-1 text-xs font-semibold text-foreground">Ctrl+B</kbd> or <kbd className="rounded bg-muted px-2 py-1 text-xs font-semibold text-foreground">Cmd+B</kbd> to start scanning
          </AlertDescription>
        </Alert>
      )}

      {scanMode && (
        <div className="space-y-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Scan barcode or SKU code..."
            value={scannedValue}
            onChange={(e) => setScannedValue(e.target.value)}
            className="font-mono text-lg"
            disabled={disabled}
            autoFocus
          />
          <div className="text-xs text-muted-foreground">
            Press <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Enter</kbd> to add | <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs">Esc</kbd> to exit
          </div>

          {lastScan && Date.now() - lastScan.timestamp < 2000 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Scanned: <span className="font-mono font-semibold">{lastScan.value}</span>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
