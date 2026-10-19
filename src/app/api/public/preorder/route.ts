import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, route } from "@/lib/server/api";
import { rs } from "@/lib/money";
import { currentAccount, toPublic } from "../../accounts/_accounts";
import { availableStock, newCode, preorderDays, preorderWindow } from "../_shop";

const Body = z.object({
  customerName: z.string().trim().min(2).max(60),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{10,16}$/, "enter a valid phone number"),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(200).optional(),
  lines: z
    .array(z.object({ itemId: z.uuid(), qty: z.number().int().min(1).max(20) }))
    .min(1)
    .max(20),
});

// A customer places a pre-order. Prices come from the server, never the client.
export const POST = route(async (req) => {
  const b = await parseBody(req, Body);
  const { today, tomorrow } = preorderWindow();
  if (b.pickupDate !== today && b.pickupDate !== tomorrow)
    throw new HttpError(400, "Pre-orders are for today or tomorrow only");

  const db = await getDb();
  const [day] = await preorderDays(db, b.pickupDate, b.pickupDate);
  if (!day.accepting)
    throw new HttpError(400, day.open ? `Orders for this day closed at ${day.cutoff}` : "Pre-orders are closed for this day");

  // Merge repeated items.
  const qtys = new Map<string, number>();
  for (const l of b.lines) qtys.set(l.itemId, (qtys.get(l.itemId) ?? 0) + l.qty);

  return db.transaction(async (tx) => {
    const items = await tx
      .select()
      .from(t.items)
      .where(and(inArray(t.items.id, [...qtys.keys()]), eq(t.items.active, true), eq(t.items.preorder, true)));
    const byId = new Map(items.map((i) => [i.id, i]));
    const available = await availableStock(tx);
    const lines = [...qtys].map(([itemId, qty]) => {
      const item = byId.get(itemId);
      if (!item) throw new HttpError(400, "An item in your order can't be pre-ordered any more");
      const left = available.get(itemId) ?? 0;
      if (qty > left)
        throw new HttpError(400, left > 0 ? `Only ${left} ${item.name} left` : `${item.name} is sold out`);
      return { itemId, name: item.name, qty, unitPrice: item.price };
    });
    const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    // The customer pays into whichever account is receiving online payments now;
    // the order remembers it even if the shop switches accounts later.
    const account = await currentAccount(tx);

    for (let attempt = 0; ; attempt++) {
      const code = newCode();
      const [taken] = await tx.select({ id: t.preorders.id }).from(t.preorders).where(eq(t.preorders.code, code));
      if (taken && attempt < 5) continue;
      const [row] = await tx
        .insert(t.preorders)
        .values({
          code,
          customerName: b.customerName,
          phone: b.phone,
          note: b.note || null,
          pickupDate: b.pickupDate,
          lines,
          total,
          accountId: account?.id ?? null,
        })
        .returning({ id: t.preorders.id });
      await logActivity(tx, null, "preorder", `New pre-order ${code} from ${b.customerName} (${rs(total)})`, row.id);
      return { id: row.id, code, total, account: account ? toPublic(account) : null };
    }
  });
});
