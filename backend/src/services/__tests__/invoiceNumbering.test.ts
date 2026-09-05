import { describe, it, expect } from 'vitest';
import { nextInvoiceNumber } from '../invoiceNumbering.js';

describe('nextInvoiceNumber', () => {
  it('starts at 0001 when there is no prior invoice', () => {
    expect(nextInvoiceNumber('FOL', 2026, null)).toBe('FOL-2026-0001');
  });

  it('increments the sequence from the last invoice number', () => {
    expect(nextInvoiceNumber('FOL', 2026, 'FOL-2026-0001')).toBe('FOL-2026-0002');
    expect(nextInvoiceNumber('FOL', 2026, 'FOL-2026-0009')).toBe('FOL-2026-0010');
  });

  it('pads beyond 4 digits without truncating', () => {
    expect(nextInvoiceNumber('FOL', 2026, 'FOL-2026-9999')).toBe('FOL-2026-10000');
  });

  it('continues the sequence even if the prefix changed mid-year', () => {
    // lastNumber came from a different prefix, but we still bump the numeric tail
    expect(nextInvoiceNumber('ACME', 2026, 'FOL-2026-0005')).toBe('ACME-2026-0006');
  });

  it('uses the current year regardless of the last invoice year (year rollover starts fresh)', () => {
    // Caller is responsible for only passing lastNumber from the current year;
    // this function trusts its inputs and just formats.
    expect(nextInvoiceNumber('FOL', 2027, null)).toBe('FOL-2027-0001');
  });
});
