import { and, desc, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

// ?from=&to= are inclusive PKT dates.
export const GET = route(async (req) => {
  await requireUser({ admin: true });
  const q = new URL(req.url).searchParams;
  const from = q.get("from");
  const to = q.get("to");
  const db = await getDb();
  const costs = await db
    .select()
    .from(t.costs)
    .where(
      and(
        from && dateRe.test(from) ? gte(t.costs.date, from) : undefined,
        to && dateRe.test(to) ? lte(t.costs.date, to) : undefined,
      ),
    )
    .orderBy(desc(t.costs.date), desc(t.costs.createdAt));
  return { costs };
});

export const POST = route(async (req) => {
  const user = await requireUser({ admin: true });
  const body = await parseBody(
    req,
    z.object({
      date: z.string().regex(dateRe),
      amount: z.number().int().positive(),
      note: z.string().trim().min(1).max(300),
    }),
  );
  const db = await getDb();
  const [row] = await db.insert(t.costs).values({ ...body, userId: user.id }).returning();
  await logActivity(db, user.id, "cost", `Added cost ${rs(row.amount)}: ${row.note}`, row.id);
  return { cost: row };
});
