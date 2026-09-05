# Follope

Mobile-first invoicing and payment tracking for Indian freelancers. UPI-first, GST-aware, built for a freelancer to send a ₹50,000 invoice with confidence.

```
follope/
├── backend/     Express + TypeScript + Prisma + PostgreSQL API
└── mobile/      Expo (React Native) + TypeScript app
```

Read `backend/ARCHITECTURE.md` for design decisions, `backend/API-DESIGN.md` for the full endpoint contract, and `backend/SECURITY-REVIEW.md` for what's been checked and what's still open. This README is just "how do I run it."

---

## Prerequisites

- Node.js 20+ and npm
- A PostgreSQL database (local install, Docker, or a hosted instance like Supabase/Neon/Railway)
- For mobile: the [Expo Go](https://expo.dev/go) app on your phone, or an iOS Simulator / Android emulator
- **Not required to run the backend, but you'll want it for the mobile app to be useful:** the backend and mobile app are two separate processes you run side by side.

---

## 1. Backend setup

```bash
cd backend
npm ci
cp .env.example .env
```

(`npm ci` rather than `npm install` — the lockfile pins the exact dependency versions I actually tested against, which matters here since a few of these packages, like Zod and TypeScript, have shipped new major versions recently. `npm install` will also work and just re-resolve within the same ranges.)

Edit `.env`:
- `DATABASE_URL` — point this at your Postgres instance. Quickest path if you don't already have Postgres running:
  ```bash
  docker run --name follope-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=follope -p 5432:5432 -d postgres:16
  # then: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/follope"
  ```
- `AUTH_SECRET` — generate one: `openssl rand -base64 48`
- `ALLOWED_ORIGINS` — leave the default (`http://localhost:8081`) for now; that's the Expo dev server's default port.

Then generate the Prisma client and create the database tables:

```bash
npm run prisma:generate
npm run prisma:migrate
```

(`prisma:migrate` will prompt you to name the migration — anything like `init` is fine. This also creates the tables from `prisma/schema.prisma`.)

Run the test suite to confirm everything's wired correctly before you start the server:

```bash
npm test
```

You should see 78 passing tests across 12 files, including the security/IDOR tests in `src/services/__tests__/*.security.test.ts`.

Start the dev server:

```bash
npm run dev
```

It'll listen on `http://localhost:3000` by default (override with `PORT` in `.env`). Confirm it's up:

```bash
curl http://localhost:3000/health
# {"data":{"status":"ok"}}
```

### A note on what I could and couldn't verify myself

I built and tested this in a sandboxed environment without real network access to Prisma's binary CDN, so I was never able to run `prisma generate` against a real schema or hit a real Postgres instance — everything was tested with a hand-written type stub for `@prisma/client` (to typecheck) and mocked Prisma clients (to unit-test the authorization logic). The calculation engine, UPI URI builder, and PDF generation *were* run for real and their output inspected (the PDF was actually rendered to an image and visually checked — see the conversation history if you want the details). The database layer itself — actual migrations, real queries, cascade behavior — has not been run against a live database by me. Your `npm run prisma:migrate` above will be the first real test of the schema. If it errors, check `prisma/schema.prisma` first; that's the one part of this I'm least certain is 100% correct, since I could never compile-check it against a live engine.

---

## 2. Mobile app setup

In a **second terminal** (keep the backend running):

```bash
cd mobile
npm ci
```

Edit `app.json` → `expo.extra.apiBaseUrl`:
- **iOS Simulator**: `http://localhost:3000/v1` (default — already set)
- **Android Emulator**: `http://10.0.2.2:3000/v1` (Android emulator's alias for the host machine's localhost)
- **Physical device via Expo Go**: your computer's LAN IP, e.g. `http://192.168.1.42:3000/v1` — find it with `ipconfig getifaddr en0` (Mac) or `ipconfig` (Windows). Your phone and computer need to be on the same Wi-Fi network, and `ALLOWED_ORIGINS` in the backend's `.env` should include whatever origin Expo Go reports (or just leave it permissive for local dev).

Typecheck before starting (this actually runs against the real Expo/React Native types, unlike the backend's Prisma stub):

```bash
npm run typecheck
```

Then start Metro:

```bash
npm start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS), or press `i` / `a` in the terminal for a simulator/emulator.

### What to expect on first run

I was not able to run the Metro bundler in the sandbox this was built in (it needs a real device/simulator), so **this app has never actually been launched**. `tsc --noEmit` passes cleanly against the real installed dependency versions, which catches type errors but not runtime issues — layout bugs, a missed import, a navigation edge case. Treat this first run as the actual first test of the mobile app, not a formality.

If it fails to start, the most likely culprits, in order:
1. Placeholder assets — `assets/icon.png`, `assets/splash.png`, `assets/adaptive-icon.png` are solid-color placeholders I generated (dark background, orange square) just so Expo has *something* to load. Replace them with real artwork whenever.
2. `apiBaseUrl` in `app.json` not matching your setup (see above) — you'll see network errors on the login/signup screens specifically, not a crash.
3. A native module (`react-native-reanimated`, `react-native-svg`) needing a clean Metro cache — try `npx expo start -c`.

---

## 3. Create your first account and invoice

1. Open the app → **Get Started** → sign up.
2. Walk through onboarding (role, optional business info, payment method).
3. On Home, tap **Create Invoice**.
4. You'll need a client first — the client picker will be empty on a fresh account. Back out, go to the **Clients** tab, add one, then return to invoice creation.
5. Fill in at least one line item and submit. The backend recomputes all totals server-side regardless of what the app shows in the live preview — that's intentional (see `ARCHITECTURE.md` §2).

---

## Known gaps (not hidden, just not built yet)

- Google OAuth (email/password only for now)
- Push notifications
- Payment gateway integration (Razorpay/Cashfree) — payments are manually recorded
- Logo upload
- Forgot-password is UI-only; there's no backend route or email delivery wired up yet
- No ESLint config despite mobile's original `lint` script reference (removed from `package.json` to avoid a dead command)
- Public invoice web page (the `https://follope.com/invoice/:token` link the app generates) — the API endpoint exists and is tested, but there's no actual web frontend rendering it yet

Full detail on all of this, plus what was security-reviewed and what wasn't, is in `backend/SECURITY-REVIEW.md` and `backend/ARCHITECTURE.md`.
