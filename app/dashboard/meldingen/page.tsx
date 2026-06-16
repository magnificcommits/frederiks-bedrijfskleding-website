import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { budgetPerMedewerker } from '@/lib/kms/rapportages';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meldingen', robots: { index: false, follow: false } };

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export default async function MeldingenPage() {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);

  const [budget, inkoopR, facturenR, leadsR] = await Promise.all([
    budgetPerMedewerker(),
    sb.from('inkoopregels').select('id, status, merk, item_naam, aantal'),
    sb.from('facturen').select('id, status, vervaldatum, bedrag_incl, organisaties(naam)'),
    sb.from('leads').select('id, name, company, status, opvolgdatum'),
  ]);

  // Budget bijna op
  const budgetBijnaOp = budget.filter((m) => m.budget > 0 && m.percentage >= 80);

  // Te bestellen, gegroepeerd per merk
  const inkoop = (inkoopR.data as { id: string; status: string; merk: string | null; item_naam: string | null; aantal: number | null }[]) ?? [];
  const teBestellenRegels = inkoop.filter((r) => r.status === 'te_bestellen');
  const teBestellenMap = new Map<string, { aantalRegels: number; aantalStuks: number }>();
  for (const r of teBestellenRegels) {
    const merk = r.merk?.trim() || 'Zonder merk';
    const huidig = teBestellenMap.get(merk) ?? { aantalRegels: 0, aantalStuks: 0 };
    huidig.aantalRegels += 1;
    huidig.aantalStuks += Number(r.aantal) || 0;
    teBestellenMap.set(merk, huidig);
  }
  const teBestellen = [...teBestellenMap.entries()].sort((a, b) => a[0].localeCompare(b[0], 'nl'));

  // Facturen over vervaldatum
  const facturen = (facturenR.data as unknown as { id: string; status: string; vervaldatum: string | null; bedrag_incl: number | null; organisaties: { naam: string } | null }[]) ?? [];
  const overVervaldatum = facturen.filter(
    (f) => f.status !== 'betaald' && f.status !== 'concept' && f.vervaldatum && new Date(f.vervaldatum) < vandaag,
  );

  // Offertes opvolgen
  const leads = (leadsR.data as { id: string; name: string; company: string | null; status: string; opvolgdatum: string | null }[]) ?? [];
  const opvolgen = leads.filter(
    (l) => l.status === 'offerte' && (!l.opvolgdatum || new Date(l.opvolgdatum) <= vandaag),
  );

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Meldingen</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Signalen die nu aandacht vragen. Live berekend uit de actuele cijfers.</p>

      <section className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900">Budget bijna op <span className="text-warm">({budgetBijnaOp.length})</span></h2>
          <Link href="/dashboard/klanten" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Naar klanten</Link>
        </div>
        <p className="mt-1 text-xs text-warm">Medewerkers die 80% of meer van hun budget hebben verbruikt.</p>
        {budgetBijnaOp.length === 0 ? (
          <p className="mt-3 text-sm text-warm">Niets open.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {budgetBijnaOp.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-ink-900">{m.naam}{m.organisatie_naam ? ` · ${m.organisatie_naam}` : ''}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="whitespace-nowrap text-warm">{euro(m.verbruik)} van {euro(m.budget)}</span>
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${m.percentage >= 100 ? 'bg-amber-100 text-amber-800' : 'bg-amber-50 text-amber-700'}`}>{m.percentage}%</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900">Te bestellen <span className="text-warm">({teBestellenRegels.length})</span></h2>
          <Link href="/dashboard/inkoop" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Naar inkoop</Link>
        </div>
        <p className="mt-1 text-xs text-warm">Openstaande inkoopregels, gegroepeerd per merk.</p>
        {teBestellen.length === 0 ? (
          <p className="mt-3 text-sm text-warm">Niets open.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {teBestellen.map(([merk, info]) => (
              <li key={merk} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate font-semibold text-ink-900">{merk}</span>
                <span className="whitespace-nowrap text-warm">{info.aantalRegels} regel{info.aantalRegels === 1 ? '' : 's'} · {info.aantalStuks} stuks</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900">Facturen over vervaldatum <span className="text-warm">({overVervaldatum.length})</span></h2>
          <Link href="/dashboard/facturen" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Naar facturen</Link>
        </div>
        <p className="mt-1 text-xs text-warm">Verstuurde facturen waarvan de vervaldatum is verstreken.</p>
        {overVervaldatum.length === 0 ? (
          <p className="mt-3 text-sm text-warm">Niets open.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {overVervaldatum.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/dashboard/facturen/${f.id}`} className="min-w-0 truncate font-semibold text-amber-700 hover:text-amber-800">{f.organisaties?.naam || 'Onbekende klant'}</Link>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="whitespace-nowrap text-warm">{f.bedrag_incl != null ? euro(Number(f.bedrag_incl)) : '-'}</span>
                  <span className="whitespace-nowrap text-warm">verviel {fmt(f.vervaldatum)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900">Offertes opvolgen <span className="text-warm">({opvolgen.length})</span></h2>
          <Link href="/dashboard/leads" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Naar leads</Link>
        </div>
        <p className="mt-1 text-xs text-warm">Offertes waarvan de opvolgdatum is bereikt of ontbreekt.</p>
        {opvolgen.length === 0 ? (
          <p className="mt-3 text-sm text-warm">Niets open.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {opvolgen.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-ink-900">{l.name}{l.company ? ` · ${l.company}` : ''}</span>
                <span className="whitespace-nowrap text-warm">{l.opvolgdatum ? `opvolgen vanaf ${fmt(l.opvolgdatum)}` : 'geen opvolgdatum'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
