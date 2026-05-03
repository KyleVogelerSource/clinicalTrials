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
      minAge: 18,
    });

    expect(normalized).toEqual({
      condition: "diabetes",
      minAge: 18,
      phase: "phase3",
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
      sex: "ALL",
    };

    const right = {
      sex: " all ",
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