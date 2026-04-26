import { expect, test } from "@playwright/test";

test.describe("Saved searches", () => {
  test("Open in Designer restores the saved designer criteria", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("auth_token", "test-token");
      window.localStorage.setItem(
        "auth_user",
        JSON.stringify({
          username: "alice",
          firstName: "Alice",
          lastName: "Tester",
        }),
      );
    });

    await page.route("**/api/auth/has-action/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ action: "user_roles", allowed: false }),
      });
    });

    await page.route("**/api/saved-searches/shared-with-me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/saved-searches", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            ownerUserId: 1,
            ownerUsername: "alice",
            name: "Phase 3 Diabetes Search",
            description: "Saved from designer",
            criteriaJson: {
              condition: "diabetes type 2",
              phase: "phase 3",
              allocationType: "randomized",
              interventionModel: "parallel assignment",
              blindingType: "double",
              minAge: 18,
              maxAge: 65,
              sex: "female",
              requiredConditions: ["hypertension"],
              ineligibleConditions: ["heart failure"],
              startDateFrom: "2020",
              startDateTo: "2024",
            },
            visibility: "private",
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
            lastKnownCount: 12,
            lastRunAt: "2026-04-16T00:00:00.000Z",
            permissions: {
              isOwner: true,
              canView: true,
              canRun: true,
              canEdit: true,
            },
          },
        ]),
      });
    });

    await page.goto("/saved-searches");

    await page.getByRole("button", { name: "Open" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#condition")).toHaveValue("diabetes type 2");
    await expect(page.locator("#phase .selected-text")).toHaveText("Phase 3");
    await expect(page.locator("#allocationType .selected-text")).toHaveText("Randomized");
    await expect(page.locator("#intervention .selected-text")).toHaveText("Parallel Assignment");
    await expect(page.locator("#blinding .selected-text")).toHaveText("Double");
    await expect(page.locator("#minAge")).toHaveValue("18");
    await expect(page.locator("#maxAge")).toHaveValue("65");
    await expect(page.locator("#startYear")).toHaveValue("2020");
    await expect(page.locator("#endYear")).toHaveValue("2024");
    await expect(page.getByText("hypertension")).toBeVisible();
    await expect(page.getByText("heart failure")).toBeVisible();
  });

  test("deletes an owned saved search from the saved-searches page", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("auth_token", "test-token");
      window.localStorage.setItem(
        "auth_user",
        JSON.stringify({
          username: "alice",
          firstName: "Alice",
          lastName: "Tester",
        }),
      );
    });

    await page.route("**/api/auth/has-action/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ action: "user_roles", allowed: false }),
      });
    });

    await page.route("**/api/saved-searches/shared-with-me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/saved-searches", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 1,
            ownerUserId: 1,
            ownerUsername: "alice",
            name: "Phase 3 Diabetes Search",
            description: "Saved from designer",
            criteriaJson: {
              condition: "Type 2 Diabetes",
              phase: "Phase 3",
            },
            visibility: "private",
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
            lastKnownCount: 12,
            lastRunAt: "2026-04-16T00:00:00.000Z",
            permissions: {
              isOwner: true,
              canView: true,
              canRun: true,
              canEdit: true,
            },
          },
        ]),
      });
    });

    await page.route("**/api/saved-searches/1", async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 204,
        body: "",
      });
    });

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain('Delete saved search "Phase 3 Diabetes Search"?');
      await dialog.accept();
    });

    await page.goto("/saved-searches");

    await expect(page.getByText("Phase 3 Diabetes Search")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Phase 3 Diabetes Search")).not.toBeVisible();
  });
});
