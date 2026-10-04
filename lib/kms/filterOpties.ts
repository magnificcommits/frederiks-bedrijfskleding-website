import { kmsAdmin } from '@/lib/kms/adminClient';
import { zoekWoorden, ilikeInKolommen, KLANT_ZOEKKOLOMMEN } from '@/lib/kms/zoeken';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';
import { isUuid, type FilterContext, type FilterOptie } from '@/lib/filterBalk';

/**
 * Opties en labels voor de filters op de lijstschermen (FilterBalk). Alleen
 * server-side, altijd achter dashAuthed(). De server actions in
 * lib/kms/filterActies.ts zijn dunne wrappers hieromheen.
 *
 * Alle queries zijn begrensd (max. 1000 rijen), zodat een filter ook bij een
 * paar duizend orders snel blijft.
 */

/** Waarde in een PostgREST or()-filter veilig quoten; ilike-jokers letterlijk nemen. */
export function pgTekst(s: string): string {
  const letterlijk = s.replace(/[\\%_]/g, (t) => `\\${t}`);
  return `"${letterlijk.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/* ------------------------------------------------------------------ */
/* Klanten                                                             */
/* ------------------------------------------------------------------ */

/**
 * Klanten voor een zoekbare klantkeuze. Zonder tekst de eerste 30 op naam,
 * zodat er bij openen meteen iets staat; met tekst moet elk woord voorkomen in
 * naam, plaats, klantnummer of contactpersoon.
 */
export async function zoekKlantOpties(term: string, limiet = 30): Promise<FilterOptie[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  let q = sb.from('organisaties').select('id, naam, plaats, klantnummer');
  for (const w of zoekWoorden(term)) q = q.or(ilikeInKolommen(KLANT_ZOEKKOLOMMEN, w));
  const { data } = await q.order('naam').limit(limiet);
  return ((data as { id: string; naam: string | null; plaats: string | null; klantnummer: string | null }[] | null) ?? []).map((k) => ({
    waarde: k.id,
    label: k.naam?.trim() || 'Naamloze klant',
    sub: [k.plaats, k.klantnummer ? `klantnr. ${k.klantnummer}` : null].filter(Boolean).join(' · ') || null,
  }));
}

/** Naam (en plaats) van één klant, voor de chip van een klantfilter. */
export async function klantLabel(id: string | null | undefined): Promise<string | null> {
  const sb = kmsAdmin();
  if (!sb || !isUuid(id)) return null;
  const { data } = await sb.from('organisaties').select('naam, plaats').eq('id', id).maybeSingle();
  const k = data as { naam: string | null; plaats: string | null } | null;
  if (!k) return null;
  return k.plaats ? `${k.naam ?? 'Klant'} (${k.plaats})` : k.naam ?? 'Klant';
}

/* ------------------------------------------------------------------ */
/* Offertes: contactpersoon                                            */
/* ------------------------------------------------------------------ */

/**
 * Contactpersonen voor het filter op de offertelijst, met het aantal offertes
 * per persoon. Is er een klantfilter actief, dan meteen alle contactpersonen
 * van die klant; anders zoeken vanaf 2 letters. Oude offertes met alleen een
 * naam als tekst komen als "niet gekoppeld" mee, alleen als er geen persoon
 * met die naam bij de klant hoort.
 */
export async function zoekOfferteContactOpties(term: string, context: FilterContext): Promise<FilterOptie[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const klant = isUuid(context.klant) ? context.klant : null;
  const woorden = zoekWoorden(term);
  if (!klant && term.trim().length < 2) return [];

  type C = { id: string; naam: string | null; email: string | null; organisatie_id: string };
  let cq = sb.from('contactpersonen').select('id, naam, email, organisatie_id');
  if (klant) cq = cq.eq('organisatie_id', klant);
  for (const w of woorden) cq = cq.or(ilikeInKolommen(['naam', 'email'], w));
  const { data: cData } = await cq.order('naam').limit(klant ? 500 : 50);
  const contacten = (cData as C[] | null) ?? [];

  // Offertes van deze personen, plus losse namen die op de zoekterm passen.
  type O = { contactpersoon: string | null; contactpersoon_id?: string | null; organisatie_id: string | null };
  const delen: string[] = [];
  if (contacten.length) delen.push(`contactpersoon_id.in.(${contacten.map((c) => c.id).join(',')})`);
  if (woorden.length) delen.push(`contactpersoon.ilike.%${woorden.join(' ')}%`);
  let oq = sb.from('offertes').select('contactpersoon, contactpersoon_id, organisatie_id');
  if (klant) oq = oq.eq('organisatie_id', klant);
  if (!klant || woorden.length) {
    if (!delen.length) return [];
    oq = oq.or(delen.join(','));
  }
  let oRes = await oq.limit(1000);
  if (kolomOntbreekt(oRes.error)) {
    let terug = sb.from('offertes').select('contactpersoon, organisatie_id').not('contactpersoon', 'is', null);
    if (klant) terug = terug.eq('organisatie_id', klant);
    if (woorden.length) terug = terug.ilike('contactpersoon', `%${woorden.join(' ')}%`);
    oRes = (await terug.limit(1000)) as typeof oRes;
  }
  const offertes = (oRes.data as O[] | null) ?? [];

  const orgIds = [...new Set([...contacten.map((c) => c.organisatie_id), ...offertes.map((o) => o.organisatie_id).filter((x): x is string => !!x)])];
  const { data: orgData } = orgIds.length ? await sb.from('organisaties').select('id, naam').in('id', orgIds.slice(0, 500)) : { data: [] };
  const orgNaam = new Map(((orgData as { id: string; naam: string | null }[] | null) ?? []).map((o) => [o.id, o.naam ?? 'Onbekende klant']));

  const telId = new Map<string, number>();
  const telTekst = new Map<string, { aantal: number; org: string | null }>();
  const naamBijKlant = new Set(contacten.map((c) => `${c.organisatie_id}|${(c.naam ?? '').trim().toLowerCase()}`));
  for (const o of offertes) {
    if (o.contactpersoon_id) {
      telId.set(o.contactpersoon_id, (telId.get(o.contactpersoon_id) ?? 0) + 1);
      continue;
    }
    const t = (o.contactpersoon ?? '').trim();
    if (!t) continue;
    if (naamBijKlant.has(`${o.organisatie_id}|${t.toLowerCase()}`)) {
      // Zelfde naam als een contactpersoon van die klant: tel hem bij die persoon.
      const c = contacten.find((x) => x.organisatie_id === o.organisatie_id && (x.naam ?? '').trim().toLowerCase() === t.toLowerCase());
      if (c) telId.set(c.id, (telId.get(c.id) ?? 0) + 1);
      continue;
    }
    const sleutel = t;
    const huidig = telTekst.get(sleutel);
    telTekst.set(sleutel, { aantal: (huidig?.aantal ?? 0) + 1, org: o.organisatie_id });
  }

  const uit: FilterOptie[] = contacten.map((c) => ({
    waarde: `c:${c.id}`,
    label: c.naam?.trim() || c.email || 'Naamloze contactpersoon',
    sub: orgNaam.get(c.organisatie_id) ?? null,
    aantal: telId.get(c.id) ?? 0,
  }));
  for (const [t, v] of telTekst) {
    uit.push({ waarde: `t:${t}`, label: t, sub: `${v.org ? orgNaam.get(v.org) ?? '' : ''}${v.org ? ' · ' : ''}niet gekoppeld`, aantal: v.aantal });
  }
  return uit
    .sort((a, b) => (b.aantal ?? 0) - (a.aantal ?? 0) || a.label.localeCompare(b.label, 'nl'))
    .slice(0, 40);
}

/** Label voor de chip van het contactpersoonfilter. */
export async function offerteContactLabel(waarde: string): Promise<string | null> {
  const w = String(waarde ?? '').trim();
  if (w.startsWith('t:')) return `${w.slice(2)} (niet gekoppeld)`;
  const sb = kmsAdmin();
  const id = w.slice(2);
  if (!sb || !w.startsWith('c:') || !isUuid(id)) return null;
  const { data } = await sb.from('contactpersonen').select('naam, email').eq('id', id).maybeSingle();
  const c = data as { naam: string | null; email: string | null } | null;
  return c ? c.naam?.trim() || c.email || 'Contactpersoon' : null;
}

/**
 * PostgREST or()-filter voor offertes van één contactpersoon: op de koppeling,
 * en voor oudere offertes op de naam binnen dezelfde klant. Null = niets vinden.
 */
export async function offerteContactOrFilter(waarde: string): Promise<{ metId: string; zonderId: string } | null> {
  const w = String(waarde ?? '').trim();
  if (w.startsWith('t:')) {
    const t = w.slice(2).trim();
    if (!t) return null;
    const f = `contactpersoon.ilike.${pgTekst(t)}`;
    return { metId: f, zonderId: f };
  }
  const sb = kmsAdmin();
  const id = w.slice(2);
  if (!sb || !w.startsWith('c:') || !isUuid(id)) return null;
  const { data } = await sb.from('contactpersonen').select('naam, organisatie_id').eq('id', id).maybeSingle();
  const c = data as { naam: string | null; organisatie_id: string } | null;
  const opNaam = c?.naam?.trim() ? `and(organisatie_id.eq.${c.organisatie_id},contactpersoon.ilike.${pgTekst(c.naam.trim())})` : '';
  return {
    metId: [`contactpersoon_id.eq.${id}`, opNaam].filter(Boolean).join(','),
    zonderId: opNaam || `id.eq.00000000-0000-0000-0000-000000000000`,
  };
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

/** Ids van orders waar minstens één drukproef aan hangt. */
export async function orderIdsMetDrukproef(): Promise<string[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb.from('drukproeven').select('order_id').not('order_id', 'is', null).limit(1000);
  if (error) return [];
  return [...new Set(((data as { order_id: string | null }[] | null) ?? []).map((r) => r.order_id).filter((x): x is string => !!x))];
}
