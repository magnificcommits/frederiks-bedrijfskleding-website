#!/usr/bin/env node
/**
 * Statische inventarisatie van de auth-checks in alle Server Actions en API-routes.
 *
 *   node scripts/check-auth.mjs            tabel (markdown) naar stdout
 *   node scripts/check-auth.mjs --json     ruwe gegevens als JSON
 *   node scripts/check-auth.mjs --strict   exitcode 1 als er een export zonder check is (CI)
 *
 * Wat het doet: zoekt in app/**\/actions.ts en app/**\/route.ts elke geëxporteerde
 * functie (Server Action of HTTP-handler), knipt de functie-body eruit en kijkt welke
 * guards erin worden aangeroepen. Een niet-geëxporteerde helper in hetzelfde bestand
 * die zelf een guard aanroept (bv. guardBeheerder, eisToegang) telt mee.
 *
 * Categorieën (eerste die past):
 *   kms      dashAuthed() / eisEigenaar() / getHuidigeAdmin() / adminSessieStatus()
 *   cron     CRON_SECRET / TAKEN_CRON_SECRET vergeleken met de request
 *   api-key  metApi(...) (api/v1, sleutel + scope + rate limit)
 *   portaal  getPortaalUser() / auth.getUser() / getServerSupabase() (RLS met sessie)
 *   token    publieke token-route: het token wordt opgezocht/gevalideerd
 *   publiek  bewust publiek, gemarkeerd met een commentaar `auth: publiek <reden>`
 *   GEEN     niets gevonden -> nakijken
 *
 * Een export die bewust zonder login werkt, markeer je in de functie of op de regel
 * erboven met:  // auth: publiek <reden>   (of `auth: token <reden>`).
 *
 * Beperkingen: statisch en regex-gebaseerd. Het ziet niet of de check vóór de
 * eerste mutatie staat en niet of een gevonden token-lookup ook echt weigert. De
 * tabel is een startpunt voor review, geen bewijs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const APP = join(ROOT, 'app');
const args = new Set(process.argv.slice(2));

/** actions.ts en route.ts, plus elk ander .ts-bestand dat met 'use server' begint. */
function walk(dir, out = []) {
  for (const naam of readdirSync(dir)) {
    if (naam === 'node_modules' || naam.startsWith('.')) continue;
    const p = join(dir, naam);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (naam === 'actions.ts' || naam === 'route.ts') out.push(p);
    else if (/\.tsx?$/.test(naam) && /^\s*['"]use server['"]/.test(readFileSync(p, 'utf8'))) out.push(p);
  }
  return out;
}

/** Vervangt strings, template-literals en commentaar door spaties (behoudt posities). */
function maskeer(src) {
  const out = src.split('');
  let i = 0;
  const n = src.length;
  const leeg = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  const tplStack = [];
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const end = e === -1 ? n : e; leeg(i, end); i = end; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const end = e === -1 ? n : e + 2; leeg(i, end); i = end; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      leeg(i + 1, j); i = j + 1; continue;
    }
    if (c === '`' || (c === '}' && tplStack.length && tplStack[tplStack.length - 1] === 0)) {
      if (c === '}') tplStack.pop();
      let j = i + 1;
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') break;
        j++;
      }
      leeg(i + 1, j);
      if (src[j] === '$') { tplStack.push(0); i = j + 2; continue; }
      i = j + 1; continue;
    }
    if (tplStack.length) {
      if (c === '{') tplStack[tplStack.length - 1]++;
      else if (c === '}') tplStack[tplStack.length - 1]--;
    }
    i++;
  }
  return out.join('');
}

/** Body (tussen de accolades) van de functie waarvan de parameterlijst op/na `start` begint. */
function body(masked, start) {
  let i = masked.indexOf('(', start);
  if (i === -1) return '';
  let diepte = 0;
  for (; i < masked.length; i++) {
    if (masked[i] === '(') diepte++;
    else if (masked[i] === ')') { diepte--; if (diepte === 0) break; }
  }
  // Na de parameters: optionele return-type-annotatie, dan '{' of '=>'.
  // Een '{' binnen <...> of direct na ':', '|', '&' of ',' is een typeliteral.
  let hoek = 0;
  let k = i + 1;
  let vorige = '';
  for (; k < masked.length; k++) {
    const c = masked[k];
    if (/\s/.test(c)) continue;
    if (c === '=' && masked[k + 1] === '>' && hoek === 0) {
      k += 2;
      while (/\s/.test(masked[k])) k++;
      if (masked[k] !== '{') { const e = masked.indexOf(';', k); return masked.slice(k, e === -1 ? undefined : e); }
      break;
    }
    if (c === '<') hoek++;
    else if (c === '>') hoek--;
    else if (c === '{') {
      if (hoek > 0 || [':', '|', '&', ','].includes(vorige)) {
        let d = 0;
        for (; k < masked.length; k++) { if (masked[k] === '{') d++; else if (masked[k] === '}') { d--; if (d === 0) break; } }
        vorige = '}';
        continue;
      }
      break;
    }
    vorige = c;
  }
  let dd = 0;
  for (let q = k; q < masked.length; q++) {
    if (masked[q] === '{') dd++;
    else if (masked[q] === '}') { dd--; if (dd === 0) return masked.slice(k + 1, q); }
  }
  return masked.slice(k + 1);
}

const GUARDS = {
  kms: /\b(dashAuthed|eisEigenaar|magEigenaar|getHuidigeAdmin|adminSessieStatus|eisKmsToegang)\s*\(/,
  cron: /\b(CRON_SECRET|cronSecret|TAKEN_CRON_SECRET)\b/,
  'api-key': /\bmetApi\s*\(/,
  portaal: /\b(getPortaalUser|getMijnToegang|getServerSupabase|getPortaalContext|auth\.getUser|eisPortaal[A-Za-z]*)\s*\(/,
  token: /\b(getRetourSessie|vindToken|zoekToken|haalToken|[a-zA-Z]*[Tt]oken[A-Za-z]*\s*\(|veiligGelijk|timingSafeEqual|verifieer[A-Za-z]*|ontsleutel[A-Za-z]*|controleerLink[A-Za-z]*|exchangeCodeForSession|verifyOtp)\b/,
};
const ROL = /\b(eisEigenaar|magEigenaar|guardBeheerder|guardBeheren|guardGoedkeurder|isBeheerder|rol\s*(===|!==|==)|\.rol\b|current_rol)\b/;

function analyseer(bestand) {
  const src = readFileSync(bestand, 'utf8');
  const masked = maskeer(src);
  const rel = relative(ROOT, bestand).split(sep).join('/');
  const isRoute = rel.endsWith('/route.ts');
  const useServer = /^\s*['"]use server['"]/m.test(src);

  // Lokale helpers (niet geëxporteerd): naam -> body
  const helpers = new Map();
  const reHelper = /(^|\n)\s*(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(|(^|\n)\s*const\s+([A-Za-z0-9_]+)\s*=\s*(?:cache\()?\s*async\s*\(/g;
  let m;
  while ((m = reHelper.exec(masked))) {
    const naam = m[2] ?? m[4];
    const pos = m.index;
    const voor = masked.slice(Math.max(0, pos - 1), pos + m[0].length);
    if (/export/.test(voor)) continue;
    helpers.set(naam, body(masked, pos + m[0].length - 1));
  }
  // Transitief: helper is 'guarded' als hij een guard of andere guarded helper aanroept.
  const helperGuards = new Map();
  const guardsVan = (tekst, bezig = new Set()) => {
    const gevonden = new Set();
    for (const [cat, re] of Object.entries(GUARDS)) if (re.test(tekst)) gevonden.add(cat);
    for (const [naam, hb] of helpers) {
      if (bezig.has(naam)) continue;
      if (new RegExp(`\\b${naam}\\s*\\(`).test(tekst)) {
        if (!helperGuards.has(naam)) { bezig.add(naam); helperGuards.set(naam, guardsVan(hb, bezig)); }
        for (const g of helperGuards.get(naam)) gevonden.add(g);
      }
    }
    return gevonden;
  };
  const rolVan = (tekst, re = ROL) => {
    if (re.test(tekst)) return true;
    for (const [naam, hb] of helpers) if (new RegExp(`\\b${naam}\\s*\\(`).test(tekst) && re.test(hb)) return true;
    return false;
  };
  // eisEigenaar()/magEigenaar() laten een bezoeker zonder admin-account door (dat is de
  // wachtwoord-login). Ze zijn dus alleen veilig ná dashAuthed(): apart signaleren.
  const DASH = /\b(dashAuthed|eisKmsToegang)\s*\(/;

  const rijen = [];
  const reExport = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*[<(]|export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/g;
  while ((m = reExport.exec(masked))) {
    const naam = m[1] ?? m[2];
    if (isRoute && !/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(naam)) continue;
    const b = body(masked, m.index + m[0].length - 1);
    // Markering in de originele bron: binnen de functie of op de 3 regels erboven.
    const regelStart = src.lastIndexOf('\n', m.index);
    const boven = src.slice(Math.max(0, src.lastIndexOf('\n', Math.max(0, regelStart - 200))), m.index);
    const origBody = src.slice(m.index, m.index + m[0].length + b.length + 2);
    const markering = /auth:\s*(publiek|token)\b[^\n]*/.exec(origBody) ?? /auth:\s*(publiek|token)\b[^\n]*/.exec(boven);
    const guards = guardsVan(b);
    let categorie = ['kms', 'cron', 'api-key', 'portaal', 'token'].find((c) => guards.has(c)) ?? null;
    if (categorie === 'kms' && !rolVan(b, DASH) && !/\b(getHuidigeAdmin|adminSessieStatus)\s*\(/.test(b)) categorie = 'KMS-ZONDER-DASHAUTHED';
    if (!categorie && markering) categorie = markering[1];
    const regel = src.slice(0, m.index).split('\n').length;
    rijen.push({
      bestand: rel,
      regel,
      export: naam,
      soort: isRoute ? 'route' : useServer ? 'action' : 'export',
      categorie: categorie ?? 'GEEN',
      guards: [...guards].sort(),
      rolcheck: rolVan(b),
      markering: markering ? markering[0].trim() : null,
    });
  }
  return rijen;
}

const rijen = [...walk(APP), ...walk(join(ROOT, 'lib'))].sort().flatMap(analyseer);

if (args.has('--json')) {
  console.log(JSON.stringify(rijen, null, 2));
} else {
  const tel = {};
  for (const r of rijen) tel[r.categorie] = (tel[r.categorie] ?? 0) + 1;
  console.log(`# Auth-inventaris Server Actions en API-routes\n`);
  console.log(`Gegenereerd met \`node scripts/check-auth.mjs\`. ${rijen.length} exports.\n`);
  console.log(Object.entries(tel).sort().map(([k, v]) => `- ${k}: ${v}`).join('\n'));
  console.log('\n| Bestand | Export | Soort | Check | Rol | Opmerking |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rijen) {
    console.log(`| ${r.bestand}:${r.regel} | ${r.export} | ${r.soort} | ${r.categorie === 'GEEN' ? '**GEEN**' : r.categorie} | ${r.rolcheck ? 'ja' : ''} | ${r.markering ?? (r.guards.length > 1 ? r.guards.join('+') : '')} |`);
  }
}

const zonder = rijen.filter((r) => r.categorie === 'GEEN' || r.categorie === 'KMS-ZONDER-DASHAUTHED');
if (zonder.length) {
  console.error(`\n${zonder.length} export(s) zonder herkenbare auth-check:`);
  for (const r of zonder) console.error(`  ${r.bestand}:${r.regel}  ${r.export}`);
  if (args.has('--strict')) process.exit(1);
}
