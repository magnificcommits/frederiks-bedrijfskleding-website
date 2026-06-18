import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getVoorraadOverzicht } from '@/lib/kms/voorraad';
import VoorraadLijst from './VoorraadLijst';

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

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Voorraad</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Voorraad per product en variant, gegroepeerd per merk. Producten onder hun minimale voorraad zijn gemarkeerd. Pas voorraad en minimale voorraad aan op de productpagina.</p>

      {producten.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen producten. Voeg eerst producten en varianten toe.</p>
      ) : (
        <VoorraadLijst producten={producten} />
      )}
    </main>
  );
}
