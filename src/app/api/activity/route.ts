import { getDb } from "@/db";
import { requireUser, route } from "@/lib/server/api";
import { activityPage } from "@/lib/server/reports";

// Newest first. Pass `before` (the previous page's `next`) to load older rows.
export const GET = route(async (req) => {
  await requireUser();
  const q = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(q.get("limit")) || 50, 1), 200);
  const before = q.get("before") ? new Date(q.get("before")!) : null;
  const db = await getDb();
  return activityPage(db, {
    limit,
    before: before && !isNaN(before.getTime()) ? before : null,
    kind: q.get("kind") || null,
  });
});
