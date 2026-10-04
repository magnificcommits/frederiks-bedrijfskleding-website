import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getVoorraadOverzicht, maatSleutel, type VoorraadRij } from '@/lib/kms/voorraad';
import EmptyState from '@/components/dashboard/EmptyState';
import { verwerkTellingActie } from '../actions';
import TellingVoet from './TellingVoet';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Telling', robots: { index: false, follow: false } };

const MAX_REGELS = 800;

type Zoek = { merk?: string; locatie?: string; alle?: string; melding?: string; geteld?: string; gewijzigd?: string; mislukt?: string };

function url(p: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/dashboard/voorraad/telling?${s}` : '/dashboard/voorraad/telling';
}

export default async function TellingPage({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sp = await searchParams;
  if (!kmsAdmin()) redirect('/dashboard/voorraad');

  const data = await getVoorraadOverzicht();
  const alle = sp.alle === '1';
  const kandidaten = data.rijen.filter((r) => alle || r.bijhouden);

  // Keuzescherm: per merk en per locatie hoeveel er te tellen is.
  const perMerk = new Map<string, number>();
  const perLocatie = new Map<string, number>();
  for (const r of data.rijen.filter((x) => x.bijhouden)) {
    const m = r.merk || 'Geen merk';
    perMerk.set(m, (perMerk.get(m) ?? 0) + 1);
    if (r.locatie) perLocatie.set(r.locatie, (perLocatie.get(r.locatie) ?? 0) + 1);
  }

  const gekozen = Boolean(sp.merk || sp.locatie);
  let regels: VoorraadRij[] = [];
  if (gekozen) {
    regels = kandidaten
      .filter((r) => (!sp.merk || (r.merk || 'Geen merk') === sp.merk) && (!sp.locatie || r.locatie === sp.locatie))
      .sort(
        (a, b) =>
          a.product_naam.localeCompare(b.product_naam, 'nl') ||
          (a.kleur ?? '').localeCompare(b.kleur ?? '', 'nl') ||
          maatSleutel(a.maat).localeCompare(maatSleutel(b.maat)),
      );
  }
  const teVeel = regels.length > MAX_REGELS;
  const getoond = regels.slice(0, MAX_REGELS);

  // Groeperen per product, en binnen een product per kleur: zo staat het ook in de schappen.
  const producten: { id: string; naam: string; foto: string | null; kleuren: { kleur: string; regels: VoorraadRij[] }[] }[] = [];
  for (const r of getoond) {
    let p = producten[producten.length - 1];
    if (!p || p.id !== r.product_id) {
      p = { id: r.product_id, naam: r.product_naam, foto: r.foto, kleuren: [] };
      producten.push(p);
    }
    const kleur = r.kleur || 'Zonder kleur';
    let k = p.kleuren[p.kleuren.length - 1];
    if (!k || k.kleur !== kleur) {
      k = { kleur, regels: [] };
      p.kleuren.push(k);
    }
    k.regels.push(r);
  }

  const huidig = url({ merk: sp.merk, locatie: sp.locatie, alle: sp.alle });
  const geteld = Number(sp.geteld) || 0;
  const gewijzigd = Number(sp.gewijzigd) || 0;
  const mislukt = Number(sp.mislukt) || 0;

  return (
    <main className="container-app pb-0">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="dash-h1">Telling</h1>
          {gekozen && <span className="text-[14px] font-semibold text-warm">{sp.merk ?? sp.locatie}</span>}
        </div>
        <div className="flex items-center gap-2">
          {gekozen && <Link href="/dashboard/voorraad/telling" className="knop-stil">Ander merk of locatie</Link>}
          <Link href="/dashboard/voorraad" className="knop-tekst">Naar voorraad</Link>
        </div>
      </div>

      {sp.melding === 'geteld' && (
        <p className={`mt-4 rounded-md border px-4 py-3 text-[14px] font-semibold ${mislukt ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {geteld} {geteld === 1 ? 'regel' : 'regels'} geteld, {gewijzigd === 0 ? 'alles klopte' : `${gewijzigd} ${gewijzigd === 1 ? 'aantal' : 'aantallen'} aangepast`}.
          {mislukt > 0 && ` ${mislukt} konden niet worden opgeslagen, tel die nog een keer.`}
        </p>
      )}
      {sp.melding === 'leeg' && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-700">
          Er was niets ingevuld, dus er is niets opgeslagen.
        </p>
      )}

      {!gekozen ? (
        <div className="mt-5 max-w-4xl">
          <p className="dash-sub">
            Kies wat je gaat tellen. Je krijgt een lijst per product en kleur met een groot invulveld per maat, goed te doen op een tablet
            met de doos voor je neus. Laat leeg wat je niet telt; dat blijft zoals het was.
          </p>
          {perMerk.size === 0 ? (
            <div className="mt-5">
              <EmptyState
                titel="Nog niets om te tellen"
                tekst="Er staan nog geen voorraadartikelen. Maak eerst in de voorraadlijst de artikelen aan die je op de plank hebt."
                actieHref="/dashboard/voorraad?bijhouden=alle"
                actieLabel="Naar alle artikelen"
              />
            </div>
          ) : (
            <>
              <h2 className="mt-6 font-display text-base font-bold text-ink-900">Per merk</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {[...perMerk.entries()].sort((a, b) => a[0].localeCompare(b[0], 'nl')).map(([m, n]) => (
                  <Link key={m} href={url({ merk: m })} className="panel flex items-center justify-between px-4 py-4 text-[15px] font-semibold text-ink-900 hover:border-ink-300">
                    {m}
                    <span className="chip-tel">{n}</span>
                  </Link>
                ))}
              </div>
              {perLocatie.size > 0 && (
                <>
                  <h2 className="mt-6 font-display text-base font-bold text-ink-900">Per locatie</h2>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {[...perLocatie.entries()].sort((a, b) => a[0].localeCompare(b[0], 'nl')).map(([l, n]) => (
                      <Link key={l} href={url({ locatie: l })} className="panel flex items-center justify-between px-4 py-4 text-[15px] font-semibold text-ink-900 hover:border-ink-300">
                        {l}
                        <span className="chip-tel">{n}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <form action={verwerkTellingActie} className="mt-4">
          <input type="hidden" name="terug" value={huidig} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="dash-sub">
              Systeemaantal staat grijs. Vul in wat je telt; groen klopt, oranje wijkt af. Opgeslagen als reden &quot;telling&quot;.
            </p>
            <Link href={url({ merk: sp.merk, locatie: sp.locatie, alle: alle ? undefined : '1' })} className="knop-tekst text-[12px]">
              {alle ? 'Alleen voorraadartikelen' : 'Ook artikelen die op order gaan'}
            </Link>
          </div>
          {teVeel && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              Dit zijn {regels.length} regels; de eerste {MAX_REGELS} staan hier. Tel in delen of kies een locatie.
            </p>
          )}
          {producten.length === 0 ? (
            <div className="mt-4">
              <EmptyState tekst="Hier staat niets om te tellen." actieHref="/dashboard/voorraad/telling" actieLabel="Terug naar de keuze" />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {producten.map((p) => (
                <section key={p.id} className="panel overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-line bg-mist px-4 py-2.5">
                    {p.foto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.foto} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded border border-line bg-white object-contain" />
                    )}
                    <h2 className="font-display text-[15px] font-bold text-ink-900">{p.naam}</h2>
                  </div>
                  {p.kleuren.map((k) => (
                    <div key={k.kleur} className="border-b border-line px-4 py-3 last:border-b-0">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-warm">{k.kleur}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                        {k.regels.map((r) => (
                          <label key={r.variant_id} className="flex flex-col rounded-md border border-line bg-white p-2">
                            <span className="flex items-baseline justify-between">
                              <span className="text-[15px] font-bold text-ink-900">{r.maat || '-'}</span>
                              <span className="text-[11px] tabular-nums text-ink-400" title="Systeemaantal">{r.voorraad}</span>
                            </span>
                            <input
                              name={`t_${r.variant_id}`}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete="off"
                              data-systeem={r.voorraad}
                              aria-label={`${p.naam} ${k.kleur} maat ${r.maat ?? ''}, systeem ${r.voorraad}`}
                              className="mt-1 h-11 w-full rounded border-2 border-line text-center text-lg font-semibold tabular-nums text-ink-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 data-[staat=anders]:border-amber-500 data-[staat=anders]:bg-amber-50 data-[staat=gelijk]:border-green-500 data-[staat=gelijk]:bg-green-50"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
          {producten.length > 0 && <TellingVoet totaal={getoond.length} />}
        </form>
      )}
    </main>
  );
}
