// Applies ./drizzle migrations to Neon before `next build`. Local dev (no
// DATABASE_URL) migrates the embedded PGlite database on first use instead.
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("migrate: no DATABASE_URL, skipping");
} else {
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("migrate: done");
}
