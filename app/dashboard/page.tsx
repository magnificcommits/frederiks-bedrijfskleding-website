import Link from 'next/link';
import type { Metadata } from 'next';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { login } from './actions';
import { dashAuthed, adminSessieStatus, getHuidigeAdmin, magEigenaar } from '@/lib/kms/adminClient';
import { redirect } from 'next/navigation';
import AdminLoginForm from '@/components/dashboard/AdminLoginForm';
import { getVandaagSignalen } from '@/lib/kms/overzicht';
import { getDashboardStats } from '@/lib/kms/dashboardStats';
import { nlDelen, DAGEN_LANG, MAANDEN_LANG } from '@/app/dashboard/taken/tijd';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import Vandaag from '@/components/dashboard/overzicht/Vandaag';
import Aandacht, { type AandachtItem } from '@/components/dashboard/overzicht/Aandacht';
import OmzetGrafiek from '@/components/dashboard/overzicht/OmzetGrafiek';
import Pijplijn from '@/components/dashboard/overzicht/Pijplijn';
import Activiteit from '@/components/dashboard/overzicht/Activiteit';
import TopKlanten from '@/components/dashboard/overzicht/TopKlanten';

export const metadata: Metadata = { title: 'Overzicht', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
type SP = { fout?: string };

function groet(uur: number): string {
  if (uur < 6) return 'Goedenacht';
  if (uur < 12) return 'Goedemorgen';
  if (uur < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

const meervoud = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`;

const SNELLE_ACTIES = [
  { href: '/dashboard/offertes/nieuw', label: 'Offerte', primair: true },
  { href: '/dashboard/orders/nieuw', label: 'Order' },
  { href: '/dashboard/klanten/nieuw', label: 'Klant' },
  { href: '/dashboard/taken?nieuw=taak', label: 'Taak' },
];

export default async function DashboardHome({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const authed = await dashAuthed();

  if (!authed) {
    // Half ingelogd: beheerder met tweestapsverificatie die de code nog moet invoeren.
    const sessie = await adminSessieStatus();
    if (sessie.status === '2fa-nodig') redirect('/dashboard/auth/2fa');
    const verlopen = sessie.status === 'verlopen';
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-sm panel p-4">
          <h1 className="dash-h1">Frederiks KMS</h1>
          <p className="mt-2 text-sm text-warm">Log in om het systeem te beheren.</p>
          {verlopen && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Je bent na 8 uur automatisch uitgelogd. Log opnieuw in.</p>
          )}
          {sp?.fout === 'link' && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">De inloglink werkte niet of is verlopen. Vraag hieronder een nieuwe aan.</p>
          )}
          <div className="mt-5">
            <AdminLoginForm />
            <p className="mt-2 text-xs text-warm">Voor beheerders met een eigen account.</p>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Of log in met het wachtwoord</p>
            {!env.dashboardPassword && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Nog niet ingesteld. Zet <code>DASHBOARD_PASSWORD</code> in de omgevingsvariabelen.</p>
            )}
            {sp?.fout === '1' && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Wachtwoord onjuist. Probeer het opnieuw.</p>
            )}
            <form action={login} className="mt-3">
              <input type="password" name="password" placeholder="Wachtwoord" autoComplete="current-password"
                className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              <button type="submit" className="mt-3 w-full rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-ink-800 hover:bg-mist">Inloggen met wachtwoord</button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  if (!isLeadsDbConfigured) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen.</p>
        </div>
      </main>
    );
  }

  const [stats, signalen, admin, eigenaar] = await Promise.all([
    getDashboardStats(),
    getVandaagSignalen(),
    getHuidigeAdmin().catch(() => null),
    magEigenaar().catch(() => false),
  ]);

  const nl = nlDelen();
  const voornaam = admin?.naam?.trim().split(/\s+/)[0] ?? null;
  const datumTekst = `${DAGEN_LANG[nl.weekdag]} ${Number(nl.datum.slice(8, 10))} ${MAANDEN_LANG[Number(nl.datum.slice(5, 7)) - 1]}`;

  if (!stats) {
    return (
      <main className="container-app py-6">
        <div className="dash-kop"><h1 className="dash-h1">{groet(nl.uur)}{voornaam ? ` ${voornaam}` : ''}</h1></div>
        <p className="panel mt-4 px-4 py-3 text-[13px] text-warm">De cijfers konden niet worden geladen. Ververs de pagina over een minuut.</p>
      </main>
    );
  }

  const { omzet, orders, offertes, facturen, leads, periode, maanden } = stats;
  const labels = maanden.map((m) => m.label);

  /* ---- Aandachtslijst: alles met een aantal, met een directe link ---- */
  const eersteOfferte = offertes.bijnaVerlopen[0];
  const aandacht: AandachtItem[] = [
    {
      key: 'taken', aantal: signalen?.verlopenTaken ?? 0, urgent: true,
      label: (signalen?.verlopenTaken ?? 0) === 1 ? 'Taak over de datum' : 'Taken over de datum',
      href: '/dashboard/taken?wanneer=verlopen',
    },
    {
      key: 'goedkeuring', aantal: orders.wachtGoedkeuring, urgent: true,
      label: orders.wachtGoedkeuring === 1 ? 'Order wacht op goedkeuring' : 'Orders wachten op goedkeuring',
      href: '/dashboard/orders?goedkeuring=wacht',
    },
    ...(eigenaar
      ? [{
          key: 'vervallen', aantal: facturen.vervallenAantal, urgent: true,
          label: facturen.vervallenAantal === 1 ? 'Factuur over de betaaltermijn' : 'Facturen over de betaaltermijn',
          detail: `${euro(facturen.vervallenBedrag)} nog niet binnen`,
          href: '/dashboard/facturen?status=verzonden',
        }]
      : []),
    {
      key: 'offertes', aantal: offertes.bijnaVerlopen.length, urgent: offertes.bijnaVerlopen.some((o) => o.dagen <= 2),
      label: offertes.bijnaVerlopen.length === 1 ? 'Offerte verloopt binnenkort' : 'Offertes verlopen binnenkort',
      detail: eersteOfferte
        ? `#${eersteOfferte.nummer ?? '—'}${eersteOfferte.klant ? ` ${eersteOfferte.klant}` : ''}, ${
            eersteOfferte.dagen === 0 ? 'laatste dag' : `nog ${meervoud(eersteOfferte.dagen, 'dag', 'dagen')}`
          }`
        : null,
      href: offertes.bijnaVerlopen.length === 1 ? `/dashboard/offertes/${eersteOfferte!.id}` : '/dashboard/offertes?status=verstuurd',
    },
    {
      key: 'opvolgen', aantal: leads.opvolgen, urgent: true,
      label: leads.opvolgen === 1 ? 'Lead om op te volgen' : 'Leads om op te volgen',
      detail: 'Opvolgdatum is vandaag of al voorbij',
      href: '/dashboard/leads',
    },
    {
      key: 'leads', aantal: leads.wachten,
      label: leads.wachten === 1 ? 'Nieuwe lead wacht op reactie' : 'Nieuwe leads wachten op reactie',
      detail: leads.eersteWachtend ? `Langst wachtend: ${leads.eersteWachtend}` : null,
      href: '/dashboard/leads',
    },
    {
      key: 'retouren', aantal: signalen?.retourenTeBeoordelen ?? 0,
      label: 'Retouren te beoordelen', href: '/dashboard/retouren',
    },
    ...(eigenaar
      ? [{
          key: 'concepten', aantal: facturen.concepten,
          label: facturen.concepten === 1 ? 'Conceptfactuur nog niet verstuurd' : 'Conceptfacturen nog niet verstuurd',
          href: '/dashboard/facturen?status=concept',
        }]
      : []),
    {
      key: 'inkoop', aantal: stats.teBestellen,
      label: stats.teBestellen === 1 ? 'Inkoopregel te bestellen' : 'Inkoopregels te bestellen',
      href: '/dashboard/inkoop',
    },
    {
      key: 'voorraad', aantal: signalen?.voorraadOnderMinimum ?? 0,
      label: 'Producten onder de minimumvoorraad', href: '/dashboard/voorraad',
    },
    {
      key: 'passessies', aantal: stats.passessiesOpenVerleden,
      label: stats.passessiesOpenVerleden === 1 ? 'Passessie nog niet afgerond' : 'Passessies nog niet afgerond',
      detail: 'De pasdag is voorbij, de sessie staat nog open',
      href: '/dashboard/passessie',
    },
  ];
  const urgentAantal = aandacht.filter((a) => a.urgent && a.aantal > 0).length;
  const aandachtAantal = aandacht.filter((a) => a.aantal > 0).length;

  /* ---- Eén zin onder de groet: hoe ziet de dag eruit ---------------- */
  const vandaagItems = stats.agenda.filter((a) => a.datum === stats.vandaag && !a.klaar);
  const afspraken = vandaagItems.filter((a) => a.soort !== 'taak').length;
  const takenVandaag = vandaagItems.filter((a) => a.soort === 'taak').length;
  const planning = [
    afspraken > 0 ? meervoud(afspraken, 'afspraak', 'afspraken') : null,
    takenVandaag > 0 ? meervoud(takenVandaag, 'taak', 'taken') : null,
  ].filter(Boolean).join(' en ');
  const dagZin =
    !planning && aandachtAantal === 0
      ? 'Niets gepland en niets dat wacht.'
      : [
          planning ? `Vandaag ${planning}.` : 'Niets gepland vandaag.',
          urgentAantal > 0 ? `${meervoud(urgentAantal, 'punt heeft', 'punten hebben')} haast.` : aandachtAantal > 0 ? `${meervoud(aandachtAantal, 'punt', 'punten')} op de lijst.` : null,
        ].filter(Boolean).join(' ');

  /* ---- KPI-tegels ---------------------------------------------------- */
  const heeft = (waarden: number[]) => waarden.some((v) => v > 0);
  const reeks = {
    omzet: maanden.map((m) => Math.round(m.gefactureerd)),
    orders: maanden.map((m) => m.orders),
    offertes: maanden.map((m) => m.offertes),
    openstaand: maanden.map((m) => Math.round(m.openstaand)),
    leads: maanden.map((m) => m.leads),
  };
  const beslist = offertes.geaccepteerd12m + offertes.afgewezen12m;

  const tegels = [
    eigenaar && (
      <KpiTegel
        key="omzet"
        label="Omzet deze maand"
        waarde={euro(omzet.mtd)}
        href="/dashboard/rapportages"
        delta={omzet.mtd > 0 || omzet.vorigeMtd > 0 ? { nu: omzet.mtd, vorige: omzet.vorigeMtd, richting: 'hoger-beter', vergelijk: periode.vorige } : undefined}
        spark={heeft(reeks.omzet) ? { waarden: reeks.omzet, labels, opmaak: 'euro', omschrijving: 'Gefactureerd per maand' } : undefined}
        sub={
          omzet.mtd > 0 ? <span className="text-warm">{euro(omzet.betaaldMtd)} daarvan al betaald</span>
          : omzet.totaal12m > 0 ? <span className="text-warm">Nog niets gefactureerd in {periode.huidig}</span>
          : <span className="text-warm">Excl. btw. Verschijnt zodra je een factuur verstuurt.</span>
        }
      />
    ),
    <KpiTegel
      key="orders"
      label="Lopende orders"
      waarde={String(orders.open)}
      href="/dashboard/orders"
      delta={orders.nieuwMtd > 0 || orders.nieuwVorigeMtd > 0
        ? { nu: orders.nieuwMtd, vorige: orders.nieuwVorigeMtd, richting: 'hoger-beter', vergelijk: periode.vorige, voorvoegsel: `${orders.nieuwMtd} nieuw` }
        : undefined}
      spark={heeft(reeks.orders) ? { waarden: reeks.orders, labels, omschrijving: 'Nieuwe orders per maand' } : undefined}
      sub={orders.oud14 > 0
        ? <span className="font-semibold text-amber-800">{meervoud(orders.oud14, 'ligt', 'liggen')} langer dan 14 dagen</span>
        : orders.open > 0 ? <span className="text-warm">Geen order ligt langer dan 14 dagen</span>
        : <span className="text-warm">Er loopt nu niets. Een goedgekeurde offerte wordt hier een order.</span>}
    />,
    <KpiTegel
      key="offertes"
      label="Openstaande offertes"
      waarde={euro(offertes.openWaarde)}
      href="/dashboard/offertes"
      delta={offertes.nieuwMtd > 0 || offertes.nieuwVorigeMtd > 0
        ? { nu: offertes.nieuwMtd, vorige: offertes.nieuwVorigeMtd, richting: 'hoger-beter', vergelijk: periode.vorige, voorvoegsel: `${offertes.nieuwMtd} nieuw` }
        : undefined}
      spark={heeft(reeks.offertes) ? { waarden: reeks.offertes, labels, omschrijving: 'Offertes per maand' } : undefined}
      sub={beslist > 0
        ? <span className="text-warm">
            <span className="font-semibold text-ink-800">{Math.round((offertes.geaccepteerd12m / beslist) * 100)}%</span> wordt order
            ({offertes.geaccepteerd12m} van {beslist} beslist)
          </span>
        : offertes.verstuurd + offertes.concept > 0
          ? <span className="text-warm">{offertes.verstuurd} verstuurd · {offertes.concept} concept · excl. btw</span>
          : <span className="text-warm">Nog geen open offertes</span>}
    />,
    eigenaar && (
      <KpiTegel
        key="facturen"
        label="Openstaande facturen"
        waarde={euro(facturen.open)}
        href="/dashboard/facturen"
        delta={facturen.open > 0 || facturen.openEindVorigeMaand > 0
          ? { nu: facturen.open, vorige: facturen.openEindVorigeMaand, richting: 'lager-beter', vergelijk: periode.vorigeMaandEinde }
          : undefined}
        spark={heeft(reeks.openstaand) ? { waarden: reeks.openstaand, labels, opmaak: 'euro', omschrijving: 'Openstaand aan het eind van de maand' } : undefined}
        sub={facturen.vervallenAantal > 0
          ? <span className="font-semibold text-amber-800">{euro(facturen.vervallenBedrag)} over de termijn</span>
          : facturen.openAantal > 0 ? <span className="text-warm">{meervoud(facturen.openAantal, 'factuur', 'facturen')}, niets vervallen</span>
          : <span className="text-warm">Alles is betaald</span>}
      />
    ),
    <KpiTegel
      key="leads"
      label="Nieuwe leads deze maand"
      waarde={String(leads.mtd)}
      href="/dashboard/leads"
      delta={leads.mtd > 0 || leads.vorigeMtd > 0 ? { nu: leads.mtd, vorige: leads.vorigeMtd, richting: 'hoger-beter', vergelijk: periode.vorige } : undefined}
      spark={heeft(reeks.leads) ? { waarden: reeks.leads, labels, omschrijving: 'Nieuwe leads per maand' } : undefined}
      sub={leads.wachten > 0
        ? <span className="text-warm">{meervoud(leads.wachten, 'wacht', 'wachten')} nog op een reactie</span>
        : <span className="text-warm">Iedereen heeft antwoord gehad</span>}
    />,
  ].filter(Boolean);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex-wrap justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="dash-h1">{groet(nl.uur)}{voornaam ? ` ${voornaam}` : ''}</h1>
          <p className="dash-sub">
            <span>{datumTekst.charAt(0).toUpperCase() + datumTekst.slice(1)}</span>
            <span className="text-ink-300"> · </span>
            {dagZin}
          </p>
        </div>
        <nav aria-label="Snel aanmaken" className="flex flex-wrap items-center gap-1.5">
          {SNELLE_ACTIES.map((a) => (
            <Link key={a.href} href={a.href} className={a.primair ? 'knop-primair' : 'knop-stil'}>
              <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
                <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <span><span className="sr-only">Nieuwe </span>{a.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Eerst wat er vandaag moet gebeuren, dan hoe het gaat. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7"><Vandaag items={stats.agenda} vandaag={stats.vandaag} nuTijd={stats.nuTijd} /></div>
        <div className="lg:col-span-5"><Aandacht items={aandacht} /></div>
      </div>

      <h2 className="sr-only">Kerncijfers</h2>
      <div className={`mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 ${tegels.length === 5 ? 'xl:grid-cols-5' : ''}`}>
        {tegels}
      </div>

      {eigenaar && (
        <div className="mt-4 grid gap-4 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-8"><OmzetGrafiek maanden={maanden} /></div>
          <div className="xl:col-span-4"><TopKlanten klanten={stats.topKlanten} /></div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7 xl:col-span-8">
          <Pijplijn fases={orders.pijplijn} open={orders.open} openWaarde={orders.openWaarde} langst={orders.langst} />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <Activiteit
            items={eigenaar ? stats.activiteit : stats.activiteit.filter((a) => a.soort !== 'factuur')}
            vandaag={stats.vandaag}
            toonLogboek={eigenaar}
          />
        </div>
      </div>
    </main>
  );
}
