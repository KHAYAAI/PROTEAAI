/**
 * Database initialization — SQLite (Electron / Fly.io) or Neon PostgreSQL (Vercel).
 *
 * Backend selection:
 *   DATABASE_URL set  →  Neon HTTP (schema-pg.ts)
 *   otherwise         →  SQLite WAL (schema.ts), path from PROTEAAI_DATA_DIR
 *
 * All table objects are re-exported from the active schema so server-side
 * routes only need to import from "src/db" — no need to know the backend.
 */

import path from "node:path";
import fs from "node:fs";

// Type-only imports — erased at compile time, no runtime require side-effects.
// This prevents native-module and path-alias errors in Vercel's Lambda environment.
import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// SQLite schema (always loaded — used by Electron + Fly.io, and as type source)
import * as schema from "./schema";

// ── Active schema (pg for Neon, sqlite otherwise) ─────────────────────────────
// Evaluated once at module load time. process.env is populated before any
// module code runs so DATABASE_URL is reliable here.

const _activeSchema: typeof schema = (() => {
  if (process.env.DATABASE_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("./schema-pg") as typeof schema;
    } catch {
      /* fall through — shouldn't happen */
    }
  }
  return schema;
})();

// ── Module-level state ────────────────────────────────────────────────────────

let _db: any = null;

// ── getDatabasePath ───────────────────────────────────────────────────────────

export function getDatabasePath(): string {
  // Web-server mode (Fly.io Docker): honour the data-directory env var
  if (process.env.PROTEAAI_DATA_DIR) {
    return path.join(process.env.PROTEAAI_DATA_DIR, "sqlite.db");
  }
  // Electron: delegate to getUserDataPath() — wrapped to avoid crashing if the
  // import chain fails (paths → settings → @/shared/templates path alias)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getUserDataPath } = require("../paths/paths") as {
      getUserDataPath: () => string;
    };
    return path.join(getUserDataPath(), "sqlite.db");
  } catch {
    /* fall through */
  }
  return path.join(process.cwd(), "userData", "sqlite.db");
}

// ── initializeDatabase ────────────────────────────────────────────────────────

export function initializeDatabase(): BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
} {
  if (_db) return _db;

  // ── Neon PostgreSQL (Vercel serverless) ───────────────────────────────────
  if (process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require("@neondatabase/serverless") as {
      neon: (url: string) => unknown;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle: drizzleNeon } = require("drizzle-orm/neon-http") as {
      drizzle: (opts: { client: unknown; schema: unknown }) => unknown;
    };
    const sql = neon(process.env.DATABASE_URL);
    _db = drizzleNeon({ client: sql, schema: _activeSchema });
    console.log("[db] Connected to Neon PostgreSQL");
    return _db;
  }

  // ── SQLite — Electron desktop or Fly.io container ─────────────────────────
  const dbPath = getDatabasePath();
  console.log("[db] SQLite at:", dbPath);

  // Ensure directory exists
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  } catch { /* ignore */ }

  // Remove tiny/corrupt DB files that would block migration
  try {
    if (fs.existsSync(dbPath) && fs.statSync(dbPath).size < 100) {
      console.log("[db] Removing corrupt database file");
      fs.unlinkSync(dbPath);
    }
  } catch { /* ignore */ }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DbCtor = require("better-sqlite3") as {
    new (path: string, opts?: { timeout?: number }): Database.Database;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3") as {
    drizzle: (
      db: Database.Database,
      opts: { schema: typeof schema },
    ) => BetterSQLite3Database<typeof schema>;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { migrate } = require("drizzle-orm/better-sqlite3/migrator") as {
    migrate: (db: unknown, opts: { migrationsFolder: string }) => void;
  };

  const sqlite = new (DbCtor as any)(dbPath, { timeout: 10000 });
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");

  _db = drizzle(sqlite, { schema });

  // Migrations path differs between Electron and Docker.
  // In Docker: cwd = /app, drizzle/ is copied to /app/drizzle.
  // In Electron: the folder is relative to the compiled output.
  const isElectron = typeof process.versions["electron"] !== "undefined";
  const migrationsFolder =
    process.env.DRIZZLE_MIGRATIONS_PATH ??
    (isElectron
      ? path.join(__dirname, "..", "..", "drizzle")
      : path.join(process.cwd(), "drizzle"));

  console.log("[db] Running migrations from:", migrationsFolder);
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(`Migrations folder not found: ${migrationsFolder}`);
  }
  migrate(_db, { migrationsFolder });

  return _db;
}

// ── getDb / db proxy ──────────────────────────────────────────────────────────

export function getDb(): BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
} {
  if (!_db) {
    throw new Error(
      "Database not initialized. Call initializeDatabase() first.",
    );
  }
  return _db;
}

export const db = new Proxy({} as any, {
  get(_target, prop) {
    const database = getDb();
    return database[prop as keyof typeof database];
  },
}) as BetterSQLite3Database<typeof schema> & { $client: Database.Database };

// ── Re-export active schema tables ────────────────────────────────────────────
//
// Server routes and middleware import table objects from here.  When
// DATABASE_URL is set the pg-core table definitions are used so Drizzle
// generates correct PostgreSQL syntax.  Without DATABASE_URL the SQLite
// definitions are used.

export const {
  users,
  subscriptions,
  userSettings,
  prompts,
  apps,
  chats,
  messages,
  versions,
  language_model_providers,
  language_models,
  mcpServers,
  mcpToolConsents,
  customThemes,
  appsRelations,
  chatsRelations,
  messagesRelations,
  versionsRelations,
  languageModelProvidersRelations,
  languageModelsRelations,
  usersRelations,
  subscriptionsRelations,
  AI_MESSAGES_SDK_VERSION,
} = _activeSchema;
