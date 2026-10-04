import { apiFout, leesJson, metApi, zodDetails } from '@/lib/api/v1';
import { medewerkerJson, pnrSchema, pnrUitPad, uitkomstJson, wijzigSchema } from '@/lib/api/medewerkers';
import { vindOpPersoneelsnummer, wijzigMedewerker } from '@/lib/kms/hrKoppeling';

/**
 * GET   /api/v1/medewerkers/{personeelsnummer}  één medewerker.
 * PATCH /api/v1/medewerkers/{personeelsnummer}  gegevens wijzigen (naam, e-mail, afdeling, functie, startdatum).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ personeelsnummer: string }> };

export async function GET(req: Request, { params }: Params) {
  const p = pnrSchema.safeParse(pnrUitPad((await params).personeelsnummer));
  if (!p.success) return apiFout(422, 'ongeldig_personeelsnummer', 'Dit personeelsnummer heeft geen geldige vorm.', zodDetails(p.error));
  return metApi(req, 'medewerkers:lezen', async (ctx) => {
    const m = await vindOpPersoneelsnummer(ctx.organisatieId, p.data);
    if (!m) return { status: 404, body: { fout: { code: 'niet_gevonden', bericht: 'Geen medewerker met dit personeelsnummer.' } }, actie: 'ophalen' };
    return { status: 200, body: { data: medewerkerJson(m) }, actie: 'ophalen', medewerkerId: m.id };
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const p = pnrSchema.safeParse(pnrUitPad((await params).personeelsnummer));
  if (!p.success) return apiFout(422, 'ongeldig_personeelsnummer', 'Dit personeelsnummer heeft geen geldige vorm.', zodDetails(p.error));
  return metApi(req, 'medewerkers:schrijven', async (ctx) => {
    const body = await leesJson(req);
    if (body == null) return { status: 400, body: { fout: { code: 'geen_json', bericht: 'Stuur een JSON-body mee (Content-Type: application/json).' } }, actie: 'wijzigen' };
    const v = wijzigSchema.safeParse(body);
    if (!v.success) {
      return { status: 422, body: { fout: { code: 'ongeldige_invoer', bericht: 'Niet alle velden kloppen.', details: zodDetails(v.error) } }, actie: 'wijzigen' };
    }
    const res = await wijzigMedewerker(ctx.organisatieId, p.data, v.data, 'api');
    if ('fout' in res) {
      return {
        status: res.nietGevonden ? 404 : 409,
        body: { fout: { code: res.nietGevonden ? 'niet_gevonden' : 'conflict', bericht: res.fout } },
        actie: 'wijzigen',
      };
    }
    return {
      status: 200,
      body: uitkomstJson(res),
      actie: 'wijzigen',
      medewerkerId: res.medewerker.id,
      details: { resultaat: res.resultaat, personeelsnummer: p.data, velden: Object.keys(v.data) },
      audit: res.resultaat !== 'ongewijzigd',
    };
  });
}
