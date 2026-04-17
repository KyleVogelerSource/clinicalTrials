import { expect, test } from "@playwright/test";

test.describe("Designer import/export", () => {
  async function mockActionPermissions(
    page: import("@playwright/test").Page,
    permissions: Partial<Record<string, boolean>>,
  ) {
    await page.route("**/api/auth/has-action/**", async (route) => {
      const action = decodeURIComponent(route.request().url().split("/api/auth/has-action/")[1] ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ action, allowed: permissions[action] ?? false }),
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
      trial_benchmarking: true,
    });
  });

  test("imports criteria directly into refine and exports from refine and results", async ({ page }) => {
    await page.route("**/api/clinical-trials/search", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          studies: [
            {
              protocolSection: {
                identificationModule: {
                  nctId: "NCT00000001",
                  briefTitle: "A Study of New Treatment for Diabetes",
                },
                conditionsModule: {
                  conditions: ["Type 2 Diabetes"],
                },
                designModule: {
                  enrollmentInfo: { count: 150 },
                  phases: ["Phase 3"],
                },
                contactsLocationsModule: {
                  locations: [
                    {
                      city: "Boston",
                      country: "USA",
                      facility: "Massachusetts General Hospital",
                    },
                  ],
                },
                statusModule: {
                  startDateStruct: { date: "2023-01-01" },
                  completionDateStruct: { date: "2025-12-31" },
                },
                sponsorCollaboratorsModule: {
                  leadSponsor: { name: "PharmaCorp" },
                },
                descriptionModule: {
                  briefSummary: "Mock summary",
                },
              },
            },
          ],
          totalCount: 1,
        }),
      });
    });

    await page.goto("/designer");

    await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);
    await expect(page.locator('label[for="criteriaImport"]')).toContainText("Import");

    await page.locator("#criteriaImport").setInputFiles({
      name: "criteria.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "clinicaltrials-designer-criteria",
          version: 1,
          criteria: {
            condition: "Type 2 Diabetes",
            phase: "Phase 3",
            allocationType: "Randomized",
            interventionModel: "Parallel Assignment",
            blindingType: "Double",
            minAge: 18,
            maxAge: 65,
            sex: "Female",
            required: ["Hypertension"],
            ineligible: ["Heart Failure"],
          },
        }),
        "utf-8",
      ),
    });
    await expect(page).toHaveURL(/\/selection$/);
    await expect(page.getByText("1 of 1 Results")).toBeVisible();
    await expect(page.getByText("Imported criteria from criteria.json.")).toBeVisible();
    await expect(page.locator('label[for="criteriaImport"]')).toHaveCount(0);

    const refineDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const refineDownload = await refineDownloadPromise;

    expect(refineDownload.suggestedFilename()).toBe("clinicaltrials-search-criteria.json");

    await page.getByRole("button", { name: "Process" }).click();
    await expect(page).toHaveURL(/\/results$/);
    await expect(page.locator('label[for="criteriaImport"]')).toHaveCount(0);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("clinicaltrials-search-criteria.json");
  });

  test("imports designer criteria from JSON and lands on refine with restored criteria", async ({ page }) => {
    await page.route("**/api/clinical-trials/search", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          studies: [
            {
              protocolSection: {
                identificationModule: {
                  nctId: "NCT00000001",
                  briefTitle: "A Study of New Treatment for Diabetes",
                },
                conditionsModule: {
                  conditions: ["Type 2 Diabetes"],
                },
                designModule: {
                  enrollmentInfo: { count: 150 },
                  phases: ["Phase 3"],
                },
                contactsLocationsModule: {
                  locations: [
                    {
                      city: "Boston",
                      country: "USA",
                      facility: "Massachusetts General Hospital",
                    },
                  ],
                },
                statusModule: {
                  startDateStruct: { date: "2023-01-01" },
                  completionDateStruct: { date: "2025-12-31" },
                },
                sponsorCollaboratorsModule: {
                  leadSponsor: { name: "PharmaCorp" },
                },
                descriptionModule: {
                  briefSummary: "Mock summary",
                },
              },
            },
          ],
          totalCount: 1,
        }),
      });
    });

    await page.goto("/designer");

    await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);

    await page.locator("#criteriaImport").setInputFiles({
      name: "criteria.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "clinicaltrials-designer-criteria",
          version: 1,
          criteria: {
            condition: "Type 2 Diabetes",
            phase: "Phase 3",
            allocationType: "Randomized",
            interventionModel: "Parallel Assignment",
            blindingType: "Double",
            minAge: 18,
            maxAge: 65,
            sex: "Female",
            required: ["Hypertension"],
            ineligible: ["Heart Failure"],
          },
        }),
        "utf-8",
      ),
    });

    await expect(page).toHaveURL(/\/selection$/);
    await expect(page.getByText("1 of 1 Results")).toBeVisible();
    await expect(page.getByText("Imported criteria from criteria.json.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  });

  test("hides designer import when the user lacks import permission", async ({ page }) => {
    await page.unroute("**/api/auth/has-action/**");
    await mockActionPermissions(page, {
      search_criteria_import: false,
      search_criteria_export: true,
      trial_benchmarking: true,
    });

    await page.goto("/designer");

    await expect(page.locator('label[for="criteriaImport"]')).toHaveCount(0);
    await expect(page.getByText("First time using import/export?")).toHaveCount(0);
  });

  test("hides refine and results export when the user lacks export permission", async ({ page }) => {
    await page.unroute("**/api/auth/has-action/**");
    await mockActionPermissions(page, {
      search_criteria_import: true,
      search_criteria_export: false,
      trial_benchmarking: true,
    });

    await page.route("**/api/clinical-trials/search", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          studies: [
            {
              protocolSection: {
                identificationModule: {
                  nctId: "NCT00000001",
                  briefTitle: "A Study of New Treatment for Diabetes",
                },
                conditionsModule: {
                  conditions: ["Type 2 Diabetes"],
                },
                designModule: {
                  enrollmentInfo: { count: 150 },
                  phases: ["Phase 3"],
                },
                contactsLocationsModule: {
                  locations: [
                    {
                      city: "Boston",
                      country: "USA",
                      facility: "Massachusetts General Hospital",
                    },
                  ],
                },
                statusModule: {
                  startDateStruct: { date: "2023-01-01" },
                  completionDateStruct: { date: "2025-12-31" },
                },
                sponsorCollaboratorsModule: {
                  leadSponsor: { name: "PharmaCorp" },
                },
                descriptionModule: {
                  briefSummary: "Mock summary",
                },
              },
            },
          ],
          totalCount: 1,
        }),
      });
    });

    await page.goto("/designer");

    await page.locator("#criteriaImport").setInputFiles({
      name: "criteria.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "clinicaltrials-designer-criteria",
          version: 1,
          criteria: {
            condition: "Type 2 Diabetes",
            phase: "Phase 3",
            allocationType: "Randomized",
            interventionModel: "Parallel Assignment",
            blindingType: "Double",
            minAge: 18,
            maxAge: 65,
            sex: "Female",
            required: ["Hypertension"],
            ineligible: ["Heart Failure"],
          },
        }),
        "utf-8",
      ),
    });

    await expect(page).toHaveURL(/\/selection$/);
    await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);

    await page.getByRole("button", { name: "Process" }).click();
    await expect(page).toHaveURL(/\/results$/);
    await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);
  });
});
