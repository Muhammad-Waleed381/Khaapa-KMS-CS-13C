import { getDb } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { periodFromQuery, salesForPeriod } from "@/lib/server/reports";

// Sales for a PKT period (?from=&to=, or ?date= for one day; default today):
// totals, per-day subtotals, online money per account, and for a single day
// the sales themselves with their lines.
export const GET = route(async (req) => {
  await requireUser();
  const q = new URL(req.url).searchParams;
  const db = await getDb();
  return salesForPeriod(db, periodFromQuery(q), { method: q.get("method"), userId: q.get("userId"), voided: q.get("voided") });
});
