import { eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, requireUser, route } from "@/lib/server/api";

// The customer's payment screenshot, for staff to check. ?raw=1 returns the
// image itself (for <img> thumbnails); otherwise JSON with the data URL.
export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireUser();
  const { id } = await params;
  const db = await getDb();
  const [row] = await db
    .select({ proof: t.preorders.proof, paymentRef: t.preorders.paymentRef })
    .from(t.preorders)
    .where(eq(t.preorders.id, id));
  if (!row) throw new HttpError(404, "Order not found");
  if (new URL(req.url).searchParams.get("raw")) {
    const match = row.proof?.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    if (!match) return new Response("No screenshot", { status: 404 });
    return new Response(Buffer.from(match[2], "base64"), {
      headers: { "Content-Type": match[1], "Cache-Control": "private, max-age=3600" },
    });
  }
  return row;
});
