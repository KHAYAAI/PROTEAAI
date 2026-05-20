/**
 * ProteaAI Express application — shared between standalone server and Vercel.
 *
 * This module exports only the Express `app`; it does NOT:
 *   - Start listening on a port
 *   - Attach a WebSocket server
 *   - Serve the built SPA (handled by Vercel CDN or by server/index.ts)
 *
 * Used by:
 *   - api/server.ts  (Vercel serverless function)
 *   - server/index.ts (standalone Node.js server for Fly.io / Docker)
 */

// Must be FIRST — sets web mode before any handler imports
import { enableWebMode, webHandlerRegistry } from "../src/ipc/handlers/base";
enableWebMode();

import express from "express";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { safeRoute } from "./middleware/safe_route";
import { requireAuth } from "./middleware/auth";
import { authRouter } from "./routes/auth";
import { billingRouter } from "./routes/billing";
import { payfastRouter } from "./routes/payfast";
import { adminRouter } from "./routes/admin";
import { gdprRouter } from "./routes/gdpr";
import dotenv from "dotenv";
dotenv.config();

// ── Startup validation ────────────────────────────────────────────────────────

const REQUIRED_ENV: Record<string, string> = {
  JWT_SECRET:
    'Required to sign authentication tokens. Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  SECRET_KEY:
    'Required to encrypt user settings (64-char hex). Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
};

for (const [key, hint] of Object.entries(REQUIRED_ENV)) {
  if (!process.env[key]) {
    console.error(`\n[FATAL] Environment variable ${key} is not set.\n  ${hint}\n`);
    process.exit(1);
  }
}

if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn(
    "[WARN] STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing.",
  );
}
if (process.env.PAYFAST_MERCHANT_ID && !process.env.PAYFAST_PASSPHRASE) {
  console.warn(
    "[WARN] PAYFAST_MERCHANT_ID is set but PAYFAST_PASSPHRASE is missing.",
  );
}

import { getProteaAIAppPath } from "../src/paths/paths";
import { getMimeType } from "../src/ipc/utils/mime_utils";
import { PROTEAAI_MEDIA_DIR_NAME } from "../src/ipc/utils/media_path_utils";
import { db } from "../src/db";
import { apps } from "../src/db";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "../src/ipc/context/user-context";
import { registerIpcHandlers } from "../src/ipc/ipc_host";
import { initializeDatabase } from "../src/db";

initializeDatabase();
registerIpcHandlers();

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Raw body for Stripe webhooks
app.use("/billing/webhook", express.raw({ type: "application/json" }));

// Raw body for PayFast ITN
app.use("/payfast/itn", express.urlencoded({ extended: false }));

app.use(express.json({ limit: "50mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests, please slow down." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "Too many auth attempts, please try again later.",
  },
});

app.use(globalLimiter);

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ ok: true, version: process.env.npm_package_version ?? "1.0.0" });
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/auth", authLimiter, authRouter);
app.use("/billing", billingRouter);
app.use("/payfast", payfastRouter);
app.use("/admin", adminRouter);
app.use("/gdpr", gdprRouter);

// ── IPC bridge ────────────────────────────────────────────────────────────────

app.post(
  "/api/:channel(*)",
  requireAuth,
  safeRoute("ipc-bridge", async (req) => {
    const channel = req.params.channel;
    const handler = webHandlerRegistry.get(channel);
    if (!handler) throw new Error(`Unknown channel: ${channel}`);
    return handler(req.body);
  }),
);

// ── Media serving ─────────────────────────────────────────────────────────────

app.get(
  "/media/:encodedAppPath/:encodedFilename",
  requireAuth,
  async (req, res) => {
    const encodedAppPath = req.params.encodedAppPath;
    const encodedFilename = req.params.encodedFilename;

    let appPathRaw: string;
    let filename: string;
    try {
      appPathRaw = decodeURIComponent(encodedAppPath);
      filename = decodeURIComponent(encodedFilename);
    } catch {
      res.status(400).send("Bad Request");
      return;
    }

    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      res.status(403).send("Forbidden");
      return;
    }

    const currentUser = getCurrentUser();
    if (currentUser) {
      const ownedApp = await db.query.apps.findFirst({
        where: and(
          eq(apps.path, appPathRaw),
          eq(apps.userId, currentUser.userId),
        ),
      });
      if (!ownedApp) {
        res.status(403).send("Forbidden");
        return;
      }
    }

    const appPath = getProteaAIAppPath(appPathRaw);
    const mediaDir = path.resolve(path.join(appPath, PROTEAAI_MEDIA_DIR_NAME));
    const resolvedPath = path.resolve(path.join(mediaDir, filename));

    if (
      !resolvedPath.startsWith(mediaDir + path.sep) &&
      resolvedPath !== mediaDir
    ) {
      res.status(403).send("Forbidden");
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).send("Not Found");
      return;
    }

    const ext = path.extname(filename).toLowerCase();
    res.setHeader("Content-Type", getMimeType(ext));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    fs.createReadStream(resolvedPath).pipe(res);
  },
);

export default app;
