/**
 * Generates the next invoice number for a user, e.g. "FOL-2026-0001".
 * Sequence resets per calendar year but not per prefix change — if a user
 * changes their prefix mid-year, numbering still continues from the same
 * counter (simplest correct behavior; avoids duplicate numbers).
 *
 * `lastNumber` is the highest existing invoiceNumber for this user in the
 * current year, or null if none exists yet. Caller is responsible for
 * fetching that inside a transaction to avoid a race between two
 * concurrent invoice creations (see invoiceService for the DB-side lock).
 */
export function nextInvoiceNumber(prefix: string, year: number, lastNumber: string | null): string {
  const yearStr = String(year);

  if (!lastNumber) {
    return `${prefix}-${yearStr}-0001`;
  }

  const match = lastNumber.match(/-(\d+)$/);
  const lastSeq = match ? parseInt(match[1], 10) : 0;
  const nextSeq = lastSeq + 1;
  const padded = String(nextSeq).padStart(4, '0');

  return `${prefix}-${yearStr}-${padded}`;
}
