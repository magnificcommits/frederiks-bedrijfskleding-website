import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { getProspect, PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import { werkProspectActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prospect', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const labelCls = 'block text-xs font-semibold text-warm';

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { id } = await params;
  const p = await getProspect(id);

  if (!p) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Prospect niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze prospect bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/prospects" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar prospects</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{p.bedrijfsnaam}</h1>
          <p className="mt-1 text-sm text-warm">{[p.branche, p.plaats].filter(Boolean).join(' · ') || 'Prospect'}{p.bron ? ` · bron: ${p.bron}` : ''}</p>
        </div>
        <div className="flex items-center gap-4">
          {p.website && (
            <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Website openen</a>
          )}
          <Link href="/dashboard/prospects" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar prospects</Link>
        </div>
      </div>

      <form action={werkProspectActie} className="mt-8 max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-soft">
        <input type="hidden" name="id" value={p.id} />

        <h2 className="font-display text-base font-bold text-ink-900">Bedrijf</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Bedrijfsnaam</label>
            <input name="bedrijfsnaam" required defaultValue={p.bedrijfsnaam} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Branche</label>
            <input name="branche" defaultValue={p.branche ?? ''} placeholder="Bijv. Bouw" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Plaats</label>
            <input name="plaats" defaultValue={p.plaats ?? ''} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input name="website" defaultValue={p.website ?? ''} placeholder="https://..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Grootte</label>
            <input name="grootte" defaultValue={p.grootte ?? ''} placeholder="Bijv. 10-20 medewerkers" className={inputCls} />
          </div>
        </div>

        <h2 className="mt-7 font-display text-base font-bold text-ink-900">Contact</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Eigenaar</label>
            <input name="eigenaar" defaultValue={p.eigenaar ?? ''} placeholder="Naam van de eigenaar" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Contactpersoon</label>
            <input name="contactpersoon" defaultValue={p.contactpersoon ?? ''} placeholder="Als dit iemand anders is" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input name="email" type="email" defaultValue={p.email ?? ''} placeholder="info@bedrijf.nl" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefoon</label>
            <input name="telefoon" defaultValue={p.telefoon ?? ''} className={inputCls} />
          </div>
        </div>

        <h2 className="mt-7 font-display text-base font-bold text-ink-900">Opvolging</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Status</label>
            <select name="status" defaultValue={p.status} className={inputCls}>
              {PROSPECT_STATUSSEN.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Score (0-100)</label>
            <input name="score" type="number" min="0" max="100" defaultValue={p.score} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notitie</label>
            <textarea name="notitie" rows={4} defaultValue={p.notitie ?? ''} placeholder="Aantekeningen, afspraken, opvolgdatum" className={inputCls} />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button type="submit" className="rounded-md bg-ink-900 px-5 py-2 text-sm font-semibold text-white hover:bg-ink-800">Opslaan</button>
          <Link href="/dashboard/prospects" className="text-sm font-semibold text-warm hover:text-ink-800">Annuleren</Link>
        </div>
      </form>
    </main>
  );
}
