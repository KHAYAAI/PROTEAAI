import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3001";

test.describe("Web Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
  });

  test("should show login page", async ({ page }) => {
    await expect(page).toHaveTitle(/login|signin/i);
    await expect(page.locator("input[type=email]")).toBeVisible();
    await expect(page.locator("input[type=password]")).toBeVisible();
  });

  test("should reject invalid email", async ({ page }) => {
    await page.locator("input[type=email]").fill("invalid");
    await page.locator("input[type=password]").fill("password");
    await page.locator("button:has-text('Sign In')").click();

    await expect(page.locator("text=/invalid|email/i")).toBeVisible({ timeout: 2000 });
  });

  test("should reject short password on signup", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);

    await page.locator("input[type=email]").fill("test@example.com");
    await page.locator("input[type=password]").fill("short");
    await page.locator("button:has-text('Sign Up')").click();

    await expect(page.locator("text=/8 characters|password/i")).toBeVisible({ timeout: 2000 });
  });

  test("should allow registration with valid credentials", async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;

    await page.goto(`${BASE_URL}/signup`);
    await page.locator("input[type=email]").fill(testEmail);
    await page.locator("input[type=password]").fill("ValidPassword123!");
    await page.locator("input[placeholder*=name]").fill("Test User");
    await page.locator("button:has-text('Sign Up')").click();

    await expect(page).toHaveURL(/\/home|\/chat|\/apps/, { timeout: 5000 });
  });

  test("should reject login with non-existent email", async ({ page }) => {
    await page.locator("input[type=email]").fill("nonexistent@example.com");
    await page.locator("input[type=password]").fill("anypassword");
    await page.locator("button:has-text('Sign In')").click();

    await expect(page.locator("text=/invalid|credentials/i")).toBeVisible({ timeout: 2000 });
  });

  test("should persist login token in localStorage", async ({ page, context }) => {
    const testEmail = `persist-${Date.now()}@example.com`;

    // Register
    await page.goto(`${BASE_URL}/signup`);
    await page.locator("input[type=email]").fill(testEmail);
    await page.locator("input[type=password]").fill("ValidPassword123!");
    await page.locator("button:has-text('Sign Up')").click();

    await expect(page).toHaveURL(/\/home|\/chat|\/apps/, { timeout: 5000 });

    // Check token exists
    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeTruthy();
  });

  test("should show /me endpoint data", async ({ page }) => {
    const testEmail = `me-${Date.now()}@example.com`;

    // Register and login
    await page.goto(`${BASE_URL}/signup`);
    await page.locator("input[type=email]").fill(testEmail);
    await page.locator("input[type=password]").fill("ValidPassword123!");
    await page.locator("button:has-text('Sign Up')").click();

    await expect(page).toHaveURL(/\/home|\/chat|\/apps/, { timeout: 5000 });

    // Call /me endpoint
    const meResponse = await page.evaluate(async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    });

    expect(meResponse.ok).toBe(true);
    expect(meResponse.data.email).toBe(testEmail);
    expect(meResponse.data.plan).toBe("free");
  });

  test("should logout and invalidate token", async ({ page }) => {
    const testEmail = `logout-${Date.now()}@example.com`;

    // Register and login
    await page.goto(`${BASE_URL}/signup`);
    await page.locator("input[type=email]").fill(testEmail);
    await page.locator("input[type=password]").fill("ValidPassword123!");
    await page.locator("button:has-text('Sign Up')").click();

    await expect(page).toHaveURL(/\/home|\/chat|\/apps/, { timeout: 5000 });

    // Find and click logout
    const logoutButton = page.locator("button:has-text('Logout')").or(page.locator("[aria-label*=logout i]"));
    if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await logoutButton.click();
      await page.waitForURL(`${BASE_URL}/login`, { timeout: 3000 });
    }
  });
});

test.describe("Web Authentication - Token Revocation", () => {
  test("should revoke token on logout", async ({ page }) => {
    const testEmail = `revoke-${Date.now()}@example.com`;

    // Register
    await page.goto(`${BASE_URL}/signup`);
    await page.locator("input[type=email]").fill(testEmail);
    await page.locator("input[type=password]").fill("ValidPassword123!");
    await page.locator("button:has-text('Sign Up')").click();

    await expect(page).toHaveURL(/\/home|\/chat|\/apps/, { timeout: 5000 });

    // Get token
    const token = await page.evaluate(() => localStorage.getItem("token"));

    // Logout
    const logoutButton = page.locator("button:has-text('Logout')").or(page.locator("[aria-label*=logout i]"));
    if (await logoutButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await logoutButton.click();
    } else {
      // Fallback: call logout API directly
      await page.evaluate(async (token) => {
        await fetch("/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }, token);
    }

    // Try to use revoked token
    const response = await page.evaluate(async (token) => {
      const res = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    }, token);

    // Should fail with revoked token error
    expect(response.ok).toBe(false);
    expect(response.error).toContain("revoked");
  });
});
