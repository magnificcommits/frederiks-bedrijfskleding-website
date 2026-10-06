import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLeadsDbConfigured } from '@/lib/env';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { getGebruikers, type Gebruiker } from '@/lib/portaalAdmin';
import { listBranches, listContactpersonen, type Contactpersoon } from '@/lib/kms/crm';
import { listAfdelingen, type Afdeling } from '@/lib/kms/structuur';
import { listWerknemers, type Werknemer } from '@/lib/kms/werknemers';
import { listKlantAssortiment } from '@/lib/kms/assortiment';
import AssortimentBeheer from '../[id]/AssortimentBeheer';
import WerknemersInvoer from '../_delen/WerknemersInvoer';
import { afdelingSuggesties } from '../_delen/afdelingSuggesties';
import { LAATSTE_STAP, WIZARD_STAPPEN, inrichtingPunten, wizardUrl, type InrichtingTelling } from '../_delen/inrichting';
import BedrijfsnaamVeld from './BedrijfsnaamVeld';
import StapContacten from './StapContacten';
import StapAfdelingen from './StapAfdelingen';
import { slaBedrijfOpActie, slaWerknemersOpActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nieuwe klant', robots: { index: false, follow: false } };

type Org = {
  id: string;
  naam: string;
  branche: string | null;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  telefoon: string | null;
  email_algemeen: string | null;
  factuur_email: string | null;
  kvk: string | null;
  btw_nummer: string | null;
  interne_notities: string | null;
};

const FOUTEN: Record<string, string> = {
  naam: 'Vul een bedrijfsnaam in.',
  mislukt: 'Opslaan is niet gelukt. Probeer het nog eens.',
  onbekend: 'Deze klant bestaat niet (meer). Begin hieronder opnieuw.',
  db: 'Geen verbinding met de database.',
};

/**
 * Wizard Nieuwe klant: in zes stappen van bedrijfsgegevens tot assortiment.
 * Stap 1 maakt de klant aan; daarna staat alles in de URL (?klant=...&stap=...)
 * en is elke stap al opgeslagen. Stoppen kan dus altijd: via de klantkaart (de
 * checklist bovenaan) of deze URL ga je later verder.
 */
export default async function NieuweKlantPage({
  searchParams,
}: {
  searchParams: Promise<{ klant?: string; stap?: string; melding?: string; fout?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');

  if (!isLeadsDbConfigured) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet de Supabase-omgevingsvariabelen en draai de migraties.</p>
          <Link href="/dashboard/klanten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar klanten</Link>
        </div>
      </main>
    );
  }

  const { klant, stap: stapRuw, melding, fout } = await searchParams;
  const klantId = (klant ?? '').trim();
  const sb = kmsAdmin();

  let org: Org | null = null;
  if (klantId && sb) {
    const { data } = await sb
      .from('organisaties')
      .select('id, naam, branche, adres, postcode, plaats, telefoon, email_algemeen, factuur_email, kvk, btw_nummer, interne_notities')
      .eq('id', klantId)
      .maybeSingle();
    org = (data as Org | null) ?? null;
    if (!org) redirect('/dashboard/klanten/nieuw?fout=onbekend');
  }

  // Zonder klant kan alleen stap 1.
  const gevraagd = Math.round(Number(stapRuw) || (org ? 2 : 1));
  const stap = org ? Math.min(LAATSTE_STAP, Math.max(1, gevraagd)) : 1;

  const leeg: [Contactpersoon[], Afdeling[], Werknemer[], Gebruiker[], number] = [[], [], [], [], 0];
  const [contactpersonen, afdelingen, werknemers, gebruikers, assortimentAantal] = org
    ? await Promise.all([
        listContactpersonen(org.id),
        listAfdelingen(org.id),
        listWerknemers(org.id),
        getGebruikers(org.id),
        sb
          ? sb
              .from('assortiment')
              .select('id', { count: 'exact', head: true })
              .eq('organisatie_id', org.id)
              .then((r) => r.count ?? 0)
          : Promise.resolve(0),
      ])
    : leeg;

  const actieveWerknemers = werknemers.filter((w) => w.actief);
  const telling: InrichtingTelling = {
    contactpersonen: contactpersonen.length,
    facturatiecontact: contactpersonen.some((c) => c.facturatie) || Boolean(org?.factuur_email?.trim()),
    afdelingen: afdelingen.length,
    werknemers: actieveWerknemers.length,
    assortiment: assortimentAantal,
    portaalgebruikers: gebruikers.length,
  };
  const stapKlaar: Record<number, boolean> = {
    1: Boolean(org),
    2: telling.contactpersonen > 0,
    3: telling.afdelingen > 0,
    4: telling.werknemers > 0,
    5: telling.assortiment > 0,
    6: false,
  };

  function Knoppen({ overslaan = false }: { overslaan?: boolean }) {
    // Opslaan en verder staat eerst in de HTML: Enter in een veld kiest de eerste
    // verstuurknop, en dat moet niet Terug zijn. flex-row-reverse zet hem rechts.
    return (
      <div className="flex flex-row-reverse flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex flex-row-reverse items-center gap-3">
          <button type="submit" name="ga" value="verder" className="knop-primair px-4 py-2.5 text-[15px]">
            Opslaan en verder
          </button>
          {overslaan && org && (
            <Link href={wizardUrl(org.id, stap + 1)} className="knop-tekst">
              Overslaan
            </Link>
          )}
        </div>
        {stap > 1 ? (
          <button type="submit" name="ga" value="terug" className="knop-stil">
            Terug
          </button>
        ) : (
          <span />
        )}
      </div>
    );
  }

  let inhoud: React.ReactNode = null;
  let titel = '';
  let uitleg = '';

  if (stap === 1) {
    titel = 'Bedrijfsgegevens';
    uitleg = 'Alleen de naam is verplicht. Na opslaan bestaat de klant en kun je altijd stoppen en later verder.';
    const [branches, alleKlanten] = await Promise.all([
      listBranches(),
      sb
        ? sb
            .from('organisaties')
            .select('id, naam')
            .limit(5000)
            .then((r) => (r.data as { id: string; naam: string }[] | null) ?? [])
        : Promise.resolve([] as { id: string; naam: string }[]),
    ]);
    inhoud = (
      <form action={slaBedrijfOpActie} className="flex flex-col gap-4">
        {org && <input type="hidden" name="klantId" value={org.id} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BedrijfsnaamVeld standaard={org?.naam ?? ''} bestaande={alleKlanten} eigenId={org?.id} />
          <div>
            <label className="veld-label" htmlFor="w-branche">Branche</label>
            <input
              id="w-branche"
              name="branche"
              list="w-branche-lijst"
              defaultValue={org?.branche ?? ''}
              placeholder="Kies of typ een branche"
              autoComplete="off"
              className="veld"
            />
            <datalist id="w-branche-lijst">
              {branches.map((b) => <option key={b} value={b} />)}
            </datalist>
            <p className="veld-hint">Kies bij voorkeur een bestaande branche. Die bepaalt ook de suggesties voor afdelingen.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="veld-label" htmlFor="w-adres">Adres</label>
            <input id="w-adres" name="adres" defaultValue={org?.adres ?? ''} placeholder="Straat en huisnummer" className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="w-postcode">Postcode</label>
            <input id="w-postcode" name="postcode" defaultValue={org?.postcode ?? ''} placeholder="0000 AA" className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="w-plaats">Plaats</label>
            <input id="w-plaats" name="plaats" defaultValue={org?.plaats ?? ''} placeholder="Plaats" className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="w-telefoon">Telefoon</label>
            <input id="w-telefoon" name="telefoon" defaultValue={org?.telefoon ?? ''} placeholder="0314 12 34 56" className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="w-email">Algemeen e-mailadres</label>
            <input id="w-email" name="email_algemeen" type="email" defaultValue={org?.email_algemeen ?? ''} placeholder="info@bedrijf.nl" className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor="w-factuur">Factuur-e-mailadres</label>
            <input id="w-factuur" name="factuur_email" type="email" defaultValue={org?.factuur_email ?? ''} placeholder="administratie@bedrijf.nl" className="veld" />
            <p className="veld-hint">Leeg laten mag; in de volgende stap kun je ook een contactpersoon de facturen laten krijgen.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="veld-label" htmlFor="w-kvk">KvK (optioneel)</label>
              <input id="w-kvk" name="kvk" defaultValue={org?.kvk ?? ''} inputMode="numeric" className="veld" />
            </div>
            <div>
              <label className="veld-label" htmlFor="w-btw">Btw-nummer (optioneel)</label>
              <input id="w-btw" name="btw_nummer" defaultValue={org?.btw_nummer ?? ''} placeholder="NL..." className="veld" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="veld-label" htmlFor="w-notitie">Notitie (alleen intern)</label>
            <textarea
              id="w-notitie"
              name="interne_notities"
              rows={3}
              defaultValue={org?.interne_notities ?? ''}
              placeholder="Bijv. via beurs Doetinchem, wil eerst een pasdag in maart"
              className="veld"
            />
          </div>
        </div>
        <Knoppen />
      </form>
    );
  } else if (org && stap === 2) {
    titel = 'Contactpersonen';
    uitleg = 'Met wie doe je zaken? Kies wie het hoofdcontact is en wie de facturen krijgt.';
    const portaalMails = new Set(gebruikers.map((g) => (g.email ?? '').trim().toLowerCase()).filter(Boolean));
    const werknemerSleutels = new Set(
      werknemers.flatMap((w) => [w.naam.trim().toLowerCase(), (w.email ?? '').trim().toLowerCase()]).filter(Boolean),
    );
    inhoud = (
      <StapContacten
        klantId={org.id}
        bestaande={contactpersonen.map((c) => ({
          id: c.id,
          naam: c.naam,
          functie: c.functie,
          email: c.email,
          telefoon: c.telefoon,
          hoofdcontact: c.hoofdcontact,
          facturatie: c.facturatie,
          heeftPortaal: Boolean(c.email && portaalMails.has(c.email.trim().toLowerCase())),
          isWerknemer: c.email
            ? werknemerSleutels.has(c.email.trim().toLowerCase())
            : werknemerSleutels.has(c.naam.trim().toLowerCase()),
        }))}
        knoppen={<Knoppen overslaan />}
      />
    );
  } else if (org && stap === 3) {
    titel = 'Afdelingen';
    uitleg = 'Groepen werknemers met eigen kleding. Mag leeg blijven.';
    const perAfdeling = new Map<string, number>();
    for (const w of actieveWerknemers) if (w.afdeling_id) perAfdeling.set(w.afdeling_id, (perAfdeling.get(w.afdeling_id) ?? 0) + 1);
    const artikelenPer = new Map<string, number>();
    if (sb && afdelingen.length > 0) {
      const { data } = await sb.from('assortiment').select('afdeling_id').eq('organisatie_id', org.id).not('afdeling_id', 'is', null);
      for (const r of (data as { afdeling_id: string }[] | null) ?? []) artikelenPer.set(r.afdeling_id, (artikelenPer.get(r.afdeling_id) ?? 0) + 1);
    }
    inhoud = (
      <StapAfdelingen
        klantId={org.id}
        bestaande={afdelingen.map((a) => ({
          id: a.id,
          naam: a.naam,
          werknemers: perAfdeling.get(a.id) ?? 0,
          artikelen: artikelenPer.get(a.id) ?? 0,
        }))}
        suggesties={afdelingSuggesties(org.branche)}
        knoppen={<Knoppen overslaan />}
      />
    );
  } else if (org && stap === 4) {
    titel = 'Werknemers';
    uitleg = 'Wie draagt de kleding? Typ ze in of plak een lijst uit Excel. Mag ook later, bijvoorbeeld op de pasdag.';
    inhoud = (
      <WerknemersInvoer
        afdelingen={afdelingen.map((a) => ({ id: a.id, naam: a.naam }))}
        bestaande={actieveWerknemers.map((w) => ({ id: w.id, naam: w.naam, afdeling_id: w.afdeling_id, email: w.email }))}
        actie={slaWerknemersOpActie}
        verborgen={{ klantId: org.id }}
        knoppen={<Knoppen overslaan />}
      />
    );
  } else if (org && stap === 5) {
    titel = 'Assortiment';
    uitleg = 'Welke artikelen mag deze klant bestellen? Elk artikel wordt meteen opgeslagen. Mag ook later.';
    const regels = await listKlantAssortiment(org.id);
    inhoud = (
      <div>
        <p className="max-w-3xl text-[14px] text-warm">
          Klik op Artikel zoeken en toevoegen. Kies per artikel de kleur en voor wie het is: de hele klant of alleen
          bepaalde afdelingen
          {afdelingen.length > 0 ? ` (${afdelingen.map((a) => a.naam).join(', ')})` : ''}. Zo krijgen de lassers
          laskleding en logistiek niet.
        </p>
        <AssortimentBeheer orgId={org.id} regels={regels} afdelingen={afdelingen.map((a) => ({ id: a.id, naam: a.naam }))} />
        <div className="mt-6 flex flex-row-reverse flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Link href={wizardUrl(org.id, 6)} className="knop-primair px-4 py-2.5 text-[15px]">
            {regels.length > 0 ? 'Verder' : 'Overslaan, later doen'}
          </Link>
          <Link href={wizardUrl(org.id, 4)} className="knop-stil">
            Terug
          </Link>
        </div>
      </div>
    );
  } else if (org && stap === 6) {
    titel = 'Klaar';
    uitleg = `${org.naam} staat in het systeem. Dit is er aangemaakt:`;
    const hoofd = contactpersonen.find((c) => c.hoofdcontact);
    const fact = contactpersonen.find((c) => c.facturatie);
    const perAfdeling = new Map<string, number>();
    let zonderAfdeling = 0;
    for (const w of actieveWerknemers) {
      if (w.afdeling_id) perAfdeling.set(w.afdeling_id, (perAfdeling.get(w.afdeling_id) ?? 0) + 1);
      else zonderAfdeling += 1;
    }
    const open = inrichtingPunten(org.id, telling).filter((p) => !p.klaar);
    const regel = (label: string, waarde: React.ReactNode, href: string) => (
      <li className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line py-3 last:border-b-0">
        <span className="w-40 shrink-0 text-[13px] font-semibold uppercase tracking-wide text-warm">{label}</span>
        <span className="flex-1 text-[14px] text-ink-900">{waarde}</span>
        <Link href={href} className="text-[13px] font-semibold text-amber-700 hover:text-amber-800">Aanpassen</Link>
      </li>
    );
    inhoud = (
      <div>
        <ul className="panel px-4">
          {regel('Bedrijf', [org.naam, org.plaats, org.branche].filter(Boolean).join(' · '), wizardUrl(org.id, 1))}
          {regel(
            'Contactpersonen',
            contactpersonen.length === 0
              ? 'Nog geen'
              : `${contactpersonen.length}${hoofd ? ` · hoofdcontact ${hoofd.naam}` : ''}${
                  fact ? ` · facturen naar ${fact.naam}` : org.factuur_email ? ` · facturen naar ${org.factuur_email}` : ''
                }`,
            wizardUrl(org.id, 2),
          )}
          {regel(
            'Afdelingen',
            afdelingen.length === 0 ? 'Geen (de hele klant is één groep)' : afdelingen.map((a) => a.naam).join(', '),
            wizardUrl(org.id, 3),
          )}
          {regel(
            'Werknemers',
            actieveWerknemers.length === 0
              ? 'Nog geen'
              : [
                  `${actieveWerknemers.length} in totaal`,
                  ...afdelingen.filter((a) => perAfdeling.get(a.id)).map((a) => `${a.naam} ${perAfdeling.get(a.id)}`),
                  ...(afdelingen.length > 0 && zonderAfdeling > 0 ? [`zonder afdeling ${zonderAfdeling}`] : []),
                ].join(' · '),
            wizardUrl(org.id, 4),
          )}
          {regel('Assortiment', assortimentAantal === 0 ? 'Nog leeg' : `${assortimentAantal} ${assortimentAantal === 1 ? 'artikel' : 'artikelen'}`, wizardUrl(org.id, 5))}
          {regel(
            'Portaal',
            gebruikers.length === 0 ? 'Nog niemand kan inloggen' : gebruikers.map((g) => g.email).join(', '),
            `/dashboard/klanten/${org.id}?tab=contact#gebruikers`,
          )}
        </ul>

        {open.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-[14px] font-semibold text-amber-900">Nog te doen</p>
            <ul className="mt-1 flex flex-col gap-1 text-[14px] text-amber-900">
              {open.map((p) => (
                <li key={p.sleutel}>
                  <Link href={p.href} className="font-semibold underline">{p.label}</Link>
                  {p.optioneel ? ' (optioneel)' : ''}: {p.uitleg}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-amber-900">Deze lijst staat ook bovenaan de klantkaart tot alles klaar is.</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/dashboard/klanten/${org.id}`} className="knop-primair px-4 py-2.5 text-[15px]">
            Naar de klantkaart
          </Link>
          <Link href={`/dashboard/klanten/${org.id}?tab=werknemers#pasdag`} className="knop-donker px-4 py-2.5 text-[15px]">
            Pasdag starten
          </Link>
          <Link href={`/dashboard/offertes/nieuw?klant=${org.id}`} className="knop-stil px-4 py-2.5 text-[15px]">
            Nieuwe offerte
          </Link>
          <Link href="/dashboard/klanten/nieuw" className="knop-tekst px-4 py-2.5 text-[15px]">
            Nog een klant aanmaken
          </Link>
        </div>
      </div>
    );
  }

  const voortgang = Math.round(((stap - 1) / (LAATSTE_STAP - 1)) * 100);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">{org ? org.naam : 'Nieuwe klant'}</h1>
          <p className="mt-1 text-sm text-warm">
            {org ? 'Klant inrichten' : 'Nieuwe klant aanmaken'} · stap {stap} van {LAATSTE_STAP}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {org && stap < LAATSTE_STAP && (
            <Link href={`/dashboard/klanten/${org.id}`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              Stoppen, later verder
            </Link>
          )}
          <Link href="/dashboard/klanten" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar klanten</Link>
        </div>
      </div>

      <nav aria-label="Stappen" className="mt-6">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist" aria-hidden="true">
          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${voortgang}%` }} />
        </div>
        <ol className="mt-3 grid grid-cols-6 gap-1">
          {WIZARD_STAPPEN.map((s) => {
            const huidig = s.nr === stap;
            const klaar = stapKlaar[s.nr] && !huidig;
            const rondje = (
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  huidig ? 'bg-amber-500 text-ink-900' : klaar ? 'bg-green-600 text-white' : 'bg-mist text-warm'
                }`}
              >
                {klaar ? '✓' : s.nr}
              </span>
            );
            const label = (
              <span className={`text-[13px] font-semibold ${huidig ? 'text-ink-900' : 'text-warm'} ${huidig ? '' : 'hidden sm:inline'}`}>
                {s.label}
              </span>
            );
            return (
              <li key={s.nr}>
                {org && !huidig ? (
                  <Link href={wizardUrl(org.id, s.nr)} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-mist">
                    {rondje}
                    {label}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 px-1 py-1" aria-current={huidig ? 'step' : undefined}>
                    {rondje}
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="mt-6 max-w-5xl">
        {fout && FOUTEN[fout] && (
          <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {FOUTEN[fout]}
          </p>
        )}
        {melding && (
          <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
            {melding.slice(0, 600)}
          </p>
        )}
        <h2 className="font-display text-xl font-bold text-ink-900">{titel}</h2>
        {uitleg && <p className="mt-1 max-w-3xl text-[14px] text-warm">{uitleg}</p>}
        <div className="mt-4">{inhoud}</div>
      </section>
    </main>
  );
}
