import { expect, test } from "@playwright/test";

test.describe("Saved searches import/export", () => {
  async function mockActionPermissions(
    page: import("@playwright/test").Page,
    permissions: Partial<Record<string, boolean>>,
  ) {
    await page.route("**/api/auth/has-action/**", async (route) => {
      const action = decodeURIComponent(route.request().url().split("/api/auth/has-action/")[1] ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action,
          allowed: permissions[action] ?? false,
        }),
      });
    });
  }

  test.beforeEach(async ({ page }) => {
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

    await mockActionPermissions(page, {
      search_criteria_import: true,
      search_criteria_export: true,
    });

    await page.route("**/api/saved-searches/shared-with-me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("exports an individual owned saved search as JSON", async ({ page }) => {
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
            criteriaJson: { condition: "Type 2 Diabetes" },
            visibility: "private",
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
            permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
          },
        ]),
      });
    });

    await page.goto("/saved-searches");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("phase-3-diabetes-search.json");
  });

  test("imports saved searches from JSON and shows the new search", async ({ page }) => {
    let records = [
      {
        id: 1,
        ownerUserId: 1,
        ownerUsername: "alice",
        name: "Existing Search",
        description: null,
        criteriaJson: { condition: "Diabetes" },
        visibility: "private",
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
        permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      },
    ];

    await page.route("**/api/saved-searches", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(records),
        });
        return;
      }

      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON() as any;
        const created = {
          id: records.length + 1,
          ownerUserId: 1,
          ownerUsername: "alice",
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
          permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
          ...payload,
        };
        records = [...records, created];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(created),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/saved-searches");

    await page.locator("#savedSearchImport").setInputFiles({
      name: "saved-searches.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        searches: [
          {
            name: "Imported Saved Search",
            description: "From file",
            visibility: "private",
            criteriaJson: { condition: "Hypertension" },
          },
        ],
      }), "utf-8"),
    });

    await expect(page.getByText("Imported 1 saved search.")).toBeVisible();
    await expect(page.getByText("Imported Saved Search")).toBeVisible();
  });

  test("imports a designer criteria JSON as a new saved search", async ({ page }) => {
    let records = [
      {
        id: 1,
        ownerUserId: 1,
        ownerUsername: "alice",
        name: "Existing Search",
        description: null,
        criteriaJson: { condition: "Diabetes" },
        visibility: "private",
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
        permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
      },
    ];

    await page.route("**/api/saved-searches", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(records),
        });
        return;
      }

      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON() as any;
        const created = {
          id: records.length + 1,
          ownerUserId: 1,
          ownerUsername: "alice",
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
          permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
          ...payload,
        };
        records = [...records, created];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(created),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto("/saved-searches");

    await page.locator("#savedSearchImport").setInputFiles({
      name: "criteria.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        format: "clinicaltrials-designer-criteria",
        version: 1,
        criteria: {
          condition: "Diabetes Mellitus, Type 2",
          phase: "Phase 1",
          allocationType: "Randomized",
          interventionModel: "Parallel Assignment",
          blindingType: "Single",
          minAge: null,
          maxAge: null,
          sex: "All",
          required: [],
          ineligible: [],
        },
      }), "utf-8"),
    });

    await expect(page.getByText("Imported 1 saved search.")).toBeVisible();
    await expect(page.getByText("Diabetes Mellitus, Type 2 (Phase 1)")).toBeVisible();
  });

  test("hides saved-search import when the user lacks import permission", async ({ page }) => {
    await page.unroute("**/api/auth/has-action/**");
    await mockActionPermissions(page, {
      search_criteria_import: false,
      search_criteria_export: true,
    });

    await page.route("**/api/saved-searches", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/saved-searches");

    await expect(page.locator('label[for="savedSearchImport"]')).toHaveCount(0);
  });

  test("hides saved-search export when the user lacks export permission", async ({ page }) => {
    await page.unroute("**/api/auth/has-action/**");
    await mockActionPermissions(page, {
      search_criteria_import: true,
      search_criteria_export: false,
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
            criteriaJson: { condition: "Type 2 Diabetes" },
            visibility: "private",
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T00:00:00.000Z",
            permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
          },
        ]),
      });
    });

    await page.goto("/saved-searches");

    await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);
  });
});
