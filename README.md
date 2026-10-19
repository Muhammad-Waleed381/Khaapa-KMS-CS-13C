# Khaapa

Management system for Khaapa, the student-run tuck shop at K2 Block, NUST H-12.

- **Counter (POS):** tap items into a sale, take cash (with change) or online payment. Works offline.
- **Inventory:** restocks at their own buy price, FIFO costing (oldest stock sold first), waste/expiry, shelf counts, low-stock alerts, oversell tracking.
- **HR scheduler:** members submit weekly availability; HR (admins) assign duty slots.
- **Shifts, sales history, voids, end-of-day report, stats, activity log.**
- **Public menu** with live stock and a distance check; **pre-orders** for today or tomorrow, paid in advance.
- **Shares:** shareholders and the costs ledger, with profit split per share.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Drizzle ORM · Postgres (Neon) · Auth.js (Google) · Dexie (IndexedDB) + service worker for offline.

## Run locally

```bash
npm install
cp .env.example .env.local   # then set DEV_LOGIN=1, NEXT_PUBLIC_DEV_LOGIN=1, ADMIN_EMAILS=you@seecs.edu.pk
npm run dev
```

If `DATABASE_URL` is empty, the app uses an embedded PGlite database in `./.data`. It needs no setup and migrates itself. With `DEV_LOGIN=1`, the login page has an email-only sign-in, so Google credentials aren't needed locally.

To change the schema, edit `src/db/schema.ts`, then run `npm run db:generate` and commit the new file in `drizzle/`.

## Deploy for free (Vercel + Neon)

1. Push the repo to GitHub and import it in Vercel.
2. In Vercel, go to **Storage → Create → Neon Postgres**. This sets `DATABASE_URL`. Migrations run automatically during `npm run build`.
3. Create a Google OAuth client at [console.cloud.google.com](https://console.cloud.google.com/apis/credentials):
   - Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`
4. Set these environment variables in Vercel:
   - `AUTH_SECRET` (generate it with `npx auth secret`)
   - `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
   - `ADMIN_EMAILS`: comma-separated emails that are admins from their first sign-in
   - Optional: `ALLOWED_EMAIL_DOMAIN` (defaults to `seecs.edu.pk`)
5. Deploy. Leave `DEV_LOGIN` unset in production.

## How it works

- **Money** is stored as integer paisa. **Dates** are Pakistan time (`src/lib/time.ts`).
- **Stock** is an append-only ledger (`stock_moves`), and stock on hand is the sum of its entries. Each restock creates a *lot* with its unit cost. Sales, waste and count corrections draw from the oldest lots first (`src/lib/server/stock.ts`). Selling with an empty shelf is allowed: those units are recorded as owed and get costed when the next restock arrives.
- **Offline:** the counter keeps items and an outbox of operations in IndexedDB. Sale IDs are generated on the device and synced through `/api/sync`, which ignores duplicates, so a sale is never counted twice. A service worker caches the app so it opens without internet.
- **Accounts:** only `@seecs.edu.pk` Google accounts can sign in. New accounts stay pending until an admin approves them on the Team page. Every action is recorded in the activity log.
