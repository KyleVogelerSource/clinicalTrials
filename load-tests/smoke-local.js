import http from "k6/http";
import { check, group, sleep } from "k6";

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";
const vus = Number(__ENV.VUS || 10);
const duration = __ENV.DURATION || "1m";

export const options = {
  stages: [
    { duration: "15s", target: vus },
    { duration, target: vus },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
};

export default function () {
  group("health", () => {
    const res = http.get(`${baseUrl}/api/health`);
    check(res, {
      "health status is 200": (r) => r.status === 200,
      "health ok is true": (r) => r.json("ok") === true,
    });
  });

  group("debug status", () => {
    const res = http.get(`${baseUrl}/api/debug/status`);
    check(res, {
      "debug status is 200": (r) => r.status === 200,
      "debug ok is true": (r) => r.json("ok") === true,
      "debug has database status": (r) => typeof r.json("databaseConnected") === "boolean",
      "debug has AI provider status": (r) => typeof r.json("aiProviders.anthropic.configured") === "boolean",
    });
  });

  group("empty response", () => {
    const res = http.get(`${baseUrl}/api/clinical-trials/empty-response`);
    check(res, {
      "empty response status is 200": (r) => r.status === 200,
    });
  });

  sleep(1);
}
