import { asc, desc, sql } from "drizzle-orm";
import { getDb, t } from "@/db";
import { requireUser, route } from "@/lib/server/api";

// Everyone (pending first), with their most recent shift start.
export const GET = route(async (req) => {
  const user = await requireUser();
  const db = await getDb();
  const lastShift = sql<string | null>`(select max(${t.shifts.startedAt}) from ${t.shifts} where ${t.shifts.userId} = ${t.users.id})`;
  const rows = await db
    .select({
      id: t.users.id,
      email: t.users.email,
      name: t.users.name,
      image: t.users.image,
      role: t.users.role,
      status: t.users.status,
      createdAt: t.users.createdAt,
      lastShiftAt: lastShift,
    })
    .from(t.users)
    .orderBy(sql`case ${t.users.status} when 'pending' then 0 when 'active' then 1 else 2 end`, asc(t.users.name), desc(t.users.createdAt));
  // Non-admins (e.g. the schedule page) only need active people's names.
  if (user.role !== "admin" || new URL(req.url).searchParams.get("active") === "1")
    return {
      users: rows
        .filter((u) => u.status === "active")
        .map((u) => ({ id: u.id, name: u.name, role: u.role, status: u.status })),
    };
  return { users: rows };
});

