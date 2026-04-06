import { expect, test } from "@playwright/test";

test.describe("Frontend e2e smoke", () => {
  test("loads home and navigates to designer", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Informed Clinical Trial Design" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Designer" })).toBeVisible();

    await page.getByRole("link", { name: "Get Started" }).click();

    await expect(page).toHaveURL(/\/designer$/);
    await expect(page.getByRole("heading", { name: "Study Design" })).toBeVisible();
  });
});
