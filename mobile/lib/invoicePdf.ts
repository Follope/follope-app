import * as Sharing from 'expo-sharing';
import { ApiError, downloadAuthenticatedFile } from './api';

export async function downloadAndShareInvoicePdf(invoiceId: string, invoiceNumber: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError('SHARING_UNAVAILABLE', 'PDF sharing is not available on this device.', 0);
  }

  const safeName = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const uri = await downloadAuthenticatedFile(`/invoices/${invoiceId}/pdf`, `${safeName}.pdf`);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Share ${invoiceNumber}`,
  });
}

export async function downloadAndShareAccountingReport(format: 'csv' | 'pdf') {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError('SHARING_UNAVAILABLE', 'Report sharing is not available on this device.', 0);
  }
  const monthStart = new Date();
  monthStart.setDate(1);
  const today = new Date();
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const uri = await downloadAuthenticatedFile(
    `/invoices/export.${format}?from=${date(monthStart)}&to=${date(today)}`,
    `follope_accounting_${date(monthStart)}.${format}`,
  );
  await Sharing.shareAsync(uri, {
    mimeType: format === 'csv' ? 'text/csv' : 'application/pdf',
    dialogTitle: 'Share accounting report',
  });
}
