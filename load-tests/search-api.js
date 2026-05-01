import http from "k6/http";
import { check, group, sleep } from "k6";

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";
const vus = Number(__ENV.VUS || 5);
const duration = __ENV.DURATION || "1m";

const headers = {
  "Content-Type": "application/json",
};

const searchPayload = JSON.stringify({
  condition: "Type 2 Diabetes",
  phase: "PHASE2",
  studyType: "INTERVENTIONAL",
  minAge: 18,
  maxAge: 75,
  sex: "ALL",
  pageSize: 10,
  countTotal: true,
});

const candidatePoolPayload = JSON.stringify({
  condition: "Type 2 Diabetes",
  phase: "PHASE2",
  studyType: "INTERVENTIONAL",
  minAge: 18,
  maxAge: 75,
  sex: "ALL",
  requiredConditions: ["Type 2 Diabetes"],
  ineligibleConditions: [],
  pageSize: 25,
  cap: 10,
});

export const options = {
  stages: [
    { duration: "15s", target: vus },
    { duration, target: vus },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<5000"],
  },
};

export default function () {
  group("clinical trial search", () => {
    const res = http.post(`${baseUrl}/api/clinical-trials/search`, searchPayload, { headers });
    check(res, {
      "search returns 200": (r) => r.status === 200,
      "search has studies array": (r) => Array.isArray(r.json("studies")),
    });
  });

  group("candidate pool", () => {
    const res = http.post(`${baseUrl}/api/clinical-trials/candidate-pool`, candidatePoolPayload, { headers });
    check(res, {
      "candidate pool returns 200": (r) => r.status === 200,
      "candidate pool has trials": (r) => Array.isArray(r.json("trials")),
      "candidate pool has metadata": (r) => r.json("metadata") !== undefined,
    });
  });

  sleep(1);
}

