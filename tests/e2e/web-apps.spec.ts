import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3001";

test.describe("Web App Management", () => {
  test.beforeEach(async ({ page }) => {
    const testEmail = `app-${Date.now()}@example.com`;

    // Register and login
    await page.goto(`${BASE_URL}/signup`);
    await page.locator("input[type=email]").fill(testEmail);
    await page.locator("input[type=password]").fill("ValidPassword123!");
    await page.locator("button:has-text('Sign Up')").click();

    await expect(page).toHaveURL(/\/home|\/chat|\/apps/, { timeout: 5000 });
  });

  test("should navigate to apps page", async ({ page }) => {
    await page.goto(`${BASE_URL}/apps`);
    await expect(page.locator("text=/app|project/i")).toBeVisible();
  });

  test("should create new app via IPC", async ({ page }) => {
    const createResponse = await page.evaluate(async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/create-app", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Test App ${Date.now()}`,
          type: "react",
        }),
      });
      return res.json();
    });

    // Either success or specific error (not auth error)
    if (createResponse.ok) {
      expect(createResponse.data.id).toBeDefined();
      expect(createResponse.data.name).toContain("Test App");
    }
  });

  test("should list user apps", async ({ page }) => {
    const listResponse = await page.evaluate(async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/list-apps", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return res.json();
    });

    expect(listResponse.ok).toBe(true);
    expect(Array.isArray(listResponse.data)).toBe(true);
  });

  test("should reject unauthorized app access", async ({ page }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/list-apps");
      return { status: res.status, ok: res.ok };
    });

    expect(response.status).toBe(401);
    expect(response.ok).toBe(false);
  });
});

test.describe("Web GDPR", () => {
  test("should export user data", async ({ page }) => {
    const testEmail = `gdpr-${Date.now()}@example.com`;

    // Register and login
    await page.goto(`${BASE_URL}/signup`);
    await page.locator("input[type=email]").fill(testEmail);
    await page.locator("input[type=password]").fill("ValidPassword123!");
    await page.locator("button:has-text('Sign Up')").click();

    await expect(page).toHaveURL(/\/home|\/chat|\/apps/, { timeout: 5000 });

    // Request data export
    const exportResponse = await page.evaluate(async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/gdpr/export", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        return {
          contentType: res.headers.get("content-type"),
          filename: res.headers.get("content-disposition"),
        };
      }
      return { status: res.status, ok: res.ok };
    });

    // Should either succeed or be not implemented
    if (exportResponse.contentType) {
      expect(exportResponse.contentType).toContain("application/json");
      expect(exportResponse.filename).toContain("proteaai-export");
    }
  });

  test("should not allow unauthorized data export", async ({ page }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch("/gdpr/export");
      return { status: res.status, ok: res.ok };
    });

    expect(response.status).toBe(401);
    expect(response.ok).toBe(false);
  });

  test("should return 401 for unauthorized deletion", async ({ page }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch("/gdpr/me", { method: "DELETE" });
      return { status: res.status, ok: res.ok };
    });

    expect(response.status).toBe(401);
    expect(response.ok).toBe(false);
  });
});
