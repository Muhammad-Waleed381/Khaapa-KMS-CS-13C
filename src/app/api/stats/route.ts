import { getDb } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { RANGES, stats, todaySoFar, type Range } from "@/lib/server/reports";

// The admin dashboard: today so far (vs yesterday and last week at the same
// time) and the trend stats for the chosen range.
export const GET = route(async (req) => {
  await requireUser({ admin: true });
  const r = new URL(req.url).searchParams.get("range") as Range;
  const db = await getDb();
  const [trend, today] = await Promise.all([stats(db, RANGES.includes(r) ? r : "7d"), todaySoFar(db)]);
  return { ...trend, today };
});
