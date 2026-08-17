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

/**
 * Een artikel uit het assortiment van één klant, met de kleuren er meteen bij.
 * De kleuren zitten in dezelfde payload zodat Jessi op de tablet in één tik van
 * artikel naar kleur gaat zonder te wachten op een tweede ronde naar de server.
 */
export type AssortimentArtikel = CatalogusItem & {
  kleuren: { kleur: string; afbeelding: string | null }[];
};

export type PasMedewerker = {
  id: string;
  naam: string;
  functie: string | null;
  personeelsnummer: string | null;
};

export type VariantKeuze = {
  kleuren: { kleur: string; afbeelding: string | null }[];
  matenPerKleur: Record<string, { variant_id: string; maat: string; prijs: number | null }[]>;
  lengtes: number[];
};

export type KlantKeuze = { id: string; naam: string; plaats: string | null };

/** Klanten voor de keuzelijst waarmee een sessie gestart wordt. */
export async function listKlantKeuze(): Promise<KlantKeuze[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb.from('organisaties').select('id, naam, plaats').order('naam');
  return (data as KlantKeuze[]) ?? [];
}

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

type MedewerkerRij = {
  id: string;
  naam: string | null;
  voornaam: string | null;
  tussenvoegsel: string | null;
  achternaam: string | null;
  functie: string | null;
  personeelsnummer: string | null;
  actief: boolean | null;
};

type NaamDelen = Pick<MedewerkerRij, 'naam' | 'voornaam' | 'tussenvoegsel' | 'achternaam'>;

/** `naam` is bij geïmporteerde en handmatig aangemaakte rijen vaak leeg; dan de losse delen aan elkaar. */
function toonNaam(r: NaamDelen): string {
  const uitDelen = [r.voornaam, r.tussenvoegsel, r.achternaam]
    .map((d) => (d ?? '').trim())
    .filter((d) => d.length > 0)
    .join(' ');
  return r.naam?.trim() || uitDelen || 'Naamloze medewerker';
}

/**
 * Medewerkers van één klant voor het pasformulier.
 *
 * LET OP, hier zat de bug: dit filterde op `.eq('actief', true)`. Een net aangemaakte
 * medewerker heeft `actief` op null staan (de kolom heeft geen default), en in SQL is
 * `null = true` niet waar. Zo'n medewerker viel dus stilzwijgend uit de lijst, terwijl
 * Jessi hem net had ingevoerd. We verbergen daarom alleen wie expliciet op inactief
 * staat; onbekend (null) telt als gewoon in dienst.
 */
export async function listMedewerkers(organisatieId: string): Promise<PasMedewerker[]> {
  const sb = kmsAdmin();
  if (!sb || !organisatieId) return [];
  const { data } = await sb
    .from('medewerkers')
    .select('id, naam, voornaam, tussenvoegsel, achternaam, functie, personeelsnummer, actief')
    .eq('organisatie_id', organisatieId)
    .limit(2000);

  return ((data as MedewerkerRij[]) ?? [])
    .filter((r) => r.actief !== false)
    .map((r) => ({
      id: r.id,
      naam: toonNaam(r),
      functie: r.functie,
      personeelsnummer: r.personeelsnummer,
    }))
    // Sorteren in JS omdat we op de samengestelde naam sorteren, niet op de kolom `naam`.
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

/**
 * Naam per medewerker-id, inclusief wie inmiddels uit dienst is. Voor het omzetten naar
 * een order: die regels zijn al gepast, dus de naam moet er hoe dan ook bij staan.
 */
export async function naamPerMedewerker(organisatieId: string): Promise<Map<string, string>> {
  const namen = new Map<string, string>();
  const sb = kmsAdmin();
  if (!sb || !organisatieId) return namen;
  const { data } = await sb
    .from('medewerkers')
    .select('id, naam, voornaam, tussenvoegsel, achternaam')
    .eq('organisatie_id', organisatieId)
    .limit(5000);
  for (const r of (data as (NaamDelen & { id: string })[]) ?? []) namen.set(r.id, toonNaam(r));
  return namen;
}

type ProductRij = {
  id: string;
  naam: string | null;
  merk: string | null;
  categorie: string | null;
  afbeeldingen: string[] | null;
  maatwerk_lengte: boolean | null;
  actief: boolean | null;
};

/**
 * De artikelen die deze klant mag bestellen, met foto en de beschikbare kleuren.
 * Dit is het startpunt van een passessie: Jessi tikt een jas aan die ze herkent aan
 * het plaatje, niet aan een naam als "Snickers 1148 AllroundWork".
 *
 * `toegestaan` en `actief` worden op null-veilige wijze beoordeeld: alleen een
 * expliciete false verbergt iets. Bij oudere rijen staat er null en die horen er
 * gewoon bij (zelfde valkuil als bij medewerkers).
 */
export async function listAssortimentArtikelen(organisatieId: string): Promise<AssortimentArtikel[]> {
  const sb = kmsAdmin();
  if (!sb || !organisatieId) return [];

  const { data: regels } = await sb
    .from('assortiment')
    .select('product_id, toegestaan')
    .eq('organisatie_id', organisatieId)
    .limit(5000);

  // Eén product kan meerdere assortimentregels hebben (per afdeling of medewerker),
  // dus ontdubbelen voordat we de producten ophalen.
  const productIds = [
    ...new Set(
      ((regels as { product_id: string | null; toegestaan: boolean | null }[]) ?? [])
        .filter((r) => Boolean(r.product_id) && r.toegestaan !== false)
        .map((r) => r.product_id as string),
    ),
  ];
  if (productIds.length === 0) return [];

  const [{ data: producten }, { data: varianten }, { data: fotos }] = await Promise.all([
    sb
      .from('producten')
      .select('id, naam, merk, categorie, afbeeldingen, maatwerk_lengte, actief')
      .in('id', productIds)
      .limit(5000),
    sb.from('product_varianten').select('product_id, kleur, actief').in('product_id', productIds).limit(20000),
    sb
      .from('product_kleur_afbeeldingen')
      .select('product_id, kleur, afbeelding_url')
      .in('product_id', productIds)
      .limit(20000),
  ]);

  const fotoVan = new Map<string, string | null>();
  for (const f of (fotos as { product_id: string; kleur: string | null; afbeelding_url: string | null }[]) ?? []) {
    if (!f.kleur) continue;
    const sleutel = `${f.product_id}|${f.kleur}`;
    if (!fotoVan.has(sleutel)) fotoVan.set(sleutel, f.afbeelding_url);
  }

  const kleurenVan = new Map<string, string[]>();
  for (const v of (varianten as { product_id: string; kleur: string | null; actief: boolean | null }[]) ?? []) {
    if (v.actief === false) continue;
    // Zelfde sleutel als getVariantKeuze gebruikt, anders klikt de kleur uit deze lijst
    // straks niet door naar de matenlijst.
    const kleur = v.kleur ?? 'Standaard';
    const lijst = kleurenVan.get(v.product_id);
    if (!lijst) kleurenVan.set(v.product_id, [kleur]);
    else if (!lijst.includes(kleur)) lijst.push(kleur);
  }

  return ((producten as ProductRij[]) ?? [])
    .filter((p) => p.actief !== false)
    .map((p) => ({
      id: p.id,
      naam: p.naam?.trim() || 'Naamloos',
      merk: p.merk,
      categorie: p.categorie,
      afbeelding: (p.afbeeldingen ?? [])[0] ?? null,
      maatwerk_lengte: Boolean(p.maatwerk_lengte),
      kleuren: (kleurenVan.get(p.id) ?? [])
        .slice()
        .sort((a, b) => a.localeCompare(b, 'nl'))
        .map((kleur) => ({ kleur, afbeelding: fotoVan.get(`${p.id}|${kleur}`) ?? null })),
    }))
    .sort((a, b) => (a.merk ?? '').localeCompare(b.merk ?? '', 'nl') || a.naam.localeCompare(b.naam, 'nl'));
}

/**
 * Alleen wat het pasformulier nodig heeft, zodat de ruim vijfhonderd artikelen een lichte
 * lijst blijven. Dit is de terugvaloptie voor iets buiten het assortiment; het startpunt is
 * listAssortimentArtikelen(). Wordt niet met de sessiepagina meegestuurd maar pas via
 * haalCatalogus() opgehaald zodra Jessi de zoekhulp openklapt. Kleuren en maten volgen nog
 * later, zodra een artikel is aangetikt.
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
