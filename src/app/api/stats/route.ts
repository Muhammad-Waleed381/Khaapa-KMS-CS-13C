import { getDb } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { RANGES, stats, type Range } from "@/lib/server/reports";

export const GET = route(async (req) => {
  await requireUser();
  const r = new URL(req.url).searchParams.get("range") as Range;
  const db = await getDb();
  return stats(db, RANGES.includes(r) ? r : "today");
});
