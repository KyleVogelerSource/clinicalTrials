import { describe, expect, it } from "vitest";
import {
  buildSavedSearchCanonicalKey,
  normalizeSavedSearchCriteria,
  toStableCriteriaJson,
} from "./SavedSearchCriteriaNormalizer";
import type { ClinicalTrialSearchRequest } from "../dto/ClinicalTrialSearchRequest";

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

  it("normalizes arrays by trimming, lowercasing configured fields, dropping unsupported values, and sorting", () => {
    const criteria = {
      condition: ["  Beta  ", "", "alpha", 42, false, { bad: true }] as unknown as string[],
      selectedTrialIds: [" NCT2 ", "NCT1"],
    } as unknown as ClinicalTrialSearchRequest;

    const normalized = normalizeSavedSearchCriteria(criteria);

    expect(normalized).toEqual({
      condition: ["alpha", "beta", 42, false],
      selectedTrialIds: ["NCT1", "NCT2"],
    });
  });

  it("keeps booleans and numbers, removes nulls and unsupported scalar values, and sorts object keys", () => {
    const criteria = {
      maxAge: null,
      minAge: 18,
      hasResults: true,
      condition: " Asthma ",
      location: { bad: true } as unknown as string,
    } as unknown as ClinicalTrialSearchRequest;

    const normalized = normalizeSavedSearchCriteria(criteria);

    expect(Object.keys(normalized)).toEqual(["condition", "hasResults", "minAge"]);
    expect(normalized).toEqual({
      condition: "asthma",
      hasResults: true,
      minAge: 18,
    });
  });

  it("drops arrays that normalize to no supported values", () => {
    expect(
      normalizeSavedSearchCriteria({
        selectedTrialIds: ["", "   ", { bad: true }] as unknown as string[],
        condition: "cancer",
      })
    ).toEqual({ condition: "cancer" });
  });
});
