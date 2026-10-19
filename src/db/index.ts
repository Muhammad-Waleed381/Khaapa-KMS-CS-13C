import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export type DB = NeonDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const g = globalThis as unknown as { __khaapaDb?: Promise<DB> };

// Production uses Neon (DATABASE_URL). Without it, local dev runs an embedded
// PGlite database in ./.data so the app works with zero setup.
async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) return drizzle({ client: new Pool({ connectionString: url }), schema });

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
