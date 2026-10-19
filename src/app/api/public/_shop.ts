import { and, between, inArray } from "drizzle-orm";
import { t, type DB, type Tx } from "@/db";
import { getSetting } from "@/lib/server/api";
import { stockLevels } from "@/lib/server/stock";
import { addDays, pkDate, pkTime } from "@/lib/time";

// Shared by the public, pre-order and settings routes. Files starting with
// "_" are not routes.

export type ShopSettings = {
  location: { lat: number; lng: number; label: string };
  hours: string;
  nayapay: { name: string; handle: string; instructions: string };
  whatsapp: string;
};

export const DEFAULT_SHOP: ShopSettings = {
  location: { lat: 33.64314917030392, lng: 72.99074742883603, label: "SEECS, NUST H-12" },
  hours: "",
  nayapay: { name: "", handle: "", instructions: "" },
  whatsapp: "",
};

export async function getShop(): Promise<ShopSettings> {
  const s = await getSetting<Partial<ShopSettings>>("shop", {});
  return {
    ...DEFAULT_SHOP,
    ...s,
    location: { ...DEFAULT_SHOP.location, ...s.location },
    nayapay: { ...DEFAULT_SHOP.nayapay, ...s.nayapay },
  };
}

/** Units reserved by pre-orders that are paid but not yet collected. */
export async function reservedUnits(db: DB | Tx) {
  const open = await db
    .select({ lines: t.preorders.lines })
    .from(t.preorders)
    .where(inArray(t.preorders.status, ["paid", "ready"]));
  const reserved = new Map<string, number>();
  for (const o of open) for (const l of o.lines) reserved.set(l.itemId, (reserved.get(l.itemId) ?? 0) + l.qty);
  return reserved;
}

/** itemId -> units a customer can still order (shelf stock minus reservations). */
export async function availableStock(db: DB | Tx) {
  const [stock, reserved] = await Promise.all([stockLevels(db), reservedUnits(db)]);
  const out = new Map<string, number>();
  for (const [id, qty] of stock) out.set(id, qty - (reserved.get(id) ?? 0));
  for (const [id, qty] of reserved) if (!stock.has(id)) out.set(id, -qty);
  return out;
}

export type DayStatus = {
  date: string;
  open: boolean;
  cutoff: string;
  note: string | null;
  /** Open, and (for today) the cutoff hasn't passed yet. */
  accepting: boolean;
};

/** Pre-order settings for a range of PKT dates. Days without a row are closed. */
export async function preorderDays(db: DB | Tx, from: string, to: string): Promise<DayStatus[]> {
  const rows = await db
    .select()
    .from(t.preorderDays)
    .where(and(between(t.preorderDays.date, from, to)));
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const today = pkDate();
  const now = pkTime();
  const out: DayStatus[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = byDate.get(d);
    const open = r?.open ?? false;
    const cutoff = r?.cutoff ?? "12:00";
    out.push({
      date: d,
      open,
      cutoff,
      note: r?.note ?? null,
      accepting: open && (d > today || (d === today && now < cutoff)),
    });
  }
  return out;
}

/** Today and tomorrow, the only days customers can pre-order for. */
export function preorderWindow() {
  const today = pkDate();
  return { today, tomorrow: addDays(today, 1) };
}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}
