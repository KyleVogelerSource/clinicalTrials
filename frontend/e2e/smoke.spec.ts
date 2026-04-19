import { expect, test } from "@playwright/test";

test.describe("Frontend e2e smoke", () => {
  test("loads dashboard and verifies workspace", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Design & Match" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Search Criteria" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Matching Trials" })).toBeVisible();
  });
});
