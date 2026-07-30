# Loadtest-gids (k6)

Deze gids hoort bij de rooktest in `ci/loadtest-smoke.yml` + `ci/loadtests-smoke.js`. De rooktest bevestigt alleen dat staging een kleine, gestage load aankan. Voor **capaciteits- en piektests** gebruik je zwaardere k6-runs — beschreven hier.

> **Regel: test alleen wat je bezit, altijd tegen staging, nooit tegen productie of direct op Supabase.** Een zware load op productie of op gedeelde provider-infra kan als aanval worden gezien.

---

## Voorwaarden

- `STAGING_URL` staat als GitHub-secret (Settings → Secrets and variables → Actions). Zonder deze secret draait de workflow niet.
- k6 lokaal geïnstalleerd voor zwaardere runs: `brew install k6` (mac) / `choco install k6` (win) / of Grafana Cloud k6.
- Het testscript staat op `loadtests/smoke.js` in je project (de workflow verwacht dat pad).

## De rooktest (CI, wekelijks + handmatig)

`ci/loadtests-smoke.js` bouwt rustig op naar 5 virtuele gebruikers, houdt vast en bouwt af, met thresholds die falen bij degradatie (`p(95)<800ms`, `<1%` fouten). Dit is een vroege waarschuwing, geen capaciteitsmeting.

## Zwaardere tests (lokaal / Grafana Cloud)

Bouw altijd op met **ramp-up-fases + thresholds die afbreken bij degradatie**, zodat je geen blinde load op een stervende app blijft stapelen.

```js
// loadtests/capacity.js — voorbeeld capaciteitstest (lokaal draaien, NIET in CI)
import http from "k6/http";
import { check, sleep } from "k6";

const TARGET = __ENV.TARGET_URL; // verplicht; geen default naar productie

export const options = {
  stages: [
    { duration: "1m", target: 20 },   // opbouwen
    { duration: "3m", target: 50 },   // vasthouden op verwachte piek
    { duration: "1m", target: 100 },  // stresspiek
    { duration: "2m", target: 0 },    // afbouwen
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // breekt af bij p95 > 500ms
    http_req_failed: ["rate<0.01"],   // breekt af bij > 1% fouten
  },
};

export default function () {
  const res = http.get(TARGET);
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1); // pacing — niet meppen
}
```

Draaien: `TARGET_URL=https://<jouw-staging>.vercel.app k6 run loadtests/capacity.js`

## De belangrijkste caveat: connection-exhaustion, niet CPU

Op **Vercel + Supabase** is de bottleneck zelden CPU maar **connection-exhaustion**. Vercel Fluid schaalt agressief zonder de Supabase-connectiepool te ontzien. Gevolg: je raakt de pooler-cap lang vóór Postgres zelf bezwijkt.

- Route DB-verkeer via de **Supavisor-pooler** (transaction-mode), niet via directe connecties.
- Reken erop dat je de **pooler-cap** raakt als eerste — meet dat expliciet.
- Interpreteer een 5xx-piek onder load daarom vaak als "pool leeg", niet als "server te traag".

## Wat je meet en rapporteert

- p95/p99 responstijd onder verwachte piek.
- Foutratio (`http_req_failed`) — moet onder je threshold blijven.
- Bij welk aantal virtuele gebruikers degradatie begint (de capaciteitsgrens).
- Leg de uitkomst vast in `outputs/loadtest-YYYY-MM-DD.md` (zie bewijsdossier in `core/GO_LIVE_CHECKLIST.md`).
