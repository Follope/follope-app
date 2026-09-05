import { describe, it, expect } from 'vitest';
import { buildUpiPaymentUri } from '../upiService.js';

describe('buildUpiPaymentUri', () => {
  it('builds a valid upi://pay URI with correctly formatted amount', () => {
    const uri = buildUpiPaymentUri({
      payeeUpiId: 'freelancer@okhdfcbank',
      payeeName: 'Priya Sharma',
      amountPaise: 1550000,
      invoiceNumber: 'FOL-2026-0001',
    });
    const url = new URL(uri.replace('upi://', 'https://'));
    expect(url.searchParams.get('pa')).toBe('freelancer@okhdfcbank');
    expect(url.searchParams.get('am')).toBe('15500.00');
    expect(url.searchParams.get('cu')).toBe('INR');
    expect(url.searchParams.get('tn')).toContain('FOL-2026-0001');
  });

  it('correctly converts paise to rupees with two decimal places', () => {
    const uri = buildUpiPaymentUri({
      payeeUpiId: 'a@upi',
      payeeName: 'A',
      amountPaise: 100,
      invoiceNumber: 'FOL-2026-0002',
    });
    const url = new URL(uri.replace('upi://', 'https://'));
    expect(url.searchParams.get('am')).toBe('1.00');
  });

  it('rejects an invalid UPI ID', () => {
    expect(() =>
      buildUpiPaymentUri({ payeeUpiId: 'not-a-upi-id', payeeName: 'A', amountPaise: 100, invoiceNumber: 'X' })
    ).toThrow();
  });

  it('rejects a zero or negative amount', () => {
    expect(() =>
      buildUpiPaymentUri({ payeeUpiId: 'a@upi', payeeName: 'A', amountPaise: 0, invoiceNumber: 'X' })
    ).toThrow();
    expect(() =>
      buildUpiPaymentUri({ payeeUpiId: 'a@upi', payeeName: 'A', amountPaise: -100, invoiceNumber: 'X' })
    ).toThrow();
  });

  it('strips unsafe characters from the payee name and note', () => {
    const uri = buildUpiPaymentUri({
      payeeUpiId: 'a@upi',
      payeeName: 'Rahul & Co. <script>',
      amountPaise: 100,
      invoiceNumber: 'FOL/2026#0001',
    });
    const url = new URL(uri.replace('upi://', 'https://'));
    expect(url.searchParams.get('pn')).not.toContain('<');
    expect(url.searchParams.get('pn')).not.toContain('&');
    expect(url.searchParams.get('tn')).not.toContain('#');
  });

  it('truncates an overly long payee name to 50 chars', () => {
    const uri = buildUpiPaymentUri({
      payeeUpiId: 'a@upi',
      payeeName: 'X'.repeat(100),
      amountPaise: 100,
      invoiceNumber: 'FOL-2026-0001',
    });
    const url = new URL(uri.replace('upi://', 'https://'));
    expect(url.searchParams.get('pn')!.length).toBeLessThanOrEqual(50);
  });
});
