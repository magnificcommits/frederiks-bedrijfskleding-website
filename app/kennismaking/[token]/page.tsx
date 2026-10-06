import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { after } from 'next/server';
import LogoOpKleding from '@/components/kennismaking/LogoOpKleding';
import { haalKennismaking } from '@/lib/prospect/kennismaking';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { isBot, isGeldigToken, logBezoek, QR_COOKIE } from '@/lib/prospect/prospect';
import { site } from '@/content/site';
import {
  JESSI_FOTO,
  LANDING_INTRO,
  TEAM_MAX,
  TEAM_MIN,
  TEAM_STANDAARD,
  standaardAantalPerPersoon,
  toonKleur,
} from '@/content/kennismaking';
import TeamRekenhulp from './TeamRekenhulp';
import PasdagFormulier from './PasdagFormulier';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await haalKennismaking(token);
  return {
    title: data ? `Werkkleding voor ${data.bedrijfsnaam}` : 'Kennismaking',
    description: `Persoonlijke pagina van ${site.name}.`,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
    alternates: { canonical: null },
    // De token-url mag niet als referrer naar andere sites (WhatsApp, leveranciers-cdn's).
    referrer: 'same-origin',
    openGraph: null,
  };
}

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

/**
 * Bezoek van type 'link' loggen: iemand opende de pagina zonder net de QR te
 * scannen (bv. via een doorgestuurde link). Herladen telt niet opnieuw: binnen
 * een half uur na een eerder bezoek slaan we het over.
 */
async function logLinkBezoek(prospectId: string, token: string) {
  const sb = kmsAdmin();
  if (!sb) return;
  try {
    const sinds = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data } = await sb
      .from('prospect_bezoeken')
      .select('id')
      .eq('prospect_id', prospectId)
      .in('soort', ['qr', 'link'])
      .gte('created_at', sinds)
      .limit(1);
    if (data && data.length) return;
    await logBezoek(sb, prospectId, 'link', `/kennismaking/${token}`);
  } catch {
    // stil
  }
}

const stappen = [
  { t: 'Pasdag bij jullie op de zaak', d: 'Ik kom langs met pasmodellen in alle maten. Iedereen past tussen het werk door, ik noteer de maten. Duurt meestal een uur of twee.' },
  { t: 'Jullie logo erop', d: 'Borduren of bedrukken doen we in eigen huis in Hengelo. Geen goed bestand van het logo? Dan maken we dat in orde. Je krijgt eerst een drukproef.' },
  { t: 'Geleverd per medewerker', d: 'Alles komt gesorteerd op naam binnen. Geen gedoe met dozen uitzoeken op maandagochtend.' },
  { t: 'Nabestellen in jullie portaal', d: 'Nieuwe collega of kapotte broek? Bestellen gaat via jullie eigen portaal, met de maten en het logo al klaar.' },
];

export default async function KennismakingPagina({ params }: Props) {
  const { token: ruwToken } = await params;
  const token = ruwToken.trim().toLowerCase();
  if (!isGeldigToken(token)) notFound();
  const data = await haalKennismaking(token);
  if (!data) notFound();

  // Bezoek loggen na het renderen, zodat de pagina er niet op wacht.
  const kwamViaQr = (await cookies()).get(QR_COOKIE)?.value === token;
  const h = await headers();
  const prefetch = h.get('purpose') === 'prefetch' || h.get('next-router-prefetch') !== null;
  if (!kwamViaQr && !prefetch && !isBot(h.get('user-agent')) && !(await dashAuthed())) {
    after(() => logLinkBezoek(data.prospectId, token));
  }

  const bedrijf = data.bedrijfsnaam;
  const intro = LANDING_INTRO.map((t) => t.replace(/\{\{bedrijf\}\}/g, bedrijf).replace(/\{\{plaats\}\}/g, data.plaats ?? 'jullie plaats'));
  const waNummer = site.whatsapp.replace(/[^0-9]/g, '');
  const waTekst = encodeURIComponent(`Hoi Jessi, ik heb jullie brief voor ${bedrijf} gezien.`);
  const waUrl = `https://wa.me/${waNummer}?text=${waTekst}`;
  const telUrl = `tel:${site.phoneIntl}`;
  const portaalUrl = `/kennismaking/${token}/portaal`;
  const hoofd = data.artikelen[0] ?? null;
  const rekenArtikelen = data.artikelen
    .filter((a) => a.prijs != null && a.prijs > 0)
    .map((a) => ({ id: a.productId, naam: a.naam, prijs: a.prijs as number, standaard: standaardAantalPerPersoon(a.categorie, a.naam) }));

  return (
    <div className="bg-white">
      {/* Kop */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="container-x grid grid-cols-1 items-center gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:py-20">
          <div>
            <p className="eyebrow text-amber-400">Persoonlijk voor {bedrijf}</p>
            <h1 className="kop-1 mt-3 text-balance text-white">Werkkleding voor {bedrijf}</h1>
            <p className="mt-4 max-w-[46ch] text-lg text-white/80">
              Ik heb jullie logo alvast op een paar artikelen gezet. Zo zie je meteen hoe het team erbij kan lopen.
            </p>
            {data.logoUrl && (
              <div className="mt-6 inline-flex items-center gap-3 rounded-lg bg-white px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.logoUrl} alt={`Logo ${bedrijf}`} referrerPolicy="no-referrer" className="h-10 w-auto max-w-[10rem] object-contain" />
                <span className="text-xs font-semibold text-warm">Dit logo gebruikten we</span>
              </div>
            )}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#pasdag" className="btn-primary">Plan een gratis pasdag</a>
              <Link href={portaalUrl} prefetch={false} className="btn border-2 border-white/40 text-white hover:border-white">Bekijk jullie voorbeeldportaal</Link>
            </div>
          </div>
          {hoofd && (
            <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-card">
              <LogoOpKleding
                fotoUrl={hoofd.fotoUrl}
                alt={`${hoofd.naam}${hoofd.kleur ? ` in ${toonKleur(hoofd.kleur)}` : ''} met logo van ${bedrijf}`}
                logoUrl={data.logoUrl}
                bedrijfsnaam={bedrijf}
                positie={hoofd.logoPositie}
                className="aspect-square"
              />
            </div>
          )}
        </div>
        <div className="h-1 w-full border-t-2 border-dashed border-amber-500/70" aria-hidden="true" />
      </section>

      {/* Persoonlijke tekst */}
      <section className="container-x sec-md">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
          <div className="flex items-center gap-4 sm:block">
            {JESSI_FOTO ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={JESSI_FOTO} alt="Jessi Frederiks" className="h-20 w-20 rounded-full object-cover sm:h-28 sm:w-28" />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 font-display text-2xl font-extrabold text-amber-800 sm:h-28 sm:w-28 sm:text-3xl" aria-hidden="true">JF</span>
            )}
            <p className="text-sm font-semibold text-ink-900 sm:hidden">Jessi Frederiks<br /><span className="font-normal text-warm">{site.name}, Hengelo Gld</span></p>
          </div>
          <div className="max-w-prose">
            <p className="text-lg font-semibold text-ink-900">Hoi{data.contactpersoon ? ` ${data.contactpersoon.split(' ')[0]}` : ''},</p>
            {intro.map((t, i) => (
              <p key={i} className="mt-3 leading-relaxed text-warm">{t}</p>
            ))}
            <p className="mt-5 font-display text-2xl italic text-ink-900" aria-label="Handtekening Jessi Frederiks">Jessi</p>
            <p className="hidden text-sm text-warm sm:block">Jessi Frederiks, {site.name}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={telUrl} className="btn-secondary">Bel Jessi: {site.phone}</a>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn border-2 border-[#25D366] text-ink-900 hover:bg-[#25D366]/10">WhatsApp Jessi</a>
            </div>
          </div>
        </div>
      </section>

      {/* Galerij */}
      {data.artikelen.length > 0 && (
        <section className="border-t border-line bg-mist">
          <div className="container-x sec-md">
            <p className="eyebrow">Uitgezocht voor jullie</p>
            <h2 className="kop-2 mt-3">Zo kan het team van {bedrijf} erbij lopen</h2>
            <p className="mt-3 max-w-2xl text-warm">
              {data.logoUrl ? 'Met jullie logo' : 'Met jullie naam'} zoals we het zouden borduren of bedrukken. Andere kleuren, merken of modellen kan altijd: dit is een eerste voorstel.
            </p>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {data.artikelen.map((a) => (
                <li key={a.productId} className="flex flex-col overflow-hidden rounded-xl border border-line bg-white">
                  <LogoOpKleding
                    fotoUrl={a.fotoUrl}
                    alt={`${a.naam}${a.kleur ? ` in ${toonKleur(a.kleur)}` : ''} met logo van ${bedrijf}`}
                    logoUrl={data.logoUrl}
                    bedrijfsnaam={bedrijf}
                    positie={a.logoPositie}
                    className="aspect-square bg-white"
                  />
                  <div className="flex grow flex-col border-t border-line p-3 sm:p-4">
                    {a.merk && <p className="text-[11px] font-bold uppercase tracking-wide text-warm">{a.merk}</p>}
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-ink-900 sm:text-base">{a.naam}</p>
                    {a.kleur && <p className="mt-0.5 text-xs text-warm">{toonKleur(a.kleur)}</p>}
                    <p className="mt-auto pt-3 text-sm text-ink-900">
                      {a.prijs != null ? (
                        <>vanaf <span className="font-bold">{euro.format(a.prijs)}</span> <span className="text-xs text-warm">ex btw</span></>
                      ) : (
                        <span className="text-warm">Prijs op aanvraag</span>
                      )}
                    </p>
                    {a.url && (
                      <Link href={a.url} prefetch={false} className="mt-2 text-xs font-semibold text-amber-700 underline-offset-2 hover:underline">Meer over dit artikel</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Rekenhulp */}
      {rekenArtikelen.length > 0 && (
        <section className="container-x sec-md">
          <p className="eyebrow">Rekenhulp</p>
          <h2 className="kop-2 mt-3">Wat kost dat voor jullie team?</h2>
          <p className="mt-3 max-w-2xl text-warm">
            Schuif naar het aantal medewerkers. Standaard reken ik per persoon twee shirts of polo&apos;s en één van de rest; pas het gerust aan.
          </p>
          <div className="mt-8">
            <TeamRekenhulp artikelen={rekenArtikelen} min={TEAM_MIN} max={TEAM_MAX} start={TEAM_STANDAARD} />
          </div>
        </section>
      )}

      {/* Zo werkt het */}
      <section className="border-t border-line bg-mist">
        <div className="container-x sec-md">
          <p className="eyebrow">Zo werkt het</p>
          <h2 className="kop-2 mt-3">Van pasdag tot nabestellen</h2>
          <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stappen.map((s, i) => (
              <li key={s.t} className="seam-card">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 font-display text-lg font-extrabold text-ink-900" aria-hidden="true">{i + 1}</span>
                <h3 className="mt-3 text-base font-bold text-ink-900"><span className="sr-only">Stap {i + 1}: </span>{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-warm">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Voorbeeldportaal */}
      <section className="container-x sec-md">
        <div className="flex flex-col items-start gap-5 rounded-2xl border-2 border-ink-900 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-xl">
            <h2 className="kop-3 text-ink-900">Kijk alvast rond in jullie eigen portaal</h2>
            <p className="mt-2 text-warm">
              Zo bestellen jullie medewerkers straks zelf, met het logo van {bedrijf} er al op. Het is een voorbeeld: klikken mag, er wordt niets besteld.
            </p>
          </div>
          <Link href={portaalUrl} prefetch={false} className="btn-primary w-full shrink-0 py-4 text-base sm:w-auto">Bekijk jullie voorbeeldportaal</Link>
        </div>
      </section>

      {/* Pasdag */}
      <section id="pasdag" className="scroll-mt-20 border-t border-line bg-mist">
        <div className="container-x sec-md grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="eyebrow">Gratis en vrijblijvend</p>
            <h2 className="kop-2 mt-3">Plan een gratis pasdag</h2>
            <p className="mt-3 max-w-prose text-warm">
              Ik kom bij jullie langs met pasmodellen. Iedereen past op de zaak, ik noteer de maten en laat zien hoe het logo eruit komt te zien. Daarna krijg je een offerte. Niets moet.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-ink-900">
              <li className="flex gap-2"><span className="text-amber-600" aria-hidden="true">✓</span> Op een moment dat jullie uitkomt, ook vroeg in de ochtend</li>
              <li className="flex gap-2"><span className="text-amber-600" aria-hidden="true">✓</span> Geen showroombezoek, geen verloren werkuren</li>
              <li className="flex gap-2"><span className="text-amber-600" aria-hidden="true">✓</span> {site.belofte}</li>
            </ul>
          </div>
          <PasdagFormulier token={token} bedrijf={bedrijf} voornaamJessi="Jessi" />
        </div>
      </section>

      {/* Contact */}
      <section className="container-x sec-md">
        <div className="grid grid-cols-1 gap-6 rounded-2xl bg-ink-900 p-6 text-white sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-8">
          <div>
            <h2 className="kop-3 text-white">Liever even bellen?</h2>
            <p className="mt-2 text-white/80">Bel of app Jessi rechtstreeks. Geen callcenter, gewoon mij.</p>
            <address className="mt-4 text-sm not-italic leading-relaxed text-white/70">
              {site.name}<br />
              {site.address.street}, {site.address.postalCode} {site.address.city} (Gld)<br />
              {site.address.locationNote}<br />
              <a href={`mailto:${site.email}`} className="underline underline-offset-2 hover:text-white">{site.email}</a>
            </address>
          </div>
          <div className="flex flex-col gap-3">
            <a href={telUrl} className="btn-primary">Bel Jessi: {site.phone}</a>
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn bg-[#25D366] text-ink-900 hover:bg-[#1fb857]">WhatsApp</a>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-warm">
          Geen interesse? <Link href={`/kennismaking/${token}/afmelden`} prefetch={false} className="font-semibold underline underline-offset-2 hover:text-ink-900">Laat het weten</Link>, dan hoor je niets meer van ons.
        </p>
      </section>
    </div>
  );
}
