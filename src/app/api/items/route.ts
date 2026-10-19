import { z } from "zod";
import { getDb, t } from "@/db";
import { logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";
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
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, createSchema);
  const db = await getDb();
  const [item] = await db.insert(t.items).values(body).returning({ id: t.items.id });
  await logActivity(db, user.id, "item", `Added ${body.name} at ${rs(body.price)}`, item.id);
  const [row] = await listItems(db, { id: item.id });
  return { item: row };
});
