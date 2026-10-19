import { getDb } from "@/db";
import { HttpError, requireUser, route } from "@/lib/server/api";
import { addDays, pkDate } from "@/lib/time";
import { preorderDays } from "../public/_shop";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Pre-order settings per day: GET ?from=&to= (defaults to today and tomorrow).
export const GET = route(async (req) => {
  await requireUser();
  const q = new URL(req.url).searchParams;
  const from = q.get("from") ?? pkDate();
  const to = q.get("to") ?? addDays(from, 1);
  if (!DATE.test(from) || !DATE.test(to) || to < from || to > addDays(from, 62))
    throw new HttpError(400, "Bad date range");
  const db = await getDb();
  return { days: await preorderDays(db, from, to) };
});
