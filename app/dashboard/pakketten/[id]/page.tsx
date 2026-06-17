import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getPakket, listPakketProducten, listProducten } from '@/lib/kms/pakketten';
import { werkPakket, voegProductToe, verwijderProductActie } from './actions';
import ConfirmSubmit from '@/components/ConfirmSubmit';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pakket', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default async function PakketPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/pakketten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar pakketten</Link>
        </div>
      </main>
    );
  }

  const pakket = await getPakket(id);
  if (!pakket) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Pakket niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Dit pakket bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/pakketten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar pakketten</Link>
        </div>
      </main>
    );
  }

  const [regels, producten] = await Promise.all([listPakketProducten(id), listProducten()]);
  const terug = '/dashboard/pakketten?org=' + encodeURIComponent(pakket.organisatie_id);

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{pakket.naam}</h1>
          <p className="mt-1 text-sm text-warm">{pakket.soort === 'start' ? 'Startpakket' : 'Regulier pakket'}</p>
        </div>
        <Link href={terug} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar pakketten</Link>
      </div>

      {pakket.soort === 'start' && (
        <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-3 text-sm text-warm">Dit is een startpakket. Een medewerker moet dit eerst bestellen voordat losse artikelen nabesteld kunnen worden.</p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink-900">Gegevens</h2>
        <form action={werkPakket} className="mt-4 grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-2">
          <input type="hidden" name="pakketId" value={id} />
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Naam</label>
            <input name="naam" required defaultValue={pakket.naam} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Soort</label>
            <select name="soort" defaultValue={pakket.soort} className={inputCls}>
              <option value="regulier">Regulier pakket</option>
              <option value="start">Startpakket</option>
            </select>
            <p className="mt-1 text-xs text-warm">Een startpakket moet eerst besteld worden voordat losse artikelen kunnen.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Pakketprijs</label>
            <input name="pakketprijs" inputMode="decimal" defaultValue={pakket.pakketprijs != null ? String(pakket.pakketprijs) : ''} placeholder="bedrag" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" name="buiten_budget" value="true" defaultChecked={pakket.buiten_budget} className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" />
            Buiten budget
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" name="actief" value="true" defaultChecked={pakket.actief} className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" />
            Actief
          </label>
          <div className="sm:col-span-2 flex items-end">
            <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Gegevens opslaan</button>
          </div>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Producten in het pakket</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {regels.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen producten in dit pakket. Voeg er rechts een toe.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Variant</th>
                      <th className="px-4 py-3">Aantal</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {regels.map((r) => (
                      <tr key={r.id} className="border-b border-line">
                        <td className="px-4 py-3 font-semibold text-ink-900">{r.product_naam}{r.product_merk ? <span className="font-normal text-warm"> ({r.product_merk})</span> : null}</td>
                        <td className="px-4 py-3 text-warm">{r.variant_label || 'alle varianten'}</td>
                        <td className="px-4 py-3 text-warm">{r.aantal}</td>
                        <td className="px-4 py-3 text-right">
                          <form action={verwijderProductActie}>
                            <input type="hidden" name="pakketId" value={id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <ConfirmSubmit message="Dit product uit het pakket verwijderen?" className="text-xs font-semibold text-red-700 hover:text-red-800">Verwijderen</ConfirmSubmit>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h3 className="font-display text-base font-bold text-ink-900">Product toevoegen</h3>
            <form action={voegProductToe} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="pakketId" value={id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Product</label>
                <select name="productId" required className={inputCls}>
                  <option value="">Kies een product</option>
                  {producten.map((p) => (
                    <option key={p.id} value={p.id}>{p.merk ? `${p.naam} (${p.merk})` : p.naam}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Aantal</label>
                <input name="aantal" inputMode="numeric" defaultValue="1" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Toevoegen</button>
            </form>
            <p className="mt-3 text-xs text-warm">Een toegevoegd product geldt voor alle varianten. De medewerker kiest bij het bestellen zelf maat en kleur.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
