import { getDb } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { RANGES, recentDays, stats, todaySoFar, type Range } from "@/lib/server/reports";

// The admin dashboard: today so far (vs yesterday and last week at the same
// time), the last 7 days for sparklines, and the trend stats for the chosen range.
export const GET = route(async (req) => {
  await requireUser({ admin: true });
  const r = new URL(req.url).searchParams.get("range") as Range;
  const db = await getDb();
  const [trend, today, recent] = await Promise.all([stats(db, RANGES.includes(r) ? r : "7d"), todaySoFar(db), recentDays(db, 7)]);
  return { ...trend, today, recent };
});
