import { and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { addDays, fmtDate, weekStart } from "@/lib/time";
import { isoDate } from "../../schedule/shared";

// Copy every slot from one Mon–Sun week onto another, shifted by whole weeks.
export const POST = route(async (req) => {
  const user = await requireUser({ admin: true });
  const b = await parseBody(req, z.object({ fromWeek: isoDate, toWeek: isoDate }));
  const from = weekStart(b.fromWeek);
  const to = weekStart(b.toWeek);
  if (from === to) throw new HttpError(400, "Pick two different weeks");
  const db = await getDb();
  const src = await db
    .select()
    .from(t.slots)
    .where(and(gte(t.slots.date, from), lte(t.slots.date, addDays(from, 6))));
  if (!src.length) throw new HttpError(400, "That week has no slots to copy");
  const shift = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  await db.insert(t.slots).values(
    src.map((s) => ({
      userId: s.userId,
      date: addDays(s.date, shift),
      start: s.start,
      end: s.end,
      note: s.note,
      createdBy: user.id,
    })),
  );
  await logActivity(db, user.id, "schedule", `Copied ${src.length} slots from week of ${fmtDate(from)} to ${fmtDate(to)}`);
  return { created: src.length };
});
