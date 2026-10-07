import { unstable_cache } from 'next/cache';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { haalAllesOp } from '@/lib/kms/varianten';
import { starterpakketten } from '@/content/configurator';
import { afronden, pakketPrijsPerMedewerker, percentiel, prijsklasse, typeVanNaam, type PrijsData, type Staffelregel } from '@/lib/kms/prijsindicatie';

/** Instellingen in de sleutel/waarde-tabel `instellingen`. */
const SLEUTELS = { aan: 'prijsindicatie_aan', korting: 'prijsindicatie_korting', team: 'prijsindicatie_team' } as const;
export const PRIJS_TAG = 'prijsindicatie';

export type PrijsInstellingen = { aan: boolean; korting: number; teamAantal: number };
export const STANDAARD: PrijsInstellingen = { aan: false, korting: 0, teamAantal: 15 };

export async function getPrijsInstellingen(): Promise<PrijsInstellingen> {
  const sb = kmsAdmin();
  if (!sb) return STANDAARD;
  const { data } = await sb.from('instellingen').select('sleutel, waarde').in('sleutel', Object.values(SLEUTELS));
  const m = new Map(((data as { sleutel: string; waarde: string | null }[]) ?? []).map((r) => [r.sleutel, r.waarde ?? '']));
  const getal = (v: string | undefined, std: number, min: number, max: number) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.min(max, Math.max(min, n)) : std;
  };
  return {
    aan: m.get(SLEUTELS.aan) === 'true',
    korting: getal(m.get(SLEUTELS.korting), STANDAARD.korting, 0, 60),
    teamAantal: Math.round(getal(m.get(SLEUTELS.team), STANDAARD.teamAantal, 1, 500)),
  };
}

export async function zetPrijsInstellingen(i: PrijsInstellingen): Promise<boolean> {
  const sb = kmsAdmin();
  if (!sb) return false;
  const nu = new Date().toISOString();
  const { error } = await sb.from('instellingen').upsert(
    [
      { sleutel: SLEUTELS.aan, waarde: i.aan ? 'true' : 'false', bijgewerkt_op: nu },
      { sleutel: SLEUTELS.korting, waarde: String(i.korting), bijgewerkt_op: nu },
      { sleutel: SLEUTELS.team, waarde: String(i.teamAantal), bijgewerkt_op: nu },
    ],
    { onConflict: 'sleutel' },
  );
  return !error;
}

export type Formaat = { techniek: string; formaat: string; omschrijving: string | null };
export type Kosten = { techniek: string; soort: string; omschrijving: string | null; bedrag: number; eenheid: string | null };
type Ruw = { typePrijzen: Record<string, number>; staffel: Staffelregel[]; categorieGrenzen: Record<string, [number, number]>; basisPerProduct: Record<string, number>; catPerProduct: Record<string, string>; formaten: Formaat[]; kosten: Kosten[] };

/** Prijsgegevens uit de catalogus. Eén keer per dag of na opslaan in het KMS opnieuw opgehaald. */
const haalRuw = unstable_cache(
  async (): Promise<Ruw> => {
    const sb = kmsAdmin();
    if (!sb) return { typePrijzen: {}, staffel: [], categorieGrenzen: {}, basisPerProduct: {}, catPerProduct: {}, formaten: [], kosten: [] };
    type P = { id: string; naam: string | null; categorie: string | null; verkoopprijs_basis: number | null };
    const [producten, staffelRes, formatenRes, kostenRes] = await Promise.all([
      haalAllesOp<P>((van, tot) => sb.from('producten').select('id, naam, categorie, verkoopprijs_basis').or('actief.is.null,actief.eq.true').order('id').range(van, tot)),
      sb.from('decoratie_tarieven').select('techniek, formaat, vanaf_aantal, stukprijs'),
      sb.from('decoratie_formaten').select('techniek, formaat, omschrijving').order('volgorde'),
      sb.from('decoratie_kosten').select('techniek, soort, omschrijving, bedrag, eenheid'),
    ]);
    const perType = new Map<string, number[]>();
    const perCat = new Map<string, number[]>();
    const basisPerProduct: Record<string, number> = {};
    const catPerProduct: Record<string, string> = {};
    for (const p of producten) {
      const prijs = Number(p.verkoopprijs_basis);
      if (!(prijs > 0)) continue;
      basisPerProduct[p.id] = prijs;
      const t = typeVanNaam(p.naam ?? '');
      if (t) perType.set(t, [...(perType.get(t) ?? []), prijs]);
      const c = (p.categorie ?? '').trim();
      if (c) {
        perCat.set(c, [...(perCat.get(c) ?? []), prijs]);
        catPerProduct[p.id] = c;
      }
    }
    const typePrijzen: Record<string, number> = {};
    for (const [t, v] of perType) {
      const p25 = percentiel(v, 0.25);
      if (p25) typePrijzen[t] = Math.round(p25 * 100) / 100;
    }
    const categorieGrenzen: Record<string, [number, number]> = {};
    for (const [c, v] of perCat) {
      const a = percentiel(v, 1 / 3);
      const b = percentiel(v, 2 / 3);
      if (a && b && v.length >= 6) categorieGrenzen[c] = [a, b];
    }
    const staffel = ((staffelRes.data ?? []) as Staffelregel[]).map((s) => ({ ...s, vanaf_aantal: Number(s.vanaf_aantal), stukprijs: Number(s.stukprijs) }));
    const formaten = (formatenRes.data ?? []) as Formaat[];
    const kosten = ((kostenRes.data ?? []) as Kosten[]).map((k) => ({ ...k, bedrag: Number(k.bedrag) }));
    return { typePrijzen, staffel, categorieGrenzen, basisPerProduct, catPerProduct, formaten, kosten };
  },
  ['prijsindicatie-ruw'],
  { revalidate: 86400, tags: [PRIJS_TAG] },
);

export type Prijsindicatie = PrijsData & {
  /** 'Vanaf ca.' per medewerker per branche (sleutel = naam van het startpakket). */
  perBranche: Record<string, number>;
  categorieGrenzen: Record<string, [number, number]>;
  basisPerProduct: Record<string, number>;
  catPerProduct: Record<string, string>;
  formaten: Formaat[];
  kosten: Kosten[];
};

/** Berekent alles, ook als de schakelaar uit staat (voor het voorbeeld in het KMS). */
export async function berekenPrijsindicatie(inst?: PrijsInstellingen): Promise<Prijsindicatie> {
  const i = inst ?? (await getPrijsInstellingen());
  const ruw = await haalRuw();
  const data: PrijsData = { typePrijzen: ruw.typePrijzen, staffel: ruw.staffel, korting: i.korting, teamAantal: i.teamAantal };
  const perBranche: Record<string, number> = {};
  for (const [naam, regels] of Object.entries(starterpakketten)) {
    const p = pakketPrijsPerMedewerker(regels, data);
    if (p) perBranche[naam] = afronden(p);
  }
  return { ...data, perBranche, categorieGrenzen: ruw.categorieGrenzen, basisPerProduct: ruw.basisPerProduct, catPerProduct: ruw.catPerProduct, formaten: ruw.formaten, kosten: ruw.kosten };
}

/** Voor de publieke site: null zolang de schakelaar in het KMS uit staat. */
export async function getPrijsindicatie(): Promise<Prijsindicatie | null> {
  const i = await getPrijsInstellingen();
  if (!i.aan) return null;
  return berekenPrijsindicatie(i);
}

/** Prijsklasse 1-3 van een artikel binnen zijn categorie, of null als het niet te bepalen is. */
export function klasseVan(p: Prijsindicatie, productId: string): 1 | 2 | 3 | null {
  const prijs = p.basisPerProduct[productId];
  const grenzen = p.categorieGrenzen[p.catPerProduct[productId] ?? ''];
  if (!prijs || !grenzen) return null;
  return prijsklasse(prijs, grenzen);
}
