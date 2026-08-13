#!/usr/bin/env node
/**
 * Haalt de productfoto's van FHB op en koppelt ze aan de artikelen in Supabase.
 *
 * FHB levert als enige merk geen beeld mee: 50 van de 452 artikelen staan zonder foto in
 * de catalogus. Dit script zoekt per artikel de productpagina op de site van FHB, pakt de
 * hoofdafbeelding en zet die in public/merken/fhb/. Daarna schrijft het de paden naar
 * producten.afbeeldingen.
 *
 * LET OP: draai dit pas als vaststaat dat Frederiks als dealer die beelden mag gebruiken.
 * Vraag het na bij FHB of kijk of er een dealerportaal met een beeldbank is; dat is altijd
 * de betere bron dan de publieke site.
 *
 * Draaien (op je eigen machine, deze heeft internet nodig):
 *   node scripts/haal-fhb-fotos.mjs --lijst          # schrijf fhb-fotos.csv om zelf in te vullen
 *   node scripts/haal-fhb-fotos.mjs --test=Adde      # probeer één artikel, toon wat het vindt
 *   node scripts/haal-fhb-fotos.mjs --zoek           # probeer alle 50 automatisch
 *   node scripts/haal-fhb-fotos.mjs --csv            # download uit de ingevulde fhb-fotos.csv
 *   node scripts/haal-fhb-fotos.mjs --koppel         # zet gevonden bestanden in de database
 *
 * De automatische zoekmodus gokt op de zoekpagina van FHB. Werkt die niet, gebruik dan
 * --lijst, plak de juiste product-URL's erbij en draai --csv. Die route werkt altijd.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = [join(ROOT, 'data', 'leveranciers'), join(ROOT, 'public', 'Data per merk')].find((p) => existsSync(p));
const FOTO_DIR = join(ROOT, 'public', 'merken', 'fhb');
const CSV = join(ROOT, 'fhb-fotos.csv');

const args = process.argv.slice(2);
const heeft = (v) => args.includes(v);
const waarde = (v) => (args.find((a) => a.startsWith(v + '=')) || '').split('=')[1] || null;

// Pas deze twee regels aan als FHB zijn site verandert.
const ZOEK_URL = (term) => `https://www.fhb.de/search?q=${encodeURIComponent(term)}`;
const UA = 'Mozilla/5.0 (compatible; FrederiksBedrijfskleding/1.0; +https://frederiksbedrijfskleding.nl)';

// ---------------------------------------------------------------- artikelen inlezen
function artikelen() {
  const bestand = readdirSync(DATA_DIR).find((f) => f.toLowerCase().includes('fhb') && f.endsWith('.xlsx'));
  if (!bestand) {
    console.error('FHB-bestand niet gevonden in', DATA_DIR);
    process.exit(1);
  }
  const wb = xlsx.readFile(join(DATA_DIR, bestand));
  const rijen = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  const uniek = new Map();
  for (const r of rijen) {
    const art = String(r['Artikelnr.'] ?? '').trim();
    if (!art || uniek.has(art)) continue;
    uniek.set(art, {
      artikel: art,
      naam: String(r.Naam ?? '').trim(),
      categorie: String(r.Productcategorie ?? '').trim(),
      sku: `FHB-${art}`,
    });
  }
  return [...uniek.values()];
}

// ---------------------------------------------------------------- helpers
async function haalPagina(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return { html: await res.text(), url: res.url };
}

/** Pakt de meest waarschijnlijke productfoto uit een HTML-pagina. */
function vindAfbeelding(html, basis) {
  const kandidaten = [];
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) kandidaten.push(og[1]);
  for (const m of html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/gi)) {
    kandidaten.push(m[1]);
  }
  const eerste = kandidaten.find((u) => !/logo|icon|sprite|placeholder|flag/i.test(u));
  if (!eerste) return null;
  try {
    return new URL(eerste, basis).href;
  } catch {
    return null;
  }
}

/** Eerste productlink op een zoekresultatenpagina. */
function vindProductLink(html, basis) {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const hit = links.find((h) => /product|artikel|p\/|detail/i.test(h) && !/search|cart|login/i.test(h));
  if (!hit) return null;
  try {
    return new URL(hit, basis).href;
  } catch {
    return null;
  }
}

async function download(url, doel) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) throw new Error('te klein, waarschijnlijk geen productfoto');
  writeFileSync(doel, buf);
  return buf.length;
}

const ext = (u) => (u.match(/\.(jpe?g|png|webp)/i)?.[1] ?? 'jpg').replace('jpeg', 'jpg');
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- modi
async function modusLijst() {
  const lijst = artikelen();
  const regels = ['artikel;naam;categorie;product_url;foto_url', ...lijst.map((a) => `${a.artikel};${a.naam};${a.categorie};;`)];
  writeFileSync(CSV, regels.join('\n'), 'utf8');
  console.log(`${lijst.length} artikelen geschreven naar ${CSV}`);
  console.log('Vul de kolom product_url of foto_url en draai daarna: node scripts/haal-fhb-fotos.mjs --csv');
}

async function zoekEen(a, stil = false) {
  const zoekterm = `FHB ${a.artikel}`;
  const zoek = await haalPagina(ZOEK_URL(zoekterm));
  const link = vindProductLink(zoek.html, zoek.url);
  if (!stil) console.log(`  zoekpagina: ${zoek.url}\n  productlink: ${link ?? 'geen'}`);
  if (!link) return null;
  const pagina = await haalPagina(link);
  const foto = vindAfbeelding(pagina.html, pagina.url);
  if (!stil) console.log(`  foto: ${foto ?? 'geen'}`);
  return foto;
}

async function modusTest(artikelNaam) {
  const a = artikelen().find((x) => x.artikel.toLowerCase() === artikelNaam.toLowerCase());
  if (!a) return console.error(`Artikel ${artikelNaam} niet gevonden.`);
  console.log(`Test voor ${a.artikel} (${a.naam}):`);
  try {
    const foto = await zoekEen(a);
    if (foto) console.log('\nGelukt. Draai nu --zoek voor alle artikelen.');
    else console.log('\nNiets gevonden. Pas ZOEK_URL bovenin het script aan, of gebruik --lijst en --csv.');
  } catch (e) {
    console.error('  fout:', e.message);
    console.log('\nDe zoek-URL klopt waarschijnlijk niet. Gebruik --lijst en --csv.');
  }
}

async function modusZoek() {
  mkdirSync(FOTO_DIR, { recursive: true });
  const lijst = artikelen();
  const gelukt = [];
  const mislukt = [];
  for (const [i, a] of lijst.entries()) {
    process.stdout.write(`[${i + 1}/${lijst.length}] ${a.artikel.padEnd(14)}`);
    try {
      const foto = await zoekEen(a, true);
      if (!foto) throw new Error('geen foto gevonden');
      const bestand = `${a.artikel.toLowerCase()}.${ext(foto)}`;
      const bytes = await download(foto, join(FOTO_DIR, bestand));
      gelukt.push({ ...a, bestand });
      console.log(`ok  ${Math.round(bytes / 1024)} kB`);
    } catch (e) {
      mislukt.push({ ...a, reden: e.message });
      console.log(`-   ${e.message}`);
    }
    await wacht(1200); // rustig aan tegen de server van FHB
  }
  console.log(`\n${gelukt.length} gelukt, ${mislukt.length} mislukt.`);
  if (mislukt.length) {
    console.log('Niet gevonden:', mislukt.map((m) => m.artikel).join(', '));
    console.log('Draai --lijst en vul voor die artikelen handmatig een URL in.');
  }
  console.log('Daarna: node scripts/haal-fhb-fotos.mjs --koppel');
}

async function modusCsv() {
  if (!existsSync(CSV)) return console.error(`${CSV} bestaat niet. Draai eerst --lijst.`);
  mkdirSync(FOTO_DIR, { recursive: true });
  const regels = readFileSync(CSV, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  let gelukt = 0;
  for (const regel of regels) {
    const [artikel, , , productUrl, fotoUrl] = regel.split(';').map((s) => s?.trim() ?? '');
    if (!artikel) continue;
    try {
      let foto = fotoUrl || null;
      if (!foto && productUrl) {
        const pagina = await haalPagina(productUrl);
        foto = vindAfbeelding(pagina.html, pagina.url);
      }
      if (!foto) continue;
      const bestand = `${artikel.toLowerCase()}.${ext(foto)}`;
      await download(foto, join(FOTO_DIR, bestand));
      console.log(`ok  ${artikel} -> ${bestand}`);
      gelukt++;
      await wacht(800);
    } catch (e) {
      console.log(`-   ${artikel}: ${e.message}`);
    }
  }
  console.log(`\n${gelukt} foto's binnengehaald. Daarna: node scripts/haal-fhb-fotos.mjs --koppel`);
}

async function modusKoppel() {
  for (const f of ['.env.local', '.env']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const regel of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = regel.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Ontbrekend: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  if (!existsSync(FOTO_DIR)) return console.error('Nog geen foto\'s gedownload.');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const bestanden = readdirSync(FOTO_DIR).filter((n) => /\.(jpe?g|png|webp)$/i.test(n));
  let bijgewerkt = 0;
  for (const bestand of bestanden) {
    const artikel = bestand.replace(/\.(jpe?g|png|webp)$/i, '');
    const { data } = await db.from('producten').select('id, sku').ilike('sku', `FHB-${artikel}`).maybeSingle();
    if (!data) {
      console.log(`-   geen product voor ${bestand}`);
      continue;
    }
    const { error } = await db
      .from('producten')
      .update({ afbeeldingen: [`/merken/fhb/${bestand}`] })
      .eq('id', data.id);
    if (error) console.log(`-   ${data.sku}: ${error.message}`);
    else {
      bijgewerkt++;
      console.log(`ok  ${data.sku}`);
    }
  }
  console.log(`\n${bijgewerkt} artikelen hebben nu een foto.`);
}

// ---------------------------------------------------------------- start
if (heeft('--lijst')) await modusLijst();
else if (waarde('--test')) await modusTest(waarde('--test'));
else if (heeft('--zoek')) await modusZoek();
else if (heeft('--csv')) await modusCsv();
else if (heeft('--koppel')) await modusKoppel();
else {
  console.log('Kies een modus: --lijst | --test=Adde | --zoek | --csv | --koppel');
  console.log('Zie de toelichting bovenin dit bestand.');
}
