import Link from 'next/link';
import { redirect } from 'next/navigation';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { isEmailConfigured } from '@/lib/env';
import { getCampagne, getRapport } from '@/lib/kms/campagnes';
import { getCampagneInstellingen } from '@/lib/kms/campagneInstellingen';
import { listNieuwsbrieven } from '@/lib/nieuwsbrief/opslag';
import { listTaakPersonen } from '@/lib/kms/taakPersonen';
import { PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import { LEAD_STATUSSEN } from '@/lib/kms/leadsModel';
import { DOEL_LABEL, DOELGROEP_LABEL, triggerOmschrijving } from '@/lib/campagnes/flow';
import FlowBouwer from './FlowBouwer';
import TriggerFormulier from './TriggerFormulier';
import OntvangersTab from './OntvangersTab';
import RapportTab from './RapportTab';
import { wijzigStatusActie } from './actions';
import { dupliceerCampagneActie, verwijderCampagneActie } from '../actions';
import { CampagneStatusBadge } from '../onderdelen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campagne', robots: { index: false, follow: false } };

const TABS = [
  { id: 'flow', label: 'Flow' },
  { id: 'instellingen', label: 'Trigger en doel' },
  { id: 'ontvangers', label: 'Ontvangers' },
  { id: 'rapport', label: 'Rapport' },
] as const;
type TabId = (typeof TABS)[number]['id'];

type Zoek = { tab?: string; melding?: string; ostatus?: string; oq?: string; dg?: string; fs?: string; fb?: string; fp?: string; fbron?: string; fq?: string; kies?: string };

function Melding({ tekst }: { tekst: string }) {
  return <p className="mt-3 rounded-md border border-line bg-mist px-4 py-2 text-[13px] text-ink-800">{tekst}</p>;
}

export default async function CampagnePagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { id } = await params;
  const zoek = await searchParams;
  const tab: TabId = (TABS.map((t) => t.id) as string[]).includes(zoek.tab ?? '') ? (zoek.tab as TabId) : 'flow';

  if (!kmsAdmin()) redirect('/dashboard/campagnes');
  const c = await getCampagne(id);
  if (!c) {
    return (
      <main className="container-smal py-20">
        <div className="panel mx-auto max-w-xl p-8">
          <h1 className="dash-h1">Campagne niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze campagne bestaat niet (meer).</p>
          <Link href="/dashboard/campagnes" className="mt-5 inline-block knop-stil">
            Naar campagnes
          </Link>
        </div>
      </main>
    );
  }

  const inst = await getCampagneInstellingen();
  const doelTekst = c.doel.soorten.length ? c.doel.soorten.map((s) => DOEL_LABEL[s]).join(' of ') : 'Geen doel: iedereen loopt de hele flow door.';
  const statusKnop = (status: string, label: string, klasse: string, bevestig?: string) => (
    <form action={wijzigStatusActie}>
      <input type="hidden" name="campagneId" value={c.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="tab" value={tab === 'flow' ? '' : tab} />
      {bevestig ? (
        <ConfirmSubmit message={bevestig} className={klasse}>
          {label}
        </ConfirmSubmit>
      ) : (
        <button type="submit" className={klasse}>
          {label}
        </button>
      )}
    </form>
  );

  let inhoud: React.ReactNode = null;
  if (tab === 'flow') {
    const [nieuwsbrieven, personen, rapport] = await Promise.all([listNieuwsbrieven(), listTaakPersonen(), getRapport(c.id)]);
    inhoud = (
      <FlowBouwer
        campagneId={c.id}
        beginFlow={c.flow}
        kanOpslaan={c.v2}
        status={c.status}
        triggerTekst={triggerOmschrijving(c.trigger)}
        doelTekst={doelTekst}
        opStap={c.opStap}
        perMail={c.perMail}
        splitsingen={rapport.splitsingen}
        nieuwsbrieven={nieuwsbrieven.map((n) => ({ id: n.id, naam: n.naam, isTemplate: n.is_template }))}
        personen={personen.filter((p) => p.actief).map((p) => ({ id: p.id, naam: p.naam }))}
        prospectStatussen={[...PROSPECT_STATUSSEN]}
        leadStatussen={[...LEAD_STATUSSEN]}
        mailIngesteld={isEmailConfigured}
      />
    );
  } else if (tab === 'instellingen') {
    const sb = kmsAdmin();
    const { data: bronData } = sb ? await sb.from('leads').select('bron').not('bron', 'is', null).limit(2000) : { data: [] };
    const leadBronnen = Array.from(new Set(((bronData as { bron: string | null }[]) ?? []).map((r) => (r.bron ?? '').trim()).filter(Boolean))).sort();
    inhoud = (
      <TriggerFormulier
        campagneId={c.id}
        begin={{ naam: c.naam, omschrijving: c.omschrijving ?? '', van_naam: c.van_naam ?? '', van_email: c.van_email ?? '', doelgroep: c.doelgroep, trigger: c.trigger, doel: c.doel }}
        prospectStatussen={PROSPECT_STATUSSEN.filter((s) => s !== 'afgemeld')}
        leadBronnen={leadBronnen}
        kanOpslaan={c.v2}
        geactiveerdOp={c.geactiveerd_op}
      />
    );
  } else if (tab === 'ontvangers') {
    inhoud = <OntvangersTab campagne={c} zoek={zoek} />;
  } else {
    inhoud = <RapportTab campagne={c} />;
  }

  return (
    <main className="container-app pb-16">
      <div className="dash-kop justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/campagnes" className="knop-tekst px-1.5" aria-label="Terug naar campagnes">
            ←
          </Link>
          <h1 className="dash-h1 truncate">{c.naam}</h1>
          <CampagneStatusBadge status={c.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.status === 'concept' && statusKnop('actief', 'Starten', 'knop-primair', 'Campagne starten? Bij de volgende dagelijkse run gaan de eerste stappen in.')}
          {c.status === 'actief' && statusKnop('gepauzeerd', 'Pauzeren', 'knop-stil')}
          {c.status === 'gepauzeerd' && statusKnop('actief', 'Hervatten', 'knop-primair')}
          {c.status === 'afgerond' && statusKnop('concept', 'Terug naar concept', 'knop-stil')}
          <details className="relative">
            <summary className="knop-tekst cursor-pointer list-none">Meer</summary>
            <div className="absolute right-0 z-40 mt-1 w-48 rounded-lg border border-line bg-white p-1 shadow-card">
              <form action={dupliceerCampagneActie}>
                <input type="hidden" name="campagneId" value={c.id} />
                <button type="submit" className="w-full rounded px-3 py-1.5 text-left text-[13px] hover:bg-mist">
                  Kopiëren
                </button>
              </form>
              {c.status !== 'afgerond' && (
                <form action={wijzigStatusActie}>
                  <input type="hidden" name="campagneId" value={c.id} />
                  <input type="hidden" name="status" value="afgerond" />
                  <ConfirmSubmit message="Campagne afronden? Wie er nog in zit, krijgt niets meer." className="w-full rounded px-3 py-1.5 text-left text-[13px] hover:bg-mist">
                    Afronden
                  </ConfirmSubmit>
                </form>
              )}
              <form action={verwijderCampagneActie}>
                <input type="hidden" name="campagneId" value={c.id} />
                <ConfirmSubmit message="Campagne verwijderen, met alle ontvangers en statistieken? Dit kan niet ongedaan worden gemaakt." className="w-full rounded px-3 py-1.5 text-left text-[13px] text-red-700 hover:bg-red-50">
                  Verwijderen
                </ConfirmSubmit>
              </form>
            </div>
          </details>
        </div>
      </div>

      <p className="mt-3 text-[13px] text-warm">
        {DOELGROEP_LABEL[c.doelgroep]} · {triggerOmschrijving(c.trigger)} · {c.totaal} ingeschreven, {c.perStatus.actief ?? 0} in de flow, {c.perStatus.doel ?? 0} doel bereikt
        {c.omschrijving ? <span className="block text-ink-500">{c.omschrijving}</span> : null}
      </p>
      {zoek.melding && <Melding tekst={zoek.melding} />}
      {inst.allesGepauzeerd && <Melding tekst="Alle campagnes staan op pauze (Campagnes, Pauzeer alles). Ook deze doet nu niets." />}
      {!isEmailConfigured && c.status === 'actief' && <Melding tekst="Mail staat nog niet aan. Deze campagne voert wel wachtstappen, taken en tags uit, maar mails blijven staan tot Resend is ingesteld. Er wordt niets als verzonden geteld." />}

      <nav className="mt-4 flex flex-wrap gap-1 border-b border-line" aria-label="Onderdelen van de campagne">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === 'flow' ? `/dashboard/campagnes/${c.id}` : `/dashboard/campagnes/${c.id}?tab=${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${tab === t.id ? 'border-amber-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'}`}
          >
            {t.label}
            {t.id === 'ontvangers' && c.totaal > 0 && <span className="chip-tel ml-1.5">{c.totaal}</span>}
          </Link>
        ))}
      </nav>

      {inhoud}
    </main>
  );
}
