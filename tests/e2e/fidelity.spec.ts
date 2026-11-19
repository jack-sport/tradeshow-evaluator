import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("dashboard is complete and renders at fidelity viewport", async ({ page }) => {
  await page.goto("/test-preview");
  await expect(page.getByRole("heading", { name: "Welcome, Jordan." })).toBeVisible();
  await expect(page.locator(".event-card")).toHaveCount(3);
  await expect(page.getByText("Team comparisons unlock after you submit.")).toBeVisible();
  const screenshot = await page.screenshot({ fullPage: true, animations: "disabled" });
  expect(screenshot.byteLength).toBeGreaterThan(10_000);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("assessment renders inputs, economics and team comparison", async ({ page }) => {
  await page.goto("/test-preview?view=assessment");
  await expect(page.getByRole("heading", { name: "RILA LINK" })).toBeVisible();
  await expect(page.getByText("$38,500")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(23);
  await expect(page.getByRole("heading", { name: "Where the team stands" })).toBeVisible();
  await expect(page.getByText("Jordan Lee")).toBeVisible();
});

test("preview has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/test-preview");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact || ""))).toEqual([]);
});
