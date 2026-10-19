import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb, t } from "@/db";
import { route } from "@/lib/server/api";
import { availableStock } from "../_shop";

// Public menu. Exact counts and costs stay private; only a coarse availability.
export const GET = route(async () => {
  await connection();
  const db = await getDb();
  const rows = await db
    .select({
      id: t.items.id,
      name: t.items.name,
      category: t.items.category,
      price: t.items.price,
      hasImage: t.items.image,
      lowStockAt: t.items.lowStockAt,
      preorder: t.items.preorder,
      updatedAt: t.items.updatedAt,
    })
    .from(t.items)
    .where(eq(t.items.active, true))
    .orderBy(asc(t.items.category), asc(t.items.name));
  const available = await availableStock(db);
  return {
    items: rows.map((r) => {
      const left = available.get(r.id) ?? 0;
      return {
        id: r.id,
        name: r.name,
        category: r.category,
        price: r.price,
        image: r.hasImage ? `/api/img/${r.id}?v=${new Date(r.updatedAt).getTime()}` : null,
        preorder: r.preorder,
        availability: left <= 0 ? "out" : left <= r.lowStockAt ? "few" : "in",
      };
    }),
  };
});
