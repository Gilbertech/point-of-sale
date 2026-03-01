/**
 * Export utilities for generating CSV and downloadable files
 */

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename);
}

export function exportToJSON(data: any, filename: string) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  downloadFile(blob, filename);
}

export function exportToPDF(htmlContent: string, filename: string) {
  // This is a placeholder - in production you'd use a library like jsPDF
  const printWindow = window.open('', '', 'height=600,width=800');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  }
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateReceiptHTML(receipt: any, storeInfo: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt ${receipt.transactionNumber}</title>
      <style>
        body { font-family: monospace; padding: 20px; }
        .receipt { max-width: 400px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
        .items { margin: 20px 0; border-bottom: 2px dashed #000; padding-bottom: 10px; }
        .item { display: flex; justify-content: space-between; margin: 5px 0; }
        .totals { margin: 20px 0; }
        .total-row { display: flex; justify-content: space-between; font-weight: bold; margin: 5px 0; }
        .footer { text-align: center; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <strong>${storeInfo?.name || 'Store'}</strong>
          <p>${storeInfo?.address || ''}</p>
        </div>
        <div class="items">
          ${receipt.items.map((item: any) => `
            <div class="item">
              <span>${item.name} x${item.quantity}</span>
              <span>$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>$${receipt.subtotal.toFixed(2)}</span>
          </div>
          ${receipt.discount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-$${receipt.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Tax:</span>
            <span>$${receipt.tax.toFixed(2)}</span>
          </div>
          <div class="total-row" style="font-size: 18px;">
            <span>TOTAL:</span>
            <span>$${receipt.total.toFixed(2)}</span>
          </div>
        </div>
        <div class="footer">
          <p>Receipt #${receipt.transactionNumber}</p>
          <p>${new Date(receipt.createdAt).toLocaleString()}</p>
          <p>Thank you for your purchase!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
