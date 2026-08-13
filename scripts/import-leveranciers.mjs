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
const DATA_DIR = [join(ROOT, 'data', 'leveranciers'), join(ROOT, 'public', 'Data per merk')]
  .find((p) => existsSync(p));

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ONLY = (args.find((a) => a.startsWith('--merk=')) || '').split('=')[1]?.toLowerCase() || null;

if (!DATA_DIR) {
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

/** Alle .xlsx in de datamap en één niveau daaronder, zodat submappen per merk meetellen. */
function alleBestanden() {
  const uit = [];
  for (const naam of readdirSync(DATA_DIR, { withFileTypes: true })) {
    if (naam.isFile() && naam.name.endsWith('.xlsx')) uit.push([naam.name, join(DATA_DIR, naam.name)]);
    else if (naam.isDirectory()) {
      for (const sub of readdirSync(join(DATA_DIR, naam.name))) {
        if (sub.endsWith('.xlsx')) uit.push([`${naam.name}/${sub}`, join(DATA_DIR, naam.name, sub)]);
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

/** Zoekt beeldbestanden in de datamap en submappen, op naamfragment. */
function plaatjesIn(submap) {
  const map = submap ? join(DATA_DIR, submap) : DATA_DIR;
  if (!existsSync(map)) return [];
  return readdirSync(map).filter((n) => /\.(jpe?g|png|webp)$/i.test(n));
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
      omschrijving: schoon(r['Omschrijving ']),
      merk: 'FHB',
      categorie: schoon(r.Productcategorie),
      verkoopprijs_basis: getal(r['Verkoopprijs ex btw']),
      afbeeldingen: [schoon(r.Afbeelding)].filter(Boolean),
      maatwerk_lengte: false,
    });
    for (const x of g) {
      varianten.push({
        sku: `FHB-${art}`,
        maat: schoon(x['Variant waardes'])?.replace(/^Maat:\s*/i, '') ?? null,
        kleur: schoon(x['Basis Kleur.1']) || schoon(x['Basis Kleur']),
        ean: code(x.Barcode),
      });
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
  const csvPad = join(DATA_DIR, 'Xirtrum', 'xirtrum-prijzen.csv');
  if (!existsSync(csvPad)) return console.warn('Xirtrum: xirtrum-prijzen.csv ontbreekt, overgeslagen');

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
      afbeeldingen: [],
      maatwerk_lengte: false,
    });
    for (const x of g) {
      varianten.push({
        sku,
        maat: code(x.MAAT),
        kleur: schoon(x['HOOFDKLEUR OMSCHRIJVING']) ?? code(x.KLEUR),
        ean: code(x.EAN),
      });
    }
  }
}

const MERKEN = { snickers, wk, brook, upower, hydrowear, mipiace, tq, pfanner, xirtrum, fhb };
for (const [naam, fn] of Object.entries(MERKEN)) {
  if (ONLY && ONLY !== naam) continue;
  fn();
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

if (DRY) { console.log('\n--dry: niets weggeschreven.'); process.exit(0); }

// ---------------------------------------------------------------- wegschrijven
const brokken = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

console.log('\nWegschrijven...');
for (const deel of brokken(producten, 200)) {
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

console.log('\nKlaar.');
