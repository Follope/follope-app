/**
 * Invoice calculation engine.
 *
 * This is the ONLY place invoice totals are computed. Never trust a
 * client-supplied total/subtotal/tax/balance — always recompute here from
 * raw line-item inputs before persisting.
 *
 * All money is integer paise. All rates are basis points (bps): 1800 = 18%.
 * Rounding: round each line item independently (half-up), then sum —
 * this matches how GST invoices are conventionally rounded in India and
 * avoids the "sum of rounded parts != rounded sum" surprise being hidden.
 */

export interface InvoiceItemInput {
  quantity: number; // e.g. 2.5 — decimal quantities allowed (hours, kg, etc.)
  unitPricePaise: number;
  discountPaise?: number; // flat discount on this line, applied before tax
  taxRateBps?: number; // e.g. 1800 = 18% GST
}

export interface InvoiceItemComputed extends InvoiceItemInput {
  grossPaise: number; // quantity * unitPricePaise, before discount
  discountPaise: number;
  taxableBasePaise: number; // gross - discount
  taxPaise: number;
  lineTotalPaise: number; // taxableBase + tax
}

export interface InvoiceTotals {
  items: InvoiceItemComputed[];
  subtotalPaise: number; // sum of gross (pre-discount, pre-tax)
  discountPaise: number; // sum of line discounts
  taxPaise: number; // sum of line tax
  totalPaise: number; // subtotal - discount + tax
}

function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

/**
 * Compute all totals for a single invoice from raw item inputs.
 * Throws on invalid input rather than silently coercing — bad invoice math
 * is a financial-integrity issue, not a UX nicety.
 */
export function computeInvoiceTotals(items: InvoiceItemInput[]): InvoiceTotals {
  if (!items || items.length === 0) {
    throw new Error('Invoice must have at least one item');
  }

  let subtotalPaise = 0;
  let totalDiscountPaise = 0;
  let totalTaxPaise = 0;

  const computedItems: InvoiceItemComputed[] = items.map((item, idx) => {
    if (item.quantity <= 0) {
      throw new Error(`Item ${idx}: quantity must be positive`);
    }
    if (!Number.isFinite(item.unitPricePaise) || item.unitPricePaise < 0) {
      throw new Error(`Item ${idx}: unitPricePaise must be a non-negative integer`);
    }
    if (!Number.isInteger(item.unitPricePaise)) {
      throw new Error(`Item ${idx}: unitPricePaise must be an integer (paise, not rupees/floats)`);
    }

    const discountPaise = item.discountPaise ?? 0;
    const taxRateBps = item.taxRateBps ?? 0;

    if (discountPaise < 0 || !Number.isInteger(discountPaise)) {
      throw new Error(`Item ${idx}: discountPaise must be a non-negative integer`);
    }
    if (taxRateBps < 0 || !Number.isInteger(taxRateBps)) {
      throw new Error(`Item ${idx}: taxRateBps must be a non-negative integer`);
    }

    const grossPaise = roundHalfUp(item.quantity * item.unitPricePaise);

    if (discountPaise > grossPaise) {
      throw new Error(`Item ${idx}: discountPaise cannot exceed line gross amount`);
    }

    const taxableBasePaise = grossPaise - discountPaise;
    const taxPaise = roundHalfUp((taxableBasePaise * taxRateBps) / 10000);
    const lineTotalPaise = taxableBasePaise + taxPaise;

    subtotalPaise += grossPaise;
    totalDiscountPaise += discountPaise;
    totalTaxPaise += taxPaise;

    return {
      ...item,
      discountPaise,
      taxRateBps,
      grossPaise,
      taxableBasePaise,
      taxPaise,
      lineTotalPaise,
    };
  });

  const totalPaise = subtotalPaise - totalDiscountPaise + totalTaxPaise;

  return {
    items: computedItems,
    subtotalPaise,
    discountPaise: totalDiscountPaise,
    taxPaise: totalTaxPaise,
    totalPaise,
  };
}

/**
 * Split a tax amount into CGST/SGST (intra-state) halves, or return the
 * full amount as IGST (inter-state). Caller decides which applies based
 * on freelancer's and client's state (out of scope for this function).
 */
export function splitGst(taxPaise: number, isInterState: boolean) {
  if (isInterState) {
    return { cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise };
  }
  const half = Math.floor(taxPaise / 2);
  // if taxPaise is odd, put the extra paisa on CGST — arbitrary but must be deterministic
  return { cgstPaise: taxPaise - half, sgstPaise: half, igstPaise: 0 };
}

/**
 * Recompute invoice status + balance after a new payment is recorded.
 * Called from the payment-recording service — never set status directly
 * from a client request.
 */
export function computeBalanceAndStatus(
  totalPaise: number,
  totalPaidPaise: number,
  currentStatus: 'DRAFT' | 'SENT' | 'VIEWED' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED',
  dueDate: Date,
  now: Date = new Date()
) {
  if (currentStatus === 'CANCELLED') {
    return { balancePaise: totalPaise - totalPaidPaise, status: 'CANCELLED' as const };
  }

  const balancePaise = totalPaise - totalPaidPaise;

  if (balancePaise <= 0) {
    return { balancePaise: Math.max(balancePaise, 0), status: 'PAID' as const };
  }
  if (totalPaidPaise > 0) {
    return { balancePaise, status: 'PARTIALLY_PAID' as const };
  }
  if (dueDate.getTime() < now.getTime()) {
    return { balancePaise, status: 'OVERDUE' as const };
  }
  // preserve DRAFT if it hasn't been sent yet; otherwise it's pending
  if (currentStatus === 'DRAFT') {
    return { balancePaise, status: 'DRAFT' as const };
  }
  return { balancePaise, status: 'PENDING' as const };
}
