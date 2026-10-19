import { z } from "zod";
import { getDb } from "@/db";
import { logActivity, parseBody, requireUser, route, setSetting } from "@/lib/server/api";
import { getShop } from "../public/_shop";

const Body = z.object({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    label: z.string().trim().min(1).max(80),
  }),
  hours: z.string().trim().max(300),
  whatsapp: z.string().trim().max(20),
});

export const GET = route(async () => {
  await requireUser({ admin: true });
  return { shop: await getShop() };
});

export const POST = route(async (req) => {
  const user = await requireUser({ admin: true });
  const shop = await parseBody(req, Body);
  await setSetting("shop", shop);
  await logActivity(await getDb(), user.id, "settings", `${user.name} updated shop settings`);
  return { shop };
});
