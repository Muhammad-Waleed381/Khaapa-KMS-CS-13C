import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";

const patch = z.object({
  status: z.enum(["active", "disabled"]).optional(),
  role: z.enum(["admin", "member"]).optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireUser({ admin: true });
  const { id } = await params;
  const p = await parseBody(req, patch);
  if (id === admin.id && (p.status === "disabled" || p.role === "member"))
    throw new HttpError(400, "You can't disable or demote yourself");
  const db = await getDb();
  const [old] = await db.select().from(t.users).where(eq(t.users.id, id));
  if (!old) throw new HttpError(404, "User not found");
  const [row] = await db
    .update(t.users)
    .set({ ...p, ...(p.status === "active" && old.status === "pending" ? { approvedBy: admin.id } : {}) })
    .where(eq(t.users.id, id))
    .returning();

  const changes: string[] = [];
  if (p.status && p.status !== old.status)
    changes.push(
      p.status === "active"
        ? old.status === "pending"
          ? `Approved ${row.name}`
          : `Re-enabled ${row.name}`
        : old.status === "pending"
          ? `Rejected ${row.name}`
          : `Disabled ${row.name}`,
    );
  if (p.role && p.role !== old.role) changes.push(`Made ${row.name} ${p.role === "admin" ? "an admin" : "a member"}`);
  if (p.name && p.name !== old.name) changes.push(`Renamed ${old.name} to ${row.name}`);
  for (const c of changes) await logActivity(db, admin.id, "team", c, row.id);

  return {
    user: { id: row.id, email: row.email, name: row.name, role: row.role, status: row.status },
  };
});
