import { kmsAdmin } from '@/lib/kms/adminClient';
import { laadVariantLijsten } from '@/lib/kms/varianten';
import { kolomOntbreekt } from '@/lib/kms/kolomTerugval';
import { meldOnbekend, normaliseerImportVariant } from '@/lib/kms/importNormaliseren';

/**
 * Bulk-import voor het KMS. Plak CSV (puntkomma of komma) in een textarea,
 * eerste regel zijn de kolomkoppen. Per regel een insert via kmsAdmin.
 * Alleen server-side gebruiken, altijd achter dashAuthed().
 */

export type ImportResultaat = {
  aangemaakt: number;
  overgeslagen: number;
  fouten: string[];
};

/** Eenvoudige CSV-parser: splitst op nieuwe regels en op puntkomma OF komma. */
export function parseCsv(csv: string): { koppen: string[]; rijen: string[][] } {
  const regels = csv
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  if (regels.length === 0) return { koppen: [], rijen: [] };

  const splitsOp = (regel: string): string[] => {
    const scheiding = regel.includes(';') ? ';' : ',';
    return regel.split(scheiding).map((v) => v.trim());
  };

  const koppen = splitsOp(regels[0]).map((k) => k.toLowerCase());
  const rijen = regels.slice(1).map(splitsOp);
  return { koppen, rijen };
}

/**
 * Robuuste CSV-parser die quotes, ingesloten scheidingstekens en BOM aankan.
 * Detecteert automatisch puntkomma of komma als scheidingsteken op basis van
 * de eerste regel (kopregel). Geschikt voor exports uit Odoo (FHB-lijsten),
 * waarin omschrijvingen komma's en regelafbrekingen binnen aanhalingstekens
 * kunnen bevatten.
 */
export function parseCsvRobuust(csv: string): { koppen: string[]; rijen: string[][] } {
  // BOM verwijderen.
  let tekst = csv.replace(/^﻿/, '');
  if (tekst.trim().length === 0) return { koppen: [], rijen: [] };

  // Scheidingsteken bepalen op de eerste niet-lege regel buiten quotes.
  const scheiding = bepaalScheiding(tekst);

  const records: string[][] = [];
  let veldwaarde = '';
  let huidig: string[] = [];
  let inQuotes = false;

  // Normaliseer regeleindes zodat \r\n als een teken telt.
  tekst = tekst.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (inQuotes) {
      if (c === '"') {
        if (tekst[i + 1] === '"') {
          veldwaarde += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        veldwaarde += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === scheiding) {
      huidig.push(veldwaarde);
      veldwaarde = '';
    } else if (c === '\n') {
      huidig.push(veldwaarde);
      records.push(huidig);
      huidig = [];
      veldwaarde = '';
    } else {
      veldwaarde += c;
    }
  }
  // Laatste veld/record afronden.
  if (veldwaarde.length > 0 || huidig.length > 0) {
    huidig.push(veldwaarde);
    records.push(huidig);
  }

  // Lege records (alleen lege velden) eruit filteren.
  const gevuld = records.filter((r) => r.some((v) => v.trim().length > 0));
  if (gevuld.length === 0) return { koppen: [], rijen: [] };

  const koppen = gevuld[0].map((k) => k.trim().toLowerCase());
  const rijen = gevuld.slice(1).map((r) => r.map((v) => v.trim()));
  return { koppen, rijen };
}

/** Telt komma's versus puntkomma's buiten quotes op de eerste regel. */
function bepaalScheiding(tekst: string): ';' | ',' {
  let komma = 0;
  let punt = 0;
  let inQuotes = false;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && c === ';') punt++;
    else if (!inQuotes && c === ',') komma++;
    else if (!inQuotes && (c === '\n' || c === '\r')) {
      if (komma > 0 || punt > 0) break;
    }
  }
  return punt >= komma ? ';' : ',';
}

/** Maakt per kolomkop een index, zodat de volgorde flexibel mag zijn. */
function kolomIndex(koppen: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  koppen.forEach((k, i) => {
    if (!(k in idx)) idx[k] = i;
  });
  return idx;
}

function veld(rij: string[], idx: Record<string, number>, ...namen: string[]): string {
  for (const n of namen) {
    const i = idx[n];
    if (i !== undefined && rij[i] !== undefined) {
      const v = rij[i].trim();
      if (v) return v;
    }
  }
  return '';
}

export async function importeerMedewerkers(orgId: string, csv: string): Promise<ImportResultaat> {
  const res: ImportResultaat = { aangemaakt: 0, overgeslagen: 0, fouten: [] };
  const sb = kmsAdmin();
  if (!sb) {
    res.fouten.push('Database niet gekoppeld.');
    return res;
  }
  if (!orgId) {
    res.fouten.push('Geen klant gekozen.');
    return res;
  }

  const { koppen, rijen } = parseCsv(csv);
  if (rijen.length === 0) {
    res.fouten.push('Geen regels gevonden onder de kolomkoppen.');
    return res;
  }
  const idx = kolomIndex(koppen);

  for (let i = 0; i < rijen.length; i++) {
    const rij = rijen[i];
    const regelnr = i + 2; // +1 voor kop, +1 voor 1-gebaseerd tellen
    const naam = veld(rij, idx, 'naam', 'volledige naam');
    if (!naam) {
      res.overgeslagen++;
      res.fouten.push(`Regel ${regelnr}: geen naam, overgeslagen.`);
      continue;
    }

    // Naam opsplitsen in voornaam/achternaam als die kolommen ontbreken.
    let voornaam = veld(rij, idx, 'voornaam') || null;
    let achternaam = veld(rij, idx, 'achternaam') || null;
    if (!voornaam && !achternaam) {
      const delen = naam.split(/\s+/);
      voornaam = delen[0] ?? null;
      achternaam = delen.length > 1 ? delen.slice(1).join(' ') : null;
    }

    const rij_data = {
      organisatie_id: orgId,
      naam,
      voornaam,
      achternaam,
      email: veld(rij, idx, 'email', 'e-mail') || null,
      functie: veld(rij, idx, 'functie') || null,
      personeelsnummer: veld(rij, idx, 'personeelsnummer', 'personeelsnr') || null,
      telefoon: veld(rij, idx, 'telefoon', 'telefoonnummer') || null,
    };

    const { error } = await sb.from('medewerkers').insert(rij_data);
    if (error) {
      res.overgeslagen++;
      res.fouten.push(`Regel ${regelnr} (${naam}): ${error.message}`);
    } else {
      res.aangemaakt++;
    }
  }

  return res;
}

export async function importeerProducten(csv: string): Promise<ImportResultaat> {
  const res: ImportResultaat = { aangemaakt: 0, overgeslagen: 0, fouten: [] };
  const sb = kmsAdmin();
  if (!sb) {
    res.fouten.push('Database niet gekoppeld.');
    return res;
  }

  const { koppen, rijen } = parseCsv(csv);
  if (rijen.length === 0) {
    res.fouten.push('Geen regels gevonden onder de kolomkoppen.');
    return res;
  }
  const idx = kolomIndex(koppen);

  for (let i = 0; i < rijen.length; i++) {
    const rij = rijen[i];
    const regelnr = i + 2;
    const naam = veld(rij, idx, 'naam');
    if (!naam) {
      res.overgeslagen++;
      res.fouten.push(`Regel ${regelnr}: geen naam, overgeslagen.`);
      continue;
    }

    const rij_data = {
      naam,
      merk: veld(rij, idx, 'merk') || null,
      categorie: veld(rij, idx, 'categorie') || null,
      subcategorie: veld(rij, idx, 'subcategorie') || null,
      sku: veld(rij, idx, 'sku', 'artikelnummer') || null,
      ean: veld(rij, idx, 'ean') || null,
      btw: 21,
    };

    const { error } = await sb.from('producten').insert(rij_data);
    if (error) {
      res.overgeslagen++;
      res.fouten.push(`Regel ${regelnr} (${naam}): ${error.message}`);
    } else {
      res.aangemaakt++;
    }
  }

  return res;
}

// --- Leverancierslijst (FHB/Odoo): een regel per variant, groeperen per artikel ---

export type LijstResultaat = {
  productenAangemaakt: number;
  productenHergebruikt: number;
  variantenAangemaakt: number;
  overgeslagen: number;
  fouten: string[];
};

/** Parst een getal uit een tekst zoals "12,50", "12.50" of "1.234,56". Leeg -> null. */
function parseGetal(waarde: string): number | null {
  const v = waarde.trim();
  if (!v) return null;
  // Verwijder valutatekens en spaties.
  let schoon = v.replace(/[^0-9.,-]/g, '');
  if (!schoon) return null;
  const heeftKomma = schoon.includes(',');
  const heeftPunt = schoon.includes('.');
  if (heeftKomma && heeftPunt) {
    // De laatste van de twee is het decimaalteken; de andere is duizendtal.
    if (schoon.lastIndexOf(',') > schoon.lastIndexOf('.')) {
      schoon = schoon.replace(/\./g, '').replace(',', '.');
    } else {
      schoon = schoon.replace(/,/g, '');
    }
  } else if (heeftKomma) {
    schoon = schoon.replace(',', '.');
  }
  const n = Number(schoon);
  return Number.isFinite(n) ? n : null;
}

/** Parst een geheel getal voor voorraad. Leeg of ongeldig -> 0. */
function parseVoorraad(waarde: string): number {
  const n = parseGetal(waarde);
  if (n === null) return 0;
  return Math.trunc(n);
}

/** Parst een btw-percentage uit "21%", "21,00 %" of "BTW 21%". Standaard 21. */
function parseBtw(waarde: string): number {
  const n = parseGetal(waarde);
  if (n === null) return 21;
  return n;
}

/**
 * Haalt de maat uit een "Variant waardes"-veld. Odoo schrijft dit als
 * "Maat: 3XL" of soms "Maat: 3XL, Kleur: Marine". We pakken de waarde achter
 * "Maat:" en vallen anders terug op de hele tekst.
 */
function parseMaat(waarde: string): string {
  const v = waarde.trim();
  if (!v) return '';
  // Splits op komma in losse attributen.
  const delen = v.split(',').map((d) => d.trim());
  for (const deel of delen) {
    const m = deel.match(/^maat\s*:?\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  // Geen expliciet "Maat:"-label: als er een attribuut is, dat als maat nemen.
  if (delen.length === 1) {
    const enkel = delen[0];
    const m = enkel.match(/^[^:]+:\s*(.+)$/);
    return (m ? m[1] : enkel).trim();
  }
  return '';
}

/**
 * Importeert een leverancierslijst (FHB/Odoo-export) waarin elke regel een
 * variant (maat) is. Groepeert per artikel op (art_nr_leverancier + merk) en
 * maakt per groep een product met meerdere varianten. Bestaande producten met
 * hetzelfde artikelnummer en merk worden hergebruikt; ontbrekende varianten
 * worden toegevoegd. Inserts gaan in batches om timeouts te voorkomen.
 */
export async function importeerProductenLijst(csv: string): Promise<LijstResultaat> {
  const res: LijstResultaat = {
    productenAangemaakt: 0,
    productenHergebruikt: 0,
    variantenAangemaakt: 0,
    overgeslagen: 0,
    fouten: [],
  };
  const sb = kmsAdmin();
  if (!sb) {
    res.fouten.push('Database niet gekoppeld.');
    return res;
  }

  const { koppen, rijen } = parseCsvRobuust(csv);
  if (rijen.length === 0) {
    res.fouten.push('Geen regels gevonden onder de kolomkoppen.');
    return res;
  }
  const idx = kolomIndex(koppen);

  type VariantInvoer = {
    maat: string | null;
    kleur: string | null;
    maat_leverancier: string | null;
    kleur_leverancier: string | null;
    ean: string | null;
    inkoopprijs: number | null;
    verkoopprijs: number | null;
    voorraad: number;
  };
  type Groep = {
    naam: string;
    merk: string | null;
    art_nr_leverancier: string;
    sku: string | null;
    categorie: string | null;
    omschrijving: string | null;
    btw: number;
    afbeeldingen: string[];
    varianten: VariantInvoer[];
  };

  const groepen = new Map<string, Groep>();
  // Kleuren en maten naar de vaste lijst; wat daar niet in staat melden we na afloop.
  const lijst = await laadVariantLijsten();
  const onbekendeKleuren = new Map<string, number>();
  const onbekendeMaten = new Map<string, number>();

  for (let i = 0; i < rijen.length; i++) {
    const rij = rijen[i];
    const regelnr = i + 2;
    const naam = veld(rij, idx, 'naam');
    const artNr = veld(rij, idx, 'artikelnr.', 'artikelnr', 'artikelnummer');
    const merk = veld(rij, idx, 'merk') || '';

    if (!naam && !artNr) {
      res.overgeslagen++;
      res.fouten.push(`Regel ${regelnr}: geen naam en geen artikelnummer, overgeslagen.`);
      continue;
    }
    // Een product zonder artikelnummer groeperen we op naam + merk.
    const groepSleutel = (artNr || naam).toLowerCase() + '|' + merk.toLowerCase();

    // "Basis Kleur" kan dubbel voorkomen; veld() pakt de eerste gevulde waarde.
    const norm = normaliseerImportVariant(
      veld(rij, idx, 'basis kleur', 'kleur') || null,
      parseMaat(veld(rij, idx, 'variant waardes', 'variant', 'maat')) || null,
      lijst,
    );
    if (norm.onbekendeKleur) onbekendeKleuren.set(norm.onbekendeKleur, (onbekendeKleuren.get(norm.onbekendeKleur) ?? 0) + 1);
    if (norm.onbekendeMaat) onbekendeMaten.set(norm.onbekendeMaat, (onbekendeMaten.get(norm.onbekendeMaat) ?? 0) + 1);
    const variant: VariantInvoer = {
      maat: norm.maat,
      kleur: norm.kleur,
      maat_leverancier: norm.maatLeverancier,
      kleur_leverancier: norm.kleurLeverancier,
      ean: veld(rij, idx, 'barcode', 'ean') || null,
      inkoopprijs: parseGetal(veld(rij, idx, 'inkoopprijs ex btw', 'inkoopprijs')),
      verkoopprijs: parseGetal(veld(rij, idx, 'verkoopprijs ex btw', 'verkoopprijs')),
      voorraad: parseVoorraad(veld(rij, idx, 'voorraad')),
    };

    const interneRef = veld(rij, idx, 'interne referentie', 'interne ref');
    const afbeelding = veld(rij, idx, 'afbeelding', 'afbeeldingen');

    let groep = groepen.get(groepSleutel);
    if (!groep) {
      // Interne referentie als sku, maar de maatsuffix eraf strippen indien aanwezig.
      let sku: string | null = interneRef || null;
      const ruweMaat = variant.maat_leverancier ?? variant.maat;
      if (sku && ruweMaat) {
        const suffix = new RegExp('[-_\\s]*' + ruweMaat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
        const gestript = sku.replace(suffix, '').trim();
        sku = gestript || null;
      }
      groep = {
        naam: naam || artNr,
        merk: merk || null,
        art_nr_leverancier: artNr || (naam || artNr),
        sku,
        categorie: veld(rij, idx, 'productcategorie', 'categorie') || null,
        omschrijving: veld(rij, idx, 'omschrijving') || null,
        btw: parseBtw(veld(rij, idx, 'btw verkoop', 'btw inkoop', 'btw')),
        afbeeldingen: afbeelding ? [afbeelding] : [],
        varianten: [],
      };
      groepen.set(groepSleutel, groep);
    } else if (afbeelding && !groep.afbeeldingen.includes(afbeelding)) {
      groep.afbeeldingen.push(afbeelding);
    }
    groep.varianten.push(variant);
  }

  // Sleutel om dubbele varianten binnen een product te herkennen. Op de genormaliseerde
  // waarden, zodat "XXL" in de database en "2XL" in het bestand als dezelfde maat tellen.
  const variantSleutel = (v: { maat: string | null; kleur: string | null; ean: string | null }) => {
    const n = normaliseerImportVariant(v.kleur, v.maat, lijst);
    return `${(n.maat ?? '').toLowerCase()}|${(n.kleur ?? '').toLowerCase()}|${(v.ean ?? '').toLowerCase()}`;
  };

  const BATCH = 500;
  let variantBuffer: Record<string, unknown>[] = [];

  const flushVarianten = async () => {
    if (variantBuffer.length === 0) return;
    let { error } = await sb.from('product_varianten').insert(variantBuffer);
    // Kolommen kleur_leverancier/maat_leverancier bestaan nog niet (migratie varianten niet gedraaid).
    if (error && kolomOntbreekt(error)) {
      const zonder = variantBuffer.map(({ kleur_leverancier: _k, maat_leverancier: _m, ...rest }) => rest);
      ({ error } = await sb.from('product_varianten').insert(zonder));
    }
    if (error) {
      res.fouten.push(`Varianten-batch mislukt: ${error.message}`);
    } else {
      res.variantenAangemaakt += variantBuffer.length;
    }
    variantBuffer = [];
  };

  for (const groep of groepen.values()) {
    // Bestaand product zoeken op artikelnummer + merk.
    let productId: string | null = null;
    const query = sb.from('producten').select('id').eq('art_nr_leverancier', groep.art_nr_leverancier).limit(1);
    const { data: bestaand, error: zoekFout } = groep.merk
      ? await query.eq('merk', groep.merk)
      : await query.is('merk', null);

    if (zoekFout) {
      res.overgeslagen += groep.varianten.length;
      res.fouten.push(`Artikel ${groep.art_nr_leverancier} (${groep.naam}): zoeken mislukt (${zoekFout.message}).`);
      continue;
    }

    let bestaandeVarianten = new Set<string>();
    if (bestaand && bestaand.length > 0) {
      productId = bestaand[0].id as string;
      res.productenHergebruikt++;
      // Bestaande varianten ophalen om dubbele te voorkomen.
      const { data: varData } = await sb
        .from('product_varianten')
        .select('maat,kleur,ean')
        .eq('product_id', productId);
      if (varData) {
        bestaandeVarianten = new Set(varData.map((v) => variantSleutel(v as VariantInvoer)));
      }
    } else {
      const { data: nieuw, error: insFout } = await sb
        .from('producten')
        .insert({
          naam: groep.naam,
          merk: groep.merk,
          art_nr_leverancier: groep.art_nr_leverancier,
          sku: groep.sku,
          categorie: groep.categorie,
          omschrijving: groep.omschrijving,
          btw: groep.btw,
          afbeeldingen: groep.afbeeldingen,
        })
        .select('id')
        .single();
      if (insFout || !nieuw) {
        res.overgeslagen += groep.varianten.length;
        res.fouten.push(`Artikel ${groep.art_nr_leverancier} (${groep.naam}): aanmaken mislukt (${insFout?.message ?? 'onbekend'}).`);
        continue;
      }
      productId = nieuw.id as string;
      res.productenAangemaakt++;
    }

    // Varianten toevoegen, dubbele binnen de groep en t.o.v. bestaande overslaan.
    const ditProductGezien = new Set<string>();
    for (const v of groep.varianten) {
      const sleutel = variantSleutel(v);
      if (bestaandeVarianten.has(sleutel) || ditProductGezien.has(sleutel)) {
        res.overgeslagen++;
        continue;
      }
      ditProductGezien.add(sleutel);
      variantBuffer.push({
        product_id: productId,
        maat: v.maat,
        kleur: v.kleur,
        maat_leverancier: v.maat_leverancier,
        kleur_leverancier: v.kleur_leverancier,
        ean: v.ean,
        inkoopprijs: v.inkoopprijs,
        verkoopprijs: v.verkoopprijs,
        voorraad: v.voorraad,
      });
      if (variantBuffer.length >= BATCH) await flushVarianten();
    }
  }

  await flushVarianten();
  // Onbekende waarden vooraan, zodat ze binnen de eerste 20 meldingen op het scherm staan.
  const onbekend = [meldOnbekend('kleuren', onbekendeKleuren), meldOnbekend('maten', onbekendeMaten)].filter((m): m is string => !!m);
  res.fouten.unshift(...onbekend);
  return res;
}
