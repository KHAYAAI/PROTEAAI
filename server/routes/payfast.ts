/**
 * PayFast billing routes for ProteaAI web server (South African payment processor).
 *
 * Flow:
 *  1. User clicks "Upgrade with PayFast"
 *  2. POST /payfast/create-payment  → returns form fields + PayFast URL
 *  3. Frontend submits auto-redirect form to PayFast
 *  4. User pays on PayFast checkout page
 *  5. PayFast sends ITN (POST /payfast/itn) to our server
 *  6. Server verifies signature → upgrades user to Pro
 *
 * Required env vars:
 *   PAYFAST_MERCHANT_ID    — from PayFast dashboard
 *   PAYFAST_MERCHANT_KEY   — from PayFast dashboard
 *   PAYFAST_PASSPHRASE     — set in PayFast account settings (strongly recommended)
 *
 * Optional env vars:
 *   PAYFAST_SANDBOX        — "true" (default) or "false" for production
 *   PAYFAST_PRO_AMOUNT     — monthly price in ZAR, default "149.00"
 */

import { Router } from "express";
import crypto from "node:crypto";
import https from "node:https";
import { db } from "../../src/db";
import { subscriptions } from "../../src/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { getCurrentUser } from "../../src/ipc/context/user-context";

export const payfastRouter = Router();

const PAYFAST_MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID ?? "";
const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY ?? "";
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE ?? "";
const PAYFAST_SANDBOX = process.env.PAYFAST_SANDBOX !== "false"; // defaults to sandbox
const PAYFAST_PRO_AMOUNT = process.env.PAYFAST_PRO_AMOUNT ?? "149.00"; // ZAR

const PAYFAST_HOST = PAYFAST_SANDBOX
  ? "https://sandbox.payfast.co.za"
  : "https://www.payfast.co.za";

const PAYFAST_VALIDATE_HOST = PAYFAST_SANDBOX
  ? "sandbox.payfast.co.za"
  : "www.payfast.co.za";

// ── Signature helpers ─────────────────────────────────────────────────────────

/**
 * Generate a PayFast MD5 signature from a key-value map.
 * Keys are sorted alphabetically, empty values are excluded,
 * and the passphrase is appended if configured.
 */
function generateSignature(data: Record<string, string>): string {
  const queryString = Object.keys(data)
    .filter((key) => key !== "signature" && data[key] !== "")
    .sort()
    .map(
      (key) =>
        `${key}=${encodeURIComponent(data[key]).replace(/%20/g, "+")}`,
    )
    .join("&");

  const toHash = PAYFAST_PASSPHRASE
    ? `${queryString}&passphrase=${encodeURIComponent(PAYFAST_PASSPHRASE).replace(/%20/g, "+")}`
    : queryString;

  return crypto.createHash("md5").update(toHash).digest("hex");
}

/**
 * Verify an ITN notification against PayFast's validate endpoint.
 * Returns true if PayFast confirms the payment is valid.
 */
function verifyWithPayfast(itnBody: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: PAYFAST_VALIDATE_HOST,
        path: "/eng/query/validate",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(itnBody),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => resolve(body.trim() === "VALID"));
      },
    );
    req.on("error", () => resolve(false));
    req.write(itnBody);
    req.end();
  });
}

// ── GET /payfast/subscription ─────────────────────────────────────────────────

payfastRouter.get("/subscription", requireAuth, async (_req, res) => {
  try {
    const { userId } = getCurrentUser()!;
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
    res.json({ ok: true, data: sub ?? { plan: "free", status: "active" } });
  } catch (err) {
    console.error("[payfast/subscription]", err);
    res.status(500).json({ ok: false, error: "Failed to fetch subscription" });
  }
});

// ── POST /payfast/create-payment ──────────────────────────────────────────────
//
// Returns the PayFast payment URL and all required form fields (including
// signature) so the frontend can auto-submit the form to PayFast.

payfastRouter.post("/create-payment", requireAuth, async (req, res) => {
  if (!PAYFAST_MERCHANT_ID || !PAYFAST_MERCHANT_KEY) {
    res.status(503).json({ ok: false, error: "PayFast is not configured" });
    return;
  }

  try {
    const { userId, email } = getCurrentUser()!;
    const baseUrl =
      (req.body as { baseUrl?: string }).baseUrl ??
      process.env.APP_BASE_URL ??
      "http://localhost:3001";

    const billingDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const paymentData: Record<string, string> = {
      // Merchant credentials
      merchant_id: PAYFAST_MERCHANT_ID,
      merchant_key: PAYFAST_MERCHANT_KEY,
      // Redirect URLs
      return_url: `${baseUrl}/billing?success=true&provider=payfast`,
      cancel_url: `${baseUrl}/billing?canceled=true`,
      notify_url: `${baseUrl}/payfast/itn`,
      // Buyer info (pre-fills PayFast checkout)
      email_address: email,
      // Payment details
      m_payment_id: userId, // our internal reference — echoed back in ITN
      amount: PAYFAST_PRO_AMOUNT,
      item_name: "ProteaAI Pro",
      item_description: "Unlimited AI-powered app building — Monthly subscription",
      // Recurring / subscription billing
      subscription_type: "1",
      billing_date: billingDate,
      recurring_amount: PAYFAST_PRO_AMOUNT,
      frequency: "3", // 3 = monthly
      cycles: "0", // 0 = infinite (until cancelled)
    };

    // Sign the payload
    paymentData.signature = generateSignature(paymentData);

    res.json({
      ok: true,
      data: {
        actionUrl: `${PAYFAST_HOST}/eng/process`,
        fields: paymentData,
        sandbox: PAYFAST_SANDBOX,
      },
    });
  } catch (err) {
    console.error("[payfast/create-payment]", err);
    res.status(500).json({ ok: false, error: "Failed to create payment" });
  }
});

// ── POST /payfast/itn ─────────────────────────────────────────────────────────
//
// Instant Transaction Notification (PayFast's webhook).
// PayFast POSTs application/x-www-form-urlencoded to this endpoint.
// The raw body is parsed by urlencoded middleware mounted in server/index.ts.

payfastRouter.post("/itn", async (req, res) => {
  // Respond 200 first to prevent PayFast retries while we process
  res.status(200).send("OK");

  const body = req.body as Record<string, string>;

  try {
    // 1. Verify signature
    const { signature, ...dataWithoutSig } = body;
    const expectedSig = generateSignature(dataWithoutSig);
    if (signature !== expectedSig) {
      console.error("[payfast/itn] signature mismatch — possible forgery");
      return;
    }

    // 2. Verify with PayFast's validate endpoint (defense-in-depth)
    // Rebuild raw body string for validation call
    const rawBody = Object.keys(body)
      .filter((k) => body[k] !== "")
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(body[k])}`,
      )
      .join("&");

    const isValid = await verifyWithPayfast(rawBody);
    if (!isValid) {
      console.error("[payfast/itn] PayFast validation endpoint rejected payment");
      return;
    }

    // 3. Only process COMPLETE payments
    if (body.payment_status !== "COMPLETE") {
      console.log(`[payfast/itn] payment_status=${body.payment_status} — no action`);
      return;
    }

    // 4. Extract userId from m_payment_id (set in create-payment)
    const userId = body.m_payment_id;
    if (!userId) {
      console.error("[payfast/itn] missing m_payment_id");
      return;
    }

    // 5. Calculate next billing date (1 month from now)
    const now = new Date();
    const nextPeriodEnd = new Date(now);
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

    const payfastToken = body.token ?? ""; // recurring billing token sent by PayFast
    const pfPaymentId = body.pf_payment_id ?? `pf_${userId}_${Date.now()}`;

    // 6. Upsert subscription — insert on first payment, update on renewals
    await db
      .insert(subscriptions)
      .values({
        id: pfPaymentId,
        userId,
        stripeCustomerId: "",
        payfastToken,
        paymentProvider: "payfast",
        status: "active",
        plan: "pro",
        currentPeriodEnd: nextPeriodEnd,
        cancelAtPeriodEnd: false,
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          id: pfPaymentId,
          payfastToken,
          paymentProvider: "payfast",
          status: "active",
          plan: "pro",
          currentPeriodEnd: nextPeriodEnd,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        },
      });

    console.log(`[payfast/itn] userId=${userId} upgraded to Pro`);
  } catch (err) {
    console.error("[payfast/itn] processing error:", err);
  }
});

// ── POST /payfast/cancel ──────────────────────────────────────────────────────
//
// Downgrade user when they cancel their PayFast subscription.
// Triggered manually or via a PayFast subscription cancellation webhook.

payfastRouter.post("/cancel", requireAuth, async (_req, res) => {
  try {
    const { userId } = getCurrentUser()!;

    await db
      .update(subscriptions)
      .set({
        plan: "free",
        status: "canceled",
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId));

    res.json({ ok: true });
  } catch (err) {
    console.error("[payfast/cancel]", err);
    res.status(500).json({ ok: false, error: "Failed to cancel subscription" });
  }
});
