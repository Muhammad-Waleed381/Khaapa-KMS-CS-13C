import { asc } from "drizzle-orm";
import { getDb, t } from "@/db";
import { logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";
import { shareholderInput } from "./schema";

export const GET = route(async () => {
  await requireUser({ admin: true });
  const db = await getDb();
  const shareholders = await db.select().from(t.shareholders).orderBy(asc(t.shareholders.boughtOn), asc(t.shareholders.createdAt));
  return { shareholders };
});

export const POST = route(async (req) => {
  const user = await requireUser({ admin: true });
  const body = await parseBody(req, shareholderInput);
  const db = await getDb();
  const [row] = await db.insert(t.shareholders).values(body).returning();
  await logActivity(
    db,
    user.id,
    "shares",
    `Added shareholder ${row.name}: ${row.shares} shares at ${rs(row.pricePerShare)}`,
    row.id,
  );
  return { shareholder: row };
});
