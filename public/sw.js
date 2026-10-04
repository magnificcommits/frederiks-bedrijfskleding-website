/*
 * Service worker voor de twee apps van Frederiks Bedrijfskleding.
 *
 * Eén bestand, twee registraties: het KMS registreert met scope /dashboard en het
 * portaal met scope /portaal (zie components/pwa/PwaRegistratie.tsx). De publieke
 * site valt buiten beide scopes en wordt dus nooit door deze worker bediend.
 *
 * Wat er gebeurt:
 *  - /_next/static/ (bestanden met een hash in de naam) en /pwa/ (iconen, offline-
 *    pagina): cache-first.
 *  - Pagina's (navigaties): altijd via het netwerk. Pagina's worden NIET bewaard,
 *    want ze bevatten klant- en bedrijfsgegevens. Zonder netwerk volgt een eigen
 *    offlinepagina.
 *  - Al het andere gaat ongemoeid naar het netwerk: POST en server actions,
 *    /api/, /auth/-routes, RSC-verzoeken, afbeeldingen van Supabase.
 *
 * Nieuwe versie uitrollen met andere cache-regels: verhoog VERSIE. Oude caches van
 * dit gebied worden bij het activeren opgeruimd.
 */
// v2: meertalige offlinepagina van het portaal (NL, EN, DE, PL).
const VERSIE = 'v2';
const SCOPE_PAD = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const GEBIED = SCOPE_PAD.startsWith('/dashboard') ? 'kms' : 'portaal';
const VOORVOEGSEL = `fb-${GEBIED}-`;
const CACHE = `${VOORVOEGSEL}${VERSIE}`;
const OFFLINE_URL = `/pwa/offline-${GEBIED}.html`;
const MAX_STATISCH = 200;

const VOORAF = [
  OFFLINE_URL,
  `/pwa/${GEBIED}-192.png`,
  `/pwa/${GEBIED}-512.png`,
  `/pwa/${GEBIED}-favicon-32.png`,
  `/pwa/${GEBIED}-apple-touch-icon.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(VOORAF.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n.startsWith(VOORVOEGSEL) && n !== CACHE).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

function isStatisch(url) {
  return url.origin === self.location.origin
    && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/pwa/'));
}

/** Houdt de cache klein: na elke deploy komen er nieuwe bestanden bij. */
async function snoei(cache) {
  const sleutels = await cache.keys();
  const teVeel = sleutels.length - MAX_STATISCH;
  for (let i = 0; i < teVeel; i += 1) await cache.delete(sleutels[i]);
}

async function cacheEerst(request) {
  const cache = await caches.open(CACHE);
  const bewaard = await cache.match(request);
  if (bewaard) return bewaard;
  const antwoord = await fetch(request);
  if (antwoord.ok && antwoord.type === 'basic') {
    await cache.put(request, antwoord.clone());
    snoei(cache);
  }
  return antwoord;
}

async function paginaOfOffline(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response('Je bent offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return; // server actions en formulieren: nooit aankomen
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/auth/')) return;

  if (isStatisch(url)) {
    event.respondWith(cacheEerst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(paginaOfOffline(request));
  }
  // Overige GET-verzoeken (RSC, afbeeldingen, downloads) gaan gewoon naar het netwerk.
});
