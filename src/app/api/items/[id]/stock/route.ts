import { z } from "zod";
import { getDb } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";
import { countCorrection, restock, writeOff } from "@/lib/server/stock";
import { getItemOr404, listItems } from "../../shared";

const note = z.string().trim().max(200).nullish();

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("restock"),
    qty: z.number().int().positive(),
    // Either per-unit or the total paid for the batch (paisa).
    unitCost: z.number().int().min(0).optional(),
    totalCost: z.number().int().min(0).optional(),
    supplier: z.string().trim().max(80).nullish(),
    note,
  }),
  z.object({ kind: z.literal("waste"), qty: z.number().int().positive(), note }),
  z.object({ kind: z.literal("count"), counted: z.number().int().min(0), note }),
]);

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const body = await parseBody(req, schema);
  const db = await getDb();
  const item = await getItemOr404(db, id);

  let message: string;
  if (body.kind === "restock") {
    const unitCost =
      body.unitCost ?? (body.totalCost !== undefined ? Math.round(body.totalCost / body.qty) : undefined);
    if (unitCost === undefined) throw new HttpError(400, "Give the unit cost or the total cost");
    await db.transaction((tx) =>
      restock(tx, { itemId: id, qty: body.qty, unitCost, supplier: body.supplier, note: body.note, userId: user.id }),
    );
    message = `Restocked ${body.qty} × ${item.name} at ${rs(unitCost)} each${body.supplier ? ` from ${body.supplier}` : ""}`;
  } else if (body.kind === "waste") {
    await db.transaction((tx) => writeOff(tx, { itemId: id, qty: body.qty, note: body.note, userId: user.id }));
    message = `Wrote off ${body.qty} × ${item.name}${body.note ? ` (${body.note})` : ""}`;
  } else {
    const delta = await db.transaction((tx) =>
      countCorrection(tx, { itemId: id, counted: body.counted, note: body.note, userId: user.id }),
    );
    message = `Counted ${item.name}: ${body.counted} on the shelf (${delta === 0 ? "no difference" : `${delta > 0 ? "+" : ""}${delta}`})`;
  }
  await logActivity(db, user.id, "stock", message, id);

  const [row] = await listItems(db, { id });
  return { item: row };
});
