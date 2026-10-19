import { z } from "zod";
import { getDb } from "@/db";
import { getSetting, logActivity, parseBody, requireUser, route, setSetting } from "@/lib/server/api";

export const GET = route(async () => {
  await requireUser();
  return { availabilityOpen: await getSetting("availability_open", false) };
});

export const POST = route(async (req) => {
  const user = await requireUser({ admin: true });
  const { availabilityOpen } = await parseBody(req, z.object({ availabilityOpen: z.boolean() }));
  await setSetting("availability_open", availabilityOpen);
  await logActivity(
    await getDb(),
    user.id,
    "schedule",
    availabilityOpen ? "Opened availability collection" : "Closed availability collection",
  );
  return { availabilityOpen };
});
