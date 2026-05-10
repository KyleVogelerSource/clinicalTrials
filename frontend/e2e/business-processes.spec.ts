import { expect, Page, test } from "@playwright/test";
import { capture } from "./support/captures";

type SavedSearchRecord = {
  id: number;
  ownerUserId: number;
  ownerUsername: string;
  name: string;
  description: string | null;
  criteriaJson: Record<string, unknown>;
  visibility: "private" | "shared";
  createdAt: string;
  updatedAt: string;
  lastKnownCount?: number | null;
  lastRunAt?: string | null;
  permissions: {
    isOwner: boolean;
    canView: boolean;
    canRun: boolean;
    canEdit: boolean;
  };
};

type AdminSnapshot = {
  users: Array<{ id: number; username: string; firstName: string; lastName: string; createdAt: string; roles: string[] }>;
  roles: Array<{ id: number; name: string; createdAt: string; actions: string[] }>;
  actions: Array<{ id: number; name: string; createdAt: string }>;
  roleActions: Array<{ roleId: number; roleName: string; actionId: number; actionName: string; createdAt: string }>;
  userRoles: Array<{ userId: number; username: string; roleId: number; roleName: string; createdAt: string }>;
};

const now = "2026-04-16T00:00:00.000Z";

const trialStudies = [
  study("NCT91000001", "Metformin Optimization in Type 2 Diabetes", "COMPLETED", 240, "2021-01-15", [
    "Type 2 Diabetes",
  ]),
  study("NCT91000002", "Lifestyle Coaching for Diabetes Prevention", "RECRUITING", 120, "2023-05-01", [
    "Type 2 Diabetes",
    "Prediabetes",
  ]),
  study("NCT91000003", "Cardiometabolic Outcomes in Diabetes", "ACTIVE_NOT_RECRUITING", 420, "2022-02-10", [
    "Type 2 Diabetes",
    "Cardiovascular Disease",
  ]),
];

function study(
  nctId: string,
  briefTitle: string,
  overallStatus: string,
  enrollment: number,
  startDate: string,
  conditions: string[],
) {
  return {
    protocolSection: {
      identificationModule: { nctId, briefTitle },
      conditionsModule: { conditions },
      designModule: {
        enrollmentInfo: { count: enrollment },
        phases: ["Phase 3"],
        designInfo: { maskingInfo: { whoMasked: ["PARTICIPANT", "INVESTIGATOR"] } },
      },
      statusModule: {
        overallStatus,
        startDateStruct: { date: startDate },
        primaryCompletionDateStruct: { date: "2024-09-01" },
        completionDateStruct: { date: "2024-10-01" },
      },
      sponsorCollaboratorsModule: {
        leadSponsor: { name: "Clinical Research Network" },
        collaborators: [{ name: "Boston Medical Center" }],
      },
      contactsLocationsModule: {
        locations: [
          {
            facility: "Boston Medical Center",
            city: "Boston",
            country: "United States",
            geoPoint: { lat: 42.336, lon: -71.072 },
          },
        ],
      },
      descriptionModule: { briefSummary: `${briefTitle} summary.` },
      eligibilityModule: {
        minimumAge: "18 Years",
        maximumAge: "75 Years",
        eligibilityCriteria: "Inclusion Criteria:\n- Adults\nExclusion Criteria:\n- Severe renal disease",
      },
      outcomesModule: {
        primaryOutcomes: [{ measure: "HbA1c change" }],
        secondaryOutcomes: [{ measure: "Weight change" }],
      },
      armsInterventionsModule: { interventions: [{ name: "Metformin" }, { name: "Lifestyle coaching" }] },
    },
  };
}

async function signIn(page: Page, canAdmin = false) {
  await page.addInitScript(() => {
    window.localStorage.setItem("auth_token", "test-token");
    window.localStorage.setItem(
      "auth_user",
      JSON.stringify({ username: "alice", firstName: "Alice", lastName: "Tester" }),
    );
  });
  await mockPermissions(page, {
    user_roles: canAdmin,
    search_criteria_import: true,
    search_criteria_export: true,
  });
}

async function mockPermissions(page: Page, permissions: Partial<Record<string, boolean>> = {}) {
  await page.route("**/api/auth/has-action/**", async (route) => {
    const action = decodeURIComponent(route.request().url().split("/api/auth/has-action/")[1] ?? "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ action, allowed: permissions[action] ?? false }),
    });
  });
}

async function mockTrialSearch(page: Page, requests: unknown[] = []) {
  await page.route("**/api/clinical-trials/search", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ studies: trialStudies, totalCount: trialStudies.length }),
    });
  });
}

async function mockBenchmark(page: Page) {
  await page.route("**/api/clinical-trials/benchmark", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        explanation: {
          explanation: "AI summary for selected Type 2 Diabetes trials.",
          generatedAt: now,
        },
        rankedTrials: [],
        comparisonMetrics: [],
      }),
    });
  });
}

async function selectCustomOption(page: Page, selector: string, optionText: string) {
  const container = page.locator(selector).first();
  const trigger = container.locator(".select-trigger");
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dropdown = container.locator(".dropdown-panel");
  await expect(dropdown).toBeVisible();
  await dropdown.locator(".option-item", { hasText: optionText }).first().click();
  if (await dropdown.isVisible().catch(() => false)) {
    await trigger.click();
  }
}

async function searchForDiabetes(page: Page) {
  await page.locator("#userPatients").fill("240");
  await page.locator("#userSites").fill("8");
  await page.locator("#userInclusions").fill("6");
  await page.locator("#userExclusions").fill("4");
  await page.locator("#userOutcomes").fill("3");
  await page.locator("#userArms").fill("2");
  await selectCustomOption(page, "#phase", "Phase 3");
  await selectCustomOption(page, "#intervention", "Parallel Assignment");
  await page.locator("#condition").fill("Type 2 Diabetes");
  await page.locator("#condition").press("Enter");
  await expect(page.getByText("Showing 3 of 3 Matches")).toBeVisible();
}

function savedSearch(overrides: Partial<SavedSearchRecord> = {}): SavedSearchRecord {
  return {
    id: 1,
    ownerUserId: 1,
    ownerUsername: "alice",
    name: "Phase 3 Diabetes Search",
    description: "Saved from designer",
    criteriaJson: {
      condition: "Type 2 Diabetes",
      phase: "Phase 3",
      interventionModel: "Parallel Assignment",
      selectedTrialIds: ["NCT91000001", "NCT91000003"],
    },
    visibility: "private",
    createdAt: now,
    updatedAt: now,
    lastKnownCount: 12,
    lastRunAt: now,
    permissions: { isOwner: true, canView: true, canRun: true, canEdit: true },
    ...overrides,
  };
}

test.describe("Critical business processes with captures", () => {
  test("authenticates a user and exposes protected navigation", async ({ page }, testInfo) => {
    await mockPermissions(page, { user_roles: false });
    await mockTrialSearch(page);

    await page.route("**/api/auth/login", async (route) => {
      const body = route.request().postDataJSON() as { username: string; password: string };
      if (body.password !== "correct-password") {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Invalid" }) });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "test-token", username: "alice", firstName: "Alice", lastName: "Tester" }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Log In" }).click();
    const loginDialog = page.getByRole("dialog", { name: "Login" });
    await page.locator("#username").fill("alice");
    await page.locator("#password").fill("wrong-password");
    await loginDialog.getByRole("button", { name: "Log In" }).click();
    await expect(page.getByRole("alert")).toHaveText("Invalid username or password.");
    await capture(page, testInfo, "login-invalid-credentials");

    await page.locator("#password").fill("correct-password");
    await loginDialog.getByRole("button", { name: "Log In" }).click();
    await expect(page.getByText("Hi, Alice")).toBeVisible();
    await expect(page.getByRole("link", { name: "Saved Searches" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await capture(page, testInfo, "login-success-protected-navigation");
  });

  test("saves a searched trial design with selected trial context", async ({ page }, testInfo) => {
    await signIn(page);
    await mockTrialSearch(page);
    const created: unknown[] = [];

    await page.route("**/api/saved-searches", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }

      const payload = route.request().postDataJSON();
      created.push(payload);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(savedSearch({ id: 9, ...(payload as Partial<SavedSearchRecord>) })),
      });
    });

    await page.goto("/");
    await searchForDiabetes(page);
    await capture(page, testInfo, "dashboard-search-results-before-save");

    await page.getByRole("checkbox", { name: "Select all trials" }).uncheck();
    await page.getByRole("checkbox", { name: "Select trial" }).nth(1).check();
    await expect(page.getByText("1 Selected")).toBeVisible();
    await page.getByRole("button", { name: "Save Search" }).click();
    await expect(page.getByRole("heading", { name: "Save This Search" })).toBeVisible();
    await capture(page, testInfo, "save-search-modal");

    await page.locator("#saveName").fill("High enrollment diabetes shortlist");
    await page.locator("#saveDesc").fill("Selected for feasibility review");
    await page.getByLabel("Shared (Public)").check();
    await page.locator("form").getByRole("button", { name: "Save Search" }).click();
    await expect(page.getByRole("button", { name: "Saved!" })).toBeVisible();
    await expect(created[0]).toMatchObject({
      name: "High enrollment diabetes shortlist",
      description: "Selected for feasibility review",
      visibility: "shared",
      criteriaJson: {
        condition: "Type 2 Diabetes",
        userPatients: 240,
        userSites: 8,
        selectedTrialIds: ["NCT91000003"],
      },
    });
    await capture(page, testInfo, "save-search-success");
  });

  test("runs owned and shared saved searches back through the designer", async ({ page }, testInfo) => {
    await signIn(page);
    await mockTrialSearch(page);
    const mine = [savedSearch()];
    const shared = [
      savedSearch({
        id: 2,
        ownerUserId: 2,
        ownerUsername: "bob",
        name: "Shared Oncology Search",
        description: "Team template",
        criteriaJson: { condition: "Lung Cancer", phase: "Phase 2", startDateFrom: "2021", startDateTo: "2025" },
        permissions: { isOwner: false, canView: true, canRun: true, canEdit: false },
      }),
    ];

    await page.route("**/api/saved-searches/shared-with-me", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shared) });
    });
    await page.route("**/api/saved-searches", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mine) });
    });

    await page.goto("/saved-searches");
    await expect(page.getByText("Phase 3 Diabetes Search (12)")).toBeVisible();
    await expect(page.getByText("Shared Oncology Search (12)")).toBeVisible();
    await capture(page, testInfo, "saved-searches-owned-and-shared");

    await page.locator("article", { hasText: "Shared Oncology Search" }).getByRole("button", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#condition")).toHaveValue("Lung Cancer");
    await expect(page.locator("#phase .selected-text")).toHaveText("Phase 2");
    await expect(page.locator("#startYear")).toHaveValue("2021");
    await expect(page.locator("#endYear")).toHaveValue("2025");
    await capture(page, testInfo, "shared-search-restored-in-designer");
  });

  test("changes saved-search visibility and imports a designer criteria file", async ({ page }, testInfo) => {
    await signIn(page);
    let records = [savedSearch()];
    await page.route("**/api/saved-searches/shared-with-me", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });
    await page.route("**/api/saved-searches/1", async (route) => {
      if (route.request().method() !== "PUT") {
        await route.fallback();
        return;
      }
      records = [savedSearch({ visibility: "shared", criteriaJson: (route.request().postDataJSON() as any).criteriaJson })];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(records[0]) });
    });
    await page.route("**/api/saved-searches", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(records) });
        return;
      }
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON() as Partial<SavedSearchRecord>;
        const created = savedSearch({ id: records.length + 1, name: payload.name, criteriaJson: payload.criteriaJson ?? {} });
        records = [...records, created];
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
        return;
      }
      await route.fallback();
    });

    await page.goto("/saved-searches");
    await page.getByRole("button", { name: "private" }).click();
    await capture(page, testInfo, "saved-search-visibility-menu");
    await page.getByRole("menuitem", { name: /Shared/ }).click();
    await expect(page.getByRole("button", { name: "shared" })).toBeVisible();

    await page.locator("#savedSearchImport").setInputFiles({
      name: "criteria.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "clinicaltrials-designer-criteria",
          version: 1,
          criteria: {
            condition: "Diabetes Mellitus, Type 2",
            phase: "Phase 1",
            allocationType: "Randomized",
            interventionModel: "Parallel Assignment",
            blindingType: "Single",
            sex: "All",
          },
        }),
        "utf-8",
      ),
    });
    await expect(page.getByText("Imported 1 saved search.")).toBeVisible();
    await expect(page.getByText("Diabetes Mellitus, Type 2 (Phase 1)")).toBeVisible();
    await capture(page, testInfo, "saved-search-import-success");
  });

  test("generates the feasibility report, filters the comparison table, and exports artifacts", async ({ page }, testInfo) => {
    await mockPermissions(page);
    await mockTrialSearch(page);
    await mockBenchmark(page);

    await page.goto("/");
    await searchForDiabetes(page);
    await page.getByRole("button", { name: "Generate Report" }).click();
    await expect(page).toHaveURL(/\/analysis$/);
    await expect(page.getByRole("heading", { name: "Feasibility Report: Type 2 Diabetes" })).toBeVisible();
    await expect(page.getByText("Global Site Distribution")).toBeVisible();
    await capture(page, testInfo, "analysis-report-generated");

    await page.getByPlaceholder("Search trials...").fill("Lifestyle");
    await expect(page.getByRole("cell", { name: "Lifestyle Coaching for Diabetes Prevention" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Metformin Optimization in Type 2 Diabetes" })).toHaveCount(0);
    await capture(page, testInfo, "analysis-comparison-filtered");

    const jsonDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    await expect((await jsonDownload).suggestedFilename()).toMatch(/^feasibility-report-\d+\.json$/);

    const excelDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Excel" }).click();
    await expect((await excelDownload).suggestedFilename()).toMatch(/^feasibility-report-\d+\.xlsx$/);
  });

  test("protects and exercises the admin role-management process", async ({ page }, testInfo) => {
    await signIn(page, true);
    let snapshot: AdminSnapshot = {
      users: [{ id: 1, username: "alice", firstName: "Alice", lastName: "Tester", createdAt: now, roles: ["admin"] }],
      roles: [{ id: 1, name: "admin", createdAt: now, actions: ["user_roles"] }],
      actions: [
        { id: 1, name: "user_roles", createdAt: now },
        { id: 2, name: "search_criteria_export", createdAt: now },
      ],
      roleActions: [{ roleId: 1, roleName: "admin", actionId: 1, actionName: "user_roles", createdAt: now }],
      userRoles: [{ userId: 1, username: "alice", roleId: 1, roleName: "admin", createdAt: now }],
    };

    await page.route("**/api/admin/summary", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot) });
    });
    await page.route("**/api/admin/users", async (route) => {
      const payload = route.request().postDataJSON() as any;
      snapshot = {
        ...snapshot,
        users: [...snapshot.users, { id: 2, username: payload.username, firstName: payload.firstName, lastName: payload.lastName, createdAt: now, roles: [] }],
      };
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 2 }) });
    });
    await page.route("**/api/admin/roles", async (route) => {
      const payload = route.request().postDataJSON() as any;
      snapshot = { ...snapshot, roles: [...snapshot.roles, { id: 2, name: payload.name, createdAt: now, actions: [] }] };
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 2 }) });
    });
    await page.route("**/api/admin/role-actions", async (route) => {
      snapshot = {
        ...snapshot,
        roleActions: [...snapshot.roleActions, { roleId: 1, roleName: "admin", actionId: 2, actionName: "search_criteria_export", createdAt: now }],
        roles: snapshot.roles.map((role) => role.id === 1 ? { ...role, actions: ["user_roles", "search_criteria_export"] } : role),
      };
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({}) });
    });

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await capture(page, testInfo, "admin-summary");

    await page.locator('input[name="userUsername"]').fill("newuser");
    await page.locator('input[name="userPassword"]').fill("Password123!");
    await page.locator('input[name="userFirstName"]').fill("New");
    await page.locator('input[name="userLastName"]').fill("User");
    await page.getByRole("button", { name: "Create User" }).click();
    await expect(page.getByText("User created.")).toBeVisible();
    await expect(page.getByRole("cell", { name: "newuser" })).toBeVisible();

    await page.locator('input[name="roleName"]').fill("criteria_manager");
    await page.getByRole("button", { name: "Create Role" }).click();
    await expect(page.getByText("Role created.")).toBeVisible();
    await expect(page.getByRole("cell", { name: "criteria_manager" })).toBeVisible();

    await page.locator('select[name="selectedActionId"]').selectOption({ label: "search_criteria_export" });
    await page.getByRole("button", { name: "Assign Action" }).click();
    await expect(page.getByText("Role assigned to action.")).toBeVisible();
    await expect(page.getByRole("cell", { name: "search_criteria_export" }).last()).toBeVisible();
    await capture(page, testInfo, "admin-role-action-updated");
  });

  test("keeps the dashboard workflow usable on a mobile viewport", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockPermissions(page);
    await mockTrialSearch(page);

    await page.goto("/");
    await searchForDiabetes(page);
    await expect(page.getByRole("button", { name: "Generate Report" })).toBeEnabled();
    await expect(page.getByText("Showing 3 of 3 Matches")).toBeVisible();
    await capture(page, testInfo, "mobile-dashboard-search-results");
  });
});
