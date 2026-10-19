import { getDb } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { salesForDay } from "@/lib/server/reports";
import { pkDate } from "@/lib/time";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Sales for one PKT day with their lines and the day's totals.
export const GET = route(async (req) => {
  await requireUser();
  const q = new URL(req.url).searchParams;
  const date = DATE.test(q.get("date") ?? "") ? q.get("date")! : pkDate();
  const db = await getDb();
  return salesForDay(db, date, { method: q.get("method"), userId: q.get("userId"), voided: q.get("voided") });
});
