# PROJECT-HANDBOEK

> Technisch overdrachtsdocument. Doel: een willekeurige developer kan met alleen dit bestand het project draaiend krijgen, begrijpen waar wat zit, en fixes uitvoeren, ook als Claude of de oorspronkelijke bouwer niet beschikbaar is.

---

## 0. Hoe dit document werkt

**Voor Claude (cowork):** dit is een levend document. Bij projectstart en na elke significante wijziging: scan de echte codebase en vul elke `[PLACEHOLDER]` in met feitelijke waarden uit het project. Verwijder secties die niet van toepassing zijn. Verzin niets, als iets onbekend is zet je `ONBEKEND` neer. Houd sectie 16 (changelog) bij.

**Voor een developer:** lees sectie 1, 3 en 15 eerst. Daarmee kun je binnen 15 minuten draaien.

**Hard regel: geen secrets in dit bestand.** Geen wachtwoorden, API-keys, tokens of connection strings. Alleen verwijzen naar waar ze staan (bijv. Vercel env, 1Password, `.env.local`). Dit bestand wordt mogelijk gedeeld of belandt in git.

---

## 1. Projectidentiteit

| Veld | Waarde |
|---|---|
| Projectnaam | `[NAAM]` |
| Eigenaar | `[NAAM + BV]` |
| Doel in 1 zin | `[WAT DOET DIT PRODUCT]` |
| Type | `[brochure / app met data / medisch/special category]` |
| Live URL | `[https://...]` |
| Staging URL | `[https://...vercel.app]` |
| Git repository | `[https://github.com/...]` |
| Status | `[in ontwikkeling / live / onderhoud]` |
| Laatste deploy | `[datum]` |

---

## 2. Tech stack

| Laag | Technologie | Versie | Waarom |
|---|---|---|---|
| Framework | Next.js | `[x.x]` | `[App Router / Pages]` |
| Styling | Tailwind CSS | `[x.x]` | |
| Database | Supabase (Postgres) | - | `[of: geen DB]` |
| CMS | Sanity | `[x.x]` | `[of: geen CMS]` |
| Hosting | Vercel | - | |
| Taal | TypeScript | `[x.x]` | |
| Package manager | `[npm / pnpm / yarn]` | `[x.x]` | |
| Node | Node.js | `[x.x]` | zie `.nvmrc` of `package.json engines` |

Andere libraries van belang: `[forms, auth, state, etc.]`

---

## 3. Snel starten (lokaal draaien)

**Vereisten:** Node `[versie]`, `[package manager]`, toegang tot de git repo, `.env.local` (zie sectie 6).

```bash
# 1. Clone
git clone [REPO-URL]
cd [MAP]

# 2. Dependencies
[npm install / pnpm install]

# 3. Environment variabelen
cp .env.example .env.local
# vul .env.local in, zie sectie 6

# 4. Lokaal draaien
[npm run dev]
# draait op http://localhost:3000
```

Als dit faalt: zie sectie 13 (bekende valkuilen).

---

## 4. Alle commando's

| Commando | Doet | Wanneer gebruiken |
|---|---|---|
| `[npm run dev]` | start dev-server | lokaal ontwikkelen |
| `[npm run build]` | productie-build | testen of build slaagt voor deploy |
| `[npm run start]` | draait productie-build lokaal | |
| `[npm run lint]` | linting | voor elke commit |
| `[npm run typecheck]` | TypeScript check | |
| `[npm test]` | tests | `[of: geen tests]` |
| `[sanity deploy]` | deployt Sanity Studio | na CMS-schema wijziging |
| `[supabase db push]` | draait migraties | na DB-wijziging |

Vul aan met alles uit `package.json` → `scripts`.

---

## 5. Mappenstructuur (waar zit wat)

```
[vul de echte boom in, ongeveer zo:]
/app of /pages      → routes en pagina's
/components         → herbruikbare UI-componenten
/lib of /utils      → helpers, API-clients (Supabase, Sanity)
/sanity             → CMS-schema's en config
/supabase           → migraties, SQL, RLS-policies
/public             → statische bestanden (afbeeldingen, fonts)
/styles             → globale CSS / Tailwind config
```

**Belangrijkste bestanden:**

| Bestand | Wat erin zit |
|---|---|
| `[next.config.js]` | Next-configuratie, redirects, headers |
| `[tailwind.config.js]` | design tokens, kleuren, fonts |
| `[lib/supabase.ts]` | Supabase client-init |
| `[sanity/schema.ts]` | CMS content-modellen |
| `[middleware.ts]` | auth-checks, route-bescherming |

---

## 6. Omgevingsvariabelen

Nooit de waardes hier. Alleen naam, doel en vindplaats.

| Variabele | Doel | Waar te vinden | Verplicht |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project-URL | Supabase dashboard → Settings → API | ja |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publieke client-key | idem | ja |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only admin-key | idem, **nooit client-side** | `[ja/nee]` |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project | sanity.io → project | `[ja/nee]` |
| `SANITY_API_TOKEN` | schrijftoegang CMS | sanity.io → API → Tokens | `[ja/nee]` |
| `[...]` | | | |

Productiewaarden staan in: **Vercel → Project → Settings → Environment Variables**.
Lokale waarden staan in: `.env.local` (niet in git, zie `.gitignore`).

---

## 7. Architectuur en dataflow

Korte beschrijving: `[bijv. "Statische pagina's uit Sanity, gebruikersdata uit Supabase, auth via Supabase Auth."]`

Request-flow (vul in):
```
Gebruiker → Vercel (Next.js)
            ├─ content → Sanity (CDN)
            ├─ data    → Supabase (Postgres + RLS)
            └─ auth    → [Supabase Auth / anders]
```

`[Beschrijf hier kort eventuele cron jobs, webhooks, server actions of API-routes en wat ze doen.]`

---

## 8. Database (Supabase)

| Veld | Waarde |
|---|---|
| Project ref | `[xxxx]` |
| Dashboard | `https://supabase.com/dashboard/project/[ref]` |
| Migraties | `[/supabase/migrations]` |
| RLS aan? | `[ja, op alle tabellen]` |

**Tabellen (kort):**

| Tabel | Inhoud | RLS-policy kort |
|---|---|---|
| `[users]` | `[...]` | `[eigen rij]` |
| `[...]` | | |

**Migratie draaien:**
```bash
[supabase db push]   # of beschrijf het echte proces
```

RLS-policies staan in: `[locatie]`. Wijzig nooit een tabel zonder de bijbehorende policy te checken.

---

## 9. CMS (Sanity)

| Veld | Waarde |
|---|---|
| Project ID | `[xxxx]` |
| Dataset | `[production]` |
| Studio URL | `[https://...sanity.studio]` |
| Schema locatie | `[/sanity/schemaTypes]` |

**Schema wijzigen → deployen:**
```bash
[cd sanity && sanity deploy]
```

Content-types (kort): `[page, post, settings, ...]`

---

## 10. Hosting en deployment (Vercel)

| Veld | Waarde |
|---|---|
| Vercel project | `[naam]` |
| Productie-branch | `[main]` |
| Deploy-trigger | push naar `[main]` → auto-deploy |
| Preview | elke PR krijgt preview-URL |

**Domeinen en DNS:**

| Domein | Type | Beheerd bij |
|---|---|---|
| `[domein.nl]` | A / CNAME | `[registrar]` |

Rollback: Vercel → Deployments → kies eerdere deploy → Promote to Production.

---

## 11. Integraties van derden

| Dienst | Doel | Waar credentials | Docs |
|---|---|---|---|
| `[Resend / SendGrid]` | e-mail | `[Vercel env]` | `[link]` |
| `[Stripe / Mollie]` | betalingen | `[...]` | |
| `[...]` | | | |

---

## 12. Beveiliging (baseline)

| Onderdeel | Status / locatie |
|---|---|
| Sentry (errors) | `[project-link, config in sentry.*.config.ts]` |
| Aikido (security scan) | `[gekoppeld aan repo]` |
| 2FA | `[aan op GitHub / Vercel / Supabase]` |
| Dependabot | `[aan, config in .github/]` |
| RLS | `[aan op alle Supabase-tabellen]` |
| Auth | `[Supabase Auth, route-bescherming in middleware.ts]` |

Bij een securityvraag: check eerst RLS-policies en de auth-middleware.

---

## 13. Bekende issues en valkuilen

- `[bijv. "Build faalt zonder SANITY_API_TOKEN, ook al is die alleen runtime nodig."]`
- `[bijv. "Node 20 vereist, faalt op 18."]`
- `[...]`

---

## 14. Accounts en toegang

Wie heeft toegang tot wat. Geen wachtwoorden, alleen waar toegang aan te vragen.

| Systeem | Eigenaar | Toegang aanvragen via |
|---|---|---|
| GitHub repo | `[naam]` | `[naam/e-mail]` |
| Vercel | `[naam]` | |
| Supabase | `[naam]` | |
| Sanity | `[naam]` | |
| Domein/DNS | `[naam]` | |

---

## 15. Voor een nieuwe developer (noodscenario)

Als de oorspronkelijke bouwer of Claude niet beschikbaar is en je moet een fix doen:

1. Lees sectie 1 (wat is dit), 2 (stack), 3 (lokaal draaien).
2. Krijg toegang via sectie 14.
3. Draai lokaal (sectie 3). Werkt het niet: sectie 13.
4. Zoek de fout: check Sentry (sectie 12) voor de stacktrace.
5. Lokaliseer de code via sectie 5 (mappenstructuur).
6. Test je fix lokaal met `[npm run build]` voordat je pusht.
7. Push naar `[main]` → Vercel deployt automatisch. Mis het? Rollback via sectie 10.

Contactpersoon eigenaar: `[naam, e-mail, telefoon]`

---

## 16. Changelog van dit handboek

| Datum | Wijziging | Door |
|---|---|---|
| `[datum]` | Initieel aangemaakt | `[naam]` |
