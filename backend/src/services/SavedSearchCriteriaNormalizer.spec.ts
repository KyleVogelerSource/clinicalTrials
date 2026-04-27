import { describe, expect, it } from "vitest";
import {
  buildSavedSearchCanonicalKey,
  normalizeSavedSearchCriteria,
  toStableCriteriaJson,
} from "./SavedSearchCriteriaNormalizer";

describe("SavedSearchCriteriaNormalizer", () => {
  it("normalizes trimmed strings, removes empties, and sorts arrays", () => {
    const normalized = normalizeSavedSearchCriteria({
      condition: "  Diabetes  ",
      phase: " PHASE3 ",
      sponsor: "",
      requiredConditions: [" hypertension ", "diabetes", ""],
      ineligibleConditions: ["COPD", " asthma "],
      minAge: 18,
    });

    expect(normalized).toEqual({
      condition: "diabetes",
      ineligibleConditions: ["asthma", "copd"],
      minAge: 18,
      phase: "phase3",
      requiredConditions: ["diabetes", "hypertension"],
    });
  });

  it("normalizes year range strings to lowercase", () => {
    const normalized = normalizeSavedSearchCriteria({
      condition: "Diabetes",
      startDateFrom: "2020",
      startDateTo: "2025",
    });

    expect(normalized).toEqual({
      condition: "diabetes",
      startDateFrom: "2020",
      startDateTo: "2025",
    });
  });

  it("produces the same canonical key for equivalent criteria", () => {
    const left = {
      condition: "Diabetes",
      requiredConditions: ["hypertension", "obesity"],
      sex: "ALL",
    };

    const right = {
      sex: " all ",
      requiredConditions: ["obesity", "hypertension"],
      condition: " diabetes ",
    };

    expect(toStableCriteriaJson(left)).toBe(toStableCriteriaJson(right));
    expect(buildSavedSearchCanonicalKey(left)).toBe(buildSavedSearchCanonicalKey(right));
  });

  it("removes undefined values from the stable representation", () => {
    expect(
      toStableCriteriaJson({
        condition: "asthma",
        sponsor: undefined,
        minAge: undefined,
      })
    ).toBe(JSON.stringify({ condition: "asthma" }));
  });
});