import { z } from "zod";
import { getDb, t } from "@/db";
import { logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { slotBody } from "../../schedule/shared";

// Assign a whole week's plan in one go.
export const POST = route(async (req) => {
  const user = await requireUser({ admin: true });
  const { slots } = await parseBody(req, z.object({ slots: z.array(slotBody).min(1).max(300) }));
  const db = await getDb();
  const rows = await db
    .insert(t.slots)
    .values(slots.map((s) => ({ ...s, note: s.note || null, createdBy: user.id })))
    .returning();
  await logActivity(db, user.id, "schedule", `Assigned ${rows.length} duty slot${rows.length > 1 ? "s" : ""}`);
  return { created: rows.length };
});
