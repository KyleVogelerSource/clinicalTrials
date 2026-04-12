import { searchClinicalTrials } from "./ClinicalTrialsService";
import { TrialCompareRequest, TrialCompareResponse, TrialCompareWeights } from "../dto/TrialCompareDto";
import { ClinicalTrialSearchRequest } from "../dto/ClinicalTrialSearchRequest";
import { ClinicalTrialStudiesResponse, ClinicalTrialStudy } from "../dto/ClinicalTrialStudiesResponse";
import { NormalizedTrial } from "../models/NormalizedTrial";
import { normalizeTrialStudy } from "./TrialNormalizer";

const DEFAULT_WEIGHTS: TrialCompareWeights = {
  conditionOverlap: 25,
  phaseMatch: 20,
  studyType: 10,
  eligibilityCompatibility: 20,
  interventionOverlap: 10,
  enrollmentSimilarity: 10,
  statusRecency: 5,
};

type SearchFn = (request: ClinicalTrialSearchRequest) => Promise<ClinicalTrialStudiesResponse>;

function normalizeWeights(weights?: Partial<TrialCompareWeights>): TrialCompareWeights {
  return {
    conditionOverlap: weights?.conditionOverlap ?? DEFAULT_WEIGHTS.conditionOverlap,
    phaseMatch: weights?.phaseMatch ?? DEFAULT_WEIGHTS.phaseMatch,
    studyType: weights?.studyType ?? DEFAULT_WEIGHTS.studyType,
    eligibilityCompatibility: weights?.eligibilityCompatibility ?? DEFAULT_WEIGHTS.eligibilityCompatibility,
    interventionOverlap: weights?.interventionOverlap ?? DEFAULT_WEIGHTS.interventionOverlap,
    enrollmentSimilarity: weights?.enrollmentSimilarity ?? DEFAULT_WEIGHTS.enrollmentSimilarity,
    statusRecency: weights?.statusRecency ?? DEFAULT_WEIGHTS.statusRecency,
  };
}

function normalizeSet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0));
}

function scoreOverlap(left: string[], right: string[]): number {
  const leftSet = normalizeSet(left);
  const rightSet = normalizeSet(right);
  if (leftSet.size === 0 && rightSet.size === 0) {
    return 1;
  }

  const intersectionSize = [...leftSet].filter((value) => rightSet.has(value)).length;
  const unionSize = new Set([...leftSet, ...rightSet]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function parseAgeInYears(age: string | null): number | null {
  if (!age) {
    return null;
  }

  const match = age.match(/(\d+)/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function scoreEligibilityCompatibility(left: NormalizedTrial, right: NormalizedTrial): number {
  const sexCompatible = left.sex === "ALL" || right.sex === "ALL" || left.sex === right.sex ? 1 : 0;

  const leftMin = parseAgeInYears(left.minimumAge);
  const leftMax = parseAgeInYears(left.maximumAge);
  const rightMin = parseAgeInYears(right.minimumAge);
  const rightMax = parseAgeInYears(right.maximumAge);

  let ageCompatibility = 0.5;
  if (leftMin !== null && rightMax !== null && leftMin > rightMax) {
    ageCompatibility = 0;
  } else if (rightMin !== null && leftMax !== null && rightMin > leftMax) {
    ageCompatibility = 0;
  } else if (leftMin !== null || leftMax !== null || rightMin !== null || rightMax !== null) {
    ageCompatibility = 1;
  }

  return (sexCompatible + ageCompatibility) / 2;
}

function scoreEnrollmentSimilarity(left: number, right: number): number {
  const max = Math.max(left, right);
  if (max === 0) {
    return 1;
  }

  return Math.max(0, 1 - Math.abs(left - right) / max);
}

function parseComparableDate(trial: NormalizedTrial): number | null {
  const candidate = trial.completionDate ?? trial.startDate;
  if (!candidate) {
    return null;
  }

  const date = new Date(`${candidate}-01T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function scoreStatusRecency(left: NormalizedTrial, right: NormalizedTrial): number {
  const leftDate = parseComparableDate(left);
  const rightDate = parseComparableDate(right);
  if (leftDate === null || rightDate === null) {
    return 0.5;
  }

  const monthsDifference = Math.abs(leftDate - rightDate) / (1000 * 60 * 60 * 24 * 30);
  return Math.max(0, 1 - monthsDifference / 120);
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildPairwiseComparison(left: NormalizedTrial, right: NormalizedTrial, weights: TrialCompareWeights) {
  const rawScores = {
    conditionOverlap: scoreOverlap(left.conditions, right.conditions),
    phaseMatch: left.phase === right.phase ? 1 : 0,
    studyType: left.studyType === right.studyType ? 1 : 0,
    eligibilityCompatibility: scoreEligibilityCompatibility(left, right),
    interventionOverlap: scoreOverlap(left.interventions, right.interventions),
    enrollmentSimilarity: scoreEnrollmentSimilarity(left.enrollmentCount, right.enrollmentCount),
    statusRecency: scoreStatusRecency(left, right),
  };

  const weightedBreakdown: TrialCompareWeights = {
    conditionOverlap: roundScore(rawScores.conditionOverlap * weights.conditionOverlap),
    phaseMatch: roundScore(rawScores.phaseMatch * weights.phaseMatch),
    studyType: roundScore(rawScores.studyType * weights.studyType),
    eligibilityCompatibility: roundScore(rawScores.eligibilityCompatibility * weights.eligibilityCompatibility),
    interventionOverlap: roundScore(rawScores.interventionOverlap * weights.interventionOverlap),
    enrollmentSimilarity: roundScore(rawScores.enrollmentSimilarity * weights.enrollmentSimilarity),
    statusRecency: roundScore(rawScores.statusRecency * weights.statusRecency),
  };

  const score = roundScore(Object.values(weightedBreakdown).reduce((sum, value) => sum + value, 0));
  const explanations = [
    rawScores.conditionOverlap > 0
      ? `Condition overlap is ${Math.round(rawScores.conditionOverlap * 100)}%.`
      : "Conditions do not overlap.",
    rawScores.phaseMatch === 1
      ? `Both trials are in ${left.phase}.`
      : `Phases differ: ${left.phase} vs ${right.phase}.`,
    rawScores.studyType === 1
      ? `Both use study type ${left.studyType}.`
      : `Study types differ: ${left.studyType} vs ${right.studyType}.`,
    `Eligibility compatibility score is ${Math.round(rawScores.eligibilityCompatibility * 100)}%.`,
    `Intervention overlap is ${Math.round(rawScores.interventionOverlap * 100)}%.`,
    `Enrollment similarity score is ${Math.round(rawScores.enrollmentSimilarity * 100)}%.`,
    `Status/date recency score is ${Math.round(rawScores.statusRecency * 100)}%.`,
  ];

  return { score, weightedBreakdown, explanations };
}

async function resolveTrialByNctId(nctId: string, searchFn: SearchFn): Promise<ClinicalTrialStudy> {
  const response = await searchFn({ term: nctId });
  const match = response.studies.find((study) => study.protocolSection.identificationModule.nctId === nctId);
  if (!match) {
    throw new Error(`TRIAL_NOT_FOUND:${nctId}`);
  }
  return match;
}

export async function compareTrials(
  request: TrialCompareRequest,
  searchFn: SearchFn = searchClinicalTrials
): Promise<TrialCompareResponse> {
  const weights = normalizeWeights(request.weights);
  const studies = await Promise.all(
    request.trials.map((trial) => resolveTrialByNctId(trial.nctId.trim(), searchFn))
  );
  const normalizedTrials = studies.map((study) => normalizeTrialStudy(study));

  const comparisonMatrix = normalizedTrials.map((trial) => ({
    nctId: trial.nctId,
    scores: normalizedTrials.map((againstTrial) => {
      if (trial.nctId === againstTrial.nctId) {
        return {
          againstNctId: againstTrial.nctId,
          score: 100,
          weightedBreakdown: { ...weights },
          explanations: ["Reference trial compared with itself."],
        };
      }

      return {
        againstNctId: againstTrial.nctId,
        ...buildPairwiseComparison(trial, againstTrial, weights),
      };
    }),
  }));

  const benchmarkScores = normalizedTrials
    .map((trial) => {
      const otherScores = comparisonMatrix
        .find((row) => row.nctId === trial.nctId)?.scores
        .filter((cell) => cell.againstNctId !== trial.nctId)
        .map((cell) => cell.score) ?? [];

      const averageScore = otherScores.length === 0
        ? 100
        : roundScore(otherScores.reduce((sum, value) => sum + value, 0) / otherScores.length);

      return {
        nctId: trial.nctId,
        score: averageScore,
      };
    })
    .sort((left, right) => right.score - left.score)
    .map((trial, index) => ({
      ...trial,
      rank: index + 1,
    }));

  return {
    normalizedTrials,
    comparisonMatrix,
    benchmarkScores,
  };
}
