import { getDb } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { dayReport } from "@/lib/server/reports";
import { pkDate } from "@/lib/time";

// End-of-day report for internal sharing (not for customers).
export const GET = route(async (req) => {
  await requireUser();
  const d = new URL(req.url).searchParams.get("date") ?? "";
  const db = await getDb();
  return dayReport(db, /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : pkDate());
});
