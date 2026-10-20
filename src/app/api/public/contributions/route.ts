import { connection } from "next/server";
import { getDb } from "@/db";
import { currentUser, route } from "@/lib/server/api";
import { activeMembers, contributionBoard, periodFromQuery } from "@/lib/server/contributions";

// Contribution board for everyone. Only totals and hand-logged entries are shown;
// shift start and end times stay private. Admins also get the member list to log against.
export const GET = route(async (req) => {
  await connection();
  const db = await getDb();
  const me = await currentUser();
  const canEdit = !!me && me.status === "active" && me.role === "admin";
  const board = await contributionBoard(db, periodFromQuery(new URL(req.url).searchParams));
  return { ...board, canEdit, members: canEdit ? await activeMembers(db) : undefined };
});
