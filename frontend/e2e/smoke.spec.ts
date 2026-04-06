import { expect, test } from "@playwright/test";

test.describe("Frontend e2e smoke", () => {
  test("loads home and navigates to designer", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Informed Clinical Trial Design" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Designer" })).toBeVisible();

    // Home CTA uses aria-label, so its accessible name differs from visible text.
    await page.getByRole("link", { name: /Start designing your trial|Get Started/i }).click();

    await expect(page).toHaveURL(/\/designer$/);
    await expect(page.getByRole("heading", { name: "Study Design" })).toBeVisible();
  });
});
