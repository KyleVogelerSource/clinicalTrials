import { describe, expect, it } from "vitest";
import { validateTrialCompareRequest } from "./TrialCompareValidator";

describe("TrialCompareValidator", () => {
  it("accepts two to five trials and non-negative weight overrides", () => {
    const result = validateTrialCompareRequest({
      trials: [{ nctId: "NCT000001" }, { nctId: "NCT000002" }],
      weights: {
        conditionOverlap: 2,
        enrollmentSimilarity: 0,
      },
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("requires trials to be an array", () => {
    const result = validateTrialCompareRequest({
      trials: undefined,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([{ field: "trials", message: "trials must be an array." }]);
  });

  it("enforces trial count limits", () => {
    const tooFew = validateTrialCompareRequest({ trials: [{ nctId: "NCT000001" }] });
    const tooMany = validateTrialCompareRequest({
      trials: [
        { nctId: "NCT000001" },
        { nctId: "NCT000002" },
        { nctId: "NCT000003" },
        { nctId: "NCT000004" },
        { nctId: "NCT000005" },
        { nctId: "NCT000006" },
      ],
    });

    expect(tooFew.errors).toContainEqual({
      field: "trials",
      message: "trials must include between 2 and 5 items.",
    });
    expect(tooMany.errors).toContainEqual({
      field: "trials",
      message: "trials must include between 2 and 5 items.",
    });
  });

  it("requires every trial to include a non-empty nctId", () => {
    const result = validateTrialCompareRequest({
      trials: [{ nctId: "NCT000001" }, { nctId: " " }, null as unknown as { nctId: string }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { field: "trials[1].nctId", message: "nctId is required." },
        { field: "trials[2].nctId", message: "nctId is required." },
      ])
    );
  });

  it("requires weights to be an object when provided", () => {
    const result = validateTrialCompareRequest({
      trials: [{ nctId: "NCT000001" }, { nctId: "NCT000002" }],
      weights: [] as unknown as Record<string, number>,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: "weights",
      message: "weights must be an object when provided.",
    });
  });

  it("rejects negative, NaN, and non-numeric weight overrides", () => {
    const result = validateTrialCompareRequest({
      trials: [{ nctId: "NCT000001" }, { nctId: "NCT000002" }],
      weights: {
        conditionOverlap: -1,
        phaseMatch: Number.NaN,
        studyType: "high" as unknown as number,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { field: "weights.conditionOverlap", message: "conditionOverlap must be a non-negative number." },
        { field: "weights.phaseMatch", message: "phaseMatch must be a non-negative number." },
        { field: "weights.studyType", message: "studyType must be a non-negative number." },
      ])
    );
  });
});
