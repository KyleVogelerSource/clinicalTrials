import http from "k6/http";
import { check, fail, sleep } from "k6";

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";
const vus = Number(__ENV.VUS || 1);
const duration = __ENV.DURATION || "30s";

const headers = {
  "Content-Type": "application/json",
};

const baseTrial = {
  officialTitle: null,
  acronym: null,
  phase: "PHASE2",
  studyType: "INTERVENTIONAL",
  overallStatus: "COMPLETED",
  whyStopped: null,
  hasResults: true,
  enrollmentType: "ACTUAL",
  allocation: "RANDOMIZED",
  interventionModel: "PARALLEL",
  primaryPurpose: "TREATMENT",
  masking: "DOUBLE",
  whoMasked: ["PARTICIPANT", "INVESTIGATOR"],
  interventionTypes: ["DRUG"],
  armCount: 2,
  eligibilityCriteria: "Adults with Type 2 Diabetes. Excludes severe renal impairment.",
  sex: "ALL",
  minimumAge: "18 Years",
  maximumAge: "75 Years",
  healthyVolunteers: false,
  stdAges: ["ADULT", "OLDER_ADULT"],
  primaryOutcomes: ["Change in HbA1c"],
  secondaryOutcomes: ["Adverse events"],
  sponsor: "Example Sponsor",
  sponsorClass: "INDUSTRY",
  collaboratorCount: 0,
  locationCount: 12,
  countries: ["United States"],
  hasDmc: true,
  meshTerms: ["Diabetes Mellitus, Type 2"],
};

const payload = JSON.stringify({
  condition: "Type 2 Diabetes",
  phase: "PHASE2",
  allocationType: "RANDOMIZED",
  interventionModel: "PARALLEL",
  blindingType: "DOUBLE",
  minAge: 18,
  maxAge: 75,
  sex: "ALL",
  selectedTrialIds: [],
  inclusionCriteria: [{ description: "Adults with Type 2 Diabetes" }],
  exclusionCriteria: [{ description: "Severe renal impairment" }],
  topK: 2,
  trials: [
    {
      ...baseTrial,
      nctId: "NCTLOAD0001",
      briefTitle: "Type 2 Diabetes Treatment Study A",
      enrollmentCount: 120,
      startDate: "2021-01",
      completionDate: "2022-06",
      conditions: ["Type 2 Diabetes"],
      interventions: ["Drug A"],
    },
    {
      ...baseTrial,
      nctId: "NCTLOAD0002",
      briefTitle: "Type 2 Diabetes Treatment Study B",
      enrollmentCount: 180,
      startDate: "2020-03",
      completionDate: "2021-12",
      conditions: ["Type 2 Diabetes"],
      interventions: ["Drug B"],
      locationCount: 20,
    },
    {
      ...baseTrial,
      nctId: "NCTLOAD0003",
      briefTitle: "Glycemic Control Study",
      enrollmentCount: 90,
      startDate: "2019-05",
      completionDate: "2020-09",
      conditions: ["Type 2 Diabetes", "Hyperglycemia"],
      interventions: ["Drug C"],
      locationCount: 8,
    },
  ],
});

export const options = {
  stages: [
    { duration: "5s", target: vus },
    { duration, target: vus },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.10"],
    http_req_duration: ["p(95)<30000"],
  },
};

export function setup() {
  if (__ENV.ENABLE_AI_BENCHMARK !== "true") {
    fail("Set ENABLE_AI_BENCHMARK=true to run provider-backed benchmark load tests.");
  }
}

export default function () {
  const res = http.post(`${baseUrl}/api/clinical-trials/benchmark`, payload, { headers });

  check(res, {
    "benchmark returns 200": (r) => r.status === 200,
    "benchmark has ranked trials": (r) => Array.isArray(r.json("rankedTrials")),
    "benchmark has explanation": (r) => typeof r.json("explanation.explanation") === "string",
  });

  sleep(2);
}

