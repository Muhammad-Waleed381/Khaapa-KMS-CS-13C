import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, t } from "@/db";

// Public: item photos are shown on the public menu too. URLs carry ?v=<imageVersion>,
// so responses can be cached forever.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [row] = await db.select({ image: t.items.image }).from(t.items).where(eq(t.items.id, id));
  const match = row?.image?.match(/^data:(image\/[a-z]+);base64,(.*)$/);
  if (!match) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
