import Link from 'next/link';
import { redirect } from 'next/navigation';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { getTijdlijn } from '@/lib/kms/campagnes';
import { gereageerdActie, stopOntvangerActie } from '../../actions';
import { InschrijvingBadge, datumTijd, volgendeRunTekst } from '../../../onderdelen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ontvanger', robots: { index: false, follow: false } };

const STIP: Record<string, string> = {
  verzonden: 'bg-amber-500',
  geopend: 'bg-amber-300',
  geklikt: 'bg-amber-700',
  doel: 'bg-green-600',
  taak: 'bg-green-500',
  mislukt: 'bg-red-600',
  afgemeld: 'bg-red-400',
  afmeldklik: 'bg-red-400',
  gestopt: 'bg-ink-500',
  klaar: 'bg-ink-700',
  gereageerd: 'bg-green-600',
};

const SOORT_HREF = { prospect: '/dashboard/prospects', lead: '/dashboard/leads', klant: '/dashboard/klanten' } as const;

export default async function OntvangerPagina({ params, searchParams }: { params: Promise<{ id: string; insId: string }>; searchParams: Promise<{ melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { id, insId } = await params;
  const { melding } = await searchParams;
  const t = await getTijdlijn(insId);
  if (!t || t.campagneId !== id) redirect(`/dashboard/campagnes/${id}?tab=ontvangers`);
  const terug = `/dashboard/campagnes/${id}/ontvanger/${insId}`;
  const ct = t.contact;

  return (
    <main className="container-smal pb-16">
      <div className="dash-kop justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/dashboard/campagnes/${id}?tab=ontvangers`} className="knop-tekst px-1.5" aria-label="Terug naar ontvangers">
            ←
          </Link>
          <h1 className="dash-h1 truncate">{ct?.bedrijfsnaam || ct?.naam || t.email}</h1>
          <InschrijvingBadge status={t.status} />
        </div>
        {t.status === 'actief' && (
          <div className="flex gap-2">
            <form action={gereageerdActie}>
              <input type="hidden" name="campagneId" value={id} />
              <input type="hidden" name="inschrijvingId" value={insId} />
              <input type="hidden" name="terug" value={terug} />
              <button type="submit" className="knop-stil">
                Heeft gereageerd
              </button>
            </form>
            <form action={stopOntvangerActie}>
              <input type="hidden" name="campagneId" value={id} />
              <input type="hidden" name="inschrijvingId" value={insId} />
              <input type="hidden" name="terug" value={terug} />
              <ConfirmSubmit message="Deze persoon uit de campagne halen?" className="knop-stil">
                Stoppen
              </ConfirmSubmit>
            </form>
          </div>
        )}
      </div>

      {melding && <p className="mt-3 rounded-md border border-line bg-mist px-4 py-2 text-[13px]">{melding}</p>}

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="panel p-5">
          <h2 className="text-[14px] font-bold text-ink-900">Tijdlijn in &ldquo;{t.campagneNaam}&rdquo;</h2>
          {t.regels.length === 0 ? (
            <p className="mt-3 text-[13px] text-warm">Nog niets gebeurd.</p>
          ) : (
            <ol className="relative mt-4 border-l border-line pl-5">
              {t.regels.map((r, i) => (
                <li key={i} className="mb-4 last:mb-0">
                  <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${STIP[r.soort] ?? 'bg-ink-300'}`} />
                  <p className="text-[13px] font-semibold text-ink-900">{r.titel}</p>
                  {r.detail && <p className="break-words text-[13px] text-ink-700">{r.detail}</p>}
                  <p className="text-[11px] text-ink-400">{datumTijd(r.tijd)}</p>
                </li>
              ))}
            </ol>
          )}
          {t.status === 'actief' && (
            <p className="mt-4 rounded-md bg-mist px-3 py-2 text-[13px] text-ink-700">
              Staat nu bij: <strong>{t.stapTitel}</strong>. Volgende actie: {volgendeRunTekst(t.volgendeActie)}.
            </p>
          )}
        </section>

        <aside className="panel h-fit p-4 text-[13px]">
          <h2 className="text-[14px] font-bold text-ink-900">Contact</h2>
          <dl className="mt-2 space-y-1.5">
            {ct?.naam && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-warm">Naam</dt>
                <dd>{ct.naam}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-warm">E-mail</dt>
              <dd className="break-all">{t.email || '–'}</dd>
            </div>
            {ct?.plaats && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-warm">Plaats</dt>
                <dd>{ct.plaats}</dd>
              </div>
            )}
            {ct?.branche && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-warm">Branche</dt>
                <dd>{ct.branche}</dd>
              </div>
            )}
            {ct?.status && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-warm">Status</dt>
                <dd>{ct.status}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-warm">Ingeschreven</dt>
              <dd>{datumTijd(t.ingeschreven)}</dd>
            </div>
          </dl>
          {ct && (
            <Link href={`${SOORT_HREF[ct.soort]}/${ct.id}`} className="mt-3 inline-block font-semibold text-amber-700 hover:underline">
              Open {ct.soort === 'klant' ? 'klant' : ct.soort}
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}
