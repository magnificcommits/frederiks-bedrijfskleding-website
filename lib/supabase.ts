import { env, isLeadsDbConfigured } from '@/lib/env';

/**
 * Lichte Supabase-laag zonder extra npm-package: we praten rechtstreeks met
 * de REST-API (PostgREST) met de server-side service-role key. Zonder
 * configuratie doen alle functies niets, zodat preview/lokaal blijft werken.
 * De service-role key komt NOOIT in client-code; dit bestand draait server-side.
 */

export type Lead = {
  id: string;
  created_at: string;
  name: string;
  company?: string | null;
  email: string;
  phone?: string | null;
  branche?: string | null;
  aantal?: string | null;
  bericht?: string | null;
  bron?: string | null;
  status: string;
  offertewaarde?: number | null;
  notitie?: string | null;
};

/** Herkomst en ingang (migratie 20261006_weblead_inname). Zonder die migratie worden ze weggelaten. */
export type LeadHerkomstVelden = {
  bron_kanaal?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  gclid?: string | null;
  referrer?: string | null;
  landingspagina?: string | null;
  conversiepagina?: string | null;
  paginas_bekeken?: number | null;
  bezochte_paden?: { p: string; s: number }[] | null;
  eerste_bezoek_op?: string | null;
  bezoeken?: number | null;
};

export type NieuweLead = Omit<Lead, 'id' | 'created_at' | 'status' | 'offertewaarde' | 'notitie'> & { status?: string } & LeadHerkomstVelden;

const HERKOMST_KOLOMMEN: (keyof LeadHerkomstVelden)[] = [
  'bron_kanaal', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid',
  'referrer', 'landingspagina', 'conversiepagina', 'paginas_bekeken', 'bezochte_paden', 'eerste_bezoek_op', 'bezoeken',
];

function headers() {
  return {
    apikey: env.supabaseServiceKey,
    Authorization: `Bearer ${env.supabaseServiceKey}`,
    'Content-Type': 'application/json',
  };
}

const base = () => `${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/leads`;

export type SaveLeadUitkomst = { saved: boolean; id?: string; fout?: string };

async function postLead(rij: Record<string, unknown>): Promise<{ ok: boolean; status: number; id?: string; tekst: string }> {
  const res = await fetch(`${base()}?select=id`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=representation' },
    body: JSON.stringify(rij),
    cache: 'no-store',
  });
  const tekst = await res.text().catch(() => '');
  if (!res.ok) return { ok: false, status: res.status, tekst };
  try {
    const data = JSON.parse(tekst) as { id?: string }[] | { id?: string };
    const id = Array.isArray(data) ? data[0]?.id : data?.id;
    return { ok: true, status: res.status, id: id ?? undefined, tekst };
  } catch {
    return { ok: true, status: res.status, tekst };
  }
}

/**
 * Lead opslaan met de service-role key. Faalt nooit stil: elke fout komt in de
 * serverlog en gaat terug naar de aanroeper (die dan in de mail waarschuwt).
 * Ontbreekt een nieuwe kolom (migratie nog niet gedraaid), dan nogmaals zonder.
 */
export async function saveLead(lead: NieuweLead): Promise<SaveLeadUitkomst> {
  if (!isLeadsDbConfigured) return { saved: false, fout: 'Leaddatabase niet gekoppeld (SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt).' };
  const rij: Record<string, unknown> = { status: 'nieuw', ...lead };
  for (const [k, v] of Object.entries(rij)) if (v === undefined) delete rij[k];
  try {
    let r = await postLead(rij);
    // PGRST204 = kolom bestaat niet; 42703 = idem in Postgres.
    if (!r.ok && /PGRST204|42703|column/i.test(r.tekst)) {
      console.error('[lead] opslaan met herkomstvelden mislukt, nogmaals zonder:', r.status, r.tekst.slice(0, 300));
      const oud = { ...rij };
      for (const k of HERKOMST_KOLOMMEN) delete oud[k];
      r = await postLead(oud);
    }
    // 23514 = check-constraint. Een nieuwe ingang (bv. 'afspraak') die de database nog
    // niet kent: dan opslaan zonder bron_kanaal, de lead zelf mag niet verloren gaan.
    if (!r.ok && /23514|bron_kanaal_chk/.test(r.tekst) && 'bron_kanaal' in rij) {
      console.error('[lead] bron_kanaal geweigerd, nogmaals zonder:', rij.bron_kanaal, r.tekst.slice(0, 200));
      const zonder = { ...rij };
      delete zonder.bron_kanaal;
      r = await postLead(zonder);
    }
    if (!r.ok) {
      console.error('[lead] opslaan mislukt:', r.status, r.tekst.slice(0, 500));
      return { saved: false, fout: `Database gaf ${r.status}: ${r.tekst.slice(0, 200)}` };
    }
    return { saved: true, id: r.id };
  } catch (e) {
    console.error('[lead] opslaan mislukt (netwerk):', e);
    return { saved: false, fout: e instanceof Error ? e.message : 'Onbekende fout' };
  }
}

export async function getLeads(): Promise<Lead[]> {
  if (!isLeadsDbConfigured) return [];
  try {
    const res = await fetch(`${base()}?select=*&order=created_at.desc&limit=1000`, {
      headers: headers(),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return (await res.json()) as Lead[];
  } catch {
    return [];
  }
}

type LeadPatch = { status?: string; offertewaarde?: number | null; notitie?: string | null };

export async function updateLead(id: string, patch: LeadPatch): Promise<boolean> {
  if (!isLeadsDbConfigured) return false;
  try {
    const res = await fetch(`${base()}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}
