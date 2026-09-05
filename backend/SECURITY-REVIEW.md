# Follope — Security Review (v1)

Scope: backend P0 surface (auth, clients, invoices, payments, public invoice page, settings). Method: read every authorization boundary in the codebase, then wrote executable tests (mocked Prisma) that actually attempt the attack rather than just asserting the code "looks right." All tests referenced below are real and passing — see `src/services/__tests__/*.security.test.ts` and `src/middleware/__tests__/idempotency.test.ts`.

## Findings — fixed

1. **`/auth/refresh` had no rate limit.** Every other sensitive auth route (login, register) was limited; refresh was not. Added a 20/min-per-IP limiter — generous enough for normal token-refresh traffic, but closes the gap against hammering the endpoint. (`rateLimit.ts`, `auth.routes.ts`)

2. **Unvalidated `status` query param on `GET /invoices` reached Prisma directly.** An invalid value would throw inside Prisma and surface as an unhandled 500 rather than a clean validation error — not exploitable for data access, but poor hygiene and a minor DoS/error-oracle surface. Added an explicit allow-list check at the route boundary returning 400. (`invoices.routes.ts`)

3. **Mobile logout didn't send the refresh token.** `POST /auth/logout` treats a missing body as a no-op for idempotency (returns `success: true` without revoking anything) — so the app would show the user logged out locally while their refresh token stayed valid server-side indefinitely. Fixed the mobile call to fetch and send the stored token. This is the one I'd flag as most worth double-checking in your own testing, since it's a "looks fine in the happy path, silently wrong" class of bug.

4. **Idempotency-Key was referenced from the mobile client but never implemented server-side.** A double-tap on "Create Invoice" would have created two invoices despite the header being sent — the header was being silently ignored. Built the middleware for real, with tests confirming per-user isolation (User A's key can't replay User B's response).

5. **GSTIN was fully withheld from the public invoice page and PDF.** Over-corrected in the original allow-list design — GST-registered freelancers are legally required to show their GSTIN on tax invoices. Now conditionally included only when the invoice actually has tax applied, and only the GSTIN (not PAN, full address, etc.).

## Findings — flagged, not fixed (judgment calls / out of scope for this pass)

- **`notes` has no internal/client-facing split.** One field, shown publicly. Added a mobile label ("visible to your client") as a cheap mitigation, but the real fix is a schema change (`notes` + `internalNotes`) if freelancers want private invoice comments. Didn't do this now since it's a data model change with migration implications, not a pure security fix.
- **Revoked sessions' access tokens remain valid for their remaining TTL (≤15 min).** This is inherent to stateless JWTs — the tradeoff for not doing a DB lookup on every request. Acceptable given the short TTL, but worth knowing: `changePassword`/logout revoke the *refresh* token immediately; the current access token is still technically usable until natural expiry.
- **Forgot-password is UI-only.** The mobile screen calls `/auth/forgot-password`, which doesn't exist on the backend — it fails silently and shows a generic "check your email" regardless (intentionally, to avoid email enumeration), but functionally nothing gets sent. This needs actual email delivery infra (transactional email provider) before it's real, which is a bigger scope item than a security fix.
- **No malicious-file-upload testing** — logo upload (spec section 54) isn't built yet, so there's nothing to test there.
- **No SQL injection testing performed directly** — Prisma parameterizes all queries by construction, so this class of attack is structurally prevented rather than something to test per-endpoint. Didn't write a test that just re-proves "Prisma parameterizes queries."

## What was actually verified (not just reasoned about)

- Cross-user read/update/delete on clients → `NotFoundError`/404, not a distinguishable 403 (5 tests)
- Cross-user invoice creation via someone else's `clientId` → blocked (5 tests)
- Cross-user invoice read/duplicate → blocked
- Client-supplied `totalPaise` field is ignored; server always recomputes from items
- Cross-user payment recording/listing → blocked (5 tests)
- Overpayment beyond invoice balance → rejected
- Payments against a cancelled invoice → rejected
- Idempotency cache is scoped per-user; User A can't replay User B's cached response using the same key (5 tests)

## Recommended before calling MVP done

1. Repeat this pass against a real database once Prisma is generated in your environment (I couldn't reach Prisma's binary CDN in this sandbox — see prior notes) — the mocked-Prisma tests prove the authorization *logic* is correct, but an integration pass against real Postgres would catch anything Prisma-specific (e.g. actual unique constraint behavior, cascade deletes).
2. Load-test the rate limiters — they're in-memory and per-instance; confirm behavior once you're running more than one backend instance (Redis migration noted in the code comments).
3. Decide on the `notes` field split before real users start typing internal comments into it.
