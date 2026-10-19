import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { getSetting, HttpError, parseBody, requireUser, route } from "@/lib/server/api";
import { hhmm, rangeMsg, timeRange } from "../schedule/shared";

// Members see their own weekly windows; admins see everyone's.
export const GET = route(async () => {
  const user = await requireUser();
  const db = await getDb();
  const rows = await db
    .select({
      id: t.availability.id,
      userId: t.availability.userId,
      name: t.users.name,
      weekday: t.availability.weekday,
      start: t.availability.start,
      end: t.availability.end,
      note: t.availability.note,
    })
    .from(t.availability)
    .innerJoin(t.users, eq(t.users.id, t.availability.userId))
    .where(user.role === "admin" ? undefined : eq(t.availability.userId, user.id))
    .orderBy(asc(t.availability.weekday), asc(t.availability.start));
  return {
    availability: rows,
    availabilityOpen: await getSetting("availability_open", false),
  };
});

const body = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start: hhmm,
    end: hhmm,
    note: z.string().trim().max(200).optional().nullable(),
    // Admins may enter availability on someone's behalf.
    userId: z.string().uuid().optional(),
  })
  .refine(timeRange, rangeMsg);

export const POST = route(async (req) => {
  const user = await requireUser();
  const a = await parseBody(req, body);
  const isAdmin = user.role === "admin";
  if (!isAdmin && !(await getSetting("availability_open", false)))
    throw new HttpError(403, "Availability collection is closed");
  const db = await getDb();
  const [row] = await db
    .insert(t.availability)
    .values({
      userId: isAdmin && a.userId ? a.userId : user.id,
      weekday: a.weekday,
      start: a.start,
      end: a.end,
      note: a.note || null,
    })
    .returning();
  return { availability: row };
});

const replaceBody = z.object({
  windows: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), start: hhmm, end: hhmm }).refine(timeRange, rangeMsg))
    .max(60),
});

// Replace all of my weekly windows at once (the tap-to-select grid saves this way).
export const PUT = route(async (req) => {
  const user = await requireUser();
  const { windows } = await parseBody(req, replaceBody);
  if (user.role !== "admin" && !(await getSetting("availability_open", false)))
    throw new HttpError(403, "Availability collection is closed");
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(t.availability).where(eq(t.availability.userId, user.id));
    if (windows.length) await tx.insert(t.availability).values(windows.map((w) => ({ ...w, userId: user.id })));
  });
  return { saved: windows.length };
});
