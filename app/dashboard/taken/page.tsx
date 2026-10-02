import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { listTaken, listTaakPersonen, synchroniseerAutoTaken, TAAK_WERKSTATUSSEN } from '@/lib/kms/taken';
import { listOrganisaties } from '@/lib/portaalAdmin';
import TakenTabel, { type SortKolom, type TakenFilters } from './TakenTabel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Taken', robots: { index: false, follow: false } };

const SORTEERKOLOMMEN: SortKolom[] = ['datum', 'klant', 'status', 'persoon', 'bron'];

/** Vandaag als yyyy-mm-dd in Nederlandse tijd (de server draait in UTC). */
function vandaagNl(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function TakenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; persoon?: string; soort?: string; bron?: string; q?: string; sort?: string; dir?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');

  const sp = await searchParams;
  const werkstatussen = TAAK_WERKSTATUSSEN as readonly string[];
  const status =
    sp.status === '__alles' || (sp.status && werkstatussen.includes(sp.status)) ? String(sp.status) : '';
  const begin: TakenFilters = {
    status,
    persoon: String(sp.persoon ?? ''),
    soort: sp.soort === 'taak' || sp.soort === 'afspraak' ? sp.soort : '',
    bron: ['handmatig', 'order', 'portaal', 'prospect'].includes(String(sp.bron)) ? String(sp.bron) : '',
    q: String(sp.q ?? ''),
    sort: SORTEERKOLOMMEN.includes(sp.sort as SortKolom) ? (sp.sort as SortKolom) : 'datum',
    dir: sp.dir === 'desc' ? 'desc' : 'asc',
  };
  const inclusiefAfgerond = status === '__alles' || status === 'Afgerond';

  // Eerst orders en portaalbestellingen omzetten naar taken, dan pas de lijst ophalen.
  await synchroniseerAutoTaken();
  const [taken, organisaties, personen] = await Promise.all([
    listTaken(inclusiefAfgerond ? 'alle' : 'open'),
    listOrganisaties(),
    listTaakPersonen(),
  ]);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <h1 className="dash-h1">Taken</h1>
      </div>
      <p className="mt-2 max-w-3xl text-[14px] text-warm">
        Alle lopende bestellingen en afspraken op één plek. Nieuwe orders en bestellingen uit het klantportaal
        komen er vanzelf in. Klik in een vakje om het te wijzigen; het wordt meteen bewaard. Vink een rij af als
        hij klaar is.
      </p>

      <div className="mt-6">
        <TakenTabel
          taken={taken}
          organisaties={organisaties.map((o) => ({ id: o.id, naam: o.naam }))}
          personen={personen}
          werkstatussen={werkstatussen}
          inclusiefAfgerond={inclusiefAfgerond}
          vandaag={vandaagNl()}
          begin={begin}
        />
      </div>
    </main>
  );
}
