# Secret-register — [PROJECTNAAM]

> Levend document. Kopieer naar de projectroot of `outputs/`. Werk bij elke rotatie en nieuwe secret bij.
>
> **Hard regel: hier staat NOOIT de waarde van een secret.** Alleen naam, eigenaar, omgeving, systeem,
> aanmaakdatum en rotatiedatum. De waardes staan in Vercel/Supabase-env of een wachtwoordmanager.

**Project:** ___  ·  **Laatst bijgewerkt:** ___  ·  **Eigenaar register:** ___

---

## Inventaris

| Secret (naam) | Systeem | Omgeving | Eigenaar | Aangemaakt | Laatst geroteerd | Rotatie-/expiratiedatum | Opslag (waar) |
|---|---|---|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | prod | | | | | Vercel env (server-only) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | prod/preview/dev | | | | | Vercel env |
| `SANITY_API_TOKEN` | Sanity | prod | | | | | Vercel env |
| `RESEND_API_KEY` | Resend | prod | | | | | Vercel env |
| `ADMIN_SESSION_SECRET` | App | prod | | | | | Vercel env |
| `SENTRY_AUTH_TOKEN` | Sentry | CI | | | | | Vercel/GitHub secret |
| `STAGING_URL` | CI | n.v.t. | | | | | GitHub Actions secret |

Aparte secrets/accounts per omgeving (dev / preview / prod). Geen gedeelde superuser-key.

## Rotatiebeleid

- **Vaste cadans:** roteer minimaal [bv. elke 6-12 maanden]; noteer per regel de volgende datum.
- **Directe rotatie** bij elk vermoeden van blootstelling (secret in log, in commit, in AI-context, gedeeld scherm).
- Een secret uit git-historie verwijderen is **niet** genoeg — de waarde is gecompromitteerd → roteren.

## Procedure bij (vermoedelijke) blootstelling

1. Roteer de secret onmiddellijk in het bronsysteem.
2. Werk de env's bij (prod/preview/dev) en deploy.
3. Trek de oude waarde in / maak ongeldig.
4. Noteer in dit register: datum, reden, nieuwe rotatiedatum.
5. Bij persoonsgegevens geraakt: beoordeel meldplicht (zie `data/INCIDENT_RESPONSE.md`).

## Preventie (afdwingen, niet alleen documenteren)

- [ ] GitHub **secret scanning + push protection** aan
- [ ] `gitleaks` in CI (`ci/security-scan.yml`) + optioneel pre-commit
- [ ] Scan van de **volledige git-historie** uitgevoerd (`gitleaks detect`)
- [ ] `.env*` in `.gitignore`; gecontroleerd met `git log --all -- .env*`
- [ ] Elke secret heeft een eigenaar en een rotatiedatum in dit register
