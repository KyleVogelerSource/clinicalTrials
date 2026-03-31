import { describe, it, expect } from "vitest";
import { validateSearchRequest } from "./ClinicalTrialSearchValidator";
import { ClinicalTrialSearchRequest } from "../dto/ClinicalTrialSearchRequest";

describe("ClinicalTrialSearchValidator", () => {
  describe("Query field validation", () => {
    it("should fail when no query fields are provided", () => {
      const req: ClinicalTrialSearchRequest = {};
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toContain("term");
    });

    it("should pass when term is provided", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer" };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should pass when condition is provided", () => {
      const req: ClinicalTrialSearchRequest = { condition: "diabetes" };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass when intervention is provided", () => {
      const req: ClinicalTrialSearchRequest = { intervention: "drug" };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass when sponsor is provided", () => {
      const req: ClinicalTrialSearchRequest = { sponsor: "NIH" };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass when investigator is provided", () => {
      const req: ClinicalTrialSearchRequest = { investigator: "John Doe" };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass when location is provided", () => {
      const req: ClinicalTrialSearchRequest = { location: "Boston" };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should ignore empty string query fields", () => {
      const req: ClinicalTrialSearchRequest = { term: "", condition: "  " };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toContain("term");
    });

    it("should pass with multiple query fields", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        location: "Boston",
        sponsor: "NIH",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });
  });

  describe("Page size validation", () => {
    it("should fail when pageSize is not an integer", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", pageSize: 10.5 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "pageSize")).toBe(true);
    });

    it("should fail when pageSize is zero", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", pageSize: 0 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should fail when pageSize is negative", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", pageSize: -5 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should fail when pageSize exceeds maximum", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", pageSize: 101 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("100");
    });

    it("should pass when pageSize is valid", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", pageSize: 50 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass when pageSize is 1", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", pageSize: 1 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass when pageSize is 100", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", pageSize: 100 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });
  });

  describe("Age validation", () => {
    it("should fail when minAge is negative", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", minAge: -1 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "minAge")).toBe(true);
    });

    it("should fail when maxAge is negative", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", maxAge: -5 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should fail when minAge is not an integer", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", minAge: 30.5 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should fail when minAge > maxAge", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        minAge: 50,
        maxAge: 30,
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "minAge / maxAge")).toBe(true);
    });

    it("should pass when age range is valid", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        minAge: 18,
        maxAge: 65,
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass when only minAge is provided", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", minAge: 18 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass when minAge equals maxAge", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        minAge: 30,
        maxAge: 30,
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });
  });

  describe("Enrollment validation", () => {
    it("should fail when minEnrollment is negative", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", minEnrollment: -1 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should fail when maxEnrollment is negative", () => {
      const req: ClinicalTrialSearchRequest = { term: "cancer", maxEnrollment: -100 };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should fail when minEnrollment > maxEnrollment", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        minEnrollment: 1000,
        maxEnrollment: 100,
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes("minEnrollment"))).toBe(true);
    });

    it("should pass when enrollment range is valid", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        minEnrollment: 10,
        maxEnrollment: 1000,
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass with zero enrollment", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        minEnrollment: 0,
        maxEnrollment: 5000,
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });
  });

  describe("Date validation", () => {
    it("should pass with valid YYYY format", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        startDateFrom: "2020",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass with valid YYYY-MM format", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        startDateFrom: "2020-03",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass with valid YYYY-MM-DD format", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        startDateFrom: "2020-03-15",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should fail with invalid date format", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        startDateFrom: "03/15/2020",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should accept date that matches format pattern", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        startDateFrom: "2020-13-01",
      };
      const result = validateSearchRequest(req);
      // The validator only checks format (YYYY-MM-DD), not actual date validity
      expect(result.valid).toBe(true);
    });

    it("should fail when startDateFrom > startDateTo", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        startDateFrom: "2023-01-01",
        startDateTo: "2020-01-01",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes("startDateFrom"))).toBe(true);
    });

    it("should pass when startDateFrom <= startDateTo", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        startDateFrom: "2020-01-01",
        startDateTo: "2023-01-01",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should fail when completionDateFrom > completionDateTo", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        completionDateFrom: "2023-01-01",
        completionDateTo: "2020-01-01",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });
  });

  describe("Conditions array validation", () => {
    it("should fail when requiredConditions is not an array", () => {
      const req = {
        term: "cancer",
        requiredConditions: "diabetes",
      } as unknown as ClinicalTrialSearchRequest;
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should fail when requiredConditions contains empty strings", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        requiredConditions: ["", "  "],
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should pass when requiredConditions is valid", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        requiredConditions: ["diabetes", "hypertension"],
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should fail when ineligibleConditions is not an array", () => {
      const req = {
        term: "cancer",
        ineligibleConditions: "pregnancy",
      } as unknown as ClinicalTrialSearchRequest;
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
    });

    it("should pass when ineligibleConditions is valid", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        ineligibleConditions: ["pregnancy", "liver disease"],
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should pass with empty arrays", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        requiredConditions: [],
        ineligibleConditions: [],
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });
  });

  describe("Complex validation scenarios", () => {
    it("should report multiple errors", () => {
      const req: ClinicalTrialSearchRequest = {
        pageSize: 150,
        minAge: 50,
        maxAge: 30,
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it("should validate all date fields", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        startDateFrom: "2020-01-01",
        startDateTo: "2023-01-01",
        completionDateFrom: "2020-06-01",
        completionDateTo: "2023-06-01",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should validate all optional fields together", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        pageSize: 50,
        minAge: 18,
        maxAge: 65,
        minEnrollment: 10,
        maxEnrollment: 1000,
        startDateFrom: "2020",
        requiredConditions: ["diabetes"],
        ineligibleConditions: ["pregnancy"],
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero values properly", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        minAge: 0,
        maxAge: 0,
        minEnrollment: 0,
        maxEnrollment: 0,
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should handle very large numbers", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer",
        minAge: 999999,
        maxAge: 999999,
        minEnrollment: 999999,
        maxEnrollment: 999999,
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should handle special characters in search terms", () => {
      const req: ClinicalTrialSearchRequest = {
        term: "cancer & treatment (advanced)",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });

    it("should handle Unicode characters in search terms", () => {
      const req: ClinicalTrialSearchRequest = {
        condition: "αρθρίτιδα",
      };
      const result = validateSearchRequest(req);
      expect(result.valid).toBe(true);
    });
  });
});
