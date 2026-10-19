import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { t, type DB } from "@/db";
import { HttpError } from "@/lib/server/api";
import { stockLevels } from "@/lib/server/stock";

// Images are small client-compressed webp data URLs (~256px).
const MAX_IMAGE_CHARS = 400_000;

export const imageField = z
  .string()
  .max(MAX_IMAGE_CHARS, "Image is too large")
  .regex(/^data:image\/(webp|png|jpeg);base64,/, "Not an image")
  .nullable();

export const itemFields = {
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(40),
  price: z.number().int().min(0),
  lowStockAt: z.number().int().min(0).max(10_000),
  preorder: z.boolean(),
  image: imageField,
};

export type ItemRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  lowStockAt: number;
  preorder: boolean;
  active: boolean;
  hasImage: boolean;
  imageVersion: number;
  stock: number;
  owed: number;
  lastUnitCost: number | null;
};

/** Items with live stock and their latest buy price. */
export async function listItems(db: DB, opts: { all?: boolean; id?: string } = {}): Promise<ItemRow[]> {
  const rows = await db
    .select({
      id: t.items.id,
      name: t.items.name,
      category: t.items.category,
      price: t.items.price,
      lowStockAt: t.items.lowStockAt,
      preorder: t.items.preorder,
      active: t.items.active,
      owed: t.items.owed,
      hasImage: sql<boolean>`${t.items.image} is not null`,
      updatedAt: t.items.updatedAt,
    })
    .from(t.items)
    .where(opts.id ? eq(t.items.id, opts.id) : opts.all ? undefined : eq(t.items.active, true))
    .orderBy(t.items.category, t.items.name);

  const stock = await stockLevels(db);
  const lastCosts = await db
    .selectDistinctOn([t.lots.itemId], { itemId: t.lots.itemId, unitCost: t.lots.unitCost })
    .from(t.lots)
    .orderBy(t.lots.itemId, desc(t.lots.createdAt));
  const lastCost = new Map(lastCosts.map((l) => [l.itemId, l.unitCost]));

  return rows.map(({ updatedAt, ...r }) => ({
    ...r,
    imageVersion: new Date(updatedAt).getTime(),
    stock: stock.get(r.id) ?? 0,
    lastUnitCost: lastCost.get(r.id) ?? null,
  }));
}

export async function getItemOr404(db: DB, id: string) {
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, "Item not found");
  const [item] = await db
    .select({ id: t.items.id, name: t.items.name, active: t.items.active })
    .from(t.items)
    .where(eq(t.items.id, id));
  if (!item) throw new HttpError(404, "Item not found");
  return item;
}
