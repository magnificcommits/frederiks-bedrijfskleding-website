import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import {
  listTaken,
  getTaak,
  listKlantKeuzes,
  listHerinneringenVandaag,
  synchroniseerAutoTaken,
  takenV2Actief,
  type Taak,
} from '@/lib/kms/taken';
import { listTaakStatussen, beginStatus, afgerondStatus } from '@/lib/kms/taakStatussen';
import { listTaakPersonen, standaardPersoon } from '@/lib/kms/taakPersonen';
import TakenWeergave, { type SortKolom, type TakenFilters, type Weergave } from './TakenWeergave';
import { IcoonTandwiel } from './onderdelen';
import { isDatum, maandagVan, plusDagen, vandaagNl } from './tijd';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Taken', robots: { index: false, follow: false } };

const SORTEERKOLOMMEN: SortKolom[] = ['datum', 'klant', 'status', 'persoon', 'bron'];
const WEERGAVEN: Weergave[] = ['lijst', 'agenda', 'archief', 'prullenbak'];
const UUID = /^[0-9a-f-]{36}$/i;

export default async function TakenPage({
  searchParams,
}: {
  searchParams: Promise<{
    weergave?: string;
    week?: string;
    status?: string;
    persoon?: string;
    soort?: string;
    bron?: string;
    wanneer?: string;
    q?: string;
    sort?: string;
    dir?: string;
    taak?: string;
    nieuw?: string;
  }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const sp = await searchParams;
  const vandaag = vandaagNl();
  const weergave: Weergave = WEERGAVEN.includes(sp.weergave as Weergave) ? (sp.weergave as Weergave) : 'lijst';
  const week = maandagVan(isDatum(sp.week) ? sp.week : vandaag);

  const [statussen, personen, klanten, v2, admin] = await Promise.all([
    listTaakStatussen(),
    listTaakPersonen(),
    listKlantKeuzes(),
    takenV2Actief(),
    getHuidigeAdmin().catch(() => null),
  ]);

  const statusNamen = statussen.map((s) => s.naam);
  const status = sp.status === '__alles' || (sp.status && statusNamen.includes(sp.status)) ? String(sp.status) : '';
  const begin: TakenFilters = {
    status,
    persoon: sp.persoon === '__niemand' || (sp.persoon && personen.some((p) => p.id === sp.persoon)) ? String(sp.persoon) : '',
    soort: sp.soort === 'taak' || sp.soort === 'afspraak' ? sp.soort : '',
    bron: ['handmatig', 'order', 'portaal', 'prospect'].includes(String(sp.bron)) ? String(sp.bron) : '',
    wanneer: ['verlopen', 'vandaag', 'week', 'zonder'].includes(String(sp.wanneer)) ? String(sp.wanneer) : '',
    q: String(sp.q ?? ''),
    sort: SORTEERKOLOMMEN.includes(sp.sort as SortKolom) ? (sp.sort as SortKolom) : 'datum',
    dir: sp.dir === 'desc' ? 'desc' : 'asc',
  };
  const inclusiefAfgerond = status === '__alles' || (statussen.find((s) => s.naam === status)?.is_afgerond ?? false);

  // Eerst orders en portaalbestellingen omzetten naar taken, dan pas de lijst ophalen.
  if (weergave === 'lijst' || weergave === 'agenda') await synchroniseerAutoTaken();

  let taken: Taak[];
  if (weergave === 'agenda') taken = await listTaken('agenda', { van: week, tot: plusDagen(week, 6) });
  else if (weergave === 'archief') taken = await listTaken('archief');
  else if (weergave === 'prullenbak') taken = await listTaken('prullenbak');
  else taken = await listTaken(inclusiefAfgerond ? 'actief' : 'open');

  const [herinneringen, openTaak] = await Promise.all([
    weergave === 'lijst' || weergave === 'agenda' ? listHerinneringenVandaag() : Promise.resolve([] as Taak[]),
    sp.taak && UUID.test(sp.taak) ? getTaak(sp.taak) : Promise.resolve(null),
  ]);

  const uitleg: Record<Weergave, string> = {
    lijst:
      'Alle lopende bestellingen, taken en afspraken op één plek. Nieuwe orders en bestellingen uit het klantportaal komen er vanzelf in. Klik op een rij om hem te openen; vink af als hij klaar is.',
    agenda: 'De week in één oogopslag: afspraken met hun tijd, taken zonder tijd bovenaan de dag.',
    archief: 'Afgeronde en gearchiveerde taken.',
    prullenbak: 'Verwijderde taken. Terugzetten kan 30 dagen lang.',
  };

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <h1 className="dash-h1">Taken en afspraken</h1>
        <Link href="/dashboard/taken/instellingen" className="knop-stil">
          <IcoonTandwiel /> Instellingen
        </Link>
      </div>
      <p className="mt-2 max-w-3xl text-[14px] text-warm">{uitleg[weergave]}</p>
      {!v2 && (
        <p className="mt-3 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-ink-800">
          De database is nog niet bijgewerkt voor de nieuwe takenmodule (migratie taken v2). De lijst werkt, maar personen,
          herinneringen, archief en prullenbak volgen zodra de update is gedraaid.
        </p>
      )}

      <div className="mt-5">
        <TakenWeergave
          key={`${weergave}-${weergave === 'agenda' ? week : ''}`}
          weergave={weergave}
          taken={taken}
          statussen={statussen}
          personen={personen}
          klanten={klanten}
          vandaag={vandaag}
          begin={begin}
          inclusiefAfgerond={inclusiefAfgerond}
          week={week}
          herinneringen={herinneringen}
          standaardPersoonId={standaardPersoon(personen, admin?.email ?? null)}
          beginStatus={beginStatus(statussen)}
          afgerondStatus={afgerondStatus(statussen)}
          v2={v2}
          openTaak={openTaak}
          startNieuw={sp.nieuw === 'taak' || sp.nieuw === 'afspraak' ? sp.nieuw : null}
        />
      </div>
    </main>
  );
}
