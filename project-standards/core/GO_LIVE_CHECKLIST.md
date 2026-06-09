# GO-LIVE CHECKLIST

Doorlopen vóór elke productie-deploy. Tier bepaalt de scope (zie README).

De hele standaarden-set beantwoordt uiteindelijk één vraag: **"Kunnen we naar een veilige productieomgeving?"** Deze checklist eindigt daarom in één verdict: GO / GO-MITS / NO-GO.

## Alle projecten (Tier 1+)
- [ ] SECURITY_AUDITOR Fast Check groen
- [ ] Env vars gescheiden dev/preview/prod, geen secrets in code of commits
- [ ] Security headers gezet (CSP, HSTS, X-Content-Type-Options, frame-ancestors, Referrer-Policy)
- [ ] Geen `NEXT_PUBLIC_` secret exposure
- [ ] Core Web Vitals groen (Lighthouse: LCP, CLS, INP)
- [ ] Accessibility baseline (ACCESSIBILITY.md): contrast, alt, labels, toetsenbord, focus
- [ ] SEO basics: title/meta per pagina, sitemap, robots.txt, schema markup
- [ ] Analytics + cookiebanner werkend en AVG-conform
- [ ] Formulieren werken + spam/bot-bescherming: honeypot op élk lead-/contactformulier; captcha (Cloudflare Turnstile/hCaptcha) op forms die e-mail/kosten triggeren of hoog-risico zijn. Let op: captcha/honeypot mag niet *fail-open* zijn als de secret ontbreekt (anders stil uitgeschakeld)
- [ ] 404-pagina aanwezig
- [ ] Domein + SSL correct, www/non-www redirect
- [ ] Content menselijk geschreven (ANTI_AI_WRITING)
- [ ] Design niet generiek (ANTI_AI_DESIGN check)
- [ ] Responsive getest op mobiel

## Projecten met data (Tier 2+)
- [ ] Supabase RLS actief op alle data-tabellen
- [ ] Auth-flows getest (login, reset, logout, sessie)
- [ ] Autorisatie server-side gecontroleerd (geen IDOR)
- [ ] Rate limiting op publieke API-routes ÉN op login/admin (per-IP, 429 + Retry-After). Login zónder eigen limiter = brute-force-risico — vertrouw niet blind op de Supabase-default. In-memory limiter (Map per instance) werkt NIET betrouwbaar op serverless/edge → gebruik gedeelde state (Supabase-RPC / Upstash / Vercel KV) en zorg dat de limiter *fail-closed* is
- [ ] Inputvalidatie met Zod
- [ ] Backup + restore getest
- [ ] AVG: bewaartermijnen, verwijder/exportproces, verwerkersovereenkomsten
- [ ] Sentry scrubbing aan (geen PII/tokens in logs)

## Zorg / multi-tenant (Tier 3)
- [ ] PENTEST_PRE_GOLIVE volledig uitgevoerd
- [ ] Tenant-isolatie getest (geen cross-tenant lek)
- [ ] DATA_BREACH_PLAYBOOK klaar en bekend
- [ ] Verwerkersovereenkomsten op orde voor bijzondere persoonsgegevens
- [ ] Externe security review overwogen

---

## Eindoordeel: GO / GO-MITS / NO-GO

Vul dit verdict in en geef het als slotregel. Een FAIL is geen schande — daar is de checklist voor.

| Veld | Invullen |
|---|---|
| Project | |
| Datum | |
| Uitgevoerd door | |
| Tier | |
| Open KRITIEK / HOOG | |
| **VERDICT** | ✅ GO / ⚠️ GO-MITS / 🛑 NO-GO |

### Beslisregel (niet onderhandelbaar)

```
Exposed secret · ontbrekende RLS/authz · service_role client-side
   · gefaalde pentest-kritiek · ongeteste restore        → 🛑 NO-GO
Alle relevante checks groen, geen open kritiek/hoog       → ✅ GO
Alleen restrisico's, élk met akkoord + eigenaar + deadline → ⚠️ GO-MITS
```

### Geaccepteerde restrisico's (verplicht bij GO-MITS)

| Risico | Ernst | Zakelijke reden | Akkoord door | Datum | Hersteldeadline |
|---|---|---|---|---|---|
| | | | | | |

> Zonder ingevulde, ondertekende restrisico-regel telt een open hoge/kritieke bevinding als **NO-GO**.

### Slotregel (zo formuleert de assistent het antwoord)

> **VERDICT: [GO / GO-MITS / NO-GO]** voor productie van *[project]* op *[datum]*.
> Onderbouwing: *[1-2 zinnen: wat is geverifieerd]*. Restrisico's: *[geen / lijst met deadlines]*.
> Niet gecontroleerd: *[expliciet benoemen]*.
