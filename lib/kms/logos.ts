import { kmsAdmin } from '@/lib/kms/adminClient';
import { downloadUrl } from '@/lib/kms/storage';

/**
 * Data-access voor de module Bedrukken/Borduren.
 * Logobibliotheek per klant plus de decoraties per orderregel (werkbon).
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type Logo = {
  id: string;
  organisatie_id: string;
  naam: string;
  logo_bestand_url: string | null;
  vectorbestand_url: string | null;
  borduurbestand_url: string | null;
  /**
   * De bestandsnaam zoals Jessi hem aanleverde. De opslagnaam in de bucket is
   * gegenereerd om botsingen te voorkomen; deze kolom houdt de herkenbare naam
   * vast zodat een download weer 'Logo Garage Jansen.pdf' heet.
   */
  logo_bestand_naam: string | null;
  vectorbestand_naam: string | null;
  borduurbestand_naam: string | null;
  opmerkingen: string | null;
  created_at: string;
};

export type LogoVelden = {
  naam: string;
  logo_bestand_url?: string | null;
  vectorbestand_url?: string | null;
  borduurbestand_url?: string | null;
  logo_bestand_naam?: string | null;
  vectorbestand_naam?: string | null;
  borduurbestand_naam?: string | null;
  opmerkingen?: string | null;
};

export type BestandSoort = 'afbeelding' | 'pdf' | 'overig';

/** Alleen wat een browser rechtstreeks als plaatje kan tonen. */
const AFBEELDING_EXTENSIES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'];

/** Extensie uit één bron, zonder punt en in kleine letters. Leeg als er geen is. */
function extensieUit(bron: string | null | undefined): string {
  const zonderQuery = ((bron ?? '').split('?')[0] ?? '').split('#')[0] ?? '';
  const laatste = zonderQuery.split('/').pop() ?? '';
  const punt = laatste.lastIndexOf('.');
  return punt > 0 ? laatste.slice(punt + 1).toLowerCase() : '';
}

/**
 * Extensie uit de bewaarde naam, met de opslag-URL als terugval. Die terugval is
 * nodig omdat iemand een bestand best 'logo' zonder punt kan noemen: dan weet
 * alleen de opslagnaam nog dat het om een pdf gaat en blijft de preview werken.
 */
export function bestandExtensie(url: string | null, bestandsnaam?: string | null): string {
  return extensieUit(bestandsnaam?.trim()) || extensieUit(url);
}

/**
 * Waar het bestand in de lijst mee getoond kan worden. Een borduurbestand (.dst,
 * .emb) valt bewust onder 'overig': daar bestaat geen preview voor, dus dan tonen
 * we een blokje met de extensie.
 */
export function bestandSoort(url: string | null, bestandsnaam?: string | null): BestandSoort {
  const ext = bestandExtensie(url, bestandsnaam);
  if (ext === 'pdf') return 'pdf';
  if (AFBEELDING_EXTENSIES.includes(ext)) return 'afbeelding';
  return 'overig';
}

export type LogoBestand = {
  sleutel: 'logo' | 'vector' | 'borduur';
  label: string;
  /** Voor tonen en openen in een nieuw tabblad. */
  url: string;
  /** Voor downloaden onder de originele naam. */
  downloadHref: string;
  /** Wat we onder de preview zetten; valt terug op de opslagnaam. */
  weergaveNaam: string;
  soort: BestandSoort;
  extensie: string;
};

/** Laatste stukje van een URL als leesbare naam, voor rijen zonder bewaarde naam. */
function naamUitUrl(url: string): string {
  const zonderQuery = (url.split('?')[0] ?? '').split('#')[0] ?? '';
  const laatste = zonderQuery.split('/').pop() ?? '';
  try {
    return decodeURIComponent(laatste) || 'bestand';
  } catch {
    return laatste || 'bestand';
  }
}

/**
 * De drie bestandsvelden van een logo als één lijst, klaar om te tonen. Alleen
 * de velden die echt gevuld zijn komen terug, zodat de pagina niets hoeft te filteren.
 */
export function logoBestanden(l: Logo): LogoBestand[] {
  const bronnen: { sleutel: LogoBestand['sleutel']; label: string; url: string | null; naam: string | null }[] = [
    { sleutel: 'logo', label: 'Logo', url: l.logo_bestand_url, naam: l.logo_bestand_naam },
    { sleutel: 'vector', label: 'Vector', url: l.vectorbestand_url, naam: l.vectorbestand_naam },
    { sleutel: 'borduur', label: 'Borduur', url: l.borduurbestand_url, naam: l.borduurbestand_naam },
  ];

  const bestanden: LogoBestand[] = [];
  for (const bron of bronnen) {
    const url = bron.url?.trim();
    if (!url) continue;
    // Oude rijen (van voor de naam-kolommen) hebben geen bewaarde naam; die
    // vallen terug op het laatste stuk van de URL.
    const bewaardeNaam = bron.naam?.trim() || null;
    bestanden.push({
      sleutel: bron.sleutel,
      label: bron.label,
      url,
      downloadHref: downloadUrl(url, bewaardeNaam) ?? url,
      weergaveNaam: bewaardeNaam ?? naamUitUrl(url),
      soort: bestandSoort(url, bewaardeNaam),
      extensie: bestandExtensie(url, bewaardeNaam),
    });
  }
  return bestanden;
}

export type Techniek = 'bedrukken' | 'borduren';

export type Decoratie = {
  id: string;
  orderregel_id: string;
  logo_id: string | null;
  techniek: Techniek;
  positie: string | null;
  afmeting: string | null;
  opmerkingen: string | null;
  created_at: string;
  logo: Logo | null;
};

export type DecoratieVelden = {
  logo_id?: string | null;
  techniek: Techniek;
  positie?: string | null;
  afmeting?: string | null;
  opmerkingen?: string | null;
};

export type OrganisatieKeuze = { id: string; naam: string };

export type WerkbonRegel = {
  id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  decoraties: Decoratie[];
};

export type Werkbon = {
  id: string;
  ordernummer: string | null;
  organisatie_naam: string | null;
  organisatie_plaats: string | null;
  medewerker_naam: string | null;
  afdeling_naam: string | null;
  regels: WerkbonRegel[];
};

export async function listOrganisaties(): Promise<OrganisatieKeuze[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('organisaties').select('id, naam').order('naam');
  return (data as OrganisatieKeuze[]) ?? [];
}

export async function listLogos(orgId: string): Promise<Logo[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  const { data } = await sb.from('logos').select('*').eq('organisatie_id', orgId).order('naam');
  return (data as Logo[]) ?? [];
}

export async function maakLogo(orgId: string, v: LogoVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('logos').insert({ organisatie_id: orgId, ...v });
  return !error;
}

export async function werkLogo(id: string, v: Partial<LogoVelden>): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('logos').update(v).eq('id', id);
  return !error;
}

export async function verwijderLogo(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('logos').delete().eq('id', id);
  return !error;
}

const DECORATIE_SELECT = '*, logo:logos(*)';

export async function listDecoraties(orderId: string): Promise<Record<string, Decoratie[]>> {
  const sb = kmsAdmin(); if (!sb) return {};
  const { data: regels } = await sb.from('orderregels').select('id').eq('order_id', orderId);
  const ids = ((regels as { id: string }[]) ?? []).map((r) => r.id);
  if (ids.length === 0) return {};
  const { data } = await sb.from('regel_decoraties').select(DECORATIE_SELECT).in('orderregel_id', ids).order('created_at');
  const rows = (data as Decoratie[]) ?? [];
  const map: Record<string, Decoratie[]> = {};
  for (const d of rows) {
    (map[d.orderregel_id] ??= []).push(d);
  }
  return map;
}

export async function maakDecoratie(orderregelId: string, v: DecoratieVelden): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('regel_decoraties').insert({ orderregel_id: orderregelId, ...v });
  return !error;
}

export async function verwijderDecoratie(id: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb.from('regel_decoraties').delete().eq('id', id);
  return !error;
}

export async function getOrderVoorWerkbon(orderId: string): Promise<Werkbon | null> {
  const sb = kmsAdmin(); if (!sb) return null;
  const { data: order } = await sb
    .from('orders')
    .select('id, ordernummer, organisatie:organisaties(naam, plaats), medewerker:medewerkers(naam), afdeling:afdelingen(naam)')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;
  const o = order as unknown as {
    id: string;
    ordernummer: string | null;
    organisatie: { naam: string | null; plaats: string | null } | null;
    medewerker: { naam: string | null } | null;
    afdeling: { naam: string | null } | null;
  };

  const { data: regelData } = await sb
    .from('orderregels')
    .select('id, item_naam, maat, kleur, aantal')
    .eq('order_id', orderId)
    .order('item_naam');
  const baseRegels = (regelData as Omit<WerkbonRegel, 'decoraties'>[]) ?? [];
  const decoratieMap = await listDecoraties(orderId);

  return {
    id: o.id,
    ordernummer: o.ordernummer,
    organisatie_naam: o.organisatie?.naam ?? null,
    organisatie_plaats: o.organisatie?.plaats ?? null,
    medewerker_naam: o.medewerker?.naam ?? null,
    afdeling_naam: o.afdeling?.naam ?? null,
    regels: baseRegels.map((r) => ({ ...r, decoraties: decoratieMap[r.id] ?? [] })),
  };
}
