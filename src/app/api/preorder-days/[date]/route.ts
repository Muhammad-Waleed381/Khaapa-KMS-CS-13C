import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { fmtDate } from "@/lib/time";

const Body = z.object({
  open: z.boolean(),
  cutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM"),
  note: z.string().trim().max(200).nullish(),
});

// Open or close pre-orders for a day and set its cutoff time (PKT).
export const PUT = route<{ date: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Bad date");
  const b = await parseBody(req, Body);
  const db = await getDb();
  const values = { open: b.open, cutoff: b.cutoff, note: b.note || null };
  await db
    .insert(t.preorderDays)
    .values({ date, ...values })
    .onConflictDoUpdate({ target: t.preorderDays.date, set: values });
  await logActivity(
    db,
    user.id,
    "preorder",
    `${user.name} ${b.open ? `opened pre-orders for ${fmtDate(date)} until ${b.cutoff}` : `closed pre-orders for ${fmtDate(date)}`}`,
  );
  return { ok: true };
});
