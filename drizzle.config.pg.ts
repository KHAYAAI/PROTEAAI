/**
 * Drizzle Kit config for PostgreSQL / Neon (used during Vercel builds).
 *
 * Run:  npx drizzle-kit push --config drizzle.config.pg.ts
 *
 * Requires DATABASE_URL environment variable pointing to a Neon connection string.
 */
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema-pg.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
