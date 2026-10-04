import { createHash, randomBytes } from 'node:crypto';
import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * API-sleutels per klantorganisatie, voor de open API onder /api/v1.
 *
 * Een sleutel ziet eruit als `fb_live_` + 32 willekeurige tekens (192 bits). We bewaren
 * alleen de SHA-256-hash en de laatste 4 tekens. Een snelle hash is hier genoeg: de
 * sleutel is lang en willekeurig, dus raden of terugrekenen is niet te doen. Na het
 * aanmaken laten we hem één keer zien; kwijt is kwijt, dan maak je een nieuwe.
 *
 * Tabel api_sleutels heeft RLS aan zonder policies: alles via kmsAdmin() (service role).
 * Alleen server-side gebruiken.
 */

export const SLEUTEL_PREFIX = 'fb_live_';
const SLEUTEL_PATROON = /^fb_live_[A-Za-z0-9_-]{24,64}$/;

export const API_SCOPES = ['medewerkers:lezen', 'medewerkers:schrijven'] as const;
export type ApiScope = (typeof API_SCOPES)[number];
export const SCOPE_LABEL: Record<ApiScope, string> = {
  'medewerkers:lezen': 'Medewerkers lezen',
  'medewerkers:schrijven': 'Medewerkers in en uit dienst melden',
};

export type ApiSleutel = {
  id: string;
  organisatie_id: string;
  naam: string;
  laatste4: string;
  scopes: ApiScope[];
  aangemaakt_door: string | null;
  created_at: string;
  laatst_gebruikt: string | null;
  ingetrokken_op: string | null;
};

const KOLOMMEN = 'id, organisatie_id, naam, laatste4, scopes, aangemaakt_door, created_at, laatst_gebruikt, ingetrokken_op';

export function hashSleutel(sleutel: string): string {
  return createHash('sha256').update(sleutel, 'utf8').digest('hex');
}

export function heeftSleutelVorm(sleutel: string): boolean {
  return SLEUTEL_PATROON.test(sleutel);
}

function schoneScopes(v: unknown): ApiScope[] {
  if (!Array.isArray(v)) return [...API_SCOPES];
  const lijst = v.filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(String(s)));
  return lijst.length ? lijst : [...API_SCOPES];
}

function naarSleutel(r: Record<string, unknown>): ApiSleutel {
  return {
    id: String(r.id),
    organisatie_id: String(r.organisatie_id),
    naam: String(r.naam ?? ''),
    laatste4: String(r.laatste4 ?? ''),
    scopes: schoneScopes(r.scopes),
    aangemaakt_door: (r.aangemaakt_door as string) ?? null,
    created_at: String(r.created_at),
    laatst_gebruikt: (r.laatst_gebruikt as string) ?? null,
    ingetrokken_op: (r.ingetrokken_op as string) ?? null,
  };
}

/** Alle sleutels van een klant, actieve eerst, nieuwste bovenaan. Leeg als de tabel nog niet bestaat. */
export async function listSleutels(organisatieId: string): Promise<ApiSleutel[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('api_sleutels')
    .select(KOLOMMEN)
    .eq('organisatie_id', organisatieId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return ((data as Record<string, unknown>[]) ?? [])
    .map(naarSleutel)
    .sort((a, b) => Number(!!a.ingetrokken_op) - Number(!!b.ingetrokken_op));
}

/**
 * Maakt een nieuwe sleutel. Geeft de volledige sleutel ÉÉN keer terug; daarna is
 * alleen nog de hash bekend.
 */
export async function maakSleutel(input: {
  organisatieId: string;
  naam: string;
  scopes?: ApiScope[];
  door: string | null;
}): Promise<{ sleutel: string; rij: ApiSleutel } | { fout: string }> {
  const sb = kmsAdmin();
  if (!sb) return { fout: 'Database niet bereikbaar.' };
  const naam = input.naam.trim().slice(0, 80);
  if (!naam) return { fout: 'Geef de sleutel een naam, bijvoorbeeld het HR-systeem dat hem gebruikt.' };
  const sleutel = SLEUTEL_PREFIX + randomBytes(24).toString('base64url');
  const { data, error } = await sb
    .from('api_sleutels')
    .insert({
      organisatie_id: input.organisatieId,
      naam,
      hash: hashSleutel(sleutel),
      laatste4: sleutel.slice(-4),
      scopes: schoneScopes(input.scopes),
      aangemaakt_door: input.door,
    })
    .select(KOLOMMEN)
    .single();
  if (error || !data) return { fout: 'De sleutel kon niet worden opgeslagen. Is de databasemigratie gedraaid?' };
  return { sleutel, rij: naarSleutel(data as Record<string, unknown>) };
}

/** Trekt een sleutel in (blijft staan voor het logboek). Alleen binnen de opgegeven klant. */
export async function trekSleutelIn(id: string, organisatieId: string): Promise<ApiSleutel | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('api_sleutels')
    .update({ ingetrokken_op: new Date().toISOString() })
    .eq('id', id)
    .eq('organisatie_id', organisatieId)
    .is('ingetrokken_op', null)
    .select(KOLOMMEN)
    .maybeSingle();
  if (error || !data) return null;
  return naarSleutel(data as Record<string, unknown>);
}

/** Zoekt een geldige (niet ingetrokken) sleutel op basis van de platte tekst. */
export async function vindSleutel(sleutel: string): Promise<(ApiSleutel & { organisatie_naam: string | null }) | null> {
  if (!heeftSleutelVorm(sleutel)) return null;
  const sb = kmsAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from('api_sleutels')
    .select(`${KOLOMMEN}, organisaties(naam)`)
    .eq('hash', hashSleutel(sleutel))
    .is('ingetrokken_op', null)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as unknown as Record<string, unknown> & { organisaties?: { naam: string } | { naam: string }[] | null };
  const org = Array.isArray(r.organisaties) ? r.organisaties[0] : r.organisaties;
  return { ...naarSleutel(r), organisatie_naam: org?.naam ?? null };
}

/** Werkt "laatst gebruikt" bij. Faalt stil. */
export async function markeerGebruikt(id: string): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  try {
    await sb.from('api_sleutels').update({ laatst_gebruikt: new Date().toISOString() }).eq('id', id);
  } catch {
    // Bewust stil.
  }
}

export type ApiLogRegel = {
  id: string;
  sleutel_id: string | null;
  methode: string | null;
  pad: string | null;
  status: number | null;
  actie: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

/** Laatste verzoeken en importen voor een klant (nieuwste eerst). */
export async function listApiLog(organisatieId: string, limiet = 15): Promise<ApiLogRegel[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('api_log')
    .select('id, sleutel_id, methode, pad, status, actie, details, created_at')
    .eq('organisatie_id', organisatieId)
    .order('created_at', { ascending: false })
    .limit(limiet);
  if (error) return [];
  return (data as ApiLogRegel[]) ?? [];
}

/** Schrijft een regel in api_log. Faalt stil: loggen mag een verzoek nooit laten mislukken. */
export async function schrijfApiLog(regel: {
  sleutelId?: string | null;
  organisatieId?: string | null;
  methode?: string | null;
  pad?: string | null;
  status?: number | null;
  actie?: string | null;
  medewerkerId?: string | null;
  details?: Record<string, unknown> | null;
}): Promise<void> {
  const sb = kmsAdmin();
  if (!sb) return;
  try {
    await sb.from('api_log').insert({
      sleutel_id: regel.sleutelId ?? null,
      organisatie_id: regel.organisatieId ?? null,
      methode: regel.methode ?? null,
      pad: regel.pad ? regel.pad.slice(0, 300) : null,
      status: regel.status ?? null,
      actie: regel.actie ?? null,
      medewerker_id: regel.medewerkerId ?? null,
      details: regel.details ?? null,
    });
  } catch {
    // Bewust stil.
  }
}

/** Aantal verzoeken van een sleutel sinds een tijdstip (voor de rate limit over meerdere servers). */
export async function telVerzoeken(sleutelId: string, sinds: Date): Promise<number | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const { count, error } = await sb
    .from('api_log')
    .select('id', { count: 'exact', head: true })
    .eq('sleutel_id', sleutelId)
    .gte('created_at', sinds.toISOString());
  if (error) return null;
  return count ?? 0;
}
