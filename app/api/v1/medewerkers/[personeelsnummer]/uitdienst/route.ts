import { apiFout, leesJson, metApi, zodDetails } from '@/lib/api/v1';
import { pnrSchema, pnrUitPad, uitDienstSchema, uitkomstJson } from '@/lib/api/medewerkers';
import { maakHrTaken, meldUitDienst } from '@/lib/kms/hrKoppeling';

/**
 * POST /api/v1/medewerkers/{personeelsnummer}/uitdienst
 * Body (optioneel): { "einddatum": "2026-12-31" }. Zonder einddatum: vandaag.
 * De medewerker blijft bestaan en krijgt de status uit dienst (of uit_dienst_gepland).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ personeelsnummer: string }> };

export async function POST(req: Request, { params }: Params) {
  const p = pnrSchema.safeParse(pnrUitPad((await params).personeelsnummer));
  if (!p.success) return apiFout(422, 'ongeldig_personeelsnummer', 'Dit personeelsnummer heeft geen geldige vorm.', zodDetails(p.error));
  return metApi(req, 'medewerkers:schrijven', async (ctx) => {
    const body = (await leesJson(req)) ?? {};
    const v = uitDienstSchema.safeParse(body);
    if (!v.success) {
      return { status: 422, body: { fout: { code: 'ongeldige_invoer', bericht: 'Niet alle velden kloppen.', details: zodDetails(v.error) } }, actie: 'uit_dienst' };
    }
    const res = await meldUitDienst(ctx.organisatieId, { personeelsnummer: p.data }, v.data.einddatum ?? null, 'api');
    if ('fout' in res) {
      return {
        status: res.nietGevonden ? 404 : 409,
        body: { fout: { code: res.nietGevonden ? 'niet_gevonden' : 'conflict', bericht: res.fout } },
        actie: 'uit_dienst',
      };
    }
    if (res.nieuwUitDienst) {
      await maakHrTaken({
        organisatieId: ctx.organisatieId,
        klantNaam: ctx.organisatieNaam,
        inDienst: [],
        uitDienst: [res.medewerker],
        bronTekst: `de HR-koppeling (${ctx.sleutelNaam})`,
      });
    }
    return {
      status: 200,
      body: uitkomstJson(res),
      actie: 'uit_dienst',
      medewerkerId: res.medewerker.id,
      details: { resultaat: res.resultaat, personeelsnummer: p.data, einddatum: res.medewerker.einddatum },
      audit: res.resultaat !== 'ongewijzigd',
    };
  });
}
