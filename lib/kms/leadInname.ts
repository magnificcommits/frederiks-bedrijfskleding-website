import { kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { maakTaak } from '@/lib/kms/taken';
import { maakOfferte, voegRegelToe, listOfferteKleuren, regelOmschrijving } from '@/lib/kms/offertes';
import { uploadMediaMetNaam } from '@/lib/kms/storage';
import { saveLead, type NieuweLead } from '@/lib/supabase';
import { OPEN_STATUSSEN, opvolgMoment } from '@/lib/kms/leadsModel';
import { controleerLogo, logoBestandsnaam } from '@/lib/bijlagen';
import { alleenNieuweRegels, ilikePatroon, samenvoegGrens, voegBerichtSamen, zonderOnbekendeProducten } from '@/lib/kms/leadInnameLogica';
import { schrijfLeadInBijTriggers } from '@/lib/kms/campagneLeadTrigger';
import { BRON_KANAAL_LABEL, schoonBronKanaal, type LeadRegelInvoer } from '@/lib/leadHerkomst';

/**
 * Een weblead in één keer werkbaar maken in het KMS:
 *  1. lead opslaan (service role, fouten gelogd en teruggegeven);
 *  2. productregels en een geüpload logo bij de lead zetten;
 *  3. opvolgtaak voor Jessi (of de ingestelde eigenaar) met een deadline binnen werktijd;
 *  4. bij gekozen artikelen een CONCEPT-offerte met catalogusprijzen (wordt niet verstuurd);
 *  5. inschrijven in actieve campagnes met trigger lead_nieuw (filter op bron_kanaal);
 *  6. een regel op de tijdlijn met wat er is klaargezet.
 * Komt er binnen een week een tweede aanvraag van hetzelfde e-mailadres terwijl
 * de eerste lead nog open is, dan wordt die lead bijgewerkt: geen tweede lead,
 * geen tweede taak, geen tweede campagne-inschrijving en geen tweede concept-offerte.
 *
 * Stap 2-6 zijn best effort: mislukt er een, dan staat dat in `waarschuwingen`
 * (en in de serverlog), maar de lead zelf blijft staan.
 *
 * De KMS-melding komt uit leads.gezien_op (null = nog niet geopend), zie
 * listOngezieneWebleads() en NieuweWebleads/LeadMelding.
 */

export type WebleadInvoer = {
  lead: NieuweLead;
  regels?: LeadRegelInvoer[];
  logo?: { dataUrl: string; naam: string | null } | null;
  opties?: {
    /** Opvolgtaak aanmaken (standaard ja). De kennismakingsbrief maakt zelf al een prospecttaak. */
    taak?: boolean;
    /** Concept-offerte maken als er regels zijn (standaard ja). */
    offerte?: boolean;
    /** Meteen inschrijven in campagnes met trigger "nieuwe lead" (standaard ja). */
    campagnes?: boolean;
  };
};

export type WebleadUitkomst = {
  opgeslagen: boolean;
  id: string | null;
  fout?: string;
  waarschuwingen: string[];
  taak?: { id: string; datum: string; tijd: string; persoon: string | null } | null;
  offerte?: { id: string; nummer: number | null; regels: number } | null;
  logoUrl?: string | null;
  /** In zoveel campagnes (trigger lead_nieuw) meteen ingeschreven. */
  campagnes?: number;
  /** De aanvraag is bij een bestaande open lead van hetzelfde adres gezet. */
  samengevoegd?: boolean;
};

type Sb = NonNullable<ReturnType<typeof kmsAdmin>>;

const MAX_LOGO_BYTES = 2_600_000;

/** Wie volgt webleads op? Instelling 'leads.standaard_eigenaar' (id), anders Jessi, anders de eerste actieve persoon. */
async function standaardEigenaar(sb: Sb): Promise<{ id: string; naam: string } | null> {
  const { data: inst } = await sb.from('instellingen').select('waarde').eq('sleutel', 'leads.standaard_eigenaar').maybeSingle();
  const gekozen = (inst as { waarde: string | null } | null)?.waarde?.trim();
  const { data } = await sb.from('taak_personen').select('id, naam, actief').eq('actief', true).order('created_at');
  const personen = (data as { id: string; naam: string }[]) ?? [];
  return (
    (gekozen && personen.find((p) => p.id === gekozen)) ||
    personen.find((p) => /^jess/i.test(p.naam.trim())) ||
    personen[0] ||
    null
  );
}

/** Verkoopprijs uit de catalogus: de gekozen kleur, anders de laagste prijs van het artikel. */
async function catalogusPrijs(productId: string, kleur: string | null): Promise<{ prijs: number; inkoop: number | null; kleur: string | null }> {
  const kleuren = await listOfferteKleuren(productId).catch(() => []);
  if (!kleuren.length) return { prijs: 0, inkoop: null, kleur };
  const sleutel = (kleur ?? '').trim().toLowerCase();
  const treffer = sleutel ? kleuren.find((k) => k.kleur.toLowerCase() === sleutel) ?? kleuren.find((k) => k.kleur.toLowerCase().includes(sleutel)) : undefined;
  if (treffer) return { prijs: treffer.prijs ?? 0, inkoop: treffer.inkoop, kleur: treffer.kleur || kleur };
  const prijzen = kleuren.map((k) => k.prijs).filter((p): p is number => p != null);
  return { prijs: prijzen.length ? Math.min(...prijzen) : 0, inkoop: null, kleur };
}

/** Aantal verschillende artikelen (artikel + kleur); het mandje stuurt één regel per maat. */
const aantalArtikelen = (regels: LeadRegelInvoer[]) => new Set(regels.map((r) => `${r.product_id ?? r.omschrijving}|${r.kleur ?? ''}`)).size;

/** Regels als offerteregels toevoegen. Geeft het aantal geslaagde regels terug. */
export async function regelsNaarOfferte(sb: Sb, offerteId: string, regels: LeadRegelInvoer[]): Promise<number> {
  const ids = [...new Set(regels.map((r) => r.product_id).filter((x): x is string => !!x))];
  const producten = new Map<string, { naam: string; merk: string | null }>();
  if (ids.length) {
    const { data } = await sb.from('producten').select('id, naam, merk').in('id', ids);
    for (const p of (data as { id: string; naam: string; merk: string | null }[]) ?? []) producten.set(p.id, p);
  }
  let gelukt = 0;
  // Eén regel per maat: de prijs per artikel en kleur maar één keer opzoeken.
  const prijsCache = new Map<string, Awaited<ReturnType<typeof catalogusPrijs>>>();
  for (const r of regels) {
    const prod = r.product_id ? producten.get(r.product_id) : undefined;
    let prijs: Awaited<ReturnType<typeof catalogusPrijs>> = { prijs: 0, inkoop: null, kleur: r.kleur };
    if (prod && r.product_id) {
      const k = `${r.product_id}|${r.kleur ?? ''}`;
      prijs = prijsCache.get(k) ?? (await catalogusPrijs(r.product_id, r.kleur));
      prijsCache.set(k, prijs);
    }
    const basis = prod ? regelOmschrijving(prod, prijs.kleur, null) : [r.omschrijving, r.kleur].filter(Boolean).join(', ');
    const extra = [prod ? null : r.maat ? `maat ${r.maat}` : null, r.opmerking, prod ? null : 'prijs nog invullen'].filter(Boolean).join(' · ');
    const ok = await voegRegelToe(offerteId, {
      omschrijving: (extra ? `${basis} (${extra})` : basis).slice(0, 300),
      aantal: r.aantal ?? 1,
      stukprijs: prijs.prijs,
      inkoop: prijs.inkoop,
      product_id: prod ? r.product_id : null,
      kleur: prijs.kleur,
      // Bij een catalogusartikel staat de maat in de eigen kolom, zodat de offerte per maat klopt.
      maat: prod ? r.maat : null,
    });
    if (ok) gelukt += 1;
  }
  return gelukt;
}

async function slaLogoOp(sb: Sb, leadId: string, logo: { dataUrl: string; naam: string | null }, bron: string): Promise<string | null> {
  // Anonieme bezoeker: geen SVG, en alleen wat aan de eerste bytes een afbeelding is.
  // Type en extensie komen uit die controle, nooit uit de opgegeven naam.
  const ok = controleerLogo(logo.dataUrl, { svgToegestaan: false, maxBytes: MAX_LOGO_BYTES });
  if (!ok) return null;
  const file = new File([new Uint8Array(ok.bytes)], logoBestandsnaam(logo.naam, ok.ext), { type: ok.mime });
  const upload = await uploadMediaMetNaam(file, 'logos/leads');
  if (!upload) return null;
  const { error } = await sb.from('lead_logos').insert({ lead_id: leadId, logo_url: upload.url, logo_naam: upload.origineleNaam, bron });
  if (error) {
    console.error('[lead] logo opgeslagen maar niet gekoppeld:', error.message);
    return null;
  }
  return upload.url;
}

/** Welke van deze product-id's bestaan echt? Bij een fout: geen enkele (dan gaan ze allemaal op null). */
async function bekendeProductIds(sb: Sb, regels: LeadRegelInvoer[]): Promise<Set<string>> {
  const ids = [...new Set(regels.map((r) => r.product_id).filter((x): x is string => !!x))];
  if (!ids.length) return new Set();
  const { data, error } = await sb.from('producten').select('id').in('id', ids);
  if (error) {
    console.error('[lead] product-id\'s niet te controleren, regels gaan zonder koppeling:', error.message);
    return new Set();
  }
  return new Set(((data as { id: string }[]) ?? []).map((p) => p.id));
}

type OpenLead = {
  id: string;
  company: string | null;
  phone: string | null;
  branche: string | null;
  aantal: string | null;
  bericht: string | null;
  created_at: string;
  volgende_taak_id: string | null;
};

/**
 * Een open lead (niet gewonnen of verloren) met hetzelfde e-mailadres uit de
 * laatste week. Zelfde zoekwijze als leadVoorAfspraak in lib/afspraken/afspraken.ts.
 * Bij een fout (bijvoorbeeld een kolom die nog ontbreekt): null, dan komt er gewoon een nieuwe lead.
 */
async function vindOpenLead(sb: Sb, email: string): Promise<OpenLead | null> {
  const adres = String(email ?? '').trim();
  if (!adres) return null;
  const { data, error } = await sb
    .from('leads')
    .select('id, company, phone, branche, aantal, bericht, created_at, volgende_taak_id')
    .ilike('email', ilikePatroon(adres))
    .in('status', [...OPEN_STATUSSEN])
    .gte('created_at', samenvoegGrens())
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return null;
  return ((data as OpenLead[]) ?? [])[0] ?? null;
}

/** De tweede aanvraag in de bestaande lead verwerken: lege velden aanvullen, bericht eronder, weer als ongezien. */
async function werkOpenLeadBij(sb: Sb, eerder: OpenLead, lead: NieuweLead): Promise<void> {
  const vandaag = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  const patch: Record<string, unknown> = {};
  if (!eerder.company && lead.company) patch.company = lead.company;
  if (!eerder.phone && lead.phone) patch.phone = lead.phone;
  if (!eerder.branche && lead.branche) patch.branche = lead.branche;
  if (!eerder.aantal && lead.aantal) patch.aantal = lead.aantal;
  const bericht = voegBerichtSamen(eerder.bericht, lead.bericht, vandaag);
  if (bericht !== (eerder.bericht ?? null)) patch.bericht = bericht;
  // Opnieuw in de melding "nieuwe webaanvragen": er is iets bijgekomen.
  // Tijdstip van deze nieuwe aanvraag, zodat de melding "opnieuw aangevraagd, vandaag" kan tonen.
  let { error } = await sb.from('leads').update({ ...patch, gezien_op: null, laatste_aanvraag_op: new Date().toISOString() }).eq('id', eerder.id);
  if (error) ({ error } = await sb.from('leads').update({ ...patch, gezien_op: null }).eq('id', eerder.id));
  if (error && Object.keys(patch).length) {
    // gezien_op ontbreekt (migratie niet gedraaid): dan alleen de inhoud.
    const { error: tweede } = await sb.from('leads').update(patch).eq('id', eerder.id);
    if (tweede) console.error('[lead] bestaande lead niet bijgewerkt:', tweede.message);
  }
}

function dagTekst(datum: string, tijd: string): string {
  const d = new Date(`${datum}T12:00:00`).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${d} ${tijd}`;
}

export async function neemWebleadIn(invoer: WebleadInvoer): Promise<WebleadUitkomst> {
  const waarschuwingen: string[] = [];
  const lead = invoer.lead;
  const sbVooraf = kmsAdmin();

  // Dubbele aanvraag? Dan de open lead van dit adres bijwerken in plaats van een tweede maken.
  const eerder = sbVooraf ? await vindOpenLead(sbVooraf, lead.email).catch(() => null) : null;
  let leadId: string | null;
  if (eerder && sbVooraf) {
    await werkOpenLeadBij(sbVooraf, eerder, lead);
    leadId = eerder.id;
  } else {
    const opslag = await saveLead(lead);
    if (!opslag.saved) return { opgeslagen: false, id: null, fout: opslag.fout, waarschuwingen };
    leadId = opslag.id ?? null;
  }
  const id = leadId;
  const sb = sbVooraf;
  if (!id || !sb) {
    waarschuwingen.push('Lead staat in de database, maar het id kwam niet terug: taak en offerte zijn niet aangemaakt.');
    return { opgeslagen: true, id, waarschuwingen };
  }
  const samengevoegd = Boolean(eerder);

  const kanaal = schoonBronKanaal(lead.bron_kanaal);
  const kanaalLabel = kanaal ? BRON_KANAAL_LABEL[kanaal] : 'de website';
  const wie = (lead.company || '').trim() || lead.name;
  // Product-id's uit de browser eerst controleren: een onbekend id breekt anders de hele insert.
  let regels = invoer.regels ?? [];
  if (regels.length) regels = zonderOnbekendeProducten(regels, await bekendeProductIds(sb, regels));
  let positieStart = 0;
  if (samengevoegd && regels.length) {
    // Alleen wat nog niet bij de lead staat (twee keer verstuurd = geen dubbele artikelen).
    const { data: staatAl } = await sb.from('lead_regels').select('product_id, omschrijving, kleur, maat, aantal').eq('lead_id', id);
    const bestaand = (staatAl as Pick<LeadRegelInvoer, 'product_id' | 'omschrijving' | 'kleur' | 'maat' | 'aantal'>[]) ?? [];
    positieStart = bestaand.length;
    regels = alleenNieuweRegels(bestaand, regels);
  }
  const uit: WebleadUitkomst = { opgeslagen: true, id, waarschuwingen, samengevoegd };
  const tijdlijn: string[] = [
    samengevoegd
      ? `Opnieuw een aanvraag via ${kanaalLabel}. Bij deze lead gezet omdat hetzelfde e-mailadres al een open aanvraag had.`
      : `Binnengekomen via ${kanaalLabel}.`,
  ];

  // 1. Productregels.
  if (regels.length) {
    const { error } = await sb.from('lead_regels').insert(
      regels.map((r, i) => ({ lead_id: id, product_id: r.product_id, omschrijving: r.omschrijving, kleur: r.kleur, maat: r.maat, aantal: r.aantal, opmerking: r.opmerking, positie: positieStart + i })),
    );
    if (error) {
      console.error('[lead] productregels niet opgeslagen:', error.message);
      waarschuwingen.push('De gekozen artikelen konden niet apart worden opgeslagen (ze staan wel in het bericht).');
    } else tijdlijn.push(`${aantalArtikelen(regels)} artikel${aantalArtikelen(regels) === 1 ? '' : 'en'} ${samengevoegd ? 'erbij' : 'gekozen'}${regels.length > aantalArtikelen(regels) ? `, ${regels.length} regels per maat` : ''}.`);
  }

  // 2. Logo naar de logobibliotheek (bij de lead, later bij de klant).
  if (invoer.logo?.dataUrl) {
    const url = await slaLogoOp(sb, id, invoer.logo, kanaalLabel).catch((e) => {
      console.error('[lead] logo upload mislukt:', e);
      return null;
    });
    uit.logoUrl = url;
    if (url) tijdlijn.push('Logo aangeleverd, staat bij de logo’s van deze lead.');
    else waarschuwingen.push('Het logo kon niet in de logobibliotheek worden gezet. Alleen PNG, JPG, WEBP of GIF tot 2,5 MB kan via de website; vraag bij een ander bestand (bijvoorbeeld SVG) het logo per mail op.');
  }

  // 3. Opvolgtaak. Bij samenvoegen alleen als de lead er nog geen heeft.
  if (invoer.opties?.taak !== false && !(samengevoegd && eerder?.volgende_taak_id)) {
    try {
      const eigenaar = await standaardEigenaar(sb);
      const moment = opvolgMoment();
      const omschrijving = [
        `${lead.name}${lead.company ? `, ${lead.company}` : ''}`,
        lead.phone ? `Telefoon: ${lead.phone}` : '',
        lead.email ? `E-mail: ${lead.email}` : '',
        `Via: ${kanaalLabel}${lead.utm_campaign ? ` (campagne ${lead.utm_campaign})` : ''}`,
        regels.length ? `${aantalArtikelen(regels)} artikel${aantalArtikelen(regels) === 1 ? '' : 'en'} gekozen` : '',
        `Openen: /dashboard/leads/${id}`,
      ].filter(Boolean);
      const taak = await maakTaak({
        titel: `Aanvraag van ${wie} opvolgen`,
        omschrijving: omschrijving.join('\n'),
        vervaldatum: moment.datum,
        tijd: moment.tijd,
        persoon_id: eigenaar?.id ?? null,
        prioriteit: kanaal === 'configurator' || kanaal === 'selectie' ? 'hoog' : 'normaal',
        soort: 'taak',
        herinnering_minuten: 0,
      });
      if ('id' in taak) {
        await sb.from('taken').update({ lead_id: id }).eq('id', taak.id);
        const patch: Record<string, unknown> = { volgende_taak_id: taak.id, volgende_stap: 'Aanvraag opvolgen', opvolgdatum: moment.datum };
        if (eigenaar) { patch.eigenaar_id = eigenaar.id; patch.eigenaar = eigenaar.naam; }
        const { error } = await sb.from('leads').update(patch).eq('id', id);
        if (error) console.error('[lead] taak aangemaakt maar niet aan de lead gekoppeld:', error.message);
        uit.taak = { id: taak.id, datum: moment.datum, tijd: moment.tijd, persoon: eigenaar?.naam ?? null };
        tijdlijn.push(`Taak voor ${eigenaar?.naam ?? 'het team'}: opvolgen ${dagTekst(moment.datum, moment.tijd)}.`);
      } else {
        console.error('[lead] opvolgtaak niet aangemaakt:', taak.fout);
        waarschuwingen.push('De opvolgtaak kon niet worden aangemaakt.');
      }
    } catch (e) {
      console.error('[lead] opvolgtaak mislukt:', e);
      waarschuwingen.push('De opvolgtaak kon niet worden aangemaakt.');
    }
  }

  // 4. Concept-offerte bij gekozen artikelen. Hangt er al een offerte aan de lead, dan
  //    komt er geen tweede: nieuwe artikelen gaan op het bestaande concept.
  if (regels.length && invoer.opties?.offerte !== false) {
    try {
      let offerteId: string | null = null;
      let bestaandConcept = false;
      let alVerstuurd = false;
      if (samengevoegd) {
        const { data: eerdere } = await sb.from('offertes').select('id, status').eq('lead_id', id).order('created_at', { ascending: false });
        const lijst = (eerdere as { id: string; status: string }[]) ?? [];
        const concept = lijst.find((o) => o.status === 'concept');
        if (concept) {
          offerteId = concept.id;
          bestaandConcept = true;
        } else if (lijst.length) alVerstuurd = true;
      }
      if (alVerstuurd) {
        tijdlijn.push('Er hangt al een verstuurde offerte aan deze lead; de nieuwe artikelen staan alleen bij de lead.');
      } else {
        if (!offerteId) {
          const geldig = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
          offerteId = await maakOfferte({
            organisatie_id: null,
            contactpersoon: lead.name,
            geldig_tot: geldig,
            notitie: `Automatisch klaargezet uit een webaanvraag (${kanaalLabel}). Controleer prijzen, maten en bedrukking voordat je hem verstuurt.`,
          });
          if (offerteId) await sb.from('offertes').update({ lead_id: id }).eq('id', offerteId);
        }
        if (offerteId) {
          const aantal = await regelsNaarOfferte(sb, offerteId, regels);
          const { data: o } = await sb.from('offertes').select('offertenummer').eq('id', offerteId).maybeSingle();
          const nummer = (o as { offertenummer: number } | null)?.offertenummer ?? null;
          uit.offerte = { id: offerteId, nummer, regels: aantal };
          tijdlijn.push(
            bestaandConcept
              ? `${aantal} regel${aantal === 1 ? '' : 's'} toegevoegd aan concept-offerte${nummer ? ` ${nummer}` : ''}.`
              : `Concept-offerte${nummer ? ` ${nummer}` : ''} klaargezet met ${aantal} regel${aantal === 1 ? '' : 's'} (catalogusprijzen, nog niet verstuurd).`,
          );
          if (aantal < regels.length) waarschuwingen.push(`${regels.length - aantal} artikel(en) kwamen niet op de concept-offerte.`);
        } else waarschuwingen.push('De concept-offerte kon niet worden aangemaakt.');
      }
    } catch (e) {
      console.error('[lead] concept-offerte mislukt:', e);
      waarschuwingen.push('De concept-offerte kon niet worden aangemaakt.');
    }
  }

  // 5. Campagnes met trigger "nieuwe lead" (optioneel gefilterd op ingang): meteen inschrijven.
  //    Niet bij samenvoegen: die lead is bij de eerste aanvraag al ingeschreven.
  if (invoer.opties?.campagnes !== false && !samengevoegd) {
    try {
      const n = await schrijfLeadInBijTriggers(id);
      if (n) tijdlijn.push(`Ingeschreven in ${n === 1 ? 'een campagne' : `${n} campagnes`} voor nieuwe leads.`);
      uit.campagnes = n;
    } catch (e) {
      console.error('[lead] campagnetrigger mislukt:', e);
      waarschuwingen.push('Inschrijven in de campagne voor nieuwe leads lukte niet; de dagelijkse campagnerun pakt hem alsnog op.');
    }
  }

  // 6. Tijdlijn en audit.
  const { error: tlFout } = await sb.from('lead_activiteiten').insert({ lead_id: id, soort: 'systeem', tekst: tijdlijn.join(' '), door: 'website' });
  if (tlFout) console.error('[lead] tijdlijnregel niet opgeslagen:', tlFout.message);
  await logAudit('lead.binnen', {
    entiteit: 'lead',
    entiteitId: id,
    actor: 'website',
    details: { bron_kanaal: kanaal, samengevoegd, taak: uit.taak?.id ?? null, offerte: uit.offerte?.id ?? null, regels: regels.length, campagnes: uit.campagnes ?? 0, waarschuwingen },
  });
  if (waarschuwingen.length) console.error('[lead] binnen met waarschuwingen:', id, waarschuwingen);
  return uit;
}
