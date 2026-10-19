import { asc, eq } from "drizzle-orm";
import { getDb, t } from "@/db";
import { HttpError, logActivity, parseBody, requireUser, route } from "@/lib/server/api";
import { rs } from "@/lib/money";
import { accountById, readShareSettings, shareSettingsInput } from "../shared";

// Any approved account can read the settings (to buy shares); admins also get
// the active payment accounts to choose from.
export const GET = route(async () => {
  const user = await requireUser();
  const db = await getDb();
  const settings = await readShareSettings(db);
  const account = await accountById(db, settings.accountId);
  const accounts =
    user.role === "admin"
      ? await db
          .select()
          .from(t.paymentAccounts)
          .where(eq(t.paymentAccounts.active, true))
          .orderBy(asc(t.paymentAccounts.createdAt))
      : undefined;
  return { settings, account, accounts };
});

export const POST = route(async (req) => {
  const user = await requireUser({ admin: true });
  const body = await parseBody(req, shareSettingsInput);
  const db = await getDb();
  if (body.accountId) {
    const [a] = await db.select().from(t.paymentAccounts).where(eq(t.paymentAccounts.id, body.accountId));
    if (!a) throw new HttpError(400, "That payment account doesn't exist");
    if (!a.active) throw new HttpError(400, "That payment account is switched off");
  }
  if (body.open && !body.accountId) throw new HttpError(400, "Choose the account buyers should pay into");
  const before = await readShareSettings(db);
  await db
    .insert(t.settings)
    .values({ key: "shares", value: body })
    .onConflictDoUpdate({ target: t.settings.key, set: { value: body } });

  const changes: string[] = [];
  if (before.pricePerShare !== body.pricePerShare)
    changes.push(`price ${rs(before.pricePerShare)} → ${rs(body.pricePerShare)}`);
  if (before.maxPerPerson !== body.maxPerPerson) changes.push(`limit ${before.maxPerPerson} → ${body.maxPerPerson} per person`);
  if (before.totalOnOffer !== body.totalOnOffer)
    changes.push(`on offer ${before.totalOnOffer ?? "no limit"} → ${body.totalOnOffer ?? "no limit"}`);
  if (before.open !== body.open) changes.push(body.open ? "opened share requests" : "closed share requests");
  if (before.accountId !== body.accountId) changes.push("changed the payment account");
  if (changes.length) await logActivity(db, user.id, "shares", `Share settings: ${changes.join(", ")}`);
  return { settings: body };
});
