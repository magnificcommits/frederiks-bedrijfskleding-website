import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Aantal rijen per status, voor de tellers op de filterchips.
 * Eén query over één kolom — bij de huidige volumes verwaarloosbaar.
 * Boven ongeveer 20.000 rijen per tabel is een database-functie met GROUP BY
 * zuiniger dan alle statussen ophalen en in JS tellen.
 */
export async function telPerStatus(tabel: string, kolom = 'status'): Promise<Record<string, number>> {
  const sb = kmsAdmin();
  if (!sb) return {};
  const { data } = await sb.from(tabel).select(kolom);
  const map: Record<string, number> = {};
  ((data as unknown as Record<string, string | null>[]) ?? []).forEach((r) => {
    const w = r[kolom];
    if (w) map[w] = (map[w] ?? 0) + 1;
  });
  return map;
}

export type DubbelGroep = { sleutel: string; reden: string; ids: string[]; namen: string[] };

/**
 * Klanten die waarschijnlijk dubbel in het bestand staan.
 *
 * Drie sleutels, met verschillend gewicht:
 *  - **e-mailadres** is hard genoeg om op zichzelf te melden;
 *  - **telefoonnummer** en **adres** alleen in combinatie met een gelijkende naam.
 *
 * Die laatste eis is er niet voor niets. Op het bestand van Frederiks leveren
 * adres en telefoon zonder naamcheck twaalf "dubbelen" op die het niet zijn:
 * bedrijven op hetzelfde bedrijventerrein, of één eigenaar met twee bv's op één
 * mobiel nummer. Een lijst die vooral vals alarm geeft, kijkt niemand een tweede
 * keer na.
 *
 * De naam wordt nooit als enige sleutel gebruikt: twee vestigingen van hetzelfde
 * bedrijf horen terecht dezelfde naam te hebben.
 *
 * Levert groepen op, geen oordeel: samenvoegen blijft een beslissing van Jessi.
 */
export async function mogelijkDubbeleKlanten(): Promise<DubbelGroep[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('organisaties')
    .select('id, naam, email_algemeen, telefoon, adres, postcode');
  type Rij = {
    id: string; naam: string; email_algemeen: string | null;
    telefoon: string | null; adres: string | null; postcode: string | null;
  };
  const rijen = (data as Rij[]) ?? [];

  const schoon = (v: string | null) => (v ?? '').toLowerCase().replace(/[\s.\-()]/g, '');
  const naamKern = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

  /** Namen lijken op elkaar als de een met de ander begint (minimaal 5 tekens). */
  function namenLijken(a: string, b: string) {
    const x = naamKern(a);
    const y = naamKern(b);
    if (!x || !y) return false;
    const kort = x.length <= y.length ? x : y;
    const lang = x.length <= y.length ? y : x;
    return kort.length >= 5 && lang.startsWith(kort.slice(0, Math.max(5, Math.floor(kort.length * 0.8))));
  }

  const sleutels: { reden: string; eisNaam: boolean; van: (r: Rij) => string }[] = [
    { reden: 'zelfde e-mailadres', eisNaam: false, van: (r) => schoon(r.email_algemeen) },
    { reden: 'zelfde telefoonnummer en gelijkende naam', eisNaam: true, van: (r) => schoon(r.telefoon) },
    {
      reden: 'zelfde adres en gelijkende naam',
      eisNaam: true,
      van: (r) => (schoon(r.adres) && schoon(r.postcode) ? schoon(r.adres) + '|' + schoon(r.postcode) : ''),
    },
  ];

  const groepen = new Map<string, DubbelGroep>();
  for (const { reden, eisNaam, van } of sleutels) {
    const perSleutel = new Map<string, Rij[]>();
    for (const r of rijen) {
      const k = van(r);
      if (!k) continue;
      perSleutel.set(k, [...(perSleutel.get(k) ?? []), r]);
    }
    for (const [k, groep] of perSleutel) {
      if (groep.length < 2) continue;
      if (eisNaam && !groep.every((r) => namenLijken(r.naam, groep[0].naam))) continue;
      const id = [...groep.map((r) => r.id)].sort().join(',');
      const bestaand = groepen.get(id);
      if (bestaand) bestaand.reden += ` · ${reden}`;
      else groepen.set(id, { sleutel: k, reden, ids: groep.map((r) => r.id), namen: groep.map((r) => r.naam) });
    }
  }
  return [...groepen.values()];
}

/** Aantal producten zonder enkele afbeelding — een lege array telt niet als NULL. */
export async function telProductenZonderFoto(): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  const { count } = await sb
    .from('producten')
    .select('id', { count: 'exact', head: true })
    .or('afbeeldingen.is.null,afbeeldingen.eq.{}');
  return count ?? 0;
}
