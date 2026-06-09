// Kopieer naar loadtests/smoke.js in je project (de workflow verwacht dat pad).
// Lichte rooktest: bevestigt dat staging een kleine, gestage load aankan.
// Voor capaciteits-/piektests: zie LOADTEST_GUIDE.md (zwaardere stages).
import http from "k6/http";
import { check, sleep } from "k6";

const TARGET = __ENV.TARGET_URL || "https://voorbeeld-staging.vercel.app";

export const options = {
  stages: [
    { duration: "30s", target: 5 }, // rustig opbouwen
    { duration: "1m", target: 5 }, // vasthouden
    { duration: "30s", target: 0 }, // afbouwen
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"], // p95 < 800ms
    http_req_failed: ["rate<0.01"], // < 1% fouten
  },
};

export default function () {
  const res = http.get(TARGET);
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1); // pacing — niet meppen
}
