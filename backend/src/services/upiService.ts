/**
 * Builds a UPI payment deep-link per the BHIM/NPCI `upi://pay` intent spec.
 * This URI is what gets encoded into the QR code and used for the
 * "Pay via UPI" button. Generating this does NOT confirm payment — see
 * the payment service; a scanned QR only opens the payer's UPI app.
 */

export interface UpiPaymentDetails {
  payeeUpiId: string; // e.g. "freelancer@okhdfcbank"
  payeeName: string;
  amountPaise: number;
  invoiceNumber: string;
}

const MAX_UPI_NOTE_LENGTH = 50; // NPCI practical limit for the `tn` field across apps

function sanitizeUpiTextField(value: string): string {
  // UPI apps vary in how they handle special characters; keep to a safe
  // alphanumeric-plus-basic-punctuation set and strip anything else.
  return value.replace(/[^a-zA-Z0-9 \-_.]/g, '').trim();
}

export function buildUpiPaymentUri(details: UpiPaymentDetails): string {
  if (!details.payeeUpiId || !/^[\w.\-]+@[\w.\-]+$/.test(details.payeeUpiId)) {
    throw new Error('Invalid UPI ID format');
  }
  if (!Number.isInteger(details.amountPaise) || details.amountPaise <= 0) {
    throw new Error('amountPaise must be a positive integer');
  }

  const amountRupees = (details.amountPaise / 100).toFixed(2);
  const payeeName = sanitizeUpiTextField(details.payeeName).slice(0, 50);
  const note = sanitizeUpiTextField(`Invoice ${details.invoiceNumber}`).slice(0, MAX_UPI_NOTE_LENGTH);

  const params = new URLSearchParams({
    pa: details.payeeUpiId,
    pn: payeeName,
    am: amountRupees,
    cu: 'INR',
    tn: note,
  });

  return `upi://pay?${params.toString()}`;
}
