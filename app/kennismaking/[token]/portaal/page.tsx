import Link from 'next/link';
import type { Metadata } from 'next';
import { vereisDemo, demoPaden } from '@/lib/prospect/demo/laad';
import OverzichtDemo from '@/components/kennismaking/demo/OverzichtDemo';
import { PaginaKop, TijdChip, knopAccent } from '@/components/kennismaking/demo/ui';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function VoorbeeldOverzicht({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const demo = await vereisDemo(token);
  const { portaal } = demoPaden(demo.token);

  return (
    <div>
      <PaginaKop
        titel="Welkom terug"
        intro={`Het klantportaal van ${demo.bedrijfsnaam}. Hier bestellen jullie kleding, houden jullie budgetten bij en keuren jullie aanvragen goed.`}
      >
        <Link href={`${portaal}/webshop`} className={knopAccent}>
          Kleding bestellen
        </Link>
      </PaginaKop>

      <div className="mt-5 flex flex-wrap gap-2">
        <TijdChip>maten staan per medewerker vast. Niemand hoeft nog rond te vragen wie welke maat broek heeft.</TijdChip>
      </div>

      <OverzichtDemo />

      <section className="mt-10 rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">Zo bestel je</p>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            ['Kies voor wie', 'Kies een collega. Zijn of haar maten staan al klaar.'],
            ['Kies de kleding', `Alleen artikelen uit de lijn van ${demo.bedrijfsnaam}, met jullie logo.`],
            ['Plaats de bestelling', 'Jessi pakt hem op en je volgt de status hier.'],
          ].map(([titel, tekst], i) => (
            <li key={titel} className="flex items-start gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--demo-accent-zacht)] font-display text-sm font-extrabold text-[color:var(--demo-accent-tekst)]"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-ink-900">{titel}</p>
                <p className="mt-0.5 text-sm text-warm">{tekst}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
