import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { listOrganisaties } from '@/lib/portaalAdmin';
import { nieuweOrganisatie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klanten', robots: { index: false, follow: false } };
const DASH_COOKIE = 'fb_dash';

async function authed() {
  return Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
}

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export default async function KlantenPage() {
  if (!(await authed())) redirect('/dashboard');

  if (!isLeadsDbConfigured) {
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

  const orgs = await listOrganisaties();

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Klanten</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Per klant zet je hier de kledinglijn op en handel je herbestellingen af.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {orgs.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen klanten. Voeg er rechts een toe.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                  <tr>
                    <th className="px-4 py-3">Naam</th>
                    <th className="px-4 py-3">Plaats</th>
                    <th className="px-4 py-3">Aangemaakt</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((o) => (
                    <tr key={o.id} className="border-b border-line">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/klanten/${o.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{o.naam}</Link>
                      </td>
                      <td className="px-4 py-3 text-warm">{o.plaats || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-warm">{fmt(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe klant</h2>
          <form action={nieuweOrganisatie} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-warm">Naam</label>
              <input name="naam" required placeholder="Bedrijfsnaam" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Plaats</label>
              <input name="plaats" placeholder="Plaats" className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Toevoegen</button>
          </form>
        </div>
      </div>
    </main>
  );
}
