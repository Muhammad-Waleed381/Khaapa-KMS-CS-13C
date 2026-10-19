import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, t, type Tx } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route, type User } from "@/lib/server/api";
import { recordSale } from "@/lib/server/stock";
import { rs } from "@/lib/money";

// Offline outbox upload. Each op runs in its own transaction and is
// idempotent on its client-generated id, so a device can resend freely.

const saleOp = z.object({
  id: z.uuid(),
  type: z.literal("sale"),
  payload: z.object({
    id: z.uuid(),
    createdAt: z.iso.datetime({ offset: true }),
    method: z.enum(["cash", "online"]),
    cashReceived: z.number().int().nonnegative().nullish(),
    shiftId: z.uuid().nullish(),
    lines: z
      .array(
        z.object({
          itemId: z.uuid(),
          name: z.string().min(1),
          qty: z.number().int().positive(),
          unitPrice: z.number().int().nonnegative(),
        }),
      )
      .min(1),
  }),
});

const shiftStartOp = z.object({
  id: z.uuid(),
  type: z.literal("shift_start"),
  payload: z.object({ id: z.uuid(), startedAt: z.iso.datetime({ offset: true }) }),
});

const shiftEndOp = z.object({
  id: z.uuid(),
  type: z.literal("shift_end"),
  // auto: the device closed it because the person's duty slot ended.
  payload: z.object({ id: z.uuid(), endedAt: z.iso.datetime({ offset: true }), auto: z.boolean().optional() }),
});

const body = z.object({ ops: z.array(z.unknown()).max(100) });
const op = z.discriminatedUnion("type", [saleOp, shiftStartOp, shiftEndOp]);

type Result = { id: string; ok: boolean; duplicate?: boolean; error?: string; permanent?: boolean };

async function apply(tx: Tx, user: User, o: z.infer<typeof op>): Promise<Omit<Result, "id">> {
  if (o.type === "sale") {
    const p = o.payload;
    if (p.method === "cash" && p.cashReceived != null) {
      const total = p.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      if (p.cashReceived < total) throw new HttpError(400, "Cash received is less than the total");
    }
    const r = await recordSale(tx, {
      id: p.id,
      userId: user.id,
      shiftId: p.shiftId,
      method: p.method,
      cashReceived: p.cashReceived,
      createdAt: new Date(p.createdAt),
      lines: p.lines,
    });
    if (!r.duplicate) {
      const units = p.lines.reduce((s, l) => s + l.qty, 0);
      await logActivity(
        tx,
        user.id,
        "sale",
        `Sold ${units} item${units > 1 ? "s" : ""} · ${rs(r.total)} ${p.method}`,
        p.id,
      );
    }
    return { ok: true, duplicate: r.duplicate };
  }

  if (o.type === "shift_start") {
    const p = o.payload;
    const [existing] = await tx.select({ id: t.shifts.id }).from(t.shifts).where(eq(t.shifts.id, p.id));
    if (existing) return { ok: true, duplicate: true };
    const startedAt = new Date(p.startedAt);
    // One open shift per person: starting a new one closes any left open.
    await tx
      .update(t.shifts)
      .set({ endedAt: startedAt })
      .where(and(eq(t.shifts.userId, user.id), isNull(t.shifts.endedAt), ne(t.shifts.id, p.id)));
    await tx.insert(t.shifts).values({ id: p.id, userId: user.id, startedAt });
    await logActivity(tx, user.id, "shift", "Started a shift", p.id);
    return { ok: true };
  }

  const p = o.payload;
  const [shift] = await tx.select().from(t.shifts).where(eq(t.shifts.id, p.id));
  if (!shift) throw new HttpError(404, "Shift not found");
  if (shift.userId !== user.id) throw new HttpError(403, "Not your shift");
  if (shift.endedAt) return { ok: true, duplicate: true };
  const endedAt = new Date(p.endedAt);
  await tx
    .update(t.shifts)
    .set({ endedAt: endedAt < shift.startedAt ? shift.startedAt : endedAt })
    .where(eq(t.shifts.id, p.id));
  const mins = Math.max(0, Math.round((endedAt.getTime() - shift.startedAt.getTime()) / 60000));
  const length = `${Math.floor(mins / 60)}h ${mins % 60}m`;
  await logActivity(
    tx,
    user.id,
    "shift",
    p.auto ? `Shift ended automatically at the end of the duty slot (${length})` : `Ended a shift (${length})`,
    p.id,
  );
  return { ok: true };
}

export const POST = route(async (req) => {
  const user = await requireUser();
  const { ops } = await parseBody(req, body);
  const db = await getDb();
  const results: Result[] = [];

  for (const raw of ops) {
    const id = (raw as { id?: unknown })?.id;
    const parsed = op.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      results.push({
        id: typeof id === "string" ? id : "",
        ok: false,
        permanent: true,
        error: `${issue.path.join(".") || "op"}: ${issue.message}`,
      });
      continue;
    }
    try {
      const r = await db.transaction((tx) => apply(tx, user, parsed.data));
      results.push({ id: parsed.data.id, ...r });
    } catch (e) {
      if (e instanceof HttpError && e.status < 500) {
        results.push({ id: parsed.data.id, ok: false, permanent: true, error: e.message });
      } else {
        console.error("sync op failed", e);
        results.push({ id: parsed.data.id, ok: false, permanent: false, error: "Server error, will retry" });
      }
    }
  }
  return { results };
});
