# Follope — Architecture Plan (v1)

## 1. Stack decisions

| Layer | Choice | Why |
|---|---|---|
| Mobile | Expo + React Native + TypeScript, Expo Router | Matches spec; Expo Router gives file-based routing with less boilerplate than React Navigation for a solo build |
| Mobile styling | NativeWind | Tailwind syntax, fast iteration, keeps a design system instead of ad-hoc styles |
| Mobile forms | React Hook Form + Zod | Shared Zod schemas can be reused on the backend for request validation — one source of truth for shapes |
| Mobile server state | TanStack Query | Handles caching/retry/loading without hand-rolled state |
| Mobile local state | Zustand | Only for UI-only state (active tab, draft-in-progress form state before submit) |
| Backend framework | **Express + TypeScript** (deviation from spec's NestJS suggestion) | At MVP/solo scale, NestJS's DI and module system is overhead without payoff. Express + a clear folder convention (routes → services → repositories) gives 90% of the structure NestJS provides, with far less ceremony. Revisit if/when a team forms. |
| ORM | Prisma | Type-safe queries, migrations, good Postgres fit |
| DB | PostgreSQL | Relational integrity for financial data — required |
| Auth | Access token (short-lived JWT) + refresh token (opaque, hashed in DB) | Refresh tokens stored as hashes only (see Session model) so a DB leak doesn't leak usable tokens |
| Mobile secure storage | expo-secure-store for refresh token only | Access token can live in memory (Zustand), never persisted |
| PDF generation | Server-side (e.g. Puppeteer or a templating lib like `pdf-lib`/`@react-pdf/renderer` on the server) | Mobile client must not be the source of truth for the PDF's numbers |

## 2. Money handling

- All monetary values stored and transmitted as **integer paise**, field-suffixed `*Paise` (e.g. `totalPaise`).
- Mobile app sends only `quantity`, `unitPricePaise`, `discountPaise`, `taxRateBps` per line item.
- Backend is the only place `lineTotalPaise`, `subtotalPaise`, `taxPaise`, `totalPaise`, `balancePaise` are computed and written. Any client-supplied total/tax/status field is ignored server-side.

## 3. Authorization model

Every resource (`Client`, `Invoice`, `Payment`, ...) carries `userId`. Every read/write handler:

1. Authenticates the requester (JWT → `userId`).
2. Loads the resource.
3. Checks `resource.userId === requester.userId` before returning/mutating.
4. Returns 404 (not 403) for cross-user access attempts, to avoid confirming a resource's existence to a non-owner.

Public invoice routes (`GET /public/invoices/:publicToken`) are the one deliberate exception — token-based, non-enumerable (cuid, not sequential), and expose only the fields explicitly in the public-view serializer (never `userId`, `id`, internal notes, client's full billing address unless intended).

## 4. Invoice status lifecycle

```
DRAFT → SENT → VIEWED → (PENDING is implicit: sent + not fully paid + not overdue)
                 ↓
         PARTIALLY_PAID → PAID
                 ↓
             OVERDUE (dueDate passed, balance > 0 — computed, not manually set)
                 ↓
           CANCELLED (from DRAFT/SENT only, not from PAID)
```

`OVERDUE` is derived at read-time (or via a scheduled job flipping status) from `dueDate < now() && balancePaise > 0 && status not in (PAID, CANCELLED)` — never set directly by a client request.

## 5. What's deferred (P1/P2, per spec's own prioritization)

Payment gateway integration (Razorpay/Cashfree), WhatsApp automation, recurring invoices, GST reporting, AI assistant, team/agency accounts. Building the schema/API so these slot in later without a rewrite (e.g. `Payment.method` already has room to grow, `Reminder.channel` is a string not an enum yet).

## 6. Suggested build order

1. Backend: auth (register/login/refresh/logout) + Session model + rate limiting on auth routes
2. Backend: Business/Profile CRUD
3. Backend: Client CRUD with ownership checks
4. Backend: Invoice creation + calculation engine (unit-test this heavily — it's the highest-risk logic)
5. Backend: Payment recording + balance recalculation
6. Backend: public invoice endpoint + UPI QR payload generation
7. Backend: PDF generation endpoint
8. Mobile: auth screens + onboarding
9. Mobile: dashboard + client list/detail
10. Mobile: invoice creation flow (client → details → items → tax/discount → payment → preview → share)
11. Mobile: invoice list/detail, payment recording, PDF/share
12. Security review pass (IDOR tests, rate limit tests, token tests) before calling MVP done
