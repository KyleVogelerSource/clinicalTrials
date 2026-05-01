import { expect, Page, test } from "@playwright/test";

type SearchRequest = {
  condition?: string;
  phase?: string;
  interventionModel?: string;
  pageSize?: number;
};

const studies = [
  {
    protocolSection: {
      identificationModule: {
        nctId: "NCT90000001",
        briefTitle: "Metformin Optimization in Type 2 Diabetes",
      },
      conditionsModule: {
        conditions: ["Type 2 Diabetes"],
      },
      designModule: {
        enrollmentInfo: { count: 240 },
        phases: ["Phase 3"],
        designInfo: {
          maskingInfo: { whoMasked: ["PARTICIPANT", "INVESTIGATOR"] },
        },
      },
      statusModule: {
        overallStatus: "COMPLETED",
        startDateStruct: { date: "2021-01-15" },
        primaryCompletionDateStruct: { date: "2022-08-01" },
        completionDateStruct: { date: "2022-09-01" },
      },
      sponsorCollaboratorsModule: {
        leadSponsor: { name: "Diabetes Research Group" },
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
          {
            facility: "Cambridge Clinical Site",
            city: "Cambridge",
            country: "United States",
            geoPoint: { lat: 42.373, lon: -71.109 },
          },
        ],
      },
      descriptionModule: {
        briefSummary: "Metformin titration for adults with Type 2 Diabetes.",
      },
      eligibilityModule: {
        minimumAge: "18 Years",
        maximumAge: "75 Years",
        eligibilityCriteria: [
          "Inclusion Criteria:",
          "- Adults with Type 2 Diabetes",
          "- HbA1c above target",
          "Exclusion Criteria:",
          "- Severe renal disease",
        ].join("\n"),
      },
      outcomesModule: {
        primaryOutcomes: [{ measure: "HbA1c change" }],
        secondaryOutcomes: [{ measure: "Weight change" }, { measure: "Adherence" }],
      },
      armsInterventionsModule: {
        interventions: [{ name: "Metformin" }, { name: "Lifestyle counseling" }],
      },
    },
  },
  {
    protocolSection: {
      identificationModule: {
        nctId: "NCT90000002",
        briefTitle: "Lifestyle Coaching for Diabetes Prevention",
      },
      conditionsModule: {
        conditions: ["Type 2 Diabetes", "Prediabetes"],
      },
      designModule: {
        enrollmentInfo: { count: 120 },
        phases: ["Phase 3"],
        designInfo: {
          maskingInfo: { whoMasked: ["OUTCOMES_ASSESSOR"] },
        },
      },
      statusModule: {
        overallStatus: "RECRUITING",
        startDateStruct: { date: "2023-05-01" },
        primaryCompletionDateStruct: { date: "2024-07-01" },
        completionDateStruct: { date: "2024-09-01" },
      },
      sponsorCollaboratorsModule: {
        leadSponsor: { name: "Community Health Institute" },
        collaborators: [],
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
      descriptionModule: {
        briefSummary: "Coaching intervention for diabetes prevention and lifestyle adherence.",
      },
      eligibilityModule: {
        minimumAge: "21 Years",
        maximumAge: "70 Years",
        eligibilityCriteria: [
          "Inclusion Criteria:",
          "- Prediabetes or Type 2 Diabetes risk",
          "Exclusion Criteria:",
          "- Recent bariatric surgery",
          "- Current insulin therapy",
        ].join("\n"),
      },
      outcomesModule: {
        primaryOutcomes: [{ measure: "Weight change" }],
        secondaryOutcomes: [{ measure: "HbA1c" }],
      },
      armsInterventionsModule: {
        interventions: [{ name: "Lifestyle coaching" }],
      },
    },
  },
  {
    protocolSection: {
      identificationModule: {
        nctId: "NCT90000003",
        briefTitle: "Cardiometabolic Outcomes in Diabetes",
      },
      conditionsModule: {
        conditions: ["Type 2 Diabetes", "Cardiovascular Disease"],
      },
      designModule: {
        enrollmentInfo: { count: 420 },
        phases: ["Phase 3"],
        designInfo: {
          maskingInfo: { whoMasked: [] },
        },
      },
      statusModule: {
        overallStatus: "ACTIVE_NOT_RECRUITING",
        startDateStruct: { date: "2022-02-10" },
        primaryCompletionDateStruct: { date: "2025-02-10" },
        completionDateStruct: { date: "2025-06-10" },
      },
      sponsorCollaboratorsModule: {
        leadSponsor: { name: "CardioMetabolic Trials Network" },
        collaborators: [{ name: "Heart Institute" }, { name: "Metabolic Research Lab" }],
      },
      contactsLocationsModule: {
        locations: [
          {
            facility: "Boston Medical Center",
            city: "Boston",
            country: "United States",
            geoPoint: { lat: 42.336, lon: -71.072 },
          },
          {
            facility: "New York Diabetes Center",
            city: "New York",
            country: "United States",
            geoPoint: { lat: 40.713, lon: -74.006 },
          },
          {
            facility: "Philadelphia Clinical Research",
            city: "Philadelphia",
            country: "United States",
            geoPoint: { lat: 39.952, lon: -75.165 },
          },
        ],
      },
      descriptionModule: {
        briefSummary: "Cardiovascular and metabolic endpoints for Type 2 Diabetes therapy.",
      },
      eligibilityModule: {
        minimumAge: "30 Years",
        maximumAge: "80 Years",
        eligibilityCriteria: [
          "Inclusion Criteria:",
          "- Type 2 Diabetes",
          "- Cardiovascular risk factor",
          "Exclusion Criteria:",
          "- Recent stroke",
          "- Unstable heart failure",
        ].join("\n"),
      },
      outcomesModule: {
        primaryOutcomes: [{ measure: "Cardiovascular event rate" }],
        secondaryOutcomes: [
          { measure: "HbA1c" },
          { measure: "Blood pressure" },
          { measure: "Hospitalization" },
        ],
      },
      armsInterventionsModule: {
        interventions: [{ name: "Cardiometabolic therapy" }, { name: "Standard care" }, { name: "Monitoring" }],
      },
    },
  },
];

async function mockPermissions(page: Page) {
  await page.route("**/api/auth/has-action/**", async (route) => {
    const action = decodeURIComponent(route.request().url().split("/api/auth/has-action/")[1] ?? "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ action, allowed: false }),
    });
  });
}

async function mockSearch(page: Page, requests: SearchRequest[], responseStudies = studies) {
  await page.route("**/api/clinical-trials/search", async (route) => {
    requests.push(route.request().postDataJSON() as SearchRequest);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ studies: responseStudies, totalCount: responseStudies.length }),
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
          explanation: "AI summary for Type 2 Diabetes trials benchmarking.",
          generatedAt: new Date().toISOString()
        },
        rankedTrials: [],
        comparisonMetrics: []
      }),
    });
  });
}

async function searchForDiabetes(page: Page) {
  await page.goto("/");
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

async function selectCustomOption(page: Page, selector: string, optionText: string) {
  const container = page.locator(selector).first();
  const trigger = container.locator(".select-trigger");
  
  // Ensure the trigger is visible and stable
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeVisible();
  
  // Click to open
  await trigger.click();
  
  const dropdown = container.locator(".dropdown-panel");
  // Wait for the dropdown to be visible with a decent timeout
  await expect(dropdown).toBeVisible({ timeout: 10000 });
  
  const option = dropdown.locator(".option-item").filter({ 
    hasText: new RegExp(`^\\s*${optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) 
  }).first();
  
  await option.scrollIntoViewIfNeeded();
  await option.click();

  // If it's a multi-select, it might stay open. We close it to avoid covering other elements.
  // We check visibility with a small timeout to avoid long waits for elements that already closed.
  try {
    const isOpen = await dropdown.isVisible();
    if (isOpen) {
      await trigger.click();
      await expect(dropdown).toBeHidden();
    }
  } catch (e) {
    // If it's already gone or hidden, that's fine
  }
}

function visibleTrialIds(page: Page) {
  return page.locator(".trials-table tbody tr:not(.detail-row) .nct-id-cell");
}

test.describe("Dashboard search workflow", () => {
  test.beforeEach(async ({ page }) => {
    await mockPermissions(page);
  });

  test("searches clinical trials and applies reversible table filters", async ({ page }) => {
    const requests: SearchRequest[] = [];
    await mockSearch(page, requests);

    await searchForDiabetes(page);

    expect(requests.at(-1)).toMatchObject({
      condition: "Type 2 Diabetes",
      phase: "PHASE3",
      interventionModel: "PARALLEL",
      pageSize: 100,
    });
    await expect(page.getByText("3 Selected")).toBeVisible();
    await expect(page.getByText("Metformin Optimization in Type 2 Diabetes")).toBeVisible();
    await expect(page.getByText("Lifestyle Coaching for Diabetes Prevention")).toBeVisible();
    await expect(page.getByText("Cardiometabolic Outcomes in Diabetes")).toBeVisible();

    await page.getByPlaceholder("Filter name...").fill("Metformin");
    await expect(page.getByText("Showing 1 of 3 Matches")).toBeVisible();
    await expect(page.getByText("Metformin Optimization in Type 2 Diabetes")).toBeVisible();
    await expect(page.getByText("Lifestyle Coaching for Diabetes Prevention")).toHaveCount(0);

    await page.getByRole("button", { name: "Clear All Filters" }).click();
    await expect(page.getByText("Showing 3 of 3 Matches")).toBeVisible();

    await page.locator("#startYear").fill("2022");
    await page.locator("#endYear").fill("2023");
    await expect(page.getByText("Showing 2 of 3 Matches")).toBeVisible();
    await expect(page.getByText("Metformin Optimization in Type 2 Diabetes")).toHaveCount(0);

    await page.getByRole("button", { name: "Clear All Filters" }).click();
    await page.getByPlaceholder("Min...").fill("200");
    await expect(page.getByText("Showing 2 of 3 Matches")).toBeVisible();
    await expect(page.getByText("Lifestyle Coaching for Diabetes Prevention")).toHaveCount(0);

    await page.getByRole("button", { name: "Clear All Filters" }).click();
    await page.getByPlaceholder("Add keyword...").fill("cardiovascular");
    await page.getByPlaceholder("Add keyword...").press("Enter");
    await expect(page.getByText("Showing 1 of 3 Matches")).toBeVisible();
    await expect(page.getByText("Cardiometabolic Outcomes in Diabetes")).toBeVisible();
  });

  test("processes selected trials into the analysis report view", async ({ page }) => {
    const requests: SearchRequest[] = [];
    await mockSearch(page, requests);
    await mockBenchmark(page);

    await searchForDiabetes(page);
    await page.getByRole("button", { name: "Generate Report" }).click();

    await expect(page).toHaveURL(/\/analysis$/);
    await expect(page.getByRole("heading", { name: "Feasibility Report: Type 2 Diabetes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await expect(page.getByText("Estimated Duration")).toBeVisible();
    await expect(page.getByText("Benchmark Distribution")).toBeVisible();
    await expect(page.getByText("Global Site Distribution")).toBeVisible();
    await expect(page.getByText("Expected Timeline")).toBeVisible();
    await expect(page.getByText("Metric Correlation Analysis")).toBeVisible();
    await expect(page.getByText("Metric Intersection Matrix")).toBeVisible();
    await expect(page.getByText("Benchmarked Trials Comparison")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Metformin Optimization in Type 2 Diabetes" })).toBeVisible();

    await page.getByPlaceholder("Search trials...").fill("Lifestyle");
    await expect(page.getByRole("cell", { name: "Lifestyle Coaching for Diabetes Prevention" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Metformin Optimization in Type 2 Diabetes" })).toHaveCount(0);
  });

  test("sorts trial rows by date, participants, and name", async ({ page }) => {
    const requests: SearchRequest[] = [];
    await mockSearch(page, requests);

    await searchForDiabetes(page);

    await expect(visibleTrialIds(page)).toHaveText([
      "NCT90000002",
      "NCT90000003",
      "NCT90000001",
    ]);

    await page.locator("th").filter({ hasText: "Participants" }).click();
    await expect(visibleTrialIds(page)).toHaveText([
      "NCT90000003",
      "NCT90000001",
      "NCT90000002",
    ]);

    await page.locator("th").filter({ hasText: "Participants" }).click();
    await expect(visibleTrialIds(page)).toHaveText([
      "NCT90000002",
      "NCT90000001",
      "NCT90000003",
    ]);

    await page.locator("th").filter({ hasText: "Name" }).click();
    await expect(visibleTrialIds(page)).toHaveText([
      "NCT90000003",
      "NCT90000002",
      "NCT90000001",
    ]);

    await page.locator("th").filter({ hasText: "Trial ID" }).click();
    await expect(visibleTrialIds(page)).toHaveText([
      "NCT90000002",
      "NCT90000003",
      "NCT90000001",
    ]);
  });

  test("filters by status and restores all rows with clear filters", async ({ page }) => {
    const requests: SearchRequest[] = [];
    await mockSearch(page, requests);

    await searchForDiabetes(page);

    await selectCustomOption(page, ".col-status app-multi-select", "RECRUITING");

    await expect(page.getByText("Showing 1 of 3 Matches")).toBeVisible();
    await expect(page.getByText("Lifestyle Coaching for Diabetes Prevention")).toBeVisible();
    await expect(page.getByText("Metformin Optimization in Type 2 Diabetes")).toHaveCount(0);
    await expect(page.getByText("Cardiometabolic Outcomes in Diabetes")).toHaveCount(0);

    await page.getByRole("button", { name: "Clear All Filters" }).click();
    await expect(page.getByText("Showing 3 of 3 Matches")).toBeVisible();
    await expect(page.getByText("Metformin Optimization in Type 2 Diabetes")).toBeVisible();
    await expect(page.getByText("Cardiometabolic Outcomes in Diabetes")).toBeVisible();
  });

  test("expands and collapses trial details", async ({ page }) => {
    const requests: SearchRequest[] = [];
    await mockSearch(page, requests);

    await searchForDiabetes(page);

    const metforminRow = page.locator("tr", { hasText: "Metformin Optimization in Type 2 Diabetes" }).first();
    const metforminDetailsRow = metforminRow.locator("xpath=following-sibling::tr[contains(@class, 'detail-row')][1]");
    await expect(metforminRow.locator("a.trial-link")).toHaveAttribute(
      "href",
      "https://clinicaltrials.gov/study/NCT90000001",
    );

    await metforminRow.getByRole("button", { name: /Details/ }).click();
    await expect(metforminDetailsRow).toHaveClass(/expanded/);
    await expect(page.getByText("Diabetes Research Group")).toBeVisible();
    await expect(page.getByText("Boston Medical Center").first()).toBeVisible();
    await expect(page.getByText("Cambridge Clinical Site")).toBeVisible();
    await expect(page.getByText("Metformin titration for adults with Type 2 Diabetes.")).toBeVisible();

    await metforminRow.getByRole("button", { name: /Hide/ }).click();
    await expect(metforminDetailsRow).not.toHaveClass(/expanded/);
    await expect(metforminRow.getByRole("button", { name: /Details/ })).toBeVisible();
  });

  test("keeps process disabled until at least one visible trial is selected", async ({ page }) => {
    const requests: SearchRequest[] = [];
    await mockSearch(page, requests);

    await page.goto("/");
    await expect(page.getByRole("button", { name: "Generate Report" })).toBeDisabled();

    await searchForDiabetes(page);
    await expect(page.getByRole("button", { name: "Generate Report" })).toBeEnabled();
    await expect(page.getByText("3 Selected")).toBeVisible();

    await page.getByRole("checkbox", { name: "Select all trials" }).uncheck();
    await expect(page.getByText("Selected")).toBeHidden();
    await expect(page.getByRole("button", { name: "Generate Report" })).toBeDisabled();

    await page.getByRole("checkbox", { name: "Select trial" }).first().check();
    await expect(page.getByText("1 Selected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate Report" })).toBeEnabled();
  });

  test("shows no-results state when the search API returns no studies", async ({ page }) => {
    const requests: SearchRequest[] = [];
    await mockSearch(page, requests, []);

    await page.goto("/");
    await selectCustomOption(page, "#phase", "Phase 3");
    await page.locator("#condition").fill("Rare Diabetes Variant");
    await page.locator("#condition").press("Enter");

    await expect(page.getByText("Showing 0 of 0 Matches")).toBeVisible();
    await expect(page.getByRole("heading", { name: "No Results" })).toBeVisible();
    await expect(page.getByText("Try adjusting your search criteria or filters to find matching trials.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate Report" })).toBeDisabled();
  });

  test("processes only the selected subset into the comparison table", async ({ page }) => {
    const requests: SearchRequest[] = [];
    await mockSearch(page, requests);
    await mockBenchmark(page);

    await searchForDiabetes(page);
    await page.getByRole("checkbox", { name: "Select all trials" }).uncheck();
    await page.getByRole("checkbox", { name: "Select trial" }).nth(1).check();
    await expect(page.getByText("1 Selected")).toBeVisible();

    await page.getByRole("button", { name: "Generate Report" }).click();

    await expect(page).toHaveURL(/\/analysis$/);
    await expect(page.getByText("Benchmarked Trials Comparison")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Cardiometabolic Outcomes in Diabetes" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Metformin Optimization in Type 2 Diabetes" })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "Lifestyle Coaching for Diabetes Prevention" })).toHaveCount(0);
  });
});
