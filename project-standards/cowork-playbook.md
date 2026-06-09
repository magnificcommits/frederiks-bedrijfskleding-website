# Cowork-playbook voor security-werk op Next.js + Supabase apps

Herbruikbaar startpunt voor toekomstige sessies. Kopieer naar je nieuwe project, plak in chat als brief, of gebruik als checklist.

---

## 1. Hoe je een sessie inschiet

Bij start van een Cowork-chat over een bestaand project:

1. Vraag eerst om een **pentest / audit** voor je iets gaat fixen. Static-only is veilig:
   > "Voer een static security pentest uit op deze repo. Scope: secrets, auth/admin routes, RLS, SSRF, XSS, dependency CVEs, headers. Rapport prioritized op Critical/High/Medium met concrete file:line + fix. Geen DAST."
2. Laat het rapport opslaan in `outputs/pentest-rapport-YYYY-MM.md`
3. Pas dan: kies wat je deze week fixt, niet alles in één sessie

**Werkprincipe:** één commit per fix-bundel. Niet 60 dingen tegelijk pushen.

---

## 2. Standaard kwetsbaarheden in Next.js + Supabase apps

Checklist die ik in ~80% van Next+Supabase projecten zie:

### Auth & sessions

- [ ] **Admin-cookie ongesigneerd** — vaak een `JSON.parse(cookie).name` check zonder HMAC. Iedereen kan forge'n. Fix: `lib/adminSession.ts` met Web Crypto HMAC, twee cookies (body + sig)
- [ ] **Klant-middleware vertrouwt op cookie-presence** — `cookie.value.length > 10` zegt niets. Echte verificatie hoort in route-handlers via `supabase.auth.getUser()`
- [ ] **Open redirect via `?next=`** — `startsWith('/')` accepteert `//evil.com`. Fix: blokkeer `//`, `/\\`, control-chars, en optionele prefix-allowlist
- [ ] **Single-secret admin auth** — `ADMIN_SECRET` dat zowel admin-login als share-links autoriseert. Splits in twee env vars

### Database & RLS

- [ ] **Service-role client met user-supplied IDs** — RLS wordt bypassed; ownership-check moet in app-code
- [ ] **Mutations leunen alleen op RLS** — `update(...).eq('id', id)` zonder `.eq('user_id', user.id)`. Defense-in-depth: voeg user-filter toe naast RLS
- [ ] **IDOR via foreign keys** — body neemt `apparatuur_id`, `locatie_id` aan. Verifieer dat de FK aan de huidige user toebehoort vóór insert
- [ ] **RLS niet aan op alle tabellen** — check via `pg_class.relrowsecurity`; vaak missen scrape/log/cache tabellen

### SSRF & external calls

- [ ] **`fetch(userUrl)` zonder DNS-block** — kan AWS IMDS (`169.254.169.254`), localhost, interne services bereiken. Helper: `safeFetch` met DNS-resolve + private-IP-blocklist + `redirect: 'manual'`
- [ ] **Webhook auth ontbreekt** — Resend/Stripe/Sanity webhooks zonder signature-verificatie

### Input & rendering

- [ ] **`dangerouslySetInnerHTML` met user-input** — alleen voor statische JSON-LD, nooit voor lead-toelichting
- [ ] **Mail-HTML zonder `escapeHtml`** — een lead-naam `<script>` in een admin-mail = stored XSS
- [ ] **CRLF in mail-subject** — header-injection. Strip `\r\n` uit alles dat in headers belandt
- [ ] **PostgREST `or(...)`-injection** — user `q` met komma's kan extra OR-clauses injecteren. Strip `,` en `()` uit search-input

### Cost-amplification (vergeten klasse)

- [ ] **LLM-endpoints zonder rate-limit** — Opus call vanaf forged cookie = €€€/dag
- [ ] **Image-gen endpoints** (Replicate/Sora) — idem, soms €0,15/call
- [ ] **GET-method op state-changing endpoints** — kan via `<img src>` in mail getriggerd worden, bypassed Lax-cookie protection
- [ ] **In-memory rate-limit** in serverless = nutteloos (cold start reset). Gebruik DB-backed (Supabase tabel of Upstash)

### Headers & config

- [ ] **CSP in Report-Only** — meet je 2 weken? Anders is het dood gewicht
- [ ] **`'unsafe-inline'` en `'unsafe-eval'` in script-src** = CSP nutteloos. Migreer naar nonces
- [ ] **`X-XSS-Protection`** = deprecated in moderne browsers, verwijderen of `0`
- [ ] **HSTS preload** — alleen aanzetten als je echt zeker bent (irreversibel ~1 jaar)
- [ ] **Cross-Origin headers** (COOP, CORP) ontbreken meestal volledig

### Dependencies & monitoring

- [ ] **Next.js outdated** — check via `npm ls next`. CVEs komen periodiek
- [ ] **Geen Dependabot** = je hoort het pas als een klant belt
- [ ] **Geen Sentry/error-monitoring** = production-bugs blijven onzichtbaar
- [ ] **Tests draaien niet in CI** = regressies sluipen erin
- [ ] **`.env.local` in git?** — check `git log --all -- .env*`

---

## 3. Quick-win templates

### `.github/dependabot.yml` (npm + GitHub Actions, weekly)

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      security-updates:
        applies-to: security-updates
        patterns: ["*"]
        # Exclude majors die framework-breaking zijn, anders smokkelt
        # dependabot ze mee onder de "security"-noemer en breekt de build.
        exclude-patterns:
          - "next"
          - "react"
          - "react-dom"
          - "sanity"
          - "vite"
          - "typescript"
          - "tailwindcss"
      minor-and-patch:
        applies-to: version-updates
        update-types: ["minor", "patch"]
    ignore:
      # Major-bumps zijn altijd handmatige review
      - dependency-name: "next"
        update-types: ["version-update:semver-major"]
      - dependency-name: "react"
        update-types: ["version-update:semver-major"]
      # ... voeg toe per project
    commit-message:
      prefix: "chore(deps)"
      include: "scope"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

### `.github/workflows/ci.yml` (typecheck + lint + test + audit)

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci --no-audit --no-fund
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test

  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    continue-on-error: true  # informatief, niet blocking
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci --no-audit --no-fund
      - run: npm audit --audit-level=high
```

### HMAC-signed admin cookie helper (`lib/adminSession.ts`)

Web Crypto-based, werkt in Node én Edge runtime. Pattern:

```ts
const COOKIE_BODY = 'app_admin'
const COOKIE_SIG  = 'app_admin_sig'
const MAX_AGE_SEC = 60 * 60 * 24 * 7

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function signAdmin(payload: { name: string }) {
  const data = { ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC }
  const body = JSON.stringify(data)
  const sig  = await hmac(process.env.ADMIN_SESSION_SECRET!, body)
  return { body, sig }
}

export async function verifyAdmin(body?: string, sig?: string) {
  if (!body || !sig) return null
  const expected = await hmac(process.env.ADMIN_SESSION_SECRET!, body)
  // constant-time compare
  if (sig.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) return null
  const p = JSON.parse(body)
  if (!p.name || (p.exp * 1000) < Date.now()) return null
  return p
}
```

### SSRF-safe `safeFetch`

```ts
import { lookup } from 'dns/promises'

const PRIVATE = [
  /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^127\./, /^169\.254\./, /^0\./,
  /^::1$/, /^fc/i, /^fd/i, /^fe80:/i,
]

export async function safeFetch(url: string, init?: RequestInit) {
  const u = new URL(url)
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
  const all = await lookup(u.hostname, { all: true })
  for (const r of all) {
    if (PRIVATE.some(re => re.test(r.address))) {
      throw new Error(`blocked: ${r.address}`)
    }
  }
  // redirect: 'manual' zodat 3xx Location opnieuw door safeFetch gaat
  return fetch(url, { ...init, redirect: init?.redirect ?? 'manual' })
}
```

### Open-redirect validator

```ts
export function safeNext(v: string | null | undefined, fallback: string, allowedPrefixes?: string[]): string {
  if (!v) return fallback
  if (!v.startsWith('/')) return fallback
  if (v.startsWith('//') || v.startsWith('/\\') || v.startsWith('/%2f') || v.startsWith('/%5c')) return fallback
  if (/[\x00-\x1F\x7F]/.test(v) || v.length > 512) return fallback
  if (allowedPrefixes?.length) {
    const ok = allowedPrefixes.some(p => v === p || v.startsWith(p + '/') || v.startsWith(p + '?'))
    if (!ok) return fallback
  }
  return v
}
```

---

## 4. Cowork-workflow tips (geleerd op de harde manier)

### Bij terminal-werk

- **Plak ALLEEN het commando** terug in chat, niet de output PLUS mijn instructies eromheen. PowerShell parsed mijn tekst als commando's → urenlange error-stream
- **Eén commando per regel, Enter na elke regel.** Niet alles in één blok plakken
- Bij grote rebases: **stash de uncommitted changes EERST**, dan rebase

### Bij Sentry-setup

- Tijdens de wizard: **`npm run dev` MOET uit zijn** (file-locks)
- Antwoord "No" op **Session Replay** als je geen Sentry-betaalplan hebt (gebruikt quota op)
- Antwoord "Yes" op **CI/CD pipeline (Vercel)** → auth-token komt automatisch als Vercel env-var
- **Vercel-Sentry integratie installeren via vercel.com/integrations/sentry** maakt soms een nieuwe Sentry-org aan i.p.v. te linken naar de bestaande. Cancel die flow → handmatig auth-token in Vercel env zetten

### Bij Dependabot

- **Eerste week** = veel PR's tegelijk (sanity, supabase, resend, etc). Merge 1 voor 1, niet allemaal samen → makkelijker reverten
- **`security-updates` groep** smokkelt majors mee. Voeg `exclude-patterns` toe voor next/react/vite/typescript/tailwindcss
- **TypeScript major bumps** breken altijd (5→6, 6→7 etc) — ignoren tot je tijd hebt
- Dependabot wil **labels** die nog niet bestaan? Maak `dependencies` + `github-actions` labels in repo settings, of verwijder uit yml

### Bij Vercel deploys

- Build-fail door **Sentry "No auth token"** = warnings, niet errors. Source maps werken niet, errors wel
- **Hydration mismatches** door single-quotes in inline CSS `<style>` = pre-existing bugs, fix met double-quotes
- Verloren push? Eerst `git status`, dan `git pull --rebase`, dan `git push`. Bij conflict: `git rebase --abort && git reset --hard origin/main`

### Niet doen

- ❌ `git push --force` (zonder eerst zeker te weten wat je verliest)
- ❌ Migreren naar Next.js 15+ in dezelfde week als andere fixes
- ❌ `npm audit fix --force` (installeert breaking changes zonder waarschuwing)
- ❌ Vercel env vars wijzigen + meteen pushen zonder lokaal te testen
- ❌ Alle dependabot PR's tegelijk mergen (één foute = rollback hell)

---

## 5. Volgorde bij volgende project

1. **Pentest** → outputs/pentest-rapport.md
2. **Quick wins** (≤30 min elk): Next.js upgrade, secret regen, open-redirect, hardcoded credentials weg
3. **Critical fixes** (1-2u elk): signed cookies, SSRF guards, rate-limits op LLM endpoints
4. **Defense in depth** (1u): expliciete user-filters in RLS-backed mutations, FK ownership checks
5. **CI/CD**: Dependabot + GitHub Action (1u)
6. **Monitoring**: Sentry (45 min) + Vercel-Sentry source maps (15 min)
7. **Handover document** met wat live staat, wat open is, en in welke volgorde aan te pakken

Doel-score: **8,5/10 audit-grade** voor een klein team. 9,5+ vereist dedicated security-engineer.

---

## 6. Wat NIET in deze playbook hoort

- Specifieke business-logica (lead-scoring, MijnKeuken, etc.) — per project anders
- Production-credentials — die staan in Vercel, niet hier
- Concrete CVE-nummers — verouderen snel, refer naar `npm audit` output
- Tooling-keuzes die je al hebt — Sentry vs Datadog, Supabase vs Postgres = projectspecifiek

---

*Versie: mei 2026. Pas aan op basis van wat je in nieuwe projecten leert.*
