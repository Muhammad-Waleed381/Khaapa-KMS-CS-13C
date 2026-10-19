import { eq } from "drizzle-orm";
import { ZodError, type ZodType } from "zod";
import { auth } from "@/auth";
import { getDb, t, type DB, type Tx } from "@/db";

export type User = typeof t.users.$inferSelect;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function currentUser(): Promise<User | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const db = await getDb();
  const [user] = await db.select().from(t.users).where(eq(t.users.email, email.toLowerCase()));
  return user ?? null;
}

/** An approved, active staff member; `admin: true` additionally needs the admin role. */
export async function requireUser(opts: { admin?: boolean } = {}): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in first");
  if (user.status !== "active") throw new HttpError(403, "Your account is waiting for admin approval");
  if (opts.admin && user.role !== "admin") throw new HttpError(403, "Admins only");
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  return schema.parse(await req.json().catch(() => ({})));
}

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps a route handler: the return value becomes JSON, thrown HttpErrors and
 * validation errors become `{ error }` responses with the right status.
 *
 *   export const GET = route(async (req, { params }) => { ... return { items } })
 */
export function route<P = Record<string, string>>(
  fn: (req: Request, ctx: Ctx<P>) => Promise<unknown>,
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : Response.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        const issue = e.issues[0];
        return Response.json(
          { error: `${issue.path.join(".") || "input"}: ${issue.message}` },
          { status: 400 },
        );
      }
      console.error(e);
      return Response.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

/** Append to the activity log shown on /activity. */
export async function logActivity(
  db: DB | Tx,
  userId: string | null,
  kind: string,
  message: string,
  ref?: string,
) {
  await db.insert(t.activity).values({ userId, kind, message, ref });
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const [row] = await db.select().from(t.settings).where(eq(t.settings.key, key));
  return (row?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  const db = await getDb();
  await db
    .insert(t.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: t.settings.key, set: { value } });
}
