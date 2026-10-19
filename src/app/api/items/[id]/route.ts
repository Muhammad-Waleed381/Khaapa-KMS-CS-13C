import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";
import { getItemOr404, itemFields, listItems } from "../shared";

type Params = { id: string };

const patchSchema = z.object({ ...itemFields, active: z.boolean() }).partial();

export const PATCH = route<Params>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const body = await parseBody(req, patchSchema);
  if (!Object.keys(body).length) throw new HttpError(400, "Nothing to change");
  const db = await getDb();
  const [before] = await db.select().from(t.items).where(eq(t.items.id, (await getItemOr404(db, id)).id));
  await db
    .update(t.items)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(t.items.id, id));

  const changes: string[] = [];
  if (body.name !== undefined && body.name !== before.name) changes.push(`renamed to ${body.name}`);
  if (body.price !== undefined && body.price !== before.price)
    changes.push(`price ${rs(before.price)} → ${rs(body.price)}`);
  if (body.category !== undefined && body.category !== before.category) changes.push(`category ${body.category}`);
  if (body.lowStockAt !== undefined && body.lowStockAt !== before.lowStockAt)
    changes.push(`low-stock alert at ${body.lowStockAt}`);
  if (body.preorder !== undefined && body.preorder !== before.preorder)
    changes.push(body.preorder ? "open for pre-order" : "closed for pre-order");
  if (body.image !== undefined) changes.push(body.image ? "new photo" : "photo removed");
  if (body.active !== undefined && body.active !== before.active) changes.push(body.active ? "restored" : "archived");
  await logActivity(db, user.id, "item", `Edited ${before.name}: ${changes.join(", ") || "no changes"}`, id);

  const [row] = await listItems(db, { id });
  return { item: row };
});

// Archive (soft delete). Sales history keeps pointing at the item.
export const DELETE = route<Params>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const db = await getDb();
  const item = await getItemOr404(db, id);
  await db.update(t.items).set({ active: false, updatedAt: new Date() }).where(eq(t.items.id, id));
  await logActivity(db, user.id, "item", `Archived ${item.name}`, id);
  return { ok: true };
});
