#!/usr/bin/env node
/**
 * Rooktest (smoke test) voor de website, het portaal en het KMS.
 *
 * Opent elke publieke pagina uit de sitemap plus /portaal/login, /dashboard en
 * /api/health in een echte browser (Chromium via Playwright) en controleert:
 *   - status 200 (een redirect is goed als de eindpagina 200 geeft);
 *   - geen fouten in de browserconsole en geen onafgevangen JavaScript-fouten;
 *   - geen "Application error" (de witte Next.js-crashpagina);
 *   - een <title>;
 *   - geen horizontale scroll op een telefoonbreedte van 390 pixels.
 *
 * Gebruik:
 *   node scripts/e2e-rook.mjs                                  # tegen http://localhost:3000
 *   BASE_URL=https://www.frederiksbedrijfskleding.nl node scripts/e2e-rook.mjs
 *   node scripts/e2e-rook.mjs --max=40                         # alleen de eerste 40 sitemap-pagina's
 *   node scripts/e2e-rook.mjs --alleen=/regio,/branches        # alleen paden die hiermee beginnen
 *
 * Opties via omgeving: BASE_URL, MAX (aantal sitemap-pagina's), PARALLEL (standaard 4),
 * CHROMIUM_PAD (eigen Chromium; anders die van Playwright), HEALTH=0 (sla /api/health over).
 * Exitcode 0 = alles goed, 1 = minstens één pagina faalt. Zie docs/testen.md.
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || 'ja'];
  }),
);

const BASE_URL = (args.base ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const MAX = Number(args.max ?? process.env.MAX ?? 0) || Infinity;
const PARALLEL = Math.max(1, Number(args.parallel ?? process.env.PARALLEL ?? 4) || 4);
const ALLEEN = String(args.alleen ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const TIMEOUT = Number(process.env.TIMEOUT ?? 45_000);

/** Pagina's die er altijd bij horen, naast de sitemap. */
const VASTE_ROUTES = [
  { pad: '/portaal/login', label: 'portaal: inloggen' },
  // Zonder sessie toont /dashboard het inlogscherm (of stuurt door naar /dashboard/login).
  { pad: '/dashboard', label: 'KMS: inlogscherm' },
];

/**
 * Consolemeldingen die geen fout van ons zijn: tracking die door een adblocker of
 * de toestemmingsbanner wordt tegengehouden, en favicons van externe partijen.
 */
const NEGEER_CONSOLE = [
  /googletagmanager|google-analytics|doubleclick|clarity\.ms|facebook\.net/i,
  /Failed to load resource: net::ERR_BLOCKED_BY_CLIENT/i,
  /Download the React DevTools/i,
];

async function laadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    console.error('Playwright ontbreekt. Installeer het eenmalig met:\n  npm install\n  npx playwright install chromium');
    process.exit(2);
  }
}

async function sitemapPaden() {
  const res = await fetch(`${BASE_URL}/sitemap.xml`, { headers: { 'User-Agent': 'fb-rooktest' } });
  if (!res.ok) throw new Error(`sitemap.xml gaf status ${res.status}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  // De sitemap noemt het productiedomein; we testen hetzelfde pad op BASE_URL.
  const paden = [...new Set(locs.map((l) => new URL(l).pathname || '/'))];
  return paden;
}

async function controleer(context, route) {
  const page = await context.newPage();
  const fouten = [];
  const consoleFouten = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const tekst = m.text();
    if (NEGEER_CONSOLE.some((r) => r.test(tekst))) return;
    consoleFouten.push(tekst.slice(0, 200));
  });
  page.on('pageerror', (e) => consoleFouten.push(`onafgevangen: ${String(e.message ?? e).slice(0, 200)}`));

  const start = Date.now();
  let status = 0;
  let eindUrl = '';
  try {
    const res = await page.goto(`${BASE_URL}${route.pad}`, { waitUntil: 'load', timeout: TIMEOUT });
    status = res?.status() ?? 0;
    eindUrl = page.url();
    // Even wachten op hydratatie en late fouten.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    if (status !== 200) fouten.push(`status ${status}`);
    const titel = (await page.title()).trim();
    if (!titel) fouten.push('geen <title>');
    const tekst = await page.evaluate(() => document.body?.innerText ?? '');
    if (/Application error: a (client|server)-side exception has occurred/i.test(tekst)) fouten.push('"Application error" op de pagina');
    const scroll = await page.evaluate(() => ({ breed: document.documentElement.scrollWidth, scherm: document.documentElement.clientWidth }));
    if (scroll.breed > scroll.scherm + 1) fouten.push(`horizontale scroll: ${scroll.breed}px breed op ${scroll.scherm}px`);
    if (consoleFouten.length) fouten.push(...consoleFouten.map((c) => `console: ${c}`));
  } catch (e) {
    fouten.push(`laden mislukt: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  } finally {
    await page.close().catch(() => {});
  }
  const redirect = eindUrl && new URL(eindUrl).pathname !== route.pad ? ` -> ${new URL(eindUrl).pathname}` : '';
  return { ...route, status, ms: Date.now() - start, fouten, redirect };
}

async function controleerHealth() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { headers: { 'User-Agent': 'fb-rooktest' } });
    const body = await res.json().catch(() => ({}));
    return { pad: '/api/health', label: 'gezondheidscheck', status: res.status, ms: 0, redirect: '', fouten: res.status === 200 && body.status === 'ok' ? [] : [`status ${res.status} (${body.status ?? 'geen json'})`] };
  } catch (e) {
    return { pad: '/api/health', label: 'gezondheidscheck', status: 0, ms: 0, redirect: '', fouten: [`niet bereikbaar: ${e instanceof Error ? e.message : e}`] };
  }
}

async function main() {
  const { chromium } = await laadPlaywright();
  console.log(`Rooktest tegen ${BASE_URL}`);

  let paden = await sitemapPaden();
  if (ALLEEN.length) paden = paden.filter((p) => ALLEEN.some((a) => p.startsWith(a)));
  paden = paden.slice(0, MAX);
  const routes = [...paden.map((pad) => ({ pad, label: 'sitemap' })), ...VASTE_ROUTES.filter((r) => !ALLEEN.length || ALLEEN.some((a) => r.pad.startsWith(a)))];
  console.log(`${routes.length} pagina's (${paden.length} uit de sitemap), ${PARALLEL} tegelijk, schermbreedte 390px\n`);

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PAD || undefined });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'nl-NL',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 fb-rooktest',
  });

  const uitslagen = [];
  let volgende = 0;
  async function werker() {
    while (volgende < routes.length) {
      const route = routes[volgende++];
      const u = await controleer(context, route);
      uitslagen.push(u);
      const teken = u.fouten.length ? 'FOUT' : ' ok ';
      console.log(`[${teken}] ${u.status || '---'} ${u.pad}${u.redirect} (${u.ms} ms)${u.fouten.length ? `\n         ${u.fouten.join('\n         ')}` : ''}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, routes.length) }, werker));
  await browser.close();

  if (process.env.HEALTH !== '0') {
    const h = await controleerHealth();
    uitslagen.push(h);
    console.log(`[${h.fouten.length ? 'FOUT' : ' ok '}] ${h.status} /api/health${h.fouten.length ? `\n         ${h.fouten.join('\n         ')}` : ''}`);
  }

  const fout = uitslagen.filter((u) => u.fouten.length);
  console.log(`\n${uitslagen.length - fout.length} goed, ${fout.length} fout.`);
  if (fout.length) {
    console.log('\nFouten:');
    for (const u of fout) console.log(`  ${u.pad}: ${u.fouten[0]}${u.fouten.length > 1 ? ` (+${u.fouten.length - 1})` : ''}`);
  }
  process.exit(fout.length ? 1 : 0);
}

main().catch((e) => {
  console.error('Rooktest kon niet starten:', e instanceof Error ? e.message : e);
  process.exit(2);
});
