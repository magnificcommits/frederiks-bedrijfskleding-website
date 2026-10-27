// Maakt de PDF van de algemene voorwaarden uit content/algemeneVoorwaarden.ts.
// Draaien na een wijziging in de voorwaarden:
//   node --experimental-strip-types scripts/voorwaarden-pdf.mjs
// De PDF komt in public/downloads en gaat als bijlage mee met elke offerte.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { voorwaarden, VOORWAARDEN_INTRO, VOORWAARDEN_VERSIE, VOORWAARDEN_PDF } = await import(path.join(root, 'content/algemeneVoorwaarden.ts'));
const logo = await readFile(path.join(root, 'public/documenten/frederiks-logo.svg'), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const datum = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${VOORWAARDEN_VERSIE}T12:00:00`));

const artikelen = voorwaarden
  .map(
    (a) => `<section class="artikel">
  <h2><span>Artikel ${a.nummer}</span>${esc(a.titel)}</h2>
  <ol>${a.leden
    .map((l, i) => `<li><span class="nr">${a.nummer}.${i + 1}</span><span>${l.kop ? `<strong>${esc(l.kop)}</strong><br>` : ''}${esc(l.tekst)}</span></li>`)
    .join('')}</ol>
</section>`,
  )
  .join('\n');

const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Algemene voorwaarden Frederiks Bedrijfskleding</title>
<style>
  @page { size: A4; margin: 18mm 18mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, Arial, sans-serif; color: #272727; font-size: 9.6pt; line-height: 1.5; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; border-bottom: 2px dashed #f49a64; margin-bottom: 18px; }
  header svg { height: 46px; width: auto; }
  header .titel { text-align: right; }
  header .titel h1 { font-family: Archivo, Arial, sans-serif; font-size: 22pt; font-weight: 800; margin: 0; color: #1c1c1c; letter-spacing: -0.01em; }
  header .titel p { margin: 4px 0 0; color: #52504e; font-size: 9pt; }
  .intro { color: #52504e; margin: 0 0 14px; }
  .artikel { margin: 0 0 13px; }
  h2 { break-after: avoid; }
  li { break-inside: avoid; }
  h2 { font-family: Archivo, Arial, sans-serif; font-size: 10.5pt; font-weight: 700; margin: 0 0 4px; color: #1c1c1c; }
  h2 span { display: block; color: #b04318; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.14em; }
  ol { list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: 6px; margin: 0 0 4px; }
  li .nr { flex: 0 0 30px; color: #828282; font-variant-numeric: tabular-nums; }
  li strong { color: #1c1c1c; }
  footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e4e2e0; color: #52504e; font-size: 8.5pt; break-inside: avoid; }
  footer strong { color: #1c1c1c; }
</style></head><body>
<header>${logo}<div class="titel"><h1>Algemene voorwaarden</h1><p>Frederiks Bedrijfskleding · versie ${esc(datum)}</p></div></header>
<p class="intro">${esc(VOORWAARDEN_INTRO)}</p>
<div class="kolommen">${artikelen}</div>
<footer><strong>Frederiks Bedrijfskleding</strong> · Kruisbergseweg 9, 7255 AG Hengelo (Gld) · info@frederiksbedrijfskleding.nl · 06 15 21 50 29</footer>
</body></html>`;

const uit = path.join(root, 'public', VOORWAARDEN_PDF);
await mkdir(path.dirname(uit), { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
const pdf = await page.pdf({
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;font-size:7pt;color:#828282;padding:0 18mm;display:flex;justify-content:space-between;"><span>Algemene voorwaarden Frederiks Bedrijfskleding, versie ${esc(datum)}</span><span>Pagina <span class="pageNumber"></span> van <span class="totalPages"></span></span></div>`,
  margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
});
await browser.close();
await writeFile(uit, pdf);
console.log('PDF geschreven:', path.relative(root, uit), pdf.length, 'bytes');
