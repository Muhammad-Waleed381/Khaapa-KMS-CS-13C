import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";
import { restock } from "@/lib/server/stock";
import { itemFields, listItems } from "./shared";

// ?all=1 includes archived items.
export const GET = route(async (req) => {
  await requireUser();
  const all = new URL(req.url).searchParams.get("all") === "1";
  return { items: await listItems(await getDb(), { all }) };
});

const createSchema = z.object({
  ...itemFields,
  category: itemFields.category.default("Snacks"),
  lowStockAt: itemFields.lowStockAt.default(5),
  preorder: itemFields.preorder.default(true),
  image: itemFields.image.default(null),
  // Optional first batch, so the buy price is recorded from day one.
  openingStock: z
    .object({
      qty: z.number().int().min(0),
      unitCost: z.number().int().min(0).optional(),
      totalCost: z.number().int().min(0).optional(),
      supplier: z.string().trim().max(80).nullish(),
    })
    .optional(),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const { openingStock, ...body } = await parseBody(req, createSchema);
  const qty = openingStock?.qty ?? 0;
  const unitCost =
    openingStock?.unitCost ?? (openingStock?.totalCost !== undefined && qty > 0 ? Math.round(openingStock.totalCost / qty) : undefined);
  if (qty > 0 && unitCost === undefined) throw new HttpError(400, "Give the buy price for the opening stock");
  const db = await getDb();
  const id = await db.transaction(async (tx) => {
    const [item] = await tx.insert(t.items).values(body).returning({ id: t.items.id });
    await logActivity(tx, user.id, "item", `Added ${body.name} at ${rs(body.price)}`, item.id);
    if (qty > 0) {
      const supplier = openingStock?.supplier || null;
      await restock(tx, { itemId: item.id, qty, unitCost: unitCost!, supplier, note: "Opening stock", userId: user.id });
      await logActivity(
        tx,
        user.id,
        "stock",
        `Restocked ${qty} × ${body.name} at ${rs(unitCost!)} each${supplier ? ` from ${supplier}` : ""}`,
        item.id,
      );
    }
    return item.id;
  });
  const [row] = await listItems(db, { id });
  return { item: row };
});
