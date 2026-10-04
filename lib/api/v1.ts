import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import { logAudit } from '@/lib/kms/audit';
import { verwerkVerlopenUitDienst } from '@/lib/kms/hrKoppeling';
import { clientIp, rateLimit } from '@/lib/ratelimit';
import { markeerGebruikt, schrijfApiLog, telVerzoeken, vindSleutel, type ApiScope } from './sleutels';

/**
 * Gedeelde afhandeling voor de open API onder /api/v1:
 * - authenticatie met `Authorization: Bearer fb_live_...` (sleutel per klantorganisatie);
 * - scope-controle;
 * - rate limit: per sleutel 60 verzoeken per minuut (in het geheugen én over alle
 *   servers heen via de tabel api_log);
 * - nette JSON-fouten in één vorm: { "fout": { "code", "bericht", "details"? } };
 * - elk verzoek in api_log, schrijfacties ook in het audit-logboek.
 */

export const API_LIMIET_PER_MINUUT = 60;
const MINUUT = 60_000;

export type ApiContext = {
  sleutelId: string;
  sleutelNaam: string;
  laatste4: string;
  organisatieId: string;
  organisatieNaam: string;
  scopes: ApiScope[];
};

export type ApiAntwoord = {
  status: number;
  body: unknown;
  /** Voor het logboek: wat er gebeurde (bv. 'in_dienst', 'uit_dienst'). */
  actie?: string;
  medewerkerId?: string | null;
  details?: Record<string, unknown>;
  /** Schrijfactie: ook in audit_log. */
  audit?: boolean;
};

const BASIS_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function apiFout(status: number, code: string, bericht: string, details?: unknown, extraHeaders?: Record<string, string>) {
  return NextResponse.json(
    { fout: { code, bericht, ...(details !== undefined ? { details } : {}) } },
    { status, headers: { ...BASIS_HEADERS, ...(extraHeaders ?? {}) } },
  );
}

/** Zod-fouten als lijst { veld, bericht } in gewone taal. */
export function zodDetails(e: ZodError): { veld: string; bericht: string }[] {
  return e.issues.map((i) => ({ veld: i.path.join('.') || '(body)', bericht: i.message }));
}

/** Leest de JSON-body; null bij lege of ongeldige JSON. */
export async function leesJson(req: Request): Promise<unknown | null> {
  const tekst = await req.text().catch(() => '');
  if (!tekst.trim()) return null;
  if (tekst.length > 64_000) return null;
  try {
    return JSON.parse(tekst);
  } catch {
    return null;
  }
}

function sleutelUitHeader(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

/**
 * Wikkelt een route-handler: authenticatie, scope, rate limit, logboek. De handler
 * geeft een ApiAntwoord terug; fouten binnen de handler worden een 500 met een nette melding.
 */
export async function metApi(req: Request, scope: ApiScope, handler: (ctx: ApiContext) => Promise<ApiAntwoord>): Promise<NextResponse> {
  const pad = new URL(req.url).pathname;
  const ip = clientIp(req);

  const plat = sleutelUitHeader(req);
  if (!plat) {
    if (!rateLimit(`api-anon:${ip}`, 30, MINUUT)) return apiFout(429, 'te_veel_verzoeken', 'Te veel verzoeken zonder geldige sleutel. Wacht een minuut.', undefined, { 'Retry-After': '60' });
    return apiFout(401, 'geen_sleutel', 'Stuur je API-sleutel mee in de header: Authorization: Bearer fb_live_...', undefined, { 'WWW-Authenticate': 'Bearer' });
  }
  const sleutel = await vindSleutel(plat);
  if (!sleutel) {
    // Raden afremmen: per IP maximaal 30 mislukte pogingen per minuut.
    if (!rateLimit(`api-fout:${ip}`, 30, MINUUT)) return apiFout(429, 'te_veel_verzoeken', 'Te veel mislukte pogingen. Wacht een minuut.', undefined, { 'Retry-After': '60' });
    return apiFout(401, 'ongeldige_sleutel', 'Deze API-sleutel bestaat niet of is ingetrokken.', undefined, { 'WWW-Authenticate': 'Bearer error="invalid_token"' });
  }

  const ctx: ApiContext = {
    sleutelId: sleutel.id,
    sleutelNaam: sleutel.naam,
    laatste4: sleutel.laatste4,
    organisatieId: sleutel.organisatie_id,
    organisatieNaam: sleutel.organisatie_naam ?? 'Klant',
    scopes: sleutel.scopes,
  };
  const log = (status: number, extra?: Partial<ApiAntwoord>) =>
    schrijfApiLog({
      sleutelId: ctx.sleutelId,
      organisatieId: ctx.organisatieId,
      methode: req.method,
      pad,
      status,
      actie: extra?.actie ?? null,
      medewerkerId: extra?.medewerkerId ?? null,
      details: extra?.details ?? null,
    });

  // Rate limit: eerst het geheugen (snel), dan de database (telt over alle servers).
  const limietHeaders = { 'X-RateLimit-Limit': String(API_LIMIET_PER_MINUUT) };
  if (!rateLimit(`api:${ctx.sleutelId}`, API_LIMIET_PER_MINUUT, MINUUT)) {
    return apiFout(429, 'te_veel_verzoeken', `Maximaal ${API_LIMIET_PER_MINUUT} verzoeken per minuut per sleutel. Probeer het over een minuut opnieuw.`, undefined, { ...limietHeaders, 'Retry-After': '60' });
  }
  const recent = await telVerzoeken(ctx.sleutelId, new Date(Date.now() - MINUUT));
  if (recent != null && recent >= API_LIMIET_PER_MINUUT) {
    return apiFout(429, 'te_veel_verzoeken', `Maximaal ${API_LIMIET_PER_MINUUT} verzoeken per minuut per sleutel. Probeer het over een minuut opnieuw.`, undefined, { ...limietHeaders, 'Retry-After': '60' });
  }
  const resterend = recent != null ? Math.max(0, API_LIMIET_PER_MINUUT - recent - 1) : null;

  if (!ctx.scopes.includes(scope)) {
    await log(403, { actie: 'geweigerd', details: { scope } });
    return apiFout(403, 'geen_toegang', `Deze sleutel mag dit niet (nodig: ${scope}).`);
  }

  await Promise.all([markeerGebruikt(ctx.sleutelId), verwerkVerlopenUitDienst(ctx.organisatieId)]);

  let antwoord: ApiAntwoord;
  try {
    antwoord = await handler(ctx);
  } catch {
    await log(500, { actie: 'fout' });
    return apiFout(500, 'serverfout', 'Er ging iets mis aan onze kant. Probeer het later opnieuw; blijft het misgaan, neem dan contact op.');
  }

  await log(antwoord.status, antwoord);
  if (antwoord.audit && antwoord.status < 400) {
    await logAudit(`api_${antwoord.actie ?? 'wijziging'}`, {
      entiteit: 'medewerker',
      entiteitId: antwoord.medewerkerId ?? undefined,
      actor: `api: ${ctx.sleutelNaam} (…${ctx.laatste4})`,
      details: { organisatie_id: ctx.organisatieId, klant: ctx.organisatieNaam, ...(antwoord.details ?? {}) },
    });
  }
  return NextResponse.json(antwoord.body, {
    status: antwoord.status,
    headers: { ...BASIS_HEADERS, ...limietHeaders, ...(resterend != null ? { 'X-RateLimit-Remaining': String(resterend) } : {}) },
  });
}
