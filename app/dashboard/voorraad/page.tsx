import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getVoorraadOverzicht } from '@/lib/kms/voorraad';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Voorraad', robots: { index: false, follow: false } };

export default async function VoorraadPage() {
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

  const producten = await getVoorraadOverzicht();
  const onderMinimumAantal = producten.filter((p) => p.onderMinimum).length;

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Voorraad</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Voorraad per product en variant. Producten onder hun minimale voorraad zijn gemarkeerd. Pas voorraad en minimale voorraad aan op de productpagina.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${onderMinimumAantal > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
          {onderMinimumAantal === 1 ? '1 product onder minimum' : `${onderMinimumAantal} producten onder minimum`}
        </span>
        <span className="text-sm text-warm">{producten.length === 1 ? '1 product totaal' : `${producten.length} producten totaal`}</span>
      </div>

      {producten.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen producten. Voeg eerst producten en varianten toe.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {producten.map((p) => (
            <div key={p.id} className={`rounded-2xl border bg-white p-6 shadow-soft ${p.onderMinimum ? 'border-amber-300 ring-1 ring-amber-200' : 'border-line'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/dashboard/producten/${p.id}`} className="font-display text-lg font-bold text-amber-700 hover:text-amber-800">{p.naam}</Link>
                  <p className="mt-0.5 text-sm text-warm">{p.merk || 'Geen merk'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {p.onderMinimum && (
                    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Onder minimum</span>
                  )}
                  <span className="inline-block rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-warm">
                    Totaal {p.totaal}{p.min_voorraad != null ? ` / min. ${p.min_voorraad}` : ''}
                  </span>
                </div>
              </div>

              {p.varianten.length === 0 ? (
                <p className="mt-4 rounded-xl border border-line bg-mist px-4 py-3 text-sm text-warm">Geen varianten voor dit product.</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                      <tr>
                        <th className="px-4 py-3">Maat</th>
                        <th className="px-4 py-3">Kleur</th>
                        <th className="px-4 py-3">Voorraad</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.varianten.map((v) => (
                        <tr key={v.id} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-3 text-warm">{v.maat || '-'}</td>
                          <td className="px-4 py-3 text-warm">{v.kleur || '-'}</td>
                          <td className="px-4 py-3 font-semibold text-ink-900">{v.voorraad}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${v.actief ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-500'}`}>{v.actief ? 'actief' : 'inactief'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
