/**
 * Database-toegang voor nieuwsbrieven, templates en modules.
 * Alleen server-side gebruiken, altijd achter dashAuthed() (service-role).
 */
import { kmsAdmin } from '@/lib/kms/adminClient';
import { env } from '@/lib/env';
import { normaliseerDoelgroep, type Doelgroep } from '@/lib/kms/nieuwsbrief';
import { BASIS_TEMPLATE_NAAM, FOOTER_MODULE_NAAM, HEADER_MODULE_NAAM, basisOntwerp, footerSectie, headerSectie } from './basis';
import { normaliseerOntwerp, normaliseerSectie } from './valideer';
import type { Module, Ontwerp } from './types';

export const NIEUWSBRIEF_STATUSSEN = ['concept', 'gepland', 'verzenden', 'verzonden', 'mislukt'] as const;
export type NieuwsbriefStatus = (typeof NIEUWSBRIEF_STATUSSEN)[number];

export const STATUS_LABEL: Record<NieuwsbriefStatus, string> = {
  concept: 'Concept',
  gepland: 'Ingepland',
  verzenden: 'Wordt verstuurd',
  verzonden: 'Verzonden',
  mislukt: 'Mislukt',
};

/** Een nieuwsbrief zonder het (zware) ontwerp, voor lijsten. */
export type NieuwsbriefKop = {
  id: string;
  naam: string;
  onderwerp: string | null;
  preheader: string | null;
  afzender_naam: string | null;
  is_template: boolean;
  status: NieuwsbriefStatus;
  doelgroep: Doelgroep;
  gepland_op: string | null;
  verzonden_op: string | null;
  aantal_ontvangers: number | null;
  aantal_verzonden: number;
  aantal_fouten: number;
  web_token: string;
  created_at: string;
  updated_at: string;
};

export type Nieuwsbrief = NieuwsbriefKop & { ontwerp: Ontwerp };

const KOP_VELDEN =
  'id, naam, onderwerp, preheader, afzender_naam, is_template, status, doelgroep, gepland_op, verzonden_op, aantal_ontvangers, aantal_verzonden, aantal_fouten, web_token, created_at, updated_at';

type RuweKop = Omit<NieuwsbriefKop, 'doelgroep' | 'status'> & { doelgroep: unknown; status: string };

function naarKop(r: RuweKop): NieuwsbriefKop {
  return {
    ...r,
    status: (NIEUWSBRIEF_STATUSSEN as readonly string[]).includes(r.status) ? (r.status as NieuwsbriefStatus) : 'concept',
    doelgroep: normaliseerDoelgroep(r.doelgroep),
    aantal_verzonden: r.aantal_verzonden ?? 0,
    aantal_fouten: r.aantal_fouten ?? 0,
  };
}

/** Standaard afzendernaam als er niets is ingevuld. */
export const STANDAARD_AFZENDER = 'Frederiks Bedrijfskleding';

export function siteUrl(): string {
  return env.siteUrl.replace(/\/$/, '');
}

export function webversieUrl(token: string): string {
  return `${siteUrl()}/nieuwsbrief/${encodeURIComponent(token)}`;
}

export async function listNieuwsbrieven(): Promise<NieuwsbriefKop[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('nieuwsbrieven').select(KOP_VELDEN).order('updated_at', { ascending: false }).limit(500);
  return ((data as RuweKop[]) ?? []).map(naarKop);
}

export async function getNieuwsbrief(id: string): Promise<Nieuwsbrief | null> {
  const sb = kmsAdmin();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await sb.from('nieuwsbrieven').select(`${KOP_VELDEN}, ontwerp`).eq('id', id).maybeSingle();
  if (!data) return null;
  const r = data as RuweKop & { ontwerp: unknown };
  return { ...naarKop(r), ontwerp: normaliseerOntwerp(r.ontwerp) };
}

export async function getNieuwsbriefOpToken(token: string): Promise<Nieuwsbrief | null> {
  const sb = kmsAdmin();
  if (!sb || !/^[A-Za-z0-9_-]{8,80}$/.test(token)) return null;
  const { data } = await sb.from('nieuwsbrieven').select(`${KOP_VELDEN}, ontwerp`).eq('web_token', token).maybeSingle();
  if (!data) return null;
  const r = data as RuweKop & { ontwerp: unknown };
  return { ...naarKop(r), ontwerp: normaliseerOntwerp(r.ontwerp) };
}

/**
 * Zorgt dat de basistemplate en de standaardmodules bestaan. Veilig om vaak
 * aan te roepen: maakt alleen iets aan als er nog geen template is, en de
 * modules alleen als die tabel nog helemaal leeg is.
 * Geeft het id van de (eerste) template terug.
 */
export async function ensureBasisTemplate(): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb) return null;

  const { data: modules, error: modFout } = await sb.from('nieuwsbrief_modules').select('id').limit(1);
  if (!modFout && (modules ?? []).length === 0) {
    await sb.from('nieuwsbrief_modules').insert([
      { naam: HEADER_MODULE_NAAM, sectie: headerSectie() },
      { naam: FOOTER_MODULE_NAAM, sectie: footerSectie() },
    ]);
  }

  const { data: bestaand } = await sb
    .from('nieuwsbrieven')
    .select('id')
    .eq('is_template', true)
    .order('created_at', { ascending: true })
    .limit(1);
  const eerste = (bestaand as { id: string }[] | null)?.[0];
  if (eerste) return eerste.id;

  const { data, error } = await sb
    .from('nieuwsbrieven')
    .insert({
      naam: BASIS_TEMPLATE_NAAM,
      onderwerp: 'Nieuws van Frederiks Bedrijfskleding',
      preheader: 'Nieuwe artikelen, tips en wat er speelt bij Frederiks Bedrijfskleding.',
      afzender_naam: STANDAARD_AFZENDER,
      ontwerp: basisOntwerp(siteUrl()),
      is_template: true,
      status: 'concept',
      doelgroep: { soort: 'alle', branches: [] },
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Nieuwe nieuwsbrief als kopie van een bestaande brief of template. Zonder
 * bron wordt de (eerste) basistemplate gebruikt.
 */
export async function maakNieuwsbrief(opties: { vanId?: string | null; naam?: string | null; alsTemplate?: boolean }): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb) return null;

  let bronId = opties.vanId || null;
  if (!bronId) bronId = await ensureBasisTemplate();
  const bron = bronId ? await getNieuwsbrief(bronId) : null;

  const datum = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date());
  const naam =
    opties.naam?.trim() ||
    (opties.alsTemplate ? `${bron?.naam ?? 'Template'} (kopie)` : bron && !bron.is_template ? `${bron.naam} (kopie)` : `Nieuwsbrief ${datum}`);

  const { data, error } = await sb
    .from('nieuwsbrieven')
    .insert({
      naam: naam.slice(0, 200),
      onderwerp: bron?.onderwerp ?? null,
      preheader: bron?.preheader ?? null,
      afzender_naam: bron?.afzender_naam || STANDAARD_AFZENDER,
      ontwerp: bron?.ontwerp ?? basisOntwerp(siteUrl()),
      is_template: Boolean(opties.alsTemplate),
      status: 'concept',
      doelgroep: bron?.doelgroep ?? { soort: 'alle', branches: [] },
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function listModules(): Promise<Module[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('nieuwsbrief_modules').select('id, naam, sectie').order('naam');
  return ((data as { id: string; naam: string; sectie: unknown }[]) ?? [])
    .map((r) => {
      const sectie = normaliseerSectie(r.sectie);
      return sectie ? { id: r.id, naam: r.naam, sectie } : null;
    })
    .filter((m): m is Module => m !== null);
}

export type OntvangerRegel = {
  id: string;
  email: string;
  naam: string | null;
  status: 'wachtrij' | 'verzonden' | 'fout' | 'overgeslagen';
  fout: string | null;
  verzonden_op: string | null;
};

/** Ontvangers van een brief, fouten eerst. Voor het resultatenoverzicht. */
export async function listOntvangers(nieuwsbriefId: string, limiet = 1000): Promise<OntvangerRegel[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('nieuwsbrief_ontvangers')
    .select('id, email, naam, status, fout, verzonden_op')
    .eq('nieuwsbrief_id', nieuwsbriefId)
    .order('email')
    .limit(limiet);
  const volgorde: Record<string, number> = { fout: 0, wachtrij: 1, overgeslagen: 2, verzonden: 3 };
  return ((data as OntvangerRegel[]) ?? []).sort((a, b) => (volgorde[a.status] ?? 9) - (volgorde[b.status] ?? 9));
}
