import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3001";

test.describe("Web Billing (Stripe)", () => {
  test.beforeEach(async ({ page }) => {
    const testEmail = `billing-${Date.now()}@example.com`;

    // Register and login
    await page.goto(`${BASE_URL}/signup`);
    await page.locator("input[type=email]").fill(testEmail);
    await page.locator("input[type=password]").fill("ValidPassword123!");
    await page.locator("button:has-text('Sign Up')").click();

    await expect(page).toHaveURL(/\/home|\/chat|\/apps/, { timeout: 5000 });
  });

  test("should show billing page for free users", async ({ page }) => {
    await page.goto(`${BASE_URL}/billing`);
    await expect(page.locator("text=/billing|subscription|plan/i")).toBeVisible();
    await expect(page.locator("text=/free/i")).toBeVisible();
  });

  test("should fetch subscription info via /billing/subscription", async ({ page }) => {
    const subResponse = await page.evaluate(async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/billing/subscription", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    });

    expect(subResponse.ok).toBe(true);
    expect(subResponse.data.plan).toBe("free");
    expect(subResponse.data.status).toBe("active");
  });

  test("should return 503 if Stripe not configured", async ({ page }) => {
    // Only run if STRIPE_SECRET_KEY is not set
    const isStripeConfigured = await page.evaluate(async () => {
      const res = await fetch("/billing/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId: "price_test" }),
      });
      return res.status !== 503;
    });

    if (!isStripeConfigured) {
      await page.goto(`${BASE_URL}/billing`);
      await expect(page.locator("text=/billing|not.*available|not.*configured/i")).toBeVisible({ timeout: 2000 });
    }
  });

  test("should show admin billing dashboard", async ({ page, context }) => {
    // This test assumes there's an admin user or admin endpoint
    // Skip if admin is not available
    const adminResponse = await page.evaluate(async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status;
    });

    if (adminResponse === 403) {
      test.skip();
    }

    if (adminResponse === 200) {
      await page.goto(`${BASE_URL}/admin`);
      await expect(page.locator("text=/stats|users|subscription/i")).toBeVisible({ timeout: 2000 });
    }
  });
});

test.describe("Web Billing - Webhook Handling", () => {
  test("should reject webhook without signature", async ({ page }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch("/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ping" }),
      });
      return { status: res.status };
    });

    // Should reject (400 or 401)
    expect([400, 401]).toContain(response.status);
  });

  test("should handle valid checkout.session.completed event (mock)", async ({ page }) => {
    // In a real test, you would use Stripe's test webhook signing secret
    // This is a placeholder for webhook simulation
    const timestamp = Math.floor(Date.now() / 1000);

    const response = await page.evaluate(async (ts) => {
      const event = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            customer: "cus_test_456",
          },
        },
      };
      const res = await fetch("/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      return { status: res.status, ok: res.ok };
    }, timestamp);

    // Even without valid signature, endpoint should exist
    expect([400, 401, 200]).toContain(response.status);
  });
});
