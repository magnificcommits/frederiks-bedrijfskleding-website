import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Data-access voor de magazijndocumenten: pakbon, picklijst (verzamellijst) en
 * verzendsticker per order. Bundelt order, orderregels, organisatie, medewerker,
 * vestiging en afdeling, met een afgeleid leveradres.
 * Alle queries via kmsAdmin() (service-role, omzeilt RLS). Alleen server-side gebruiken,
 * altijd achter dashAuthed().
 */

export type MagazijnRegel = {
  id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
};

export type Adres = {
  straat: string | null;
  postcode: string | null;
  plaats: string | null;
};

export type MagazijnData = {
  id: string;
  ordernummer: string | null;
  referentienr: string | null;
  besteldatum: string | null;
  status: string | null;
  organisatie_naam: string | null;
  medewerker_naam: string | null;
  vestiging_naam: string | null;
  afdeling_naam: string | null;
  /** Afgeleid: vestiging-leveradres indien aanwezig, anders afdeling-leveradres, anders organisatie-adres. */
  leveradres: Adres;
  /** Bron van het afgeleide leveradres, handig voor weergave en debuggen. */
  leveradres_bron: 'vestiging' | 'afdeling' | 'organisatie' | 'geen';
  regels: MagazijnRegel[];
};

function heeftAdres(a: Adres): boolean {
  return Boolean(a.straat || a.postcode || a.plaats);
}

function medewerkerNaam(m: {
  naam: string | null;
  voornaam: string | null;
  achternaam: string | null;
} | null): string | null {
  if (!m) return null;
  if (m.naam && m.naam.trim()) return m.naam.trim();
  const samen = [m.voornaam, m.achternaam].filter(Boolean).join(' ').trim();
  return samen || null;
}

export async function getMagazijnData(orderId: string): Promise<MagazijnData | null> {
  const sb = kmsAdmin();
  if (!sb) return null;

  const { data: order } = await sb
    .from('orders')
    .select(
      'id, ordernummer, referentienr, besteldatum, status, ' +
        'organisatie:organisaties(naam, adres, postcode, plaats), ' +
        'medewerker:medewerkers(naam, voornaam, achternaam), ' +
        'vestiging:vestigingen(naam, leveradres, leverpostcode, leverplaats), ' +
        'afdeling:afdelingen(naam, leveradres, leverpostcode, leverplaats)',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;

  const o = order as unknown as {
    id: string;
    ordernummer: string | null;
    referentienr: string | null;
    besteldatum: string | null;
    status: string | null;
    organisatie: { naam: string | null; adres: string | null; postcode: string | null; plaats: string | null } | null;
    medewerker: { naam: string | null; voornaam: string | null; achternaam: string | null } | null;
    vestiging: { naam: string | null; leveradres: string | null; leverpostcode: string | null; leverplaats: string | null } | null;
    afdeling: { naam: string | null; leveradres: string | null; leverpostcode: string | null; leverplaats: string | null } | null;
  };

  const { data: regelData } = await sb
    .from('orderregels')
    .select('id, item_naam, maat, kleur, aantal')
    .eq('order_id', orderId)
    .order('item_naam');
  const regels = (regelData as MagazijnRegel[]) ?? [];

  const vestigingAdres: Adres = {
    straat: o.vestiging?.leveradres ?? null,
    postcode: o.vestiging?.leverpostcode ?? null,
    plaats: o.vestiging?.leverplaats ?? null,
  };
  const afdelingAdres: Adres = {
    straat: o.afdeling?.leveradres ?? null,
    postcode: o.afdeling?.leverpostcode ?? null,
    plaats: o.afdeling?.leverplaats ?? null,
  };
  const organisatieAdres: Adres = {
    straat: o.organisatie?.adres ?? null,
    postcode: o.organisatie?.postcode ?? null,
    plaats: o.organisatie?.plaats ?? null,
  };

  let leveradres: Adres = { straat: null, postcode: null, plaats: null };
  let leveradres_bron: MagazijnData['leveradres_bron'] = 'geen';
  if (heeftAdres(vestigingAdres)) {
    leveradres = vestigingAdres;
    leveradres_bron = 'vestiging';
  } else if (heeftAdres(afdelingAdres)) {
    leveradres = afdelingAdres;
    leveradres_bron = 'afdeling';
  } else if (heeftAdres(organisatieAdres)) {
    leveradres = organisatieAdres;
    leveradres_bron = 'organisatie';
  }

  return {
    id: o.id,
    ordernummer: o.ordernummer,
    referentienr: o.referentienr,
    besteldatum: o.besteldatum,
    status: o.status,
    organisatie_naam: o.organisatie?.naam ?? null,
    medewerker_naam: medewerkerNaam(o.medewerker),
    vestiging_naam: o.vestiging?.naam ?? null,
    afdeling_naam: o.afdeling?.naam ?? null,
    leveradres,
    leveradres_bron,
    regels,
  };
}
