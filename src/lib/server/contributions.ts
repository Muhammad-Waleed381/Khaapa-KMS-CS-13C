import { and, asc, desc, eq, gte, inArray, isNotNull, lt, lte, type SQL } from "drizzle-orm";
import { type DB, t } from "@/db";
import { UNIT_MINUTES } from "@/lib/units";
import { pkDate, pkDayRange } from "@/lib/time";

// Counter shifts earn whole 30-minute units only: 75 minutes is 2 units.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type Period = { from: string | null; to: string | null };

/** ?from=&to= in PKT dates. A missing bound means the period is open on that side. */
export function periodFromQuery(q: URLSearchParams): Period {
  const from = DATE.test(q.get("from") ?? "") ? q.get("from")! : null;
  const to = DATE.test(q.get("to") ?? "") ? q.get("to")! : null;
  return from && to && from > to ? { from: to, to: from } : { from, to };
}

/** Whole 30-minute units in a shift. A part unit is not paid out, so it doesn't count. */
export function unitsForShift(startedAt: Date, endedAt: Date) {
  const minutes = (endedAt.getTime() - startedAt.getTime()) / 60_000;
  return Math.max(0, Math.floor(minutes / UNIT_MINUTES));
}

export type Board = Awaited<ReturnType<typeof contributionBoard>>;

/**
 * Everyone's contribution for a period: counter-shift units plus the units an
 * admin logged by hand, with the hand-logged entries listed for everyone to see.
 */
export async function contributionBoard(db: DB, p: Period) {
  const shiftWhere: SQL[] = [isNotNull(t.shifts.endedAt)];
  if (p.from) shiftWhere.push(gte(t.shifts.startedAt, pkDayRange(p.from).start));
  if (p.to) shiftWhere.push(lt(t.shifts.startedAt, pkDayRange(p.to).end));
  const shiftRows = await db
    .select({ userId: t.shifts.userId, startedAt: t.shifts.startedAt, endedAt: t.shifts.endedAt })
    .from(t.shifts)
    .where(and(...shiftWhere));

  const manualWhere: SQL[] = [];
  if (p.from) manualWhere.push(gte(t.contributions.date, p.from));
  if (p.to) manualWhere.push(lte(t.contributions.date, p.to));
  const entries = await db
    .select({
      id: t.contributions.id,
      userId: t.contributions.userId,
      name: t.users.name,
      date: t.contributions.date,
      units: t.contributions.units,
      note: t.contributions.note,
    })
    .from(t.contributions)
    .innerJoin(t.users, eq(t.users.id, t.contributions.userId))
    .where(manualWhere.length ? and(...manualWhere) : undefined)
    .orderBy(desc(t.contributions.date), desc(t.contributions.createdAt));

  const names = new Map<string, string>(entries.map((e) => [e.userId, e.name]));
  const people = new Map<string, { userId: string; name: string; shiftUnits: number; manualUnits: number }>();
  const person = (userId: string) => {
    let row = people.get(userId);
    if (!row) {
      row = { userId, name: names.get(userId) ?? "", shiftUnits: 0, manualUnits: 0 };
      people.set(userId, row);
    }
    return row;
  };

  for (const s of shiftRows) person(s.userId).shiftUnits += unitsForShift(s.startedAt, s.endedAt!);
  for (const e of entries) person(e.userId).manualUnits += e.units;

  // Names for people who only have shifts in this period.
  const missing = [...people.values()].filter((p) => !p.name).map((p) => p.userId);
  if (missing.length) {
    const rows = await db
      .select({ id: t.users.id, name: t.users.name })
      .from(t.users)
      .where(inArray(t.users.id, missing));
    for (const r of rows) person(r.id).name = r.name;
  }

  const list = [...people.values()]
    .map((p) => ({ ...p, units: p.shiftUnits + p.manualUnits }))
    .filter((p) => p.units > 0)
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));

  const shiftUnits = list.reduce((s, p) => s + p.shiftUnits, 0);
  const manualUnits = list.reduce((s, p) => s + p.manualUnits, 0);
  return {
    period: p,
    today: pkDate(),
    totals: { units: shiftUnits + manualUnits, shiftUnits, manualUnits, people: list.length },
    people: list,
    entries,
  };
}

/** Active members, for the admin's member picker. */
export async function activeMembers(db: DB) {
  return db
    .select({ id: t.users.id, name: t.users.name })
    .from(t.users)
    .where(eq(t.users.status, "active"))
    .orderBy(asc(t.users.name));
}
