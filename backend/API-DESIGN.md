# Follope — API Design (v1)

Base: `https://api.follope.com/v1`

All authenticated routes require `Authorization: Bearer <accessToken>`.
All responses: `{ data: ... }` on success, `{ error: { code, message } }` on failure. No stack traces in production responses.

---

## Auth

### POST /auth/register
```
Request:  { name, email, password }
Response: { data: { user: { id, name, email }, accessToken } }
Sets:     httpOnly refresh cookie OR returns refreshToken for mobile (stored via expo-secure-store)
```

### POST /auth/login
```
Request:  { email, password }
Response: { data: { user, accessToken, refreshToken } }
Rate limit: 5/min per IP, 10/hr per email
```

### POST /auth/refresh
```
Request:  { refreshToken }
Response: { data: { accessToken, refreshToken } }   // rotates refresh token
```

### POST /auth/logout
```
Request:  { refreshToken }
Response: { data: { success: true } }   // revokes the session
```

### GET /me
```
Response: { data: { user, profile, business } }
```

---

## Clients

```
GET    /clients                 → { data: Client[] }  (paginated: ?cursor=&limit=)
POST   /clients                 → { data: Client }
GET    /clients/:id             → { data: Client }     (404 if not owned by requester)
PATCH  /clients/:id             → { data: Client }
DELETE /clients/:id             → { data: { success: true } }
```

Client payload:
```ts
{ name: string, company?: string, email?: string, phone?: string, billingAddress?: string, gstin?: string }
```

---

## Invoices

```
GET    /invoices                → { data: Invoice[] }  (?status=&clientId=&search=&sort=&cursor=&limit=)
POST   /invoices                → { data: Invoice }     // server computes all totals
GET    /invoices/:id            → { data: Invoice }
PATCH  /invoices/:id            → { data: Invoice }     // only allowed while DRAFT/SENT
DELETE /invoices/:id            → { data: { success: true } }  // soft — sets CANCELLED, doesn't hard-delete if payments exist
POST   /invoices/:id/duplicate  → { data: Invoice }     // new invoiceNumber, no payment history copied
POST   /invoices/:id/share      → { data: { publicUrl } }  // marks sentAt if first share
POST   /invoices/:id/reminder   → { data: { success: true } }  // records Reminder, returns share text
```

Create invoice request — **client sends only inputs, never totals**:
```ts
{
  clientId: string,
  dueDate: string,       // ISO date
  items: [{
    description: string,
    quantity: number,
    unitPricePaise: number,
    discountPaise?: number,
    taxRateBps?: number
  }],
  notes?: string
}
```

Server computes and persists: `subtotalPaise, discountPaise, taxPaise, totalPaise, balancePaise, invoiceNumber (auto-incremented per user, e.g. FOL-2026-0001), publicToken`.

---

## Payments

```
POST /invoices/:id/payments     → { data: Payment }   // recalculates invoice.paidPaise, balancePaise, status
GET  /invoices/:id/payments     → { data: Payment[] }
```

Request:
```ts
{ amountPaise: number, method: "UPI"|"BANK_TRANSFER"|"CASH"|"OTHER", paidAt: string, referenceId?: string, notes?: string }
```
Server rejects if `amountPaise > invoice.balancePaise` (no overpayment without explicit handling) and never accepts a client-supplied "paid" boolean directly on the invoice.

---

## Public invoice (no auth)

```
GET /public/invoices/:publicToken
```
Response exposes only: business display name/logo/UPI id, client display name, invoice number, dates, items, totals, status, UPI QR payload. Never `userId`, internal `id`s, client email/phone/full billing address unless the freelancer opts to include them, internal notes.

Rate-limited aggressively (e.g. 30/min per IP) since it's unauthenticated.

Marks `viewedAt` on first fetch (idempotent — doesn't reset on repeat views).

---

## Dashboard

```
GET /dashboard
Response: { data: { outstandingPaise, thisMonthPaise, invoiceCount, recentInvoices: Invoice[] } }
```

---

## UPI QR payload

Generated server-side per BHIM/NPCI UPI deep-link spec:
```
upi://pay?pa={upiId}&pn={payeeName}&am={amount}&cu=INR&tn={invoiceNumber}
```
Returned as both the raw URI (for "Pay via UPI" button) and a QR image (SVG/PNG) from the public invoice endpoint and the mobile preview screen.

---

## Idempotency

`POST /invoices` and `POST /invoices/:id/payments` accept an optional `Idempotency-Key` header; server stores recent keys per user (e.g. 5 min TTL) and returns the original response on replay, preventing duplicate-tap invoice/payment creation.
