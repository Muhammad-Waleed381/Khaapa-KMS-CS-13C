import { Pool, type PoolClient } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type DB = NeonDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const g = globalThis as unknown as { __khaapaDb?: Promise<DB> };

// Neon's free tier suspends the database when idle, and while it wakes the
// first WebSocket connections fail ("Received network error or non-101 status
// code"). Retry opening a connection a few times: nothing has run yet, so it
// is always safe. Errors with a Postgres SQLSTATE code are real and not retried.
function retryConnects(pool: Pool, attempts = 4) {
  const open = pool.connect.bind(pool) as unknown as () => Promise<PoolClient>;
  const withRetry = async () => {
    for (let i = 1; ; i++) {
      try {
        return await open();
      } catch (e) {
        if (i >= attempts || (e as { code?: string }).code) throw e;
        await new Promise((r) => setTimeout(r, 250 * 2 ** i));
      }
    }
  };
  // pg's Pool calls this.connect(callback) internally for pool.query().
  pool.connect = ((cb?: (err: Error | undefined, client?: PoolClient, done?: () => void) => void) => {
    if (!cb) return withRetry();
    withRetry().then(
      (client) => cb(undefined, client, () => client.release()),
      (err) => cb(err),
    );
  }) as Pool["connect"];
  return pool;
}

// Production uses Neon (DATABASE_URL). Without it, local dev runs an embedded
// PGlite database in ./.data so the app works with zero setup.
async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) return drizzle({ client: retryConnects(new Pool({ connectionString: url })), schema });

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleLite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { mkdirSync } = await import("node:fs");
  mkdirSync("./.data", { recursive: true });
  const client = new PGlite("./.data/pglite");
  const db = drizzleLite({ client, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  g.__khaapaDb ??= connect().catch((e) => {
    g.__khaapaDb = undefined;
    throw e;
  });
  return g.__khaapaDb;
}

export * as t from "./schema";
