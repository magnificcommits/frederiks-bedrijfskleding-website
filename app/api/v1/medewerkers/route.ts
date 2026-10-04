import { apiFout, leesJson, metApi, zodDetails } from '@/lib/api/v1';
import { inDienstSchema, lijstQuerySchema, medewerkerJson, uitkomstJson } from '@/lib/api/medewerkers';
import { listHrMedewerkers, maakHrTaken, meldInDienst } from '@/lib/kms/hrKoppeling';

/**
 * GET  /api/v1/medewerkers  lijst van de medewerkers van de klant achter de sleutel.
 * POST /api/v1/medewerkers  nieuwe medewerker in dienst (idempotent op personeelsnummer of e-mail).
 * Documentatie: /dashboard/instellingen/api en docs/api-v1.md.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const q = lijstQuerySchema.safeParse(params);
  if (!q.success) return apiFout(422, 'ongeldige_parameters', 'Controleer de parameters in de URL.', zodDetails(q.error));

  return metApi(req, 'medewerkers:lezen', async (ctx) => {
    const alle = await listHrMedewerkers(ctx.organisatieId);
    const sinds = q.data.gewijzigd_sinds ? new Date(q.data.gewijzigd_sinds).getTime() : null;
    const gefilterd = alle.filter(
      (m) =>
        (q.data.status === 'alle' || (q.data.status === 'uit_dienst' ? m.status === 'uit_dienst' : m.status !== 'uit_dienst')) &&
        (sinds == null || (m.bijgewerkt_op != null && new Date(m.bijgewerkt_op).getTime() >= sinds)),
    );
    const pagina = gefilterd.slice(q.data.offset, q.data.offset + q.data.limit);
    return {
      status: 200,
      body: {
        data: pagina.map(medewerkerJson),
        totaal: gefilterd.length,
        limit: q.data.limit,
        offset: q.data.offset,
      },
      actie: 'lijst',
      details: { aantal: pagina.length },
    };
  });
}

export async function POST(req: Request) {
  return metApi(req, 'medewerkers:schrijven', async (ctx) => {
    const body = await leesJson(req);
    if (body == null) return { status: 400, body: { fout: { code: 'geen_json', bericht: 'Stuur een JSON-body mee (Content-Type: application/json).' } }, actie: 'in_dienst' };
    const v = inDienstSchema.safeParse(body);
    if (!v.success) {
      return { status: 422, body: { fout: { code: 'ongeldige_invoer', bericht: 'Niet alle velden kloppen.', details: zodDetails(v.error) } }, actie: 'in_dienst' };
    }
    const res = await meldInDienst(ctx.organisatieId, v.data, 'api');
    if ('fout' in res) return { status: 409, body: { fout: { code: 'conflict', bericht: res.fout } }, actie: 'in_dienst' };
    if (res.nieuwInDienst) {
      await maakHrTaken({
        organisatieId: ctx.organisatieId,
        klantNaam: ctx.organisatieNaam,
        inDienst: [res.medewerker],
        uitDienst: [],
        bronTekst: `de HR-koppeling (${ctx.sleutelNaam})`,
      });
    }
    return {
      status: res.resultaat === 'aangemaakt' ? 201 : 200,
      body: uitkomstJson(res),
      actie: 'in_dienst',
      medewerkerId: res.medewerker.id,
      details: { resultaat: res.resultaat, personeelsnummer: res.medewerker.personeelsnummer, naam: res.medewerker.naam },
      audit: res.resultaat !== 'ongewijzigd',
    };
  });
}
