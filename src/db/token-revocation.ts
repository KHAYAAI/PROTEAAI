import { db } from "./index";
import { sql } from "drizzle-orm";

export const tokenRevokedTable = db.schema.table("token_revoked", (t) => ({
  id: t.text().primaryKey(),
  token_jti: t.text().unique().notNull(),
  user_id: t.text().notNull(),
  revoked_at: t.integer().notNull(),
  expires_at: t.integer().notNull(),
}));

export async function revokeToken(jti: string, userId: string, expiresAt: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.insert(tokenRevokedTable).values({
    id: `${userId}-${jti}-${now}`,
    token_jti: jti,
    user_id: userId,
    revoked_at: now,
    expires_at: expiresAt,
  });

  await cleanupExpiredRevocations();
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const result = await db
    .select()
    .from(tokenRevokedTable)
    .where(sql`token_jti = ${jti}`);
  return result.length > 0;
}

async function cleanupExpiredRevocations(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .delete(tokenRevokedTable)
    .where(sql`expires_at < ${now}`);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .delete(tokenRevokedTable)
    .where(sql`user_id = ${userId}`);
}
