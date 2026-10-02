import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { listKlantenMetFuncties } from '@/lib/kms/functies';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Functies', robots: { index: false, follow: false } };

/**
 * Functies bestaan niet meer als los onderdeel: ze zijn opgegaan in afdelingen
 * bij de klant. Deze pagina legt dat uit en wijst naar de klanten waar nog
 * functies staan, zodat Jessi kan controleren of alles goed is overgekomen.
 */
export default async function FunctiesPage() {
  if (!(await dashAuthed())) redirect('/dashboard');
  const klanten = await listKlantenMetFuncties();

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Functies zijn nu afdelingen</h1>
        <Link href="/dashboard/klanten" className="knop-tekst">Naar klanten</Link>
      </div>

      <section className="mt-6 max-w-3xl panel p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Wat is er veranderd</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-800">
          <li>
            Groepen werknemers met dezelfde kleding (bijv. Lassers, Logistiek) heten nu <strong>afdelingen</strong>. Je
            vindt ze bij de klant zelf, op het tabblad <strong>Afdelingen</strong>.
          </li>
          <li>
            Welke kleding een afdeling krijgt, kies je bij de klant op het tabblad <strong>Assortiment</strong>: bij elk
            artikel geef je aan of het voor de hele klant is of alleen voor bepaalde afdelingen.
          </li>
          <li>
            Werknemers koppel je aan een afdeling op het tabblad <strong>Werknemers</strong>. In het portaal zien ze dan
            de kleding van de hele klant plus die van hun eigen afdeling.
          </li>
          <li>
            Bestaande functies zijn omgezet: per functie is er een afdeling met dezelfde naam gemaakt, met het
            kledingpakket als assortiment, en de werknemers met die functie zitten in die afdeling.
          </li>
        </ul>
      </section>

      <section className="mt-8 max-w-3xl">
        <h2 className="font-display text-lg font-bold text-ink-900">Klanten met functies van vroeger</h2>
        {klanten.length === 0 ? (
          <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-[14px] text-warm">
            Er staan geen functies meer in het systeem. Er is niets meer te doen.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[14px] text-warm">
              Controleer bij deze klanten of de afdelingen kloppen. Staat er bij een functie nog geen afdeling, maak die
              dan aan op het tabblad Afdelingen.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {klanten.map((k) => (
                <li key={k.organisatie_id} className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-[15px] font-semibold text-ink-900">{k.klant_naam}</p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {k.functies.map((f) => (
                        <span key={f.id} className={f.afdeling_bestaat ? 'badge-klaar' : 'badge-actie'}>
                          {f.naam}
                          {f.afdeling_bestaat ? ' (afdeling bestaat)' : ' (nog geen afdeling)'}
                        </span>
                      ))}
                    </p>
                  </div>
                  <Link href={`/dashboard/klanten/${k.organisatie_id}?tab=afdelingen`} className="knop-stil">
                    Afdelingen van deze klant
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
