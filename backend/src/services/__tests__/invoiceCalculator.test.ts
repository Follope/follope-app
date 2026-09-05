import { describe, it, expect } from 'vitest';
import { computeInvoiceTotals, splitGst, computeBalanceAndStatus } from '../invoiceCalculator.js';

describe('computeInvoiceTotals', () => {
  it('computes a simple single-item invoice with no tax/discount', () => {
    const result = computeInvoiceTotals([{ quantity: 1, unitPricePaise: 10000 }]);
    expect(result.subtotalPaise).toBe(10000);
    expect(result.discountPaise).toBe(0);
    expect(result.taxPaise).toBe(0);
    expect(result.totalPaise).toBe(10000);
  });

  it('applies flat discount before tax', () => {
    const result = computeInvoiceTotals([
      { quantity: 1, unitPricePaise: 10000, discountPaise: 1000, taxRateBps: 1800 },
    ]);
    // gross 10000, discount 1000 -> taxable base 9000, tax 18% of 9000 = 1620
    expect(result.subtotalPaise).toBe(10000);
    expect(result.discountPaise).toBe(1000);
    expect(result.taxPaise).toBe(1620);
    expect(result.totalPaise).toBe(10000 - 1000 + 1620);
  });

  it('handles decimal quantities (e.g. hourly billing)', () => {
    const result = computeInvoiceTotals([{ quantity: 2.5, unitPricePaise: 2000 }]);
    expect(result.subtotalPaise).toBe(5000);
    expect(result.totalPaise).toBe(5000);
  });

  it('sums multiple items correctly', () => {
    const result = computeInvoiceTotals([
      { quantity: 1, unitPricePaise: 5000, taxRateBps: 1800 },
      { quantity: 2, unitPricePaise: 3000, taxRateBps: 1800 },
    ]);
    // item1: gross 5000, tax 900 -> line 5900
    // item2: gross 6000, tax 1080 -> line 7080
    expect(result.subtotalPaise).toBe(11000);
    expect(result.taxPaise).toBe(1980);
    expect(result.totalPaise).toBe(12980);
    expect(result.items[0].lineTotalPaise).toBe(5900);
    expect(result.items[1].lineTotalPaise).toBe(7080);
  });

  it('rounds tax half-up per line, deterministically', () => {
    // taxable base 33, rate 1800bps -> 5.94 -> rounds to 6
    const result = computeInvoiceTotals([{ quantity: 1, unitPricePaise: 33, taxRateBps: 1800 }]);
    expect(result.taxPaise).toBe(6);
  });

  it('rejects a negative or zero quantity', () => {
    expect(() => computeInvoiceTotals([{ quantity: 0, unitPricePaise: 100 }])).toThrow();
    expect(() => computeInvoiceTotals([{ quantity: -1, unitPricePaise: 100 }])).toThrow();
  });

  it('rejects non-integer unitPricePaise (guards against rupee-vs-paise mistakes)', () => {
    expect(() => computeInvoiceTotals([{ quantity: 1, unitPricePaise: 99.5 }])).toThrow();
  });

  it('rejects a discount larger than the line gross amount', () => {
    expect(() =>
      computeInvoiceTotals([{ quantity: 1, unitPricePaise: 100, discountPaise: 200 }])
    ).toThrow();
  });

  it('rejects an empty item list', () => {
    expect(() => computeInvoiceTotals([])).toThrow();
  });
});

describe('splitGst', () => {
  it('splits intra-state tax evenly into CGST/SGST', () => {
    expect(splitGst(1800, false)).toEqual({ cgstPaise: 900, sgstPaise: 900, igstPaise: 0 });
  });

  it('puts the odd paisa on CGST for odd totals', () => {
    expect(splitGst(1801, false)).toEqual({ cgstPaise: 901, sgstPaise: 900, igstPaise: 0 });
  });

  it('returns full amount as IGST for inter-state', () => {
    expect(splitGst(1800, true)).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 1800 });
  });
});

describe('computeBalanceAndStatus', () => {
  const future = new Date(Date.now() + 86400_000);
  const past = new Date(Date.now() - 86400_000);

  it('marks PAID when balance reaches zero', () => {
    const r = computeBalanceAndStatus(10000, 10000, 'PENDING', future);
    expect(r).toEqual({ balancePaise: 0, status: 'PAID' });
  });

  it('marks PAID even on overpayment, clamping balance to zero', () => {
    const r = computeBalanceAndStatus(10000, 12000, 'PENDING', future);
    expect(r.status).toBe('PAID');
    expect(r.balancePaise).toBe(0);
  });

  it('marks PARTIALLY_PAID when some but not all is paid', () => {
    const r = computeBalanceAndStatus(10000, 4000, 'PENDING', future);
    expect(r).toEqual({ balancePaise: 6000, status: 'PARTIALLY_PAID' });
  });

  it('marks OVERDUE when nothing paid and due date has passed', () => {
    const r = computeBalanceAndStatus(10000, 0, 'PENDING', past);
    expect(r).toEqual({ balancePaise: 10000, status: 'OVERDUE' });
  });

  it('keeps DRAFT status untouched when nothing paid and not yet sent', () => {
    const r = computeBalanceAndStatus(10000, 0, 'DRAFT', future);
    expect(r).toEqual({ balancePaise: 10000, status: 'DRAFT' });
  });

  it('never reopens a CANCELLED invoice', () => {
    const r = computeBalanceAndStatus(10000, 5000, 'CANCELLED', future);
    expect(r.status).toBe('CANCELLED');
  });
});
