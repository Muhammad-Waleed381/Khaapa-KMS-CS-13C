# Khaapa: complete project context

Handoff for an agent continuing this project. Read the "Rules" section before you change anything.

## 1. What this is

Khaapa is a class project (Semester 7, NUST SEECS): a management system for **Khaapa**, the student-run tuck shop at **SEECS, NUST H-12**, Islamabad. Its name is just "Khaapa" (not "K2 Khaapa"); the reference site's "K2 Block" wording does not apply. It sells snacks and drinks and takes cash or NayaPay.

It recreates the intent of the live reference app at http://khaapa.deeznust.com/ as a **separate codebase**; nothing was copied from that site. v1 covers everything on the reference site except coupons/promo codes, NayaPay auto-matching and the MCP/AI connector page, which the user said to skip for now.

Status as of 2026-10-19: all v1 modules are built and on `origin/main`. Production build, `tsc` and `eslint` are clean. The local dev database was wiped, so it starts empty.

### Vision and scope (confirmed with the user)

Khaapa is for the shop's **day-to-day operations** only. It is not growing into anything broader. There are two kinds of users:

- **Staff and admins** sign in and use the staff app to record sales and revenue, manage inventory, and run the duty schedule. The schedule is a mapping of names to times: who reports to the counter when, and who takes over next.
- **Customers** never sign in. They browse live stock on the public site and place pre-orders.

What's in and out:
- **Shares stay.** Admins record shareholders and running costs, and the app splits profit per share.
- **Duty schedule:** dated slots (person, date, start, end). Members submit weekly availability and admins assign slots. **Only admins change slots**, including for swaps and no-shows.
- **On duty now:** every staff screen shows who the schedule puts at the counter right now and who reports next.
- **Handover:** a counter shift **ends automatically at the end of the person's duty slot** (section 6.6).
- **Attendance stays out.** The planned schedule is the record. The counter's shift log is kept, but nothing compares it against the schedule.
- **Permissions are unchanged:** any active staff member can sell, void and edit items. Admins also manage the team, schedule, shares and settings.

## 2. Requirements and decisions from the user (don't re-ask)

| Topic | Decision |
|---|---|
| Hosting | Next.js on the **free Vercel tier**. Database is Neon Postgres (free), added through Vercel. |
| Offline | **Offline-first is mandatory.** Campus internet fails at rush hour, and the counter must never wait on the network. |
| Devices | Responsive. The POS mostly runs on a laptop and the public shop mostly on phones. |
| Login | Google sign-in, **any `@seecs.edu.pk` email**. Admins approve new users. The first admins come from the `ADMIN_EMAILS` env var. |
| Roles | `admin` and `member` only. "HR" means admins. |
| Payments at counter | Cash or online, **no split payments**. Cash records amount received and change. Cash and online totals are tracked separately. Online is just the cashier saying it was paid online (no NayaPay API). |
| Voids/edits | Allowed for any active staff member, but **logged with who did it and why**. |
| Selling at zero stock | Show a dialog, allow it, and **track the oversell**. |
| Costing | **FIFO**: buy and sell prices change over time, and the oldest units are sold first. Example: bought at Rs 20, later at Rs 30, selling at 40 means profit is 20 per unit until the Rs 20 units run out, then 10. |
| Inventory | Restocks with buy price; waste/expiry only (no batches or expiry dates); low-stock alerts; supplier optional. |
| Cash drawer | **Not needed** (no opening float or closing count). |
| HR scheduler | Members submit availability, then HR assigns all slots at once and can edit later. **No rules enforced.** Attendance checking is **out of scope**. Only admins edit slots (no staff swap requests). |
| On duty / handover | Staff screens show who's on duty now and who's next. A counter shift **closes automatically at the end of the person's duty slot**. |
| Pre-orders | **Advance payment** (NayaPay; customer submits a reference or screenshot, staff verify). Each day has its own cutoff time. |
| Shares | Shareholders have a share count and purchase price. Profit is divided over all shares, and each person sees their payout plus profit. |
| Coupons | **Not in v1.** |
| Receipts | No customer receipts, and nothing may slow down a sale. An internal end-of-day report is shareable (WhatsApp/copy). |
| Location | Khaapa is at **SEECS, NUST H-12**. The exact coordinates **33.64314917030392, 72.99074742883603** (given by the user) are the default in `api/public/_shop.ts`, and admins can edit them in Settings. The public site has a "how far am I" check. |
| Scale | Small, not enterprise. |
| Speed | The user wants maximum speed and **asked to use parallel sub-agents** for big work. |

## 3. Rules for working in this repo

- **Commits:** granular and logical, with clear messages. **No `Co-Authored-By` or any AI attribution lines. Never push.** (These are standing user preferences.)
- **Next.js 16.4.2** differs from older Next versions. Read `node_modules/next/dist/docs/` before using unfamiliar APIs (see `AGENTS.md`). Key points:
  - `cacheComponents: true` is on. Don't call `Date.now()`, `Math.random()` or `crypto.randomUUID()` during server or prerender rendering.
  - `useSearchParams` needs a `<Suspense>` boundary. This codebase reads `location.search` in an effect instead.
  - `middleware` is now `proxy`; it is unused here.
  - Route handler params are a `Promise`.
  - `experimental.instantInsights.validationLevel = "manual-warning"` is set, because pages load data on the client and would otherwise trigger "instant-unrendered-segment" dev warnings.
- **Schema changes:** edit `src/db/schema.ts`, run `npm run db:generate`, and commit the new `drizzle/` file. Never hand-edit migrations.
- **PGlite is single-process.** Only one process at a time can open `./.data/pglite`, so don't run two dev servers or a script against it while dev is running.
- **Port 3000** may already be in use; check before starting dev.

## 4. Stack

Next.js 16.4.2 (App Router, Turbopack), React 19.3, TypeScript, Tailwind CSS 4 (`@tailwindcss/turbopack`), Drizzle ORM 0.45, Neon serverless driver / PGlite 0.5 (local), Auth.js `next-auth@5.0.0-beta.32` (JWT sessions), Zod, Dexie 4 (IndexedDB), and a hand-written service worker. There's no UI library, chart library or SWR: everything is built by hand.

## 5. Running

```bash
npm install
cp .env.example .env.local
# local: DEV_LOGIN=1, NEXT_PUBLIC_DEV_LOGIN=1, ADMIN_EMAILS=<your>@seecs.edu.pk, AUTH_SECRET=<anything>
npm run dev
```

- With no `DATABASE_URL`, the app uses embedded **PGlite** in `./.data/pglite` (gitignored). It is created and migrated automatically on first DB access (`src/db/index.ts`).
- `DEV_LOGIN=1` adds an email-only "Credentials" provider with id `dev`, and the login page shows a form for it. It must **never** be set in production.
- `npm run build` runs `node scripts/migrate.mjs` (applies `drizzle/` to Neon, skipped without `DATABASE_URL`) followed by `next build`.
- Other scripts: `npm run typecheck`, `npm run lint`, `npm run db:generate`, `npm run db:migrate`.
- Env vars (see `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`, `ALLOWED_EMAIL_DOMAIN` (default `seecs.edu.pk`), `DEV_LOGIN`, `NEXT_PUBLIC_DEV_LOGIN`, `NEXT_PUBLIC_SW_DEV` (registers the service worker under `next dev`).
- Deployment steps (Vercel + Neon + Google OAuth redirect `https://<domain>/api/auth/callback/google`) are in `README.md`.

**Scripted login for curl tests**: `GET /api/auth/csrf`, then `POST /api/auth/callback/dev` with form fields `csrfToken` and `email`, keeping a cookie jar.

**Browser testing**: Chrome is at `/usr/bin/google-chrome`. Use `playwright-core` with `channel: "chrome"`, installed in a scratch directory rather than the project.

## 6. Architecture

### 6.1 Rendering model
- All staff pages are `"use client"` components that fetch JSON from `/api/*`. They prerender as **static shells**, which is what lets the service worker cache them for offline use.
- The public home page (`src/app/page.tsx`) is a static shell around client components in `src/components/public/`.
- API route handlers use the `route()` wrapper and are dynamic. Public GET routes call `connection()` so they are never prerendered.

### 6.2 Conventions (use these, don't reinvent them)
- **Money**: integer **paisa** everywhere (DB, API, client). `src/lib/money.ts` has `rs(paisa)` → "Rs 1,200" and `toPaisa`/`toRupees`.
- **Time**: Pakistan time (UTC+5, no DST). Dates are `YYYY-MM-DD` strings and times of day are `HH:MM`. `src/lib/time.ts` has `pkDate`, `pkTime`, `pkDayRange(date)` → UTC `[start, end)`, `addDays`, `weekday` (0 = Monday), `weekStart`, `WEEKDAYS`, `fmtDate`, `fmtDateTime`, `fmtClock`.
- **Server helpers** (`src/lib/server/api.ts`):
  - `route(fn)` wraps a handler: the return value becomes JSON; `HttpError(status, msg)` and Zod errors become `{error}` responses.
  - `requireUser({admin?})` returns 401 if not signed in and 403 if pending, disabled, or not an admin when `admin` is set. `currentUser()` returns the user or null.
  - `parseBody(req, zodSchema)`, `logActivity(db|tx, userId, kind, message, ref?)`, and `getSetting`/`setSetting` (stored in the `settings` table as JSON).
- **DB**: `const db = await getDb()`; tables come from `import { t } from "@/db"`. Types `DB` and `Tx` (transaction) are exported. Multi-step writes go in `db.transaction(async (tx) => …)`.
- **Route files may only export handlers.** Shared code lives beside them: `api/items/shared.ts`, `api/schedule/shared.ts`, `api/shareholders/schema.ts`, `api/public/_shop.ts`.
- **Client helpers**:
  - `api(url, {method, body})` throws `ApiError(status, message)`; status 0 means offline.
  - `useApi<T>(url)` returns `{data, error, loading, stale, reload, setData}` and caches the last good response in localStorage, so pages still show data offline, flagged `stale`; show it with `<StaleNote stale />`.
- **UI kit** (`src/components/ui.tsx`): `Button` (primary/secondary/ghost/danger, sizes sm/md/lg), `Input`, `Textarea`, `Select`, `Field`, `Card`, `Badge` (tones neutral/good/warn/bad/accent), `Modal` (bottom sheet on phones), `PageHeader`, `Empty`, `Spinner`, `Stat`, `StaleNote`, `cx`. Also `toast(text, "good"|"bad")` from `src/components/toast.tsx` and `<Icon name=…/>` from `src/components/icons.tsx`.
- **Design tokens** (`src/app/globals.css`, light and dark): `bg-bg`, `bg-surface`, `bg-muted`, `border-line`, `text-ink`, `text-ink-soft`, `text-ink-faint`, `bg-accent`/`text-accent` (#d9480f), `bg-accent-soft`. Use the tokens, not raw colors.
- **Staff shell** (`src/app/(staff)/layout.tsx`):
  - Loads `/api/me` and caches it in localStorage (`khaapa:me`) so the app works offline.
  - On 401 it redirects to `/login?next=…`; pending or disabled users get an approval screen.
  - It provides `useMe()` → `{user, shift, onCounter, isAdmin, reload}`.
  - The nav list is in `nav.ts`; admin-only entries are Shares, Team and Settings.
- **Activity kinds** are dotted prefixes (`item`, `stock.*`, `sale`, `sale.void`, `shift`, `preorder`, `schedule`, `team`, `shares`, `cost`, `settings`). The Activity page filters by prefix.

### 6.3 Auth (`src/auth.ts`)
- **Providers:** Google (with `hd=seecs.edu.pk`, `prompt=select_account`), plus the `dev` Credentials provider when `DEV_LOGIN=1`.
- **Access checks:**
  - The `signIn` callback rejects emails outside `ALLOWED_EMAIL_DOMAIN`.
  - The `jwt` callback upserts the `users` row: new users start `pending` / `member`, and emails in `ADMIN_EMAILS` become `active` admins.
  - Sessions are JWTs lasting 60 days, long enough to survive offline periods.
  - Authorization is checked against the DB row on every request (`requireUser`).

### 6.4 Data model (`src/db/schema.ts`, migration `drizzle/0000_init.sql`)
- `users`: email (unique), name, image, role (`admin|member`), status (`pending|active|disabled`), approvedBy.
- `items`: name, category, price (paisa), image (webp data URL, served via `/api/img/[id]`), lowStockAt, preorder (bool), active (archive flag), **owed** (units sold while out of stock and not yet costed), updatedAt (used as the image version).
- `lots`: FIFO batches with qtyIn, qtyLeft, unitCost and supplier.
- `stock_moves`: **append-only stock ledger**.
  - kind is one of `restock | sale | void | waste | correction | settle`.
  - qty is signed, and stock on hand = `SUM(qty)` per item.
  - Other columns: cost (the FIFO value moved), unitCost, allocations (JSON `[{lotId, qty, unitCost}]`), oversold, saleId, supplier, note, userId.
- `shifts`: id is **generated on the device**; userId, startedAt, endedAt.
- `sales`: id is **generated on the device** (idempotent sync). Columns: userId, shiftId, method (`cash|online`), total, cost (FIFO), cashReceived, change, oversold, preorderId, voided/voidReason/voidedBy/voidedAt, createdAt (device time) and syncedAt.
- `sale_lines`: saleId, itemId, name (snapshot), qty, unitPrice (as charged), cost, oversold.
- `availability`: userId, weekday (0 = Monday), start, end, note.
- `slots`: userId, date, start, end, note, createdBy.
- `preorder_days`: date (PK), open, cutoff `HH:MM`, note. A missing row means the day is closed.
- `preorders`: code (6 characters, unique), customerName, phone, note, pickupDate, lines (JSON with server-set prices), total, status (`awaiting_payment → paid → ready → collected`, or `cancelled`), paymentRef, proof (jpeg data URL ≤300 KB), saleId.
- `shareholders`: name, contact, shares, pricePerShare, boughtOn, note.
- `costs`: running costs (date, amount, note) that reduce profit.
- `activity`: userId, kind, message, ref, createdAt.
- `settings`: key/value JSON. Keys in use:
  - `shop`: location `{lat, lng, label}`, hours, nayapay `{name, handle, instructions}`, whatsapp; defaults are in `api/public/_shop.ts`.
  - `availability_open`: boolean.

### 6.5 FIFO stock engine (`src/lib/server/stock.ts`), the core of the app

**Invariants, per item:**
- stock = `SUM(stock_moves.qty)`
- `SUM(lots.qty_left)` = stock + owed
- owed > 0 only while stock < 0

**Functions** (all take a transaction `tx`):

| Function | What it does |
|---|---|
| `restock` | Adds a `restock` move, then puts the units on the shelf. If the item has `owed` units, they are **paid off first** at this restock's cost (a `settle` move with qty 0 and that cost), and the rest becomes a new lot. |
| `writeOff` | Waste or expiry. Takes units from the oldest lots and refuses if qty exceeds stock. |
| `countCorrection` | Sets stock to a shelf count. A negative difference takes units FIFO; a positive one adds units at the last unit cost. |
| `recordSale` | **Idempotent on sale id.** Takes units FIFO for each line; units that can't be covered are oversold (`items.owed += short`). Writes the sale, its lines and its moves, and uses the price and name sent by the device. |
| `voidSale` | Returns units to the lots they came from (via the stored allocations). Oversold units still owed are simply un-owed; any already paid off come back as a new lot at the last cost. Writes `void` moves with negative cost and marks the sale voided. |

Helpers: `stockOf`, `stockLevels`.

**Finance** (`src/lib/server/finance.ts`):
- `summary(db, from?, to?)` returns revenue, cash, online, counts, cogs, writeOffs, costs, grossProfit and netProfit.
- COGS = cost of `sale` + `settle` + `void` moves; write-offs = cost of `waste` + `correction` moves; net profit = revenue − COGS − write-offs − costs.
- `stockValue(db)` is the FIFO value of what's on the shelf.

These numbers are verified, through the API and the UI:
- Restocking 10 @ Rs 20 and 10 @ Rs 30, then wasting 12, costs Rs 260.
- A count then removed 3 @ Rs 30.
- An oversell plus a restock settled correctly, and voids restore stock and owed.
- A UI cash sale of Rs 140 with Rs 200 received recorded Rs 60 change.

### 6.6 Offline-first (`src/lib/client/offline/`, `public/sw.js`)
- **Dexie database "khaapa"** (`db.ts`) holds cached items, the **outbox** (ops `sale | shift_start | shift_end`, with tries and lastError), this device's local sales, and a meta table.
- **Sync** (`sync.ts`):
  - It flushes the outbox in order to `POST /api/sync` on load, on the `online` event, after each enqueue and every ~20 s, then refreshes the items cache.
  - A permanent 4xx rejection marks that op failed (shown in the UI with a retry) rather than blocking the queue; network errors and 5xx are retried.
  - Exports: `syncNow`, `queueSale`, `queueShift`, `cancelPendingSale`, `retryFailed`, `startSync`, `useSyncState`, `useCounterItems` (stock shown = server stock − pending sales), `useLive`.
- **Shifts** (`shift.ts`): `startShift`, `endShift`, `useLocalShift`, `adoptShift`, `holdShift`, `useShiftAutoEnd`. The current shift is kept locally and reconciled with `useMe().shift`.
- **Automatic end at slot end** (`src/lib/duty.ts` holds the shared rule):
  - A shift belongs to the person's first slot that day that hadn't ended when the shift started (`slotForShift`). With no such slot, the shift only ends by hand.
  - It closes at the slot's end time, or at the last sale on that shift if the handover ran over.
  - **Device:** `useShiftAutoEnd` in the staff layout checks every 15 s using the slots from `/api/me`, so it works offline. The POS calls `holdShift` while a sale is in the cart, so a handover never wipes it. The `shift_end` op carries `auto: true` so the activity log says it was automatic.
  - **Server:** `closeOverdueShifts` (`src/lib/server/shifts.ts`) applies the same rule. There's no cron on Vercel Hobby, so `/api/me`, `/api/shifts`, `/api/report` and collecting a pre-order call it first. Whichever side closes first wins; the other's `shift_end` is a duplicate.
- **On duty now** (`src/components/on-duty.tsx`): `/api/me` returns everyone's `slots` from yesterday to tomorrow. The widget sits in the sidebar, the mobile menu and the POS start screen, and re-renders every 30 s. The layout reloads `/api/me` every 5 minutes to pick up schedule edits.
- **`POST /api/sync`**:
  - Takes `{ ops: [{ id, type, payload }] }`, up to 100.
  - Op payloads:
    - sale: `{id, createdAt, method, cashReceived?, shiftId?, lines:[{itemId,name,qty,unitPrice}]}`
    - shift_start: `{id, startedAt}`, which closes any other open shift for that user
    - shift_end: `{id, endedAt}`
  - Each op runs in its own transaction and is idempotent. The response is `{results:[{id, ok, duplicate?, error?, permanent?}]}`.
- **Service worker** (`public/sw.js`):
  - Registered by `src/components/sw-register.tsx` in production only, or in dev with `NEXT_PUBLIC_SW_DEV=1`.
  - On install it precaches the shell routes.
  - Caching: cache-first for `/_next/static` and `/api/img`; network-first with cache fallback for page loads and same-origin GET `/api/*`, except auth and sync. Non-GET requests are never cached.
  - **Bump `VERSION`** in sw.js when caching behaviour changes.
- **PWA**: `src/app/manifest.ts` (start_url `/pos`), `src/app/icon.svg`, `src/app/apple-icon.png`, `public/icons/*`.
- **SyncStatus pill** (`src/components/sync-status.tsx`) in the sidebar and mobile header shows Synced / Syncing… / N pending / Offline · N pending / N rejected · retry.

## 7. Modules: pages and APIs

| Module | Pages | APIs |
|---|---|---|
| Counter | `/pos` | `POST /api/sync`, `GET /api/me` |
| Shifts | `/shifts` | `GET /api/shifts?limit=` → `{shifts:[…minutes], onCounter}` |
| Items & inventory | `/items` (`item-dialog.tsx`, `item-form.tsx`, `types.ts` with `imgSrc()`, `compressImage()`) | `GET/POST /api/items` (`?all=1` includes archived); `PATCH/DELETE /api/items/[id]` (delete archives); `POST …/restore`; `DELETE …/permanent` (admin, only if never moved); `POST …/stock` `{kind:"restock",qty,unitCost\|totalCost,supplier?,note?}` \| `{kind:"waste",qty,note?}` \| `{kind:"count",counted,note?}`; `GET …/moves?limit=` → `{moves, lots}`; `GET /api/img/[id]?v=` (public, immutable cache) |
| Sales | `/sales` | `GET /api/sales?date=&method=&userId=&voided=` → `{sales, totals, cashiers}`; `POST /api/sales/[id]/void {reason}` |
| Stats | `/stats` | `GET /api/stats?range=today\|7d\|30d\|all` |
| Day report | `/report` (Share via `navigator.share` → WhatsApp → copy) | `GET /api/report?date=` |
| Activity | `/activity` | `GET /api/activity?limit=&before=&kind=` → `{rows, next}` |
| Schedule (HR) | `/schedule` (`availability.tsx`, `plan.tsx`, `types.ts`); tabs Schedule / My availability / Plan week (admin) | `GET/POST /api/schedule/settings {availabilityOpen}`; `GET/POST /api/availability`, `DELETE /api/availability/[id]` (members are locked while collection is closed); `GET /api/slots?from=&to=`, `POST /api/slots`, `PATCH/DELETE /api/slots/[id]`, `POST /api/slots/bulk {slots}`, `POST /api/slots/copy-week {fromWeek,toWeek}` (admin) |
| Team | `/team` (admin) | `GET /api/users` (admin: full list; `?active=1` or non-admin: active names only); `PATCH /api/users/[id] {status?,role?,name?}` (can't change yourself) |
| Public site | `/` (`src/components/public/*`: menu, distance check via haversine and geolocation, hours, contact) | `GET /api/public/items` (availability `in\|few\|out` = stock − paid/ready pre-orders, never exact counts); `GET /api/public/info` |
| Pre-orders (customer) | `/preorder` (cart → details → NayaPay payment step → status; "My orders" codes kept in localStorage) | `POST /api/public/preorder`; `GET /api/public/preorders?codes=`; `POST /api/public/preorders/[id]/proof {code,paymentRef,proof?}` |
| Pre-orders (staff) | `/orders` (day open/cutoff controls for today and tomorrow, proof viewer, status buttons) | `GET /api/preorders?date=`, `GET /api/preorders/[id]/proof`, `POST /api/preorders/[id]/status {status}` (marking collected runs `recordSale` with method online and stores saleId); `GET /api/preorder-days?from=&to=`, `PUT /api/preorder-days/[date] {open,cutoff,note?}` |
| Shares | `/shares` (admin) | `GET/POST /api/shareholders`, `PATCH/DELETE /api/shareholders/[id]`; `GET/POST /api/costs`, `DELETE /api/costs/[id]`; `GET /api/shares/summary?from=&to=` (profitPerShare = netProfit / totalShares; per person: ownership %, invested, profit share, payout = invested + profit share) |
| Settings | `/settings` (admin) | `GET/POST /api/settings` (setting key `shop`) |
| Auth | `/login` | `/api/auth/*` (Auth.js), `GET /api/me` → `{user, shift, onCounter, slots}` |

## 8. Commit history (oldest first)

1. Scaffold Next.js 16 app with Tailwind and core dependencies
2. Add database schema with Neon/PGlite connection and migrations
3. Add Google sign-in restricted to SEECS emails with admin approval
4. Add API route helpers, FIFO stock engine and finance summary
5. Add UI kit, design tokens and staff app shell with placeholder pages
6. Add README with local setup and free deployment guide
7. Add shares module: shareholders, costs ledger and per-share profit split
8. Add items and inventory: FIFO restocks, waste, shelf counts and low-stock alerts
9. Add sales history with voids, stats, shareable day report and activity log
10. Add HR scheduler with availability collection, duty slots and team approvals
11. Add offline-first counter with outbox sync, cash change and shift tracking
12. Make the app an installable PWA with a service worker and sync status pill
13. Add public menu with live availability and distance check
14. Add customer pre-orders with advance payment proof and staff order management
15. Add admin settings for shop location, hours and NayaPay details
16. Validate instant navigation only for segments that opt in

How it was built: the lead agent wrote the foundation (commits 1–6), then six parallel sub-agents each built one module in its own files (commits 7–15), and the lead committed each module separately.

## 9. Verification status

**Verified:**
- `npm run build` succeeds: every page is static (○) and every API route is dynamic (ƒ). `tsc` and `eslint` are clean.
- Every module's API was tested with curl against the dev server, including the FIFO, oversell, void, idempotent-sync, pre-order and permission cases.
- Headless Chrome (desktop and 390px phone) loaded every staff page and the public pages with **no console or page errors**.
- A real cash sale went through the POS UI and synced with the correct lines and change.
- Automatic shift end at slot end:
  - With curl: the server closes at the slot end, closes at the last sale when a handover runs over, leaves the shift open while the slot runs, and logs the `auto` message.
  - In headless Chromium: the "On duty now" widget showed the current person and who's next (sidebar, start screen and phone menu), then switched to the next person at the handover. A cart held the shift open past the slot end. Completing the sale closed the shift on the device with a toast, and the server recorded `endedAt` at the sale time.

**Not yet verified:**
- Going offline in a real browser: the service worker only runs in production, so test it with `npm run build && npm start`, or with `NEXT_PUBLIC_SW_DEV=1`.
- Real Google OAuth and Neon in production (they need the user's credentials and deployment).
- A browser click-through of: the pre-order cart, payment-proof upload, the geolocation distance check, image upload, and the schedule planner's "Save all".
- Dark mode was not visually checked.

## 10. Known gaps and possible next steps

- **Waiting on the user:** the real NayaPay details, opening hours and WhatsApp number (the current ones are placeholders set through `/settings`).
- **Deferred:** coupons/promo codes, NayaPay payment matching, and the MCP/AI connector. Attendance (comparing shifts against slots) is out of scope.
- **Auto-end edge case:** if an admin assigns a slot that has already ended to someone mid-shift, their shift closes at that slot's end (or their last sale). They start a new shift to keep selling.
- **Vercel Hobby:** the plan is officially non-commercial, so mention this if the shop uses it long-term. Its cron is limited to once a day, so any future background job should be triggered by the app rather than on a timer.
- **Voids:**
  - Voiding needs the network (`/sales` page). The counter can only cancel sales that haven't synced yet.
  - Edge case: voiding an oversold sale whose units were already paid off by a restock puts those units back at the last unit cost, and the `settle` cost stays counted. This is acceptable at this scale.
- **Oversell cost:** an oversold unit gets its cost when the next restock pays it off. Until then, profit for that period overstates slightly.
- **No automated tests yet.** A good first addition would be unit tests for `src/lib/server/stock.ts` against PGlite.

## 11. Round 2 (2026-10-20): accounts, share requests, reports, demo data

**Decisions made in this round (don't re-ask):**
- "NayaPay" is shown as **"Online"** everywhere. Admins manage **payment accounts** (label, provider, title, number, active; deactivate rather than delete).
- The Counter has **one current receiving account**. A cashier changes it once and every later online sale uses it, with no prompt per sale. The change also works offline, as a `account_switch` op in the outbox.
- Every online sale (`sales.account_id`) and every pre-order (`preorders.account_id`) records the account. Reports total online money per account.
- **Share requests:** any approved account can request 1..cap shares, paying into the share account and attaching a screenshot. Admins approve or reject. The price is **locked at request time**, and approval creates a `shareholders` row with `user_id` and `purchase_id`. Profit is split **equally per share**. Share settings live in the setting key `shares`: `{pricePerShare, maxPerPerson, totalOnOffer, open, accountId}`.
- **Schedule:** members see **only their own duties** and their availability. HR (admins) see the Timetable, Availability and Plan week.
- **Landing page:** admins land on **Dashboard** (`/stats`) and everyone else on the Counter, via `/home`.
- **Still to discuss with the user:** how "payment received" should work for pre-orders. They flagged it and deferred it.

**New code:**
- Schema migration `drizzle/0001_accounts_and_share_purchases.sql`.
- APIs: `/api/accounts` (with `/current`), `/api/shares/{settings,mine}` and `/api/share-purchases/*`.
- Sales and shifts take `?from=&to=` periods.
- `POST /api/items` accepts `openingStock`, and `GET /api/items/[id]/moves` returns batches and price history.

**Demo data:**
- `npm run seed:demo` (`scripts/seed-demo.ts`, run directly by Node's type stripping) simulates 42 days with the same FIFO rules as the engine and bulk-inserts the result. It also creates payment accounts, a temporary switch to a backup account, and share requests across a price rise.
- Demo staff use `@demo.khaapa.invalid` emails, which can't sign in.
- `--wipe` empties every table; `--pglite <dir>` targets a local database.
- `npm run seed:reference` only imports the menu and photos.

**Testing without touching production:**
- `.env.local` points at **production Neon**. To test against a local database, stop the user's `npm run dev` (ask first) and run `DATABASE_URL= npm run dev`. With `DATABASE_URL` empty, the app uses PGlite in `./.data`.
- **Never run a second Next dev server or a `next build` with a different `distDir` inside the project folder while the user's dev server is running.** Its build output lands in the watched project tree and makes the user's server recompile and reload the browser about twice a second, which looks like an infinite render loop. This happened once. If you need an isolated server, put it in a separate git worktree outside the project folder.
- The dev login admin email must be in `ADMIN_EMAILS`. The user changed it to their real accounts, so `admin.bscs23seecs@…` is no longer an admin.

**Gotchas:**
- Never call `getSetting`, `setSetting`, `getDb` or `getShop` **inside a transaction**. On PGlite's single connection it deadlocks the whole server; on Neon it silently reads outside the transaction. Read through the `tx` you're given.
- `next build` logs "During prerendering, headers()/connection() rejects…" for cookie-reading API routes. This is harmless: they end up dynamic (ƒ) and the build exits 0.
- The Dashboard's number tickers and fade-ins only animate once they're scrolled into view, so full-page headless screenshots show "Rs 0" and blank cards.
