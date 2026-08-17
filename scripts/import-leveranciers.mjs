#!/usr/bin/env node
/**
 * Importeert de leveranciersbestanden naar Supabase.
 *
 * Draaien:
 *   npm i -D xlsx
 *   node scripts/import-leveranciers.mjs --dry        # alleen tellen en controleren
 *   node scripts/import-leveranciers.mjs              # alle merken wegschrijven
 *   node scripts/import-leveranciers.mjs --merk=brook # één merk
 *
 * Zoekt de bestanden in data/leveranciers/, en anders in public/Data per merk/.
 * Zet ze bij voorkeur in data/leveranciers: alles onder public/ wordt door Vercel
 * één-op-één als website geserveerd, en upower assortiment.xlsx bevat de inkoopkorting.
 *
 * PRIJZEN. Het script schrijft alleen de bruto adviesverkoopprijs naar
 * producten.verkoopprijs_basis. Verkoop- en inkoopprijs per variant worden daarna in
 * de database berekend door herbereken_variantprijzen():
 *
 *   verkoop = basis x (1 + maattoeslag van het merk voor die maat)
 *   inkoop  = verkoop x (1 - kortingspercentage van de leverancier)
 *
 * Een nieuwe conditie of prijsverhoging is dus één veld aanpassen plus die functie
 * draaien; geen herimport nodig.
 *
 * IDEMPOTENT. Producten matchen op sku. Varianten worden per merk verwijderd en
 * opnieuw geschreven, zodat vervallen kleuren en maten echt verdwijnen. De vlag
 * producten.actief blijft bij bestaande producten ongemoeid.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIRS = [join(ROOT, 'data', 'leveranciers'), join(ROOT, 'public', 'Data per merk')]
  .filter((p) => existsSync(p));
const DATA_DIR = DATA_DIRS[0];

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ONLY = (args.find((a) => a.startsWith('--merk=')) || '').split('=')[1]?.toLowerCase() || null;

if (!DATA_DIRS.length) {
  console.error('Geen datamap gevonden (data/leveranciers of public/Data per merk).');
  process.exit(1);
}

// ---------------------------------------------------------------- env
for (const f of ['.env.local', '.env']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  // Splitsen op /\r?\n/ en niet op '\n': in een JavaScript-regex telt \r als
  // regeleinde, dus (.*)$ matcht nooit op een Windows-bestand met CRLF.
  for (const regel of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = regel.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY && (!URL || !KEY)) {
  console.error('Ontbrekend: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = DRY ? null : createClient(URL, KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------- helpers
const schoon = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/^'/, '').trim();
  return s === '' || s === 'None' || s === 'nan' ? null : s;
};
const getal = (v) => {
  const f = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(f) && f > 0 ? Math.round(f * 100) / 100 : null;
};
const code = (v) => schoon(v)?.replace(/\.0$/, '') ?? null;
const https = (u) => (!u ? null : /^https?:\/\//i.test(u) ? u : `https://${u}`);
/**
 * Blåkläder levert de commerciële tekst als HTML-opsomming: "· regel<br>·regel".
 * Op de site is dat één alinea, dus zet de bullets om naar losse zinnen.
 */
const opsomming = (v) => {
  const t = schoon(v);
  if (!t) return null;
  return t
    .replace(/<br\s*\/?>/gi, ' ')
    .split('·')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (/[.!?]$/.test(d) ? d : `${d}.`))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};
/** Kolomkoppen met spaties eromheen komen in meerdere leveranciersbestanden voor. */
const getrimd = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), v]));

/** Alle .xlsx in de datamap en één niveau daaronder, zodat submappen per merk meetellen. */
function alleBestanden() {
  const uit = [];
  for (const map of DATA_DIRS) {
    for (const naam of readdirSync(map, { withFileTypes: true })) {
      if (naam.isFile() && naam.name.endsWith('.xlsx')) uit.push([naam.name, join(map, naam.name)]);
      else if (naam.isDirectory()) {
        for (const sub of readdirSync(join(map, naam.name))) {
          if (sub.endsWith('.xlsx')) uit.push([`${naam.name}/${sub}`, join(map, naam.name, sub)]);
        }
      }
    }
  }
  return uit;
}

/** Zoekt een bestand op losse woorden, zodat spaties en (1)-suffixen niet uitmaken. */
function bestand(...woorden) {
  const hit = alleBestanden().find(([naam]) => {
    const l = naam.toLowerCase();
    return woorden.every((w) => l.includes(w.toLowerCase()));
  });
  return hit ? hit[1] : null;
}

/**
 * Beeldbestanden voor een merk. Zoekt in beide datamappen en, als laatste, in
 * public/merken/<submap> - want daar staan de foto's die al klaargezet zijn voor
 * de site, en van sommige merken (Tricorp) is dat de enige plek.
 */
function plaatjesIn(submap) {
  const kandidaten = [
    ...DATA_DIRS.map((d) => (submap ? join(d, submap) : d)),
    ...(submap ? [join(ROOT, 'public', 'merken', submap)] : []),
  ];
  for (const map of kandidaten) {
    if (!existsSync(map)) continue;
    const beelden = readdirSync(map).filter((n) => /\.(jpe?g|png|webp)$/i.test(n));
    if (beelden.length) return beelden;
  }
  return [];
}
function lees(pad, opties = {}) {
  const wb = xlsx.readFile(pad);
  const blad = wb.Sheets[opties.blad || wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(blad, { defval: null, range: opties.vanafRij ?? 0 });
}

const fouten = [];
const meld = (merk, sku, wat) => fouten.push({ merk, sku, wat });

// ---------------------------------------------------------------- merken
const producten = [];
const varianten = [];
const kleurfotos = [];

function product(p) {
  if (!p.verkoopprijs_basis) meld(p.merk, p.sku, 'geen verkoopprijs');
  if (!p.afbeeldingen?.length) meld(p.merk, p.sku, 'geen foto');
  producten.push(p);
}

// --- Snickers: assortimentlijst geeft de prijs, productlijst de kleuren en maten
function snickers() {
  const fAss = bestand('snickers', 'assortiment');
  const fProd = bestand('snickers', 'producten');
  if (!fAss || !fProd) return console.warn('Snickers: bestanden niet gevonden, overgeslagen');

  const prijs = new Map();
  for (const r of lees(fAss, { vanafRij: 1 })) {
    const waarden = Object.values(r);
    const art = code(waarden[0]);
    const p = getal(waarden[1]);
    if (art && p) prijs.set(art, p);
  }

  const rijen = lees(fProd);
  const perArtikel = new Map();
  for (const r of rijen) {
    const art = code(r.ModelCode);
    if (!art || !prijs.has(art)) continue;
    if (!perArtikel.has(art)) perArtikel.set(art, []);
    perArtikel.get(art).push(r);
  }

  const imgKolom = Object.keys(rijen[0] ?? {})[0]; // 'This is the main image'
  for (const [art, g] of perArtikel) {
    const r = g[0];
    const sku = `SNI-${art}`;
    product({
      sku, art_nr_leverancier: art,
      naam: schoon(r.Name) || schoon(r.ProdDesc1),
      omschrijving: schoon(r.Intro),
      merk: 'Snickers Workwear',
      categorie: schoon(r['Family Collection_text']) || schoon(r.ProdDesc1),
      materiaal: schoon(r.Material_info),
      verkoopprijs_basis: prijs.get(art),
      afbeeldingen: [schoon(r[imgKolom])].filter(Boolean),
      maatwerk_lengte: false,
    });
    const gezien = new Set();
    for (const x of g) {
      varianten.push({ sku, maat: code(x.Size), kleur: schoon(x.Colour_text), ean: code(x.EAN_text) });
      const kl = schoon(x.Colour_text);
      const url = schoon(x[imgKolom]);
      if (kl && url && !gezien.has(kl)) { gezien.add(kl); kleurfotos.push({ sku, kleur: kl, url }); }
    }
  }
}

// --- WK: PIM-export, alles zit in één bestand
function wk() {
  const f = bestand('wk');
  if (!f) return console.warn('WK: bestand niet gevonden, overgeslagen');
  const perRef = new Map();
  for (const r of lees(f)) {
    const ref = schoon(r.Product_Ref);
    if (!ref) continue;
    if (!perRef.has(ref)) perRef.set(ref, []);
    perRef.get(ref).push(r);
  }
  for (const [ref, g] of perRef) {
    const r = g[0];
    const sku = `WK-${ref}`;
    product({
      sku, art_nr_leverancier: ref,
      naam: schoon(r.Designation_nl),
      omschrijving: schoon(r.Description_nl),
      merk: 'WK. Designed To Work',
      categorie: schoon(r.Family_nl),
      geslacht: schoon(r.Gender_nl),
      materiaal: schoon(r.Composition_nl),
      verkoopprijs_basis: getal(r['verkoopprijs ex btw']),
      afbeeldingen: [https(schoon(r.URL_Packshots_Face))].filter(Boolean),
      maatwerk_lengte: false,
    });
    const gezien = new Set();
    for (const x of g) {
      varianten.push({ sku, maat: schoon(x.Size_nl), kleur: schoon(x.Colors), ean: code(x.EAN) });
      const kl = schoon(x.Colors);
      const url = https(schoon(x.URL_Packshots_Face));
      if (kl && url && !gezien.has(kl)) { gezien.add(kl); kleurfotos.push({ sku, kleur: kl, url }); }
    }
  }
}

// --- Brook Taverner: broeken krijgen een maatwerk-lengte bij bestellen
function brook() {
  const f = bestand('brook');
  if (!f) return console.warn('Brook Taverner: bestand niet gevonden, overgeslagen');
  const perSku = new Map();
  for (const r of lees(f)) {
    const s = schoon(r.Sku);
    if (!s) continue;
    if (!perSku.has(s)) perSku.set(s, []);
    perSku.get(s).push(r);
  }
  for (const [s, g] of perSku) {
    const r = g[0];
    const sku = `BT-${s}`;
    const soort = schoon(r['Clothing Type']) || '';
    product({
      sku, art_nr_leverancier: s,
      naam: schoon(r.Name),
      omschrijving: schoon(r.Description),
      merk: 'Brook Taverner',
      categorie: soort || null,
      geslacht: schoon(r.Gender),
      materiaal: schoon(r['Fabric Information']),
      verkoopprijs_basis: getal(r['Verkoop advies ex btw']),
      afbeeldingen: [schoon(r['Main Product Image URL'])].filter(Boolean),
      maatwerk_lengte: soort.toLowerCase() === 'broek',
    });
    const gezien = new Set();
    for (const x of g) {
      varianten.push({ sku, maat: schoon(x.Size), kleur: schoon(x.Colour), ean: null });
      const kl = schoon(x.Colour);
      const url = schoon(x['Main Product Image URL']);
      if (kl && url && !gezien.has(kl)) { gezien.add(kl); kleurfotos.push({ sku, kleur: kl, url }); }
    }
  }
}

// --- Upower: schoenen, foto's staan als losse bestanden naast het Excel
function upower() {
  const f = bestand('upower');
  if (!f) return console.warn('Upower: bestand niet gevonden, overgeslagen');
  const plaatjes = plaatjesIn('').filter((n) => /\.(jpe?g|png)$/i.test(n));
  const zoekFoto = (model) => {
    const kern = String(model || '').split(' ')[0].toLowerCase();
    const hit = kern && plaatjes.find((n) => n.toLowerCase().includes(kern));
    return hit ? `/merken/upower/${hit}` : null;
  };
  const perArt = new Map();
  for (const r of lees(f)) {
    const art = schoon(r.Artikelnummer);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }
  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `UP-${art}`;
    product({
      sku, art_nr_leverancier: art,
      naam: schoon(r.Model),
      merk: 'Upower',
      categorie: 'Werkschoenen',
      verkoopprijs_basis: getal(r.Verkoopprijs),
      afbeeldingen: [zoekFoto(r.Model)].filter(Boolean),
      maatwerk_lengte: false,
    });
    for (const x of g) varianten.push({ sku, maat: code(x.Maten), kleur: null, ean: null });
  }
}

// --- FHB: prijzen bijwerken op de al bestaande producten
function fhb() {
  const f = bestand('fhb');
  if (!f) return console.warn('FHB: bestand niet gevonden, overgeslagen');
  // FHB levert zelf geen beeld aan; Jessi zoekt de foto's er met de hand bij en
  // zet ze in public/merken/fhb. De modelnaam is de sleutel ("Florian.jpg"), een
  // kleurvariant mag erachter ("Florian - Marine 16.jpg"). Hoofdletters, spaties
  // en streepjes maken niet uit.
  const plaatjes = plaatjesIn('fhb');
  const sleutel = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const zonderExt = (n) => n.replace(/\.[^.]+$/, '');
  const fotoVoorKleur = (art, kleur) => {
    const doel = sleutel(art + kleur);
    const hit = plaatjes.find((n) => sleutel(zonderExt(n)) === doel);
    return hit ? `/merken/fhb/${hit}` : null;
  };
  // Exacte naam gaat vóór een beginnend-met-treffer: "Andre" en "Andrea" zijn
  // allebei FHB-modellen, en zonder die volgorde pakt Andre het bestand van
  // Andrea zodra de leesvolgorde van de map wijzigt.
  const hoofdfoto = (art) => {
    const doel = sleutel(art);
    const hit =
      plaatjes.find((n) => sleutel(zonderExt(n)) === doel) ??
      plaatjes.find((n) => sleutel(zonderExt(n)).startsWith(doel));
    return hit ? `/merken/fhb/${hit}` : null;
  };
  const perArt = new Map();
  for (const r of lees(f)) {
    const art = schoon(r['Artikelnr.']);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }
  for (const [art, g] of perArt) {
    const r = g[0];
    product({
      sku: `FHB-${art}`, art_nr_leverancier: art,
      naam: schoon(r.Naam),
      // Alleen meesturen als FHB zelf tekst levert. Een lege kolom zou als null
      // in de kolomlijst van de upsert belanden en de met de hand geschreven
      // omschrijvingen bij de volgende import wissen.
      ...(schoon(r['Omschrijving ']) ? { omschrijving: schoon(r['Omschrijving ']) } : {}),
      merk: 'FHB',
      categorie: schoon(r.Productcategorie),
      verkoopprijs_basis: getal(r['Verkoopprijs ex btw']),
      // Eigen bestand gaat voor: de kolom Afbeelding is in de praktijk leeg.
      afbeeldingen: [hoofdfoto(art) ?? schoon(r.Afbeelding)].filter(Boolean),
      maatwerk_lengte: false,
    });
    const gezienFHB = new Set();
    for (const x of g) {
      // FHB zet in 'Variant waardes' soms de maat ("Maat: 3XL") en soms de kleur
      // ("Kleur: Wit/Antraciet 1012"). De interne referentie is wel consistent:
      // FHB-<artikel>-<kleurcode>-<maat>, dus daar halen we de maat uit.
      const delen = (schoon(x['Interne referentie']) ?? '').split('-');
      const maat = delen.length > 2 ? delen[delen.length - 1] : null;
      const vw = schoon(x['Variant waardes']) ?? '';
      const kleur = /^kleur:/i.test(vw)
        ? vw.replace(/^kleur:\s*/i, '')
        : schoon(x['Basis Kleur_1']) || schoon(x['Basis Kleur']);
      varianten.push({ sku: `FHB-${art}`, maat, kleur, ean: code(x.Barcode) });
      const url = kleur ? fotoVoorKleur(art, kleur) : null;
      if (kleur && url && !gezienFHB.has(kleur)) {
        gezienFHB.add(kleur);
        kleurfotos.push({ sku: `FHB-${art}`, kleur, url });
      }
    }
  }
}

// --- Hydrowear: elke maat heeft in het bestand al een eigen brutoprijs. De laagste is
// de basisprijs; de verhogingen (10/15/20/25%) staan als ladder in tabel maattoeslagen,
// zodat de prijsmotor ze precies reproduceert.
function hydrowear() {
  const f = bestand('hydrowear', 'assortiment');
  if (!f) return console.warn('Hydrowear: bestand niet gevonden, overgeslagen');
  const plaatjes = plaatjesIn('hydrowear');
  const perArt = new Map();
  for (const r of lees(f)) {
    const art = schoon(r['Article Number']);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }
  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `HW-${art}`;
    const prijzen = g.map((x) => getal(x['Gross Price'])).filter(Boolean);
    const foto = plaatjes.find((n) => n.toLowerCase().startsWith(art.toLowerCase() + '_'));
    product({
      sku, art_nr_leverancier: art,
      naam: schoon(r['Article Name NL']) || schoon(r['Name of Article']),
      omschrijving: schoon(r['Article Description NL']) || schoon(r['Items Description']),
      merk: 'Hydrowear',
      categorie: schoon(r['Main Category']),
      verkoopprijs_basis: prijzen.length ? Math.min(...prijzen) : null,
      afbeeldingen: foto ? [`/merken/hydrowear/${foto}`] : [],
      maatwerk_lengte: false,
    });
    const kleur = schoon(r['Colour NL']);
    for (const x of g) varianten.push({ sku, maat: schoon(x.Sizes), kleur: schoon(x['Colour NL']), ean: null });
    if (kleur && foto) kleurfotos.push({ sku, kleur, url: `/merken/hydrowear/${foto}` });
  }
}

/**
 * Mi-piace, TQ Amsterdam en Pfanner leveren hetzelfde eenvoudige formaat aan:
 * merk, artikelnummer, kleur, maat, omschrijving, prijs ex btw en het kortingspercentage.
 * Foto's staan als losse bestanden in dezelfde submap, met het artikelnummer in de naam.
 */
/**
 * Mi-piace, TQ en Pfanner leveren geen productcategorie mee, terwijl de webshop en de
 * pakketconfigurator daarop filteren. De namen zijn beschrijvend genoeg om hem af te leiden.
 */
function categorieUitNaam(naam) {
  const n = (naam ?? '').toLowerCase();
  if (n.includes('blazer')) return 'Blazers';
  if (n.includes('gilet')) return 'Gilets';
  if (n.includes('blouse')) return 'Blouses';
  if (n.includes('t-shirt')) return 'T-shirts';
  if (n.includes('overhemd') || n.includes('shirt')) return 'Overhemden';
  if (n.startsWith('top') || n.includes(' top ')) return 'Tops';
  if (n.includes('rok')) return 'Rokken';
  if (n.includes('bermuda') || n.includes('korte broek')) return 'Korte broeken';
  if (n.includes('broek')) return 'Broeken';
  return null;
}

function eenvoudigAssortiment({ submap, zoekwoorden, merk, prefix, fotomap, basisArtikel }) {
  const f = bestand(...zoekwoorden);
  if (!f) return console.warn(`${merk}: bestand niet gevonden, overgeslagen`);
  const plaatjes = plaatjesIn(submap);
  const perArt = new Map();
  for (const r of lees(f)) {
    const ruw = schoon(r.artikelnummer) ?? schoon(r.Artikelnummer);
    if (!ruw) continue;
    const art = basisArtikel ? basisArtikel(ruw) : ruw;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }
  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `${prefix}-${art}`;
    // Foto per kleur: bestandsnaam bevat artikelnummer en meestal de kleur.
    const vanArtikel = plaatjes.filter((n) => n.toLowerCase().includes(art.toLowerCase()));
    /**
     * Zoekt de foto die bij deze kleur hoort. Vindt hij die niet, dan geeft hij null en
     * niet zomaar de eerste foto van het artikel: een zwarte blouse tonen bij "dark blue"
     * is erger dan geen foto, want dan bestelt iemand de verkeerde kleur.
     */
    const fotoVoorKleur = (kleur) => {
      const k = (kleur ?? '').toLowerCase().replace(/\s+/g, '');
      const hit = k && vanArtikel.find((n) => n.toLowerCase().replace(/\s+/g, '').includes(k));
      return hit ? `/merken/${fotomap}/${hit}` : null;
    };
    // Voor de hoofdfoto van het artikel volstaat de eerste; die staat los van de kleurkeuze.
    const hoofdfoto = vanArtikel[0] ? `/merken/${fotomap}/${vanArtikel[0]}` : null;
    product({
      sku, art_nr_leverancier: art,
      naam: schoon(r.Omschrijving),
      merk,
      categorie: categorieUitNaam(schoon(r.Omschrijving)),
      verkoopprijs_basis: getal(r['Prijs ex btw']),
      afbeeldingen: [hoofdfoto].filter(Boolean),
      maatwerk_lengte: false,
    });
    const gezien = new Set();
    for (const x of g) {
      varianten.push({ sku, maat: schoon(x.maten), kleur: schoon(x.Kleur), ean: null });
      const kl = schoon(x.Kleur);
      const url = fotoVoorKleur(kl);
      if (kl && url && !gezien.has(kl)) { gezien.add(kl); kleurfotos.push({ sku, kleur: kl, url }); }
    }
  }
}

const mipiace = () =>
  eenvoudigAssortiment({ submap: 'Mi-piace', zoekwoorden: ['mi-piace', 'assortiment'], merk: 'Mi-piace', prefix: 'MP', fotomap: 'mi-piace' });
const tq = () =>
  eenvoudigAssortiment({ submap: 'TQ', zoekwoorden: ['tq', 'assortiment'], merk: 'TQ Amsterdam', prefix: 'TQ', fotomap: 'tq' });
// Pfanner geeft elke maat een eigen leveranciersnummer (108500-90-25 t/m -45). Dat is
// één artikel met 21 maten, geen 21 artikelen: knip het maatnummer eraf.
const pfanner = () =>
  eenvoudigAssortiment({
    submap: 'Pfanner', zoekwoorden: ['pfanner'], merk: 'Pfanner', prefix: 'PF', fotomap: 'pfanner',
    basisArtikel: (a) => a.split('-').slice(0, 2).join('-'),
  });

/**
 * Xirtrum levert kleuren, maten en EAN's in Excel, maar de prijzen alleen in een PDF.
 * Die zijn eenmalig uitgelezen naar xirtrum-prijzen.csv naast het Excelbestand; dat CSV
 * is met de hand bij te werken als er een nieuwe prijslijst komt.
 */
function xirtrum() {
  const f = bestand('xr', 'ean', 'codes');
  if (!f) return console.warn('Xirtrum: bestand niet gevonden, overgeslagen');
  // Ook hier beide datamappen af: het CSV staat bij de Xirtrum-bestanden, en die
  // hoeven niet in dezelfde map te liggen als het Excel van een ander merk.
  const csvPad = DATA_DIRS.map((d) => join(d, 'Xirtrum', 'xirtrum-prijzen.csv')).find((p) => existsSync(p));
  if (!csvPad) return console.warn('Xirtrum: xirtrum-prijzen.csv ontbreekt, overgeslagen');

  // Zelfde afspraak als bij FHB: foto's met de hand in public/merken/xirtrum,
  // met het artikelnummer als bestandsnaam ("X3382.jpg"), kleur er eventueel
  // achter ("X3380 - Indigo.jpg").
  const plaatjes = plaatjesIn('xirtrum');
  const sleutel = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const zonderExt = (n) => n.replace(/\.[^.]+$/, '');
  const fotoVoorKleur = (art, kleur) => {
    const doel = sleutel(art + kleur);
    const hit = plaatjes.find((n) => sleutel(zonderExt(n)) === doel);
    return hit ? `/merken/xirtrum/${hit}` : null;
  };

  const prijs = new Map();
  for (const regel of readFileSync(csvPad, 'utf8').split(/\r?\n/).slice(1)) {
    const [art, , bedrag] = regel.split(';');
    if (art?.trim() && bedrag) prijs.set(art.trim().toUpperCase(), getal(bedrag.replace(',', '.')));
  }

  const perArt = new Map();
  for (const r of lees(f)) {
    const art = schoon(r.ARTIKEL);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }
  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `XR-${art}`;
    const key = art.toUpperCase();
    if (!prijs.has(key)) meld('Xirtrum', sku, 'geen prijs in xirtrum-prijzen.csv');
    product({
      sku, art_nr_leverancier: art,
      naam: schoon(r.OMSCHRIJVING),
      merk: 'Xirtrum',
      categorie: schoon(r.PRODUCTGROEP),
      geslacht: schoon(r['DAMES/HEREN']),
      materiaal: schoon(r.STOFCONSTRUCTIE),
      verkoopprijs_basis: prijs.get(key) ?? null,
      afbeeldingen: (() => {
        const doel = sleutel(art);
        const hit =
          plaatjes.find((n) => sleutel(zonderExt(n)) === doel) ??
          plaatjes.find((n) => sleutel(zonderExt(n)).startsWith(doel));
        return hit ? [`/merken/xirtrum/${hit}`] : [];
      })(),
      maatwerk_lengte: false,
    });
    const gezienXR = new Set();
    for (const x of g) {
      const kleur = schoon(x['HOOFDKLEUR OMSCHRIJVING']) ?? code(x.KLEUR);
      varianten.push({ sku, maat: code(x.MAAT), kleur, ean: code(x.EAN) });
      const url = kleur ? fotoVoorKleur(art, kleur) : null;
      if (kleur && url && !gezienXR.has(kleur)) { gezienXR.add(kleur); kleurfotos.push({ sku, kleur, url }); }
    }
  }
}

/**
 * Fristads levert één rij per artikel/kleur/maat, met de adviesprijs en het kortingspercentage
 * (35%) in het bestand zelf. De foto's staan niet lokaal maar in het PIM van Fristads; die URL
 * is per kleur exact ("109424-171-F171_front01.png"), dus we bewaren de link in plaats van het
 * bestand. Kolomnamen worden getrimd omdat 'Kleurcode' in het Excelbestand op een newline eindigt.
 */
function fristads() {
  const f = bestand('fristads');
  if (!f) return console.warn('Fristads: bestand niet gevonden, overgeslagen');

  const perArt = new Map();
  for (const ruw of lees(f)) {
    const r = {};
    for (const [k, v] of Object.entries(ruw)) r[k.trim()] = v;
    const art = code(r.Artikelnummer);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }

  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `FR-${art}`;
    // Eerste foto per kleur, in volgorde van voorkomen: de eerste daarvan is de hoofdfoto.
    const perKleur = new Map();
    for (const x of g) {
      const kl = schoon(x.Kleur);
      const url = https(schoon(x['Link picture 1']));
      if (kl && url && !perKleur.has(kl)) perKleur.set(kl, url);
    }
    const eerste = [...perKleur.values()][0] ?? null;

    product({
      sku,
      art_nr_leverancier: art,
      naam: schoon(r['Artikelnaam NL']),
      omschrijving: schoon(r['Commerciële tekst']),
      merk: 'Fristads',
      categorie: schoon(r.Artikelsoort),
      normeringen: schoon(r['EN ISO normen']),
      materiaal: schoon(r.Samenstelling),
      verkoopprijs_basis: getal(r.Adviesprijs),
      afbeeldingen: eerste ? [eerste] : [],
      maatwerk_lengte: false,
    });

    for (const x of g) {
      varianten.push({ sku, maat: schoon(x.Maten), kleur: schoon(x.Kleur), ean: null });
    }
    for (const [kleur, url] of perKleur) kleurfotos.push({ sku, kleur, url });
  }
}

/**
 * Blåkläder: één rij per maat. De prijs in het bestand is de bruto adviesprijs;
 * de foto's staan als losse bestanden met het artikelnummer in de naam.
 */
function blaklader() {
  const f = bestand('blaklader', 'assortiment');
  if (!f) return console.warn('Blåkläder: bestand niet gevonden, overgeslagen');
  const plaatjes = plaatjesIn('Blaklader');
  const perArt = new Map();
  for (const ruw of lees(f)) {
    const r = getrimd(ruw);
    const art = schoon(r.Artikelnummer);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }
  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `BL-${art}`;
    const foto = plaatjes.find((n) => n.includes(art));
    const url = foto ? `/merken/blaklader/${foto}` : null;
    product({
      sku, art_nr_leverancier: art,
      naam: schoon(r['Artikel naam']),
      omschrijving: opsomming(r.Omschrijving),
      merk: 'Blåkläder',
      categorie: schoon(r.Soort),
      verkoopprijs_basis: getal(r.Prijs),
      afbeeldingen: [url].filter(Boolean),
      maatwerk_lengte: false,
    });
    const gezien = new Set();
    for (const x of g) {
      varianten.push({ sku, maat: schoon(x.Maat), kleur: schoon(x.Kleur), ean: null });
      const kl = schoon(x.Kleur);
      if (kl && url && !gezien.has(kl)) { gezien.add(kl); kleurfotos.push({ sku, kleur: kl, url }); }
    }
  }
}

/**
 * Emma Safety Footwear levert geen lopende tekst maar wél alle normdata los in kolommen:
 * klasse, antislip, antistatisch, neusbescherming, binnenzool, metaalvrij. Daar is een
 * betere omschrijving van te maken dan de leverancier zelf aanlevert ("S3 ZWART HOOG
 * MODEL PUR ESD"), dus die stellen we hier samen.
 */
function emma() {
  const f = bestand('emma', 'assortiment');
  if (!f) return console.warn('Emma: bestand niet gevonden, overgeslagen');
  const plaatjes = plaatjesIn('Emma');
  const perArt = new Map();
  for (const ruw of lees(f)) {
    const r = getrimd(ruw);
    const art = schoon(r['Artikel nummer']);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }
  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `EM-${art}`;
    const model = schoon(r['Hultafors Artikel']) ?? art;
    const hoogLaag = (schoon(r.Model) ?? '').toLowerCase();
    const norm = schoon(r.Norm);
    // Foto zoeken op modelnaam, en anders op het artikelnummer zonder de MM-prefix.
    const nr = art.replace(/^MM/i, '');
    const foto =
      plaatjes.find((n) => n.toLowerCase().includes(model.toLowerCase())) ??
      plaatjes.find((n) => n.includes(nr)) ?? null;
    const url = foto ? `/merken/emma/${foto}` : null;

    const maten = [...new Set(g.map((x) => schoon(x.Maat)).filter(Boolean))];
    const zinnen = [
      `De ${model} van Emma Safety Footwear is een veiligheidsschoen in klasse ${norm ?? 'S3'}${hoogLaag ? `, ${hoogLaag} model` : ''}.`,
      schoon(r['Metaal vrij'])?.toUpperCase() === 'JA' ? 'Volledig metaalvrij, dus geen gepiep bij de detectiepoort.' : null,
      schoon(r.Neusbescherming) ? `Neusbescherming: ${schoon(r.Neusbescherming)}.` : null,
      schoon(r.Binnenzool) ? `Binnenzool: ${schoon(r.Binnenzool)}.` : null,
      schoon(r['Antistatische eigenschappen']) ? `Antistatisch: ${schoon(r['Antistatische eigenschappen'])}.` : null,
      schoon(r.Antislip) ? `Slipweerstand ${schoon(r.Antislip)}.` : null,
      maten.length ? `Leverbaar in ${maten.length} maten, van ${maten[0]} tot ${maten[maten.length - 1]}.` : null,
      'Werkschoenen koop je op pasvorm, niet op maatnummer — kom ze in Hengelo Gld even passen.',
    ].filter(Boolean);

    product({
      sku, art_nr_leverancier: art,
      naam: `${model} ${norm ?? ''} veiligheidsschoen${hoogLaag ? ` ${hoogLaag}` : ''}`.replace(/\s+/g, ' ').trim(),
      omschrijving: zinnen.join(' '),
      merk: 'Emma Safety Footwear',
      categorie: 'Werkschoenen',
      normeringen: norm ? `EN ISO 20345 ${norm}${schoon(r.Antislip) ? ` ${schoon(r.Antislip)}` : ''}` : null,
      verkoopprijs_basis: getal(r.Prijs),
      afbeeldingen: [url].filter(Boolean),
      maatwerk_lengte: false,
    });
    const gezien = new Set();
    for (const x of g) {
      varianten.push({ sku, maat: schoon(x.Maat), kleur: schoon(x.Kleur), ean: null });
      const kl = schoon(x.Kleur);
      if (kl && url && !gezien.has(kl)) { gezien.add(kl); kleurfotos.push({ sku, kleur: kl, url }); }
    }
  }
}

/**
 * Grisport levert de omschrijving compleet aan. De foto's staan los, met het modelnummer
 * en de Nederlandse kleur in de bestandsnaam ("Grisport 72457C Bruin.jpg").
 */
function grisport() {
  const f = bestand('grisport', 'assortiment');
  if (!f) return console.warn('Grisport: bestand niet gevonden, overgeslagen');
  const plaatjes = plaatjesIn('Grisport');
  const perArt = new Map();
  for (const ruw of lees(f)) {
    const r = getrimd(ruw);
    const art = code(r.Artikelnummer);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }
  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `GS-${art}`;
    const naam = schoon(r.Naam) ?? art;
    // "Grisport 903L" -> 903, "Grisport 72457C Brown" -> 72457c, "Enduro Cross ..." -> enduro
    const kern = naam.replace(/grisport/gi, '').trim().split(/\s+/)[0].toLowerCase().replace(/l$/, '');
    const kleur = (schoon(r.Kleur) ?? '').toLowerCase();
    const kandidaten = plaatjes.filter((n) => n.toLowerCase().includes(kern));
    const foto = kandidaten.find((n) => n.toLowerCase().includes(kleur)) ?? kandidaten[0] ?? null;
    const url = foto ? `/merken/grisport/${foto}` : null;
    product({
      sku, art_nr_leverancier: art,
      naam,
      omschrijving: schoon(r.Omschrijving),
      merk: 'Grisport',
      categorie: 'Werkschoenen',
      normeringen: schoon(r.Classe) ? `EN ISO 20345 ${schoon(r.Classe)}` : null,
      verkoopprijs_basis: getal(r.Verkoopprijs),
      afbeeldingen: [url].filter(Boolean),
      maatwerk_lengte: false,
    });
    const gezien = new Set();
    for (const x of g) {
      varianten.push({ sku, maat: code(x.Maat), kleur: schoon(x.Kleur), ean: null });
      const kl = schoon(x.Kleur);
      if (kl && url && !gezien.has(kl)) { gezien.add(kl); kleurfotos.push({ sku, kleur: kl, url }); }
    }
  }
}

/**
 * Kariban komt uit hetzelfde PIM als WK (TopTex), dus dezelfde kolomnamen en dezelfde
 * packshot-URL's op cdn.toptex.com. Geen lokale foto's nodig: die staan al online, per kleur.
 */
function kariban() {
  const f = bestand('kariban');
  if (!f) return console.warn('Kariban: bestand niet gevonden, overgeslagen');
  const perArt = new Map();
  for (const ruw of lees(f)) {
    const r = getrimd(ruw);
    const art = schoon(r.Artikelnummer);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }
  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `KB-${art}`;
    const perKleur = new Map();
    for (const x of g) {
      const kl = schoon(x.Colors);
      const u = https(schoon(x.URL_Packshots_Face));
      if (kl && u && !perKleur.has(kl)) perKleur.set(kl, u);
    }
    product({
      sku, art_nr_leverancier: art,
      naam: schoon(r.Designation_nl),
      omschrijving: schoon(r.Description_nl),
      merk: 'Kariban',
      categorie: schoon(r.Family_nl),
      materiaal: schoon(r.Composition_nl),
      verkoopprijs_basis: getal(r.Price),
      afbeeldingen: [...perKleur.values()].slice(0, 1),
      maatwerk_lengte: false,
    });
    for (const x of g) varianten.push({ sku, maat: schoon(x.Size_Manufacturer), kleur: schoon(x.Colors), ean: null });
    for (const [kleur, url] of perKleur) kleurfotos.push({ sku, kleur, url });
  }
}

/**
 * Tricorp levert één rij per artikel/kleur/maat, met de adviesprijs én het
 * kortingspercentage per artikel. Dat laatste is bijzonder: waar Snickers en WK
 * één conditie voor het hele merk hebben, loopt Tricorp van 30% op de
 * basiscollectie tot 44% op de instap-T-shirts. Daarom schrijven we de korting
 * per artikel weg in producten.korting_pct; de prijsmotor geeft die voorrang
 * boven de leverancierskorting.
 *
 * Foto's staan per artikel en kleur in public/merken/tricorp, met het
 * artikelnummer voorop ("101009 Tricorp Navy.webp"). Let op de tikfouten in een
 * paar bestandsnamen ("tricrop", "Denimbleu"); de vergelijking negeert daarom
 * alles wat geen letter of cijfer is en corrigeert die twee.
 */
function tricorp() {
  const f = bestand('tricorp', 'assortiment');
  if (!f) return console.warn('Tricorp: bestand niet gevonden, overgeslagen');
  const plaatjes = plaatjesIn('tricorp');
  const sleutel = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').replace('bleu', 'blue');

  const perArt = new Map();
  for (const ruw of lees(f)) {
    const r = getrimd(ruw);
    const art = code(r.Artikelnummer);
    if (!art) continue;
    if (!perArt.has(art)) perArt.set(art, []);
    perArt.get(art).push(r);
  }

  for (const [art, g] of perArt) {
    const r = g[0];
    const sku = `TRI-${art}`;
    // Kleurfoto alleen bij een exacte treffer: een zwarte polo tonen bij
    // "darkgrey" is erger dan geen foto, want dan komt de verkeerde kleur binnen.
    const fotoVoorKleur = (kleur) => {
      const doel = sleutel(art + 'tricorp' + kleur);
      const alt = sleutel(art + 'tricrop' + kleur);
      const hit = plaatjes.find((n) => [doel, alt].includes(sleutel(n.replace(/\.[^.]+$/, ''))));
      return hit ? `/merken/tricorp/${hit}` : null;
    };
    const eerste = plaatjes.find((n) => n.startsWith(art));

    product({
      sku, art_nr_leverancier: art,
      naam: schoon(r.Artikelnaam),
      merk: 'Tricorp',
      verkoopprijs_basis: getal(r.Verkoopadviesprijs),
      korting_pct: Math.round(parseFloat(r.Korting) * 1000) / 10,
      afbeeldingen: eerste ? [`/merken/tricorp/${eerste}`] : [],
      maatwerk_lengte: false,
    });

    const gezien = new Set();
    for (const x of g) {
      varianten.push({ sku, maat: schoon(x.Maat), kleur: schoon(x.Kleur), ean: null });
      const kl = schoon(x.Kleur);
      const url = kl ? fotoVoorKleur(kl) : null;
      if (kl && url && !gezien.has(kl)) { gezien.add(kl); kleurfotos.push({ sku, kleur: kl, url }); }
    }
  }
}

const MERKEN = { snickers, wk, brook, upower, hydrowear, mipiace, tq, pfanner, xirtrum, fhb, fristads, blaklader, emma, grisport, kariban, tricorp };
for (const [naam, fn] of Object.entries(MERKEN)) {
  if (ONLY && ONLY !== naam) continue;
  fn();
}

// Vangnet tegen dubbele regels in een leveranciersbestand: dezelfde maat en kleur hoort
// er maar één keer te zijn. FHB leverde er 4.116 te veel. Vóór het rapport, zodat de
// getallen kloppen met wat er straks wordt weggeschreven.
{
  const gezien = new Set();
  const uniek = varianten.filter((v) => {
    const sleutel = `${v.sku}|${v.maat ?? ''}|${v.kleur ?? ''}`;
    if (gezien.has(sleutel)) return false;
    gezien.add(sleutel);
    return true;
  });
  const weg = varianten.length - uniek.length;
  varianten.length = 0;
  varianten.push(...uniek);
  if (weg) console.log(`\n${weg} dubbele varianten overgeslagen.`);
}

// ---------------------------------------------------------------- rapport
const perMerk = {};
for (const p of producten) (perMerk[p.merk] ??= { artikelen: 0, varianten: 0 }).artikelen++;
for (const v of varianten) {
  const p = producten.find((x) => x.sku === v.sku);
  if (p) perMerk[p.merk].varianten++;
}
console.log('\nGevonden:');
for (const [m, t] of Object.entries(perMerk)) {
  console.log(`  ${m.padEnd(24)} ${String(t.artikelen).padStart(4)} artikelen  ${String(t.varianten).padStart(6)} varianten`);
}
console.log(`  ${'TOTAAL'.padEnd(24)} ${String(producten.length).padStart(4)} artikelen  ${String(varianten.length).padStart(6)} varianten`);
console.log(`  kleurfoto's: ${kleurfotos.length}`);

if (fouten.length) {
  console.log(`\nLet op (${fouten.length}):`);
  const perSoort = {};
  for (const f of fouten) (perSoort[`${f.merk} - ${f.wat}`] ??= []).push(f.sku);
  for (const [k, skus] of Object.entries(perSoort)) {
    console.log(`  ${k}: ${skus.length}x  (${skus.slice(0, 6).join(', ')}${skus.length > 6 ? ', ...' : ''})`);
  }
}

/**
 * --json=<pad> schrijft wat er gevonden is naar een bestand in plaats van naar Supabase.
 * Bedoeld voor omgevingen zonder netwerktoegang naar de database; de inhoud is precies
 * wat de upsert hieronder ook zou wegschrijven.
 */
const JSON_UIT = (args.find((a) => a.startsWith('--json=')) || '').split('=')[1] || null;
if (JSON_UIT) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(JSON_UIT, JSON.stringify({ producten, varianten, kleurfotos }, null, 1));
  console.log(`\n--json: ${producten.length} producten weggeschreven naar ${JSON_UIT}`);
  process.exit(0);
}

if (DRY) { console.log('\n--dry: niets weggeschreven.'); process.exit(0); }

// ---------------------------------------------------------------- wegschrijven
const brokken = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

console.log('\nWegschrijven...');
/**
 * Per merk wegschrijven, niet in één grote hoop.
 *
 * PostgREST bouwt de kolomlijst van een upsert op uit alle sleutels die in de batch
 * voorkomen. Zit er één merk in de batch dat wél een omschrijving meelevert, dan komt
 * `omschrijving` in die lijst en krijgen alle andere rijen in dezelfde batch daar null.
 * Zo wiste een volledige import eerder de met de hand geschreven teksten van merken die
 * hun omschrijving niet uit het leveranciersbestand halen. Per merk chunken houdt de
 * kolomlijst per batch gelijk, en dan blijft wat niet meegestuurd wordt gewoon staan.
 */
const perMerkProducten = new Map();
for (const p of producten) {
  if (!perMerkProducten.has(p.merk)) perMerkProducten.set(p.merk, []);
  perMerkProducten.get(p.merk).push(p);
}
for (const deel of [...perMerkProducten.values()].flatMap((rij) => brokken(rij, 200))) {
  const { error } = await db.from('producten').upsert(
    deel.map((p) => ({ ...p, bron: 'leveranciersimport', laatst_geimporteerd: new Date().toISOString() })),
    { onConflict: 'sku', ignoreDuplicates: false },
  );
  if (error) { console.error('producten:', error.message); process.exit(1); }
}
console.log(`  ${producten.length} producten`);

// leverancier koppelen op merknaam
const { data: levs } = await db.from('leveranciers').select('id, naam');
const levId = new Map((levs ?? []).map((l) => [l.naam, l.id]));
for (const merk of Object.keys(perMerk)) {
  if (!levId.has(merk)) { console.warn(`  geen leverancier voor merk ${merk}`); continue; }
  await db.from('producten').update({ leverancier_id: levId.get(merk) }).eq('merk', merk);
}

const { data: rijen } = await db.from('producten').select('id, sku').in('sku', producten.map((p) => p.sku));
const idVan = new Map((rijen ?? []).map((r) => [r.sku, r.id]));
const ids = [...idVan.values()];

for (const deel of brokken(ids, 200)) {
  await db.from('product_varianten').delete().in('product_id', deel);
  await db.from('product_kleur_afbeeldingen').delete().in('product_id', deel);
}

const varRijen = varianten
  .filter((v) => idVan.has(v.sku))
  .map((v) => ({ product_id: idVan.get(v.sku), maat: v.maat, kleur: v.kleur, ean: v.ean }));
for (const deel of brokken(varRijen, 500)) {
  const { error } = await db.from('product_varianten').insert(deel);
  if (error) { console.error('varianten:', error.message); process.exit(1); }
}
console.log(`  ${varRijen.length} varianten`);

const fotoRijen = kleurfotos
  .filter((k) => idVan.has(k.sku))
  .map((k) => ({ product_id: idVan.get(k.sku), kleur: k.kleur, afbeelding_url: k.url }));
for (const deel of brokken(fotoRijen, 500)) {
  const { error } = await db.from('product_kleur_afbeeldingen').insert(deel);
  if (error) { console.error('kleurfotos:', error.message); process.exit(1); }
}
console.log(`  ${fotoRijen.length} kleurfoto's`);

const { data: n, error: eBer } = await db.rpc('herbereken_variantprijzen', { p_merk: null });
if (eBer) console.error('prijsberekening:', eBer.message);
else console.log(`  ${n} variantprijzen berekend uit basisprijs, maattoeslag en korting`);

// Elke leverancier hanteert zijn eigen categorie-indeling. Deze functie zet ze om naar
// één set kledingsoorten en bewaart het origineel in subcategorie, zodat filteren over
// merken heen werkt.
const { data: nc, error: eCat } = await db.rpc('normaliseer_categorieen');
if (eCat) console.error('categorieen:', eCat.message);
else console.log(`  ${nc} categorieen genormaliseerd`);

console.log('\nKlaar.');
