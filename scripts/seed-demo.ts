// Seeds six weeks of believable shop history: the reference site's menu and
// photos, staff, availability and duty slots, shifts, cash and online sales,
// restocks at changing buy prices (FIFO), waste, counts, voids, oversells,
// pre-orders, shareholders, running costs and the activity log.
//
//   node scripts/seed-demo.ts            # uses DATABASE_URL from the env
//   node scripts/seed-demo.ts --pglite ./.data/pglite
//   node scripts/seed-demo.ts --wipe     # empty every table first
//
// Run with: node --env-file=.env.local scripts/seed-demo.ts
//
// Refuses to run on a database that already has items or sales unless --wipe
// is given. Demo staff use @demo.khaapa.invalid emails, which can never sign
// in (the app only accepts @seecs.edu.pk), so they can't collide with real
// students. Stock follows the same FIFO rules as src/lib/server/stock.ts.

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import * as t from "../src/db/schema.ts";

const REF = "https://khaapa.deeznust.com";
const DAYS = 42;
const args = process.argv.slice(2);
const WIPE = args.includes("--wipe");
const PGLITE = args.includes("--pglite") ? args[args.indexOf("--pglite") + 1] : null;

// ---------------------------------------------------------------- helpers

let seed = 20261020;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
function weighted<T>(xs: T[], w: (x: T) => number): T {
  const total = xs.reduce((s, x) => s + w(x), 0);
  let r = rand() * total;
  for (const x of xs) if ((r -= w(x)) <= 0) return x;
  return xs[xs.length - 1];
}

const PKT = 5 * 3600_000;
const pkDate = (d: Date | number) => new Date(new Date(d).getTime() + PKT).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Mon
/** PKT date + minutes after midnight -> instant */
const at = (date: string, minutes: number) =>
  new Date(Date.parse(`${date}T00:00:00+05:00`) + Math.round(minutes * 60) * 1000);
const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const rs = (paisa: number) => {
  const v = paisa / 100;
  return `${v < 0 ? "−" : ""}Rs ${Math.abs(v).toLocaleString("en-PK", { maximumFractionDigits: Number.isInteger(v) ? 0 : 2, minimumFractionDigits: Number.isInteger(v) ? 0 : 2 })}`;
};

const NOW = Date.now();
const TODAY = pkDate(NOW);
const START = addDays(TODAY, -(DAYS - 1));
const dates = Array.from({ length: DAYS }, (_, i) => addDays(START, i));
const isPast = (d: Date) => d.getTime() <= NOW;

// ---------------------------------------------------------------- rows to insert

type Row<T extends { $inferInsert: unknown }> = T["$inferInsert"];
const rows = {
  users: [] as Row<typeof t.users>[],
  items: [] as Row<typeof t.items>[],
  lots: [] as Row<typeof t.lots>[],
  stockMoves: [] as Row<typeof t.stockMoves>[],
  shifts: [] as Row<typeof t.shifts>[],
  sales: [] as Row<typeof t.sales>[],
  saleLines: [] as Row<typeof t.saleLines>[],
  availability: [] as Row<typeof t.availability>[],
  slots: [] as Row<typeof t.slots>[],
  preorderDays: [] as Row<typeof t.preorderDays>[],
  preorders: [] as Row<typeof t.preorders>[],
  shareholders: [] as Row<typeof t.shareholders>[],
  costs: [] as Row<typeof t.costs>[],
  activity: [] as Row<typeof t.activity>[],
  paymentAccounts: [] as Row<typeof t.paymentAccounts>[],
  sharePurchases: [] as Row<typeof t.sharePurchases>[],
};
const log = (userId: string | null, kind: string, message: string, createdAt: Date, ref?: string) => {
  if (isPast(createdAt)) rows.activity.push({ userId, kind, message, ref, createdAt });
};

// ---------------------------------------------------------------- people

type Person = { id: string; name: string; role: "admin" | "member" };
const mkUser = (name: string, role: "admin" | "member", status: "active" | "pending" | "disabled", createdAt: Date, approvedBy?: string) => {
  const id = randomUUID();
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}@demo.khaapa.invalid`;
  rows.users.push({ id, email, name, role, status, approvedBy, createdAt });
  return { id, name, role } as Person;
};
const opening = at(addDays(START, -2), 20 * 60);
const ali = mkUser("Ali Raza", "admin", "active", opening);
const ayesha = mkUser("Ayesha Khan", "admin", "active", opening, ali.id);
const members = ["Hamza Tariq", "Fatima Noor", "Usman Sheikh", "Zainab Malik", "Bilal Ahmed", "Hira Javed"].map((n) =>
  mkUser(n, "member", "active", at(addDays(START, -2), int(20 * 60 + 10, 22 * 60)), ali.id),
);
const staff = [ali, ayesha, ...members];
log(ali.id, "team", `Approved ${ayesha.name}`, at(addDays(START, -2), 20 * 60 + 5), ayesha.id);
for (const m of members) log(ali.id, "team", `Approved ${m.name}`, at(addDays(START, -1), int(9 * 60, 11 * 60)), m.id);
const lateJoin = mkUser("Danish Mehmood", "member", "disabled", at(addDays(START, 6), 15 * 60), ali.id);
log(ali.id, "team", `Approved ${lateJoin.name}`, at(addDays(START, 6), 16 * 60), lateJoin.id);
log(ali.id, "team", `Disabled ${lateJoin.name}`, at(addDays(START, 27), 18 * 60), lateJoin.id);
for (const [n, d] of [["Saad Iqbal", -1], ["Maryam Aslam", 0]] as const) {
  mkUser(n, "member", "pending", at(addDays(TODAY, d), Math.min(hm("09:30") + int(0, 300), (NOW - Date.parse(`${TODAY}T00:00:00+05:00`)) / 60000 - 5)));
}

// Weekly availability (0 = Mon). Admins mostly cover gaps.
for (const p of [...members, ayesha]) {
  const days = [0, 1, 2, 3, 4].filter(() => chance(0.65));
  for (const wd of days.length ? days : [int(0, 4)]) {
    const [s, e] = pick([["09:00", "13:00"], ["11:00", "15:00"], ["13:00", "17:00"], ["09:00", "11:00"], ["15:00", "17:00"]]);
    rows.availability.push({ userId: p.id, weekday: wd, start: s, end: e, createdAt: at(addDays(START, -1), int(12 * 60, 22 * 60)) });
  }
  if (chance(0.4)) rows.availability.push({ userId: p.id, weekday: 5, start: "10:00", end: "14:00", note: "Saturdays are free", createdAt: at(addDays(START, -1), 21 * 60) });
}
const freeAt = (p: Person, wd: number, s: string, e: string) =>
  rows.availability.some((a) => a.userId === p.id && a.weekday === wd && a.start <= s && a.end >= e);

// ---------------------------------------------------------------- payment accounts

// The shop's main wallet. For two weeks it hit its monthly limit, so online
// payments went to the treasurer's JazzCash, then back.
const mkAccount = (label: string, provider: string, accountTitle: string, accountNumber: string, createdAt: Date) => {
  const id = randomUUID();
  rows.paymentAccounts.push({ id, label, provider, accountTitle, accountNumber, active: true, createdBy: ali.id, createdAt });
  return { id, label, provider, accountNumber };
};
const mainAccount = mkAccount("Shop main", "NayaPay", "Khaapa SEECS", "0300 0000 101", at(addDays(START, -2), 21 * 60));
const backupAccount = mkAccount("Treasurer (backup)", "JazzCash", ayesha.name, "0300 0000 202", at(addDays(START, 15), 12 * 60));
const SWITCH_AWAY = at(addDays(START, 16), 9 * 60 + 5);
const SWITCH_BACK = at(addDays(START, 30), 9 * 60 + 10);
const accountAt = (when: Date) => (when >= SWITCH_AWAY && when < SWITCH_BACK ? backupAccount : mainAccount);
const describe = (a: { label: string; provider: string; accountNumber: string }) => `${a.label} (${a.provider} ••${a.accountNumber.slice(-4)})`;
log(ali.id, "account", `Added payment account ${describe(mainAccount)}`, at(addDays(START, -2), 21 * 60 + 1), mainAccount.id);
log(ali.id, "account", `${ali.name} switched online payments to ${describe(mainAccount)}`, at(addDays(START, -2), 21 * 60 + 2), mainAccount.id);
log(ayesha.id, "account", `Added payment account ${describe(backupAccount)}`, at(addDays(START, 15), 12 * 60 + 1), backupAccount.id);
log(members[0].id, "account", `${members[0].name} switched online payments to ${describe(backupAccount)}`, SWITCH_AWAY, backupAccount.id);
log(ayesha.id, "account", `${ayesha.name} switched online payments to ${describe(mainAccount)}`, SWITCH_BACK, mainAccount.id);

// ---------------------------------------------------------------- items

type Ref = { id: number; name: string; category: string; price: number; image_key: string | null; availability: "in" | "low" | "out" };
console.log("Fetching the reference menu…");
const ref: Ref[] = (await (await fetch(`${REF}/api/public/items`)).json()).items;

async function image(key: string | null) {
  if (!key) return null;
  const res = await fetch(`${REF}/api/img/${key}`);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !/^image\/(webp|png|jpeg)$/.test(type)) return null;
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

type Lot = { id: string; qtyIn: number; qtyLeft: number; unitCost: number; supplier: string | null; createdAt: Date };
type Sim = {
  id: string;
  name: string;
  category: string;
  price: number; // current (final) price
  oldPrice: number | null; // before the mid-period price rise
  raiseOn: string | null;
  costRatio: number;
  weight: number;
  perishable: boolean;
  lunch: boolean;
  caseSize: number;
  lowStockAt: number;
  finalState: Ref["availability"];
  lots: Lot[];
  owed: number;
  stock: number;
  lastCost: number;
};

const RAISE_DAY = addDays(START, 23);
const items: Sim[] = [];
for (const r of ref) {
  const name = r.name.replace(/\s+/g, " ").trim();
  const price = Math.round(r.price * 100);
  const perishable = /homemade|biryani|cupcake|lunch deal/i.test(name);
  const lunch = /biryani|lunch deal/i.test(name);
  const cheap = r.price <= 20;
  let weight = r.price === 0 ? 0 : r.price <= 6 ? 5 : r.price <= 20 ? 7 : r.price <= 80 ? 5 : r.price <= 120 ? 2.5 : r.price <= 350 ? 1.2 : 0.5;
  if (r.category === "Drinks") weight *= 1.6;
  if (perishable) weight *= lunch ? 4 : 2.5; // fresh food sells out most days
  if (/cocomo|slanty|cola next|mineral water|lays|cheetos|candi/i.test(name)) weight *= 1.5;
  weight *= between(0.7, 1.3);
  const raise = !perishable && r.price >= 15 && r.price <= 120 && chance(0.18);
  const step = r.price <= 20 ? 500 : 1000;
  items.push({
    id: randomUUID(),
    name,
    category: r.category || "Snacks",
    price,
    oldPrice: raise ? price - step : null,
    raiseOn: raise ? RAISE_DAY : null,
    costRatio: perishable ? between(0.55, 0.65) : between(0.66, 0.8),
    weight,
    perishable,
    lunch,
    caseSize: perishable ? 1 : cheap ? 24 : r.category === "Drinks" ? 12 : 6,
    lowStockAt: perishable ? 2 : cheap ? 8 : 5,
    finalState: r.availability,
    lots: [],
    owed: 0,
    stock: 0,
    lastCost: 0,
  });
}
console.log(`Fetching ${ref.filter((r) => r.image_key).length} photos…`);
const images = await Promise.all(ref.map((r) => image(r.image_key)));
const itemCreated = at(addDays(START, -1), 16 * 60);
items.forEach((it, i) => {
  rows.items.push({
    id: it.id,
    name: it.name,
    category: it.category,
    price: it.price,
    image: images[i],
    lowStockAt: it.lowStockAt,
    preorder: it.price > 0 && !/sticker|tissue/i.test(it.name),
    active: true,
    owed: 0,
    createdAt: itemCreated,
    updatedAt: it.raiseOn ? at(it.raiseOn, 8 * 60 + 40) : itemCreated,
  });
  log(ayesha.id, "item", `Added ${it.name} at ${rs(it.oldPrice ?? it.price)}`, new Date(itemCreated.getTime() + i * 20_000), it.id);
});
const priceOn = (it: Sim, date: string) => (it.raiseOn && date < it.raiseOn ? it.oldPrice! : it.price);
for (const it of items.filter((i) => i.raiseOn)) {
  log(ayesha.id, "item", `Edited ${it.name}: price ${rs(it.oldPrice!)} → ${rs(it.price)}`, at(RAISE_DAY, 8 * 60 + 40), it.id);
}
const sellable = items.filter((i) => i.weight > 0);

// ---------------------------------------------------------------- FIFO (mirrors src/lib/server/stock.ts)

function take(it: Sim, qty: number) {
  let need = qty;
  let cost = 0;
  const allocations: { lotId: string; qty: number; unitCost: number }[] = [];
  for (const lot of it.lots) {
    if (need <= 0) break;
    if (lot.qtyLeft <= 0) continue;
    const q = Math.min(need, lot.qtyLeft);
    lot.qtyLeft -= q;
    allocations.push({ lotId: lot.id, qty: q, unitCost: lot.unitCost });
    cost += q * lot.unitCost;
    need -= q;
  }
  return { cost, allocations, short: need };
}
function put(it: Sim, qty: number, unitCost: number, when: Date, userId: string, supplier: string | null) {
  const settle = Math.min(it.owed, qty);
  if (settle > 0) {
    it.owed -= settle;
    rows.stockMoves.push({
      itemId: it.id, kind: "settle", qty: 0, cost: settle * unitCost, unitCost, userId, createdAt: when,
      note: `Cost of ${settle} unit${settle > 1 ? "s" : ""} sold while out of stock`,
    });
  }
  const lot: Lot = { id: randomUUID(), qtyIn: qty, qtyLeft: qty - settle, unitCost, supplier, createdAt: when };
  it.lots.push(lot);
  it.lastCost = unitCost;
}
function restock(it: Sim, qty: number, when: Date, user: Person, supplier: string, note?: string) {
  const date = pkDate(when);
  const drift = between(0.97, 1.04) * (it.raiseOn && date >= it.raiseOn ? 1.06 : 1);
  const total = Math.round((priceOn(it, date) * it.costRatio * drift * qty) / 1000) * 1000; // whole Rs 10
  const unitCost = Math.max(100, Math.round(total / qty));
  rows.stockMoves.push({ itemId: it.id, kind: "restock", qty, unitCost, supplier, note, userId: user.id, createdAt: when });
  put(it, qty, unitCost, when, user.id, supplier);
  it.stock += qty;
  log(user.id, "stock", `Restocked ${qty} × ${it.name} at ${rs(unitCost)} each from ${supplier}`, when, it.id);
}
function writeOff(it: Sim, qty: number, when: Date, user: Person, note: string) {
  const { cost, allocations } = take(it, qty);
  rows.stockMoves.push({ itemId: it.id, kind: "waste", qty: -qty, cost, allocations, note, userId: user.id, createdAt: when });
  it.stock -= qty;
  log(user.id, "stock", `Wrote off ${qty} × ${it.name} (${note})`, when, it.id);
}
function count(it: Sim, counted: number, when: Date, user: Person, note: string) {
  const delta = counted - it.stock;
  if (delta < 0) {
    const { cost, allocations } = take(it, -delta);
    rows.stockMoves.push({ itemId: it.id, kind: "correction", qty: delta, cost, allocations, note, userId: user.id, createdAt: when });
  } else if (delta > 0) {
    rows.stockMoves.push({ itemId: it.id, kind: "correction", qty: delta, unitCost: it.lastCost, note, userId: user.id, createdAt: when });
    put(it, delta, it.lastCost, when, user.id, null);
  }
  it.stock = counted;
  log(user.id, "stock", `Counted ${it.name}: ${counted} on the shelf (${delta === 0 ? "no difference" : `${delta > 0 ? "+" : ""}${delta}`})`, when, it.id);
}

type SaleRow = Row<typeof t.sales> & { id: string; total: number };
function sell(
  lines: { it: Sim; qty: number }[], when: Date, user: Person, shiftId: string | null,
  method: "cash" | "online", preorderId: string | null = null,
): SaleRow {
  const id = randomUUID();
  const date = pkDate(when);
  let total = 0;
  let cost = 0;
  let oversold = false;
  for (const { it, qty } of lines) {
    const unitPrice = priceOn(it, date);
    const r = take(it, qty);
    if (r.short > 0) {
      it.owed += r.short;
      oversold = true;
    }
    it.stock -= qty;
    total += unitPrice * qty;
    cost += r.cost;
    rows.stockMoves.push({
      itemId: it.id, kind: "sale", qty: -qty, cost: r.cost, allocations: r.allocations, oversold: r.short,
      saleId: id, userId: user.id, createdAt: when,
    });
    rows.saleLines.push({ saleId: id, itemId: it.id, name: it.name, qty, unitPrice, cost: r.cost, oversold: r.short });
  }
  let cashReceived: number | null = null;
  if (method === "cash") {
    const rup = total / 100;
    const options = [rup, Math.ceil(rup / 50) * 50, Math.ceil(rup / 100) * 100, rup <= 500 ? 500 : 1000, 1000];
    cashReceived = Math.round(weighted(options.map((v, i) => [v, [5, 3, 3, 1.2, rup < 150 ? 0.3 : 0.8][i]] as const), (o) => o[1])[0] * 100);
    if (cashReceived < total) cashReceived = total;
  }
  // Most sales sync within seconds; a few waited out a dropped connection.
  const syncDelay = chance(0.04) ? int(5 * 60, 40 * 60) : int(1, 25);
  const sale: SaleRow = {
    id, userId: user.id, shiftId, method, total, cost, oversold, preorderId,
    accountId: method === "online" ? accountAt(when).id : null,
    cashReceived, change: cashReceived === null ? null : cashReceived - total,
    createdAt: when, syncedAt: new Date(when.getTime() + syncDelay * 1000),
  };
  rows.sales.push(sale);
  const units = lines.reduce((s, l) => s + l.qty, 0);
  log(user.id, "sale", `Sold ${units} item${units > 1 ? "s" : ""} · ${rs(total)} ${method}`, when, id);
  return sale;
}
function voidSale(sale: SaleRow, when: Date, user: Person, reason: string) {
  for (const m of rows.stockMoves.filter((x) => x.saleId === sale.id && x.kind === "sale")) {
    const it = items.find((i) => i.id === m.itemId)!;
    for (const a of m.allocations ?? []) it.lots.find((l) => l.id === a.lotId)!.qtyLeft += a.qty;
    if (m.oversold! > 0) {
      const unOwe = Math.min(it.owed, m.oversold!);
      it.owed -= unOwe;
      const back = m.oversold! - unOwe;
      if (back > 0) it.lots.push({ id: randomUUID(), qtyIn: back, qtyLeft: back, unitCost: it.lastCost, supplier: null, createdAt: when });
    }
    it.stock -= m.qty;
    rows.stockMoves.push({ itemId: it.id, kind: "void", qty: -m.qty, cost: -(m.cost ?? 0), saleId: sale.id, userId: user.id, note: reason, createdAt: when });
  }
  Object.assign(sale, { voided: true, voidReason: reason, voidedBy: user.id, voidedAt: when });
  log(user.id, "sale.void", `Voided sale ${rs(sale.total)} — ${reason}`, when, sale.id);
}

// ---------------------------------------------------------------- the shop, day by day

const SUPPLIERS = ["Metro Cash & Carry", "Metro Cash & Carry", "Imtiaz Super Market", "Al-Fatah", "Wholesale, G-9 Markaz"];
const HOME_KITCHEN = "Home kitchen";
const SLOT_TEMPLATES: Record<number, [string, string][]> = {
  0: [["09:00", "11:00"], ["11:00", "13:00"], ["13:00", "15:00"], ["15:00", "17:00"]],
  1: [["09:00", "11:00"], ["11:00", "13:00"], ["13:00", "15:00"], ["15:00", "17:00"]],
  2: [["09:00", "11:00"], ["11:00", "13:00"], ["13:00", "15:00"], ["15:00", "17:00"]],
  3: [["09:00", "11:00"], ["11:00", "13:00"], ["13:00", "15:00"], ["15:00", "17:00"]],
  4: [["09:00", "11:00"], ["11:00", "13:00"], ["13:00", "15:00"]],
  5: [["10:00", "14:00"]],
};
// Sales per hour on a normal weekday, before the trend and weekday factors.
const RATE: Record<number, number> = { 9: 3, 10: 6, 11: 9, 12: 8, 13: 12, 14: 9, 15: 6, 16: 4 };
const VOID_REASONS = ["Rang up twice", "Wrong item tapped", "Customer changed their mind", "Was online, rang up as cash", "Wrong quantity"];
const FIRST = ["Ahmed", "Sana", "Hassan", "Areeba", "Talha", "Mahnoor", "Abdullah", "Iqra", "Shahzaib", "Rida", "Hamid", "Laiba", "Umer", "Noor", "Faizan", "Anaya"];
const LAST = ["Butt", "Chaudhry", "Qureshi", "Siddiqui", "Mirza", "Abbasi", "Awan", "Bhatti", "Raja", "Hashmi"];
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = () => Array.from({ length: 6 }, () => pick([...CODE_CHARS])).join("");
const usedCodes = new Set<string>();

// Expected units per day, used to size restocks.
const avgSales = 52;
const totalWeight = sellable.reduce((s, i) => s + i.weight, 0);
const daily = (it: Sim) => (avgSales * 1.75 * it.weight) / totalWeight;
const target = (it: Sim) => Math.max(it.caseSize, Math.ceil((daily(it) * 4) / it.caseSize) * it.caseSize) + it.lowStockAt;

// Shares: Rs 5,000 each, at most 3 per person. The two founders were entered
// by hand; everyone else bought through share requests. The price went up to
// Rs 5,500 in week four, and earlier buyers keep the price they paid.
const SHARE_CAP = 3;
const PRICE_RISE = addDays(START, 24);
const sharePrice = (date: string) => (date < PRICE_RISE ? 500_000 : 550_000);
const shareholderDay = addDays(START, -3);
for (const p of [ali, ayesha]) {
  const id = randomUUID();
  rows.shareholders.push({ id, name: p.name, contact: "Founder", shares: SHARE_CAP, pricePerShare: 500_000, boughtOn: shareholderDay, createdAt: at(shareholderDay, 21 * 60) });
  log(ali.id, "shares", `Added shareholder ${p.name} (${SHARE_CAP} shares)`, at(shareholderDay, 21 * 60 + 2), id);
}
log(ali.id, "shares", "Opened share sales: Rs 5,000 per share, up to 3 per person", at(shareholderDay, 21 * 60 + 5));
log(ayesha.id, "shares", "Raised the share price to Rs 5,500", at(PRICE_RISE, 10 * 60));
const shareRequest = (
  person: Person, shares: number, date: string, minutes: number,
  status: "approved" | "rejected" | "pending", note?: string,
) => {
  const createdAt = at(date, minutes);
  if (!isPast(createdAt)) return;
  const id = randomUUID();
  const price = sharePrice(date);
  const decidedAt = status === "pending" ? null : at(addDays(date, 1), 10 * 60 + int(0, 90));
  const decided = decidedAt && isPast(decidedAt) ? decidedAt : null;
  const req: Row<typeof t.sharePurchases> = {
    id, userId: person.id, shares, pricePerShare: price, total: shares * price, accountId: mainAccount.id,
    paymentRef: `NP${int(10000000, 99999999)}`, status: decided ? status : "pending", note: decided ? note : null,
    decidedBy: decided ? ayesha.id : null, decidedAt: decided, createdAt,
  };
  rows.sharePurchases.push(req);
  log(person.id, "shares", `${person.name} requested ${shares} share${shares > 1 ? "s" : ""} (${rs(shares * price)})`, createdAt, id);
  if (!decided) return;
  if (status === "approved") {
    rows.shareholders.push({
      name: person.name, contact: `${person.name.toLowerCase().replace(/\s+/g, ".")}@demo.khaapa.invalid`, shares, pricePerShare: price,
      boughtOn: pkDate(decided), userId: person.id, purchaseId: id, createdAt: decided,
    });
    log(ayesha.id, "shares", `Approved ${person.name}'s request for ${shares} share${shares > 1 ? "s" : ""} at ${rs(price)}`, decided, id);
  } else {
    log(ayesha.id, "shares", `Rejected ${person.name}'s share request${note ? ` (${note})` : ""}`, decided, id);
  }
};
shareRequest(members[0], 2, addDays(START, -2), 13 * 60, "approved"); // Hamza
shareRequest(members[2], 1, addDays(START, 1), 19 * 60, "approved"); // Usman
shareRequest(members[3], 2, addDays(START, 3), 21 * 60, "approved"); // Zainab
shareRequest(lateJoin, 1, addDays(START, 8), 20 * 60, "rejected", "Payment not received");
shareRequest(members[1], 1, addDays(START, 26), 18 * 60, "approved"); // Fatima, at the new price
shareRequest(members[4], 1, addDays(START, 33), 17 * 60, "approved"); // Bilal
shareRequest(members[5], 1, addDays(TODAY, -1), 20 * 60, "pending"); // Hira, waiting
const addCost = (date: string, rupees: number, note: string, by: Person, minutes = 18 * 60) => {
  const when = at(date, minutes);
  if (!isPast(when)) return;
  const id = randomUUID();
  rows.costs.push({ id, date, amount: rupees * 100, note, userId: by.id, createdAt: when });
  log(by.id, "cost", `Added cost ${rs(rupees * 100)}: ${note}`, when, id);
};
addCost(addDays(START, -1), 4500, "Display rack and baskets", ayesha);
addCost(addDays(START, -1), 300, "Printing the rate list", ayesha);

// Opening stock, the evening before the first day.
for (const it of sellable) {
  restock(it, it.perishable ? Math.max(2, Math.round(daily(it))) : target(it), at(addDays(START, -1), 17 * 60 + int(0, 60)), ayesha, "Metro Cash & Carry", "Opening stock");
}
log(ali.id, "settings", `${ali.name} updated shop settings`, at(addDays(START, -1), 22 * 60));

for (const [dayIndex, date] of dates.entries()) {
  const wd = weekday(date);
  const templates = SLOT_TEMPLATES[wd];
  if (!templates) continue; // closed on Sundays
  const trend = 0.72 + (0.38 * dayIndex) / (DAYS - 1); // word got around
  const dayFactor = (wd === 4 ? 0.8 : wd === 5 ? 0.45 : 1) * between(0.85, 1.15);
  const daysLeft = DAYS - 1 - dayIndex;

  // Sunday evening: plan the coming week.
  if (wd === 0) {
    const n = Object.entries(SLOT_TEMPLATES).reduce((s, [, v]) => s + v.length, 0);
    log(ali.id, "schedule", `Assigned ${n} duty slots`, at(addDays(date, -1), 20 * 60 + int(0, 50)));
  }

  // Morning restock run on Mondays and Thursdays; homemade food every day.
  const runner = pick([ali, ayesha, members[0], members[2]]);
  if (wd === 0 || wd === 3) {
    const supplier = pick(SUPPLIERS);
    let t0 = 8 * 60 + int(15, 45);
    for (const it of sellable.filter((i) => !i.perishable)) {
      const stopAfter = it.finalState === "out" ? 7 : it.finalState === "low" ? 4 : -1;
      if (daysLeft < stopAfter) continue;
      if (it.stock < target(it) * 0.5) {
        const want = target(it) - Math.max(it.stock, 0);
        restock(it, Math.ceil(want / it.caseSize) * it.caseSize, at(date, (t0 += 0.4)), runner, supplier);
      }
    }
    addCost(date, pick([300, 350, 400, 450]), `Rickshaw to ${supplier} and back`, runner, t0 + 2);
  } else {
    // Mid-week top-up of anything that ran out.
    for (const it of sellable.filter((i) => !i.perishable && i.stock <= 0 && i.finalState === "in" && chance(0.5))) {
      restock(it, it.caseSize, at(date, 8 * 60 + int(30, 55)), runner, "Imtiaz Super Market");
    }
  }
  for (const it of sellable.filter((i) => i.perishable)) {
    if (wd === 5 || (it.finalState === "out" && daysLeft < 3)) continue;
    // Homemade food is made for the day: about what usually sells.
    const qty = Math.round(daily(it) * trend * dayFactor + between(-0.6, 0.6)) - Math.max(it.stock, 0);
    if (qty > 0) restock(it, qty, at(date, 8 * 60 + int(40, 58)), pick(members), HOME_KITCHEN);
  }
  if (dayIndex % 14 === 3) addCost(date, 650, "Shopping bags (pack of 500)", ayesha);

  // Duty slots and the shifts that actually happened.
  const slotsToday: { person: Person; start: string; end: string; shiftId: string | null }[] = [];
  templates.forEach(([s, e], i) => {
    const free = staff.filter((p) => freeAt(p, wd, s, e) && !slotsToday.some((x) => x.person.id === p.id));
    const person = free.length ? pick(free) : pick(i % 2 ? [ali, ayesha] : members);
    rows.slots.push({ userId: person.id, date, start: s, end: e, createdBy: ali.id, createdAt: at(addDays(date, -1 - wd), 20 * 60) });
    slotsToday.push({ person, start: s, end: e, shiftId: null });
  });

  for (const slot of slotsToday) {
    const startedAt = at(date, hm(slot.start) + between(-6, 12));
    if (!isPast(startedAt)) continue;
    const shiftId = randomUUID();
    slot.shiftId = shiftId;
    const autoEnd = chance(0.2);
    const plannedEnd = at(date, hm(slot.end) + (autoEnd ? 0 : between(-4, 9)));
    const endedAt = isPast(plannedEnd) ? plannedEnd : null;
    rows.shifts.push({ id: shiftId, userId: slot.person.id, startedAt, endedAt });
    log(slot.person.id, "shift", "Started a shift", startedAt, shiftId);

    // Customers, minute by minute.
    const until = endedAt ?? new Date(NOW);
    for (let m = startedAt.getTime() + 60_000; m < until.getTime(); m += 60_000) {
      const when = new Date(m + int(0, 59) * 1000);
      const hour = Number(new Date(when.getTime() + PKT).toISOString().slice(11, 13));
      if (!chance(((RATE[hour] ?? 0) * trend * dayFactor) / 60)) continue;
      const minutes = (when.getTime() - Date.parse(`${date}T00:00:00+05:00`)) / 60000;
      const lunchTime = minutes >= hm("12:30") && minutes <= hm("15:00");
      const nLines = weighted([1, 2, 3, 4], (n) => [55, 30, 12, 3][n - 1]);
      const lines: { it: Sim; qty: number }[] = [];
      for (let k = 0; k < nLines; k++) {
        const pool = sellable.filter((i) => (lunchTime || !i.lunch) && !lines.some((l) => l.it === i));
        let it = weighted(pool, (i) => i.weight * (i.stock > 0 ? 1 : i.stock > -3 ? 0.08 : 0));
        if (it.stock <= 0 && !chance(0.35)) it = weighted(pool, (i) => (i.stock > 0 ? i.weight : 0));
        if (!it || (it.stock <= 0 && it.stock <= -3)) continue;
        const qty = priceOn(it, date) <= 600 ? int(2, 5) : weighted([1, 2, 3], (q) => [80, 15, 5][q - 1]);
        lines.push({ it, qty });
      }
      if (!lines.length) continue;
      const sale = sell(lines, when, slot.person, shiftId, chance(0.62) ? "cash" : "online");
      if (chance(0.009)) {
        const when2 = new Date(when.getTime() + int(30, 400) * 1000);
        if (isPast(when2)) voidSale(sale, when2, chance(0.8) ? slot.person : pick([ali, ayesha]), pick(VOID_REASONS));
      }
    }
    if (endedAt) {
      const mins = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
      const length = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      log(slot.person.id, "shift", autoEnd ? `Shift ended automatically at the end of the duty slot (${length})` : `Ended a shift (${length})`, endedAt, shiftId);
    }
  }

  // Pre-orders (from the second week, when they were switched on).
  const closeAt = at(date, hm(templates[templates.length - 1][1]));
  if (dayIndex >= 7 && wd <= 4) {
    const open = chance(0.85) || date >= addDays(TODAY, 0);
    rows.preorderDays.push({ date, open, cutoff: "11:00" });
    if (open) {
      const n = date === TODAY ? 3 : int(0, 3);
      for (let k = 0; k < n; k++) {
        const placedAt = chance(0.4) ? at(addDays(date, -1), int(18 * 60, 23 * 60)) : at(date, int(8 * 60, 10 * 60 + 55));
        if (!isPast(placedAt)) continue;
        const pool = sellable.filter((i) => i.lunch || (!i.perishable && rows.items.find((r) => r.id === i.id)!.preorder));
        const lines = [...new Set(Array.from({ length: int(1, 3) }, () => weighted(pool, (i) => (i.lunch ? 6 : i.weight))))].map((it) => ({
          it, qty: it.lunch ? 1 : int(1, 3),
        }));
        const total = lines.reduce((s, l) => s + priceOn(l.it, date) * l.qty, 0);
        let c = code();
        while (usedCodes.has(c)) c = code();
        usedCodes.add(c);
        const id = randomUUID();
        const customer = `${pick(FIRST)} ${pick(LAST)}`;
        const order: Row<typeof t.preorders> = {
          id, code: c, customerName: customer, phone: `0300-0000${String(int(100, 999))}`,
          pickupDate: date, total, status: "awaiting_payment", createdAt: placedAt, accountId: accountAt(placedAt).id,
          lines: lines.map((l) => ({ itemId: l.it.id, name: l.it.name, qty: l.qty, unitPrice: priceOn(l.it, date) })),
        };
        rows.preorders.push(order);
        log(null, "preorder", `New pre-order ${c} from ${customer} (${rs(total)})`, placedAt, id);
        const proofAt = new Date(placedAt.getTime() + int(3, 25) * 60_000);
        if (!isPast(proofAt) || (date === TODAY && k === 0)) continue;
        order.paymentRef = `NP${int(10000000, 99999999)}`;
        log(null, "preorder", `Payment proof sent for pre-order ${c} (ref ${order.paymentRef})`, proofAt, id);
        const onDuty = slotsToday[0].person;
        const paidAt = date === pkDate(proofAt) ? new Date(proofAt.getTime() + int(5, 40) * 60_000) : at(date, 9 * 60 + int(5, 50));
        if (chance(0.06)) {
          order.status = "cancelled";
          log(onDuty.id, "preorder", `${onDuty.name} cancelled pre-order ${c}`, paidAt, id);
          continue;
        }
        if (!isPast(paidAt)) continue;
        order.status = "paid";
        log(onDuty.id, "preorder", `${onDuty.name} verified payment for pre-order ${c}`, paidAt, id);
        const readyAt = at(date, int(11 * 60 + 30, 12 * 60 + 20));
        if (!isPast(readyAt)) continue;
        const counter = slotsToday.find((s) => hm(s.start) <= hm("12:00") && hm(s.end) > hm("12:00")) ?? slotsToday[0];
        order.status = "ready";
        log(counter.person.id, "preorder", `${counter.person.name} marked ready pre-order ${c}`, readyAt, id);
        const collectedAt = at(date, int(12 * 60 + 25, 14 * 60 + 30));
        if (!isPast(collectedAt) || collectedAt > closeAt) continue;
        const handing = slotsToday.find((s) => at(date, hm(s.start)) <= collectedAt && collectedAt < at(date, hm(s.end))) ?? counter;
        const sale = sell(lines, collectedAt, handing.person, handing.shiftId, "online", id);
        order.status = "collected";
        order.saleId = sale.id;
        log(handing.person.id, "preorder", `${handing.person.name} handed over pre-order ${c}`, collectedAt, id);
      }
    }
  }

  // Closing: day-old homemade food goes, and Saturdays get a shelf count.
  const closing = at(date, hm(templates[templates.length - 1][1]) + 10);
  if (!isPast(closing)) continue;
  const closer = slotsToday[slotsToday.length - 1].person;
  for (const it of sellable.filter((i) => i.perishable && i.stock > 0)) {
    if (chance(0.5)) writeOff(it, it.stock, closing, closer, "Expired (day old)");
  }
  if (chance(0.12)) {
    const it = pick(sellable.filter((i) => !i.perishable && i.stock > 1));
    writeOff(it, 1, closing, closer, pick(["Packet torn", "Crushed in the carton", "Past expiry date", "Bottle leaking"]));
  }
  if (wd === 5) {
    for (const it of sellable.filter((i) => !i.perishable && i.stock > 3 && chance(0.15))) {
      count(it, it.stock + (chance(0.75) ? -1 : 1), new Date(closing.getTime() + 5 * 60_000), ayesha, "Weekly shelf count");
    }
  }
}

// Pre-orders for tomorrow, and the coming week's duty slots.
const TOMORROW = addDays(TODAY, 1);
if (weekday(TOMORROW) <= 4) {
  rows.preorderDays.push({ date: TOMORROW, open: true, cutoff: "11:00" });
  for (const status of ["awaiting_payment", "paid"] as const) {
    const placedAt = new Date(NOW - int(10, 120) * 60_000);
    const it = weighted(sellable.filter((i) => i.lunch || !i.perishable), (i) => (i.lunch ? 5 : i.weight));
    const id = randomUUID();
    let c = code();
    while (usedCodes.has(c)) c = code();
    usedCodes.add(c);
    const customer = `${pick(FIRST)} ${pick(LAST)}`;
    rows.preorders.push({
      id, code: c, customerName: customer, phone: `0300-0000${String(int(100, 999))}`, pickupDate: TOMORROW,
      total: it.price, status, paymentRef: status === "paid" ? `NP${int(10000000, 99999999)}` : null, createdAt: placedAt, accountId: mainAccount.id,
      lines: [{ itemId: it.id, name: it.name, qty: 1, unitPrice: it.price }],
    });
    log(null, "preorder", `New pre-order ${c} from ${customer} (${rs(it.price)})`, placedAt, id);
  }
}
for (let d = 1; d <= 13 - weekday(TODAY); d++) {
  const date = addDays(TODAY, d);
  const wd = weekday(date);
  for (const [s, e] of SLOT_TEMPLATES[wd] ?? []) {
    const free = staff.filter((p) => freeAt(p, wd, s, e));
    rows.slots.push({ userId: (free.length ? pick(free) : pick(members)).id, date, start: s, end: e, createdBy: ali.id, createdAt: at(addDays(TODAY, -weekday(TODAY) - 1), 20 * 60) });
  }
}

// Final item state and FIFO lots.
for (const it of items) {
  rows.items.find((r) => r.id === it.id)!.owed = it.owed;
  for (const lot of it.lots) rows.lots.push({ id: lot.id, itemId: it.id, qtyIn: lot.qtyIn, qtyLeft: lot.qtyLeft, unitCost: lot.unitCost, supplier: lot.supplier, createdAt: lot.createdAt });
}

// ---------------------------------------------------------------- write

type Db = import("drizzle-orm/neon-serverless").NeonDatabase;

async function connect(): Promise<{ db: Db; close: () => Promise<void> }> {
  if (!PGLITE && process.env.DATABASE_URL) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    console.log(`Database: ${new URL(process.env.DATABASE_URL).hostname}`);
    return { db: drizzle({ client: pool }), close: () => pool.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = PGLITE ?? "./.data/pglite";
  const { mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log(`Database: PGlite at ${dir}`);
  return { db: db as unknown as Db, close: () => client.close() };
}

const { db, close } = await connect();
const ALL_TABLES = ["share_purchases", "payment_accounts", "activity", "sale_lines", "stock_moves", "sales", "lots", "shifts", "slots", "availability", "preorders", "preorder_days", "shareholders", "costs", "items", "users", "settings"];
const [{ n: existing }] = (await db.execute(sql`select (select count(*) from items) + (select count(*) from sales) as n`)).rows as { n: string }[];
if (Number(existing) > 0 && !WIPE) {
  console.error("This database already has items or sales. Re-run with --wipe to replace everything (this deletes all data).");
  await close();
  process.exit(1);
}

const chunked = async <T>(table: Parameters<typeof db.insert>[0], list: T[], size = 400) => {
  for (let i = 0; i < list.length; i += size) await tx.insert(table).values(list.slice(i, i + size) as never);
};
let tx: typeof db;
await db.transaction(async (trx) => {
  tx = trx as unknown as typeof db;
  if (WIPE) await tx.execute(sql.raw(`truncate ${ALL_TABLES.join(", ")} restart identity cascade`));
  // Keep any shop settings someone already saved; otherwise fill in the basics.
  await tx.execute(sql`insert into settings (key, value) values ('shop', ${JSON.stringify({
    location: { lat: 33.64314917030392, lng: 72.99074742883603, label: "SEECS, NUST H-12" },
    hours: "Mon–Thu 9 am – 5 pm · Fri 9 am – 3 pm · Sat 10 am – 2 pm",
    nayapay: { name: "", handle: "", instructions: "" },
    whatsapp: "",
  })}::jsonb) on conflict (key) do nothing`);
  await tx.execute(sql`insert into settings (key, value) values ('availability_open', 'false'::jsonb) on conflict (key) do nothing`);
  await tx.execute(sql`insert into settings (key, value) values ('online_account', ${JSON.stringify({ accountId: accountAt(new Date(NOW)).id })}::jsonb) on conflict (key) do nothing`);
  await tx.execute(sql`insert into settings (key, value) values ('shares', ${JSON.stringify({
    pricePerShare: sharePrice(TODAY), maxPerPerson: SHARE_CAP, totalOnOffer: 20, open: true, accountId: mainAccount.id,
  })}::jsonb) on conflict (key) do nothing`);
  await chunked(t.users, rows.users);
  await chunked(t.paymentAccounts, rows.paymentAccounts);
  await chunked(t.sharePurchases, rows.sharePurchases);
  await chunked(t.items, rows.items, 20);
  await chunked(t.lots, rows.lots);
  await chunked(t.shifts, rows.shifts);
  await chunked(t.sales, rows.sales);
  await chunked(t.saleLines, rows.saleLines);
  await chunked(t.stockMoves, rows.stockMoves);
  await chunked(t.availability, rows.availability);
  await chunked(t.slots, rows.slots);
  await chunked(t.preorderDays, rows.preorderDays);
  await chunked(t.preorders, rows.preorders);
  await chunked(t.shareholders, rows.shareholders);
  await chunked(t.costs, rows.costs);
  await chunked(t.activity, rows.activity.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime()));
});

// Check the FIFO invariants the app relies on.
const bad = (
  await db.execute(sql`
    select i.name, coalesce(m.qty, 0) as stock, coalesce(l.left_, 0) as lots, i.owed
    from items i
    left join (select item_id, sum(qty)::int qty from stock_moves group by item_id) m on m.item_id = i.id
    left join (select item_id, sum(qty_left)::int left_ from lots group by item_id) l on l.item_id = i.id
    where coalesce(l.left_, 0) <> coalesce(m.qty, 0) + i.owed or (i.owed > 0 and coalesce(m.qty, 0) >= 0)`)
).rows;
const sales = rows.sales.filter((s) => !s.voided);
const revenue = sales.reduce((s, x) => s + x.total, 0);
const cash = sales.filter((s) => s.method === "cash").reduce((s, x) => s + x.total, 0);
console.log(`
Seeded ${DAYS} days (${START} → ${TODAY}):
  ${rows.users.length} staff (demo emails), ${rows.items.length} items, ${rows.sales.length} sales (${rows.sales.length - sales.length} voided, ${rows.sales.filter((s) => s.oversold).length} with oversells)
  revenue ${rs(revenue)} (cash ${rs(cash)}, online ${rs(revenue - cash)})
  ${rows.stockMoves.filter((m) => m.kind === "restock").length} restocks, ${rows.stockMoves.filter((m) => m.kind === "waste").length} write-offs, ${rows.shifts.length} shifts, ${rows.slots.length} duty slots, ${rows.preorders.length} pre-orders, ${rows.activity.length} activity entries
  FIFO check: ${bad.length ? `${bad.length} items inconsistent ${JSON.stringify(bad.slice(0, 3))}` : "all items consistent"}`);
await close();
