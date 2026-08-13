import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Passessies: op locatie bij de klant per medewerker artikel, kleur en maat vastleggen.
 * Alles draait via de service-role client achter de dashboard-login.
 */

export type Passessie = {
  id: string;
  organisatie_id: string;
  datum: string;
  locatie: string | null;
  notitie: string | null;
  status: 'open' | 'afgerond' | 'omgezet';
  order_id: string | null;
  aangemaakt_door: string | null;
  organisatie_naam?: string | null;
  regels?: number;
};

export type PassessieRegel = {
  id: string;
  passessie_id: string;
  medewerker_id: string | null;
  medewerker_naam: string | null;
  product_id: string | null;
  variant_id: string | null;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  lengte: number | null;
  aantal: number;
  stukprijs: number | null;
  opmerking: string | null;
};

export type CatalogusItem = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  afbeelding: string | null;
  maatwerk_lengte: boolean;
};

export type VariantKeuze = {
  kleuren: { kleur: string; afbeelding: string | null }[];
  matenPerKleur: Record<string, { variant_id: string; maat: string; prijs: number | null }[]>;
  lengtes: number[];
};

export async function listPassessies(): Promise<Passessie[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('passessies')
    .select('*, organisaties(naam), passessie_regels(count)')
    .order('datum', { ascending: false })
    .limit(100);
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    ...(r as unknown as Passessie),
    organisatie_naam: (r.organisaties as { naam?: string } | null)?.naam ?? null,
    regels: (r.passessie_regels as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

export async function getPassessie(id: string): Promise<Passessie | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  const { data } = await sb.from('passessies').select('*, organisaties(naam)').eq('id', id).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return { ...(r as unknown as Passessie), organisatie_naam: (r.organisaties as { naam?: string } | null)?.naam ?? null };
}

export async function listRegels(passessieId: string): Promise<PassessieRegel[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('passessie_regels')
    .select('*')
    .eq('passessie_id', passessieId)
    .order('created_at', { ascending: true });
  return (data as PassessieRegel[]) ?? [];
}

export async function listMedewerkers(organisatieId: string) {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('medewerkers')
    .select('id, naam, functie, personeelsnummer')
    .eq('organisatie_id', organisatieId)
    .eq('actief', true)
    .order('naam');
  return (data as { id: string; naam: string; functie: string | null; personeelsnummer: string | null }[]) ?? [];
}

/**
 * Alleen wat het pasformulier nodig heeft: 450+ artikelen blijven zo een lichte payload.
 * Kleuren en maten worden pas opgehaald zodra een artikel is aangetikt.
 */
export async function listCatalogus(): Promise<CatalogusItem[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('producten')
    .select('id, naam, merk, categorie, afbeeldingen, maatwerk_lengte')
    .eq('actief', true)
    .order('merk')
    .order('naam')
    .limit(2000);
  return ((data as Record<string, unknown>[]) ?? []).map((p) => ({
    id: p.id as string,
    naam: (p.naam as string) ?? 'Naamloos',
    merk: (p.merk as string) ?? null,
    categorie: (p.categorie as string) ?? null,
    afbeelding: ((p.afbeeldingen as string[] | null) ?? [])[0] ?? null,
    maatwerk_lengte: Boolean(p.maatwerk_lengte),
  }));
}

/** Kleuren, maten en eventuele maatwerklengtes van één artikel. */
export async function getVariantKeuze(productId: string): Promise<VariantKeuze> {
  const leeg: VariantKeuze = { kleuren: [], matenPerKleur: {}, lengtes: [] };
  const sb = kmsAdmin();
  if (!sb) return leeg;

  const { data: prod } = await sb
    .from('producten')
    .select('id, merk, maatwerk_lengte')
    .eq('id', productId)
    .maybeSingle();
  if (!prod) return leeg;

  const [{ data: varianten }, { data: fotos }] = await Promise.all([
    sb.from('product_varianten').select('id, maat, kleur, verkoopprijs').eq('product_id', productId).limit(2000),
    sb.from('product_kleur_afbeeldingen').select('kleur, afbeelding_url').eq('product_id', productId),
  ]);

  const fotoVan = new Map(
    ((fotos as { kleur: string; afbeelding_url: string | null }[]) ?? []).map((f) => [f.kleur, f.afbeelding_url]),
  );

  const matenPerKleur: VariantKeuze['matenPerKleur'] = {};
  for (const v of (varianten as { id: string; maat: string | null; kleur: string | null; verkoopprijs: number | null }[]) ?? []) {
    const kleur = v.kleur ?? 'Standaard';
    (matenPerKleur[kleur] ??= []).push({ variant_id: v.id, maat: v.maat ?? '-', prijs: v.verkoopprijs });
  }
  for (const lijst of Object.values(matenPerKleur)) {
    lijst.sort((a, b) => {
      const na = Number(a.maat);
      const nb = Number(b.maat);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.maat.localeCompare(b.maat, 'nl', { numeric: true });
    });
  }

  let lengtes: number[] = [];
  if ((prod as { maatwerk_lengte?: boolean }).maatwerk_lengte) {
    const { data } = await sb
      .from('maatwerk_lengtes')
      .select('lengte')
      .eq('merk', (prod as { merk: string }).merk)
      .order('lengte');
    lengtes = ((data as { lengte: number }[]) ?? []).map((r) => r.lengte);
  }

  return {
    kleuren: Object.keys(matenPerKleur)
      .sort((a, b) => a.localeCompare(b, 'nl'))
      .map((kleur) => ({ kleur, afbeelding: fotoVan.get(kleur) ?? null })),
    matenPerKleur,
    lengtes,
  };
}
