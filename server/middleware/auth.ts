/**
 * JWT authentication middleware for the ProteaAI web server.
 *
 * Validates the Bearer token from the Authorization header, looks up the
 * user's subscription plan, and calls runWithUserContext() so IPC handlers
 * can call requireCurrentUser() / getCurrentUser() without needing their
 * signatures changed.
 *
 * Routes that are public (auth endpoints, health check) should be registered
 * BEFORE applyAuthMiddleware() is called, or be explicitly excluded.
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../../src/db";
import { users, subscriptions } from "../../src/db";
import { eq } from "drizzle-orm";
import { runWithUserContext } from "../../src/ipc/context/user-context";
import { jwtSecret as JWT_SECRET } from "../utils/jwt";
import { isTokenRevoked } from "../../src/db/token-revocation";

/**
 * Express middleware that requires a valid JWT.
 * Sets req.userId and wraps the rest of the handler in a user context.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  let payload: { sub: string; jti?: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { sub: string; jti?: string };
  } catch {
    res.status(401).json({ ok: false, error: "Invalid or expired token" });
    return;
  }

  // Async: check token revocation, look up user + subscription
  (async () => {
    if (payload.jti && await isTokenRevoked(payload.jti)) {
      res.status(401).json({ ok: false, error: "Token has been revoked" });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      with: { subscription: true },
    });

    if (!user) {
      res.status(401).json({ ok: false, error: "User not found" });
      return;
    }

    const context = {
      userId: user.id,
      email: user.email,
      role: user.role as "user" | "admin",
      plan: (user.subscription?.plan ?? "free") as "free" | "pro",
    };

    // Run next() inside the AsyncLocalStorage context so all downstream
    // handlers (including IPC bridge handlers) can call getCurrentUser()
    runWithUserContext(context, () => next());
  })().catch((err) => {
    console.error("[auth middleware]", err);
    res.status(500).json({ ok: false, error: "Auth check failed" });
  });
}

/**
 * Middleware that attaches user context if a valid token is present,
 * but does NOT reject unauthenticated requests. Useful for optional auth.
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  let payload: { sub: string; jti?: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { sub: string; jti?: string };
  } catch {
    next();
    return;
  }

  (async () => {
    if (payload.jti && await isTokenRevoked(payload.jti)) {
      next();
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      with: { subscription: true },
    });

    if (!user) {
      next();
      return;
    }

    const context = {
      userId: user.id,
      email: user.email,
      role: user.role as "user" | "admin",
      plan: (user.subscription?.plan ?? "free") as "free" | "pro",
    };

    runWithUserContext(context, () => next());
  })().catch(() => next());
}

/**
 * Admin-only middleware — rejects non-admin users with 403.
 * Must be used after requireAuth.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  let payload: { sub: string; jti?: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { sub: string; jti?: string };
  } catch {
    res.status(401).json({ ok: false, error: "Invalid or expired token" });
    return;
  }

  (async () => {
    if (payload.jti && await isTokenRevoked(payload.jti)) {
      res.status(401).json({ ok: false, error: "Token has been revoked" });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user || user.role !== "admin") {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }

    runWithUserContext(
      {
        userId: user.id,
        email: user.email,
        role: "admin",
        plan: "pro",
      },
      () => next(),
    );
  })().catch((err) => {
    console.error("[admin middleware]", err);
    res.status(500).json({ ok: false, error: "Auth check failed" });
  });
}
