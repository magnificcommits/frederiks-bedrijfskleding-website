import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getPortaalUser } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getAssortiment, getMijnMedewerker, getVoorkeursmaten } from '@/lib/portaal/webshop';
import { listMijnMaatwijzigingen } from '@/lib/portaal/maatwijziging';
import { sorteerMaten } from '@/lib/kms/variantenStandaard';
import { getVertaler } from '@/lib/i18n/portaal/server';
import PortaalNav from '../PortaalNav';
import { vraagMaatwijzigingActie } from './actions';

export const metadata: Metadata = { title: 'Maatwijziging aanvragen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const FOUT: Record<string, string> = {
  geen: 'Je account is niet gekoppeld aan een werknemer. Vraag Frederiks Bedrijfskleding om dit te regelen.',
  maat: 'Kies een artikel en een maat uit de lijst.',
  zelfde: 'Dat is al je huidige maat.',
  opslaan: 'Versturen is niet gelukt. Probeer het opnieuw.',
};
const STATUS: Record<string, { tekst: string; klasse: string }> = {
  wacht: { tekst: 'Wordt beoordeeld', klasse: 'border-amber-300 bg-amber-50 text-amber-800' },
  goedgekeurd: { tekst: 'Aangepast', klasse: 'border-green-300 bg-green-50 text-green-800' },
  afgewezen: { tekst: 'Niet aangepast', klasse: 'border-line bg-mist text-warm' },
};

export default async function Maatwijziging({ searchParams }: { searchParams: Promise<{ ok?: string; fout?: string; product?: string }> }) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const [toegang, ik, { t, datum }] = await Promise.all([getMijnToegang(), getMijnMedewerker(), getVertaler()]);
  const sp = await searchParams;

  const [assortiment, voorkeur, verzoeken] = ik
    ? await Promise.all([getAssortiment(ik), getVoorkeursmaten(ik.id), listMijnMaatwijzigingen(ik.id)])
    : [[], {}, []];
  const naamVan = new Map(assortiment.map((p) => [p.id, p.naam]));
  const artikelen = assortiment
    .map((p) => ({
      id: p.id,
      naam: p.naam,
      huidig: (voorkeur as Record<string, { voorkeursmaat: string | null }>)[p.id]?.voorkeursmaat ?? null,
      maten: sorteerMaten([...new Set(p.varianten.map((v) => (v.maat ?? '').trim()).filter(Boolean))]),
    }))
    .filter((a) => a.maten.length > 0);

  return (
    <main className="container-x py-12">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
      <h1 className="font-display text-3xl font-extrabold text-ink-900">Maatwijziging aanvragen</h1>
      <PortaalNav rol={toegang.rol} actief="/portaal/maatwijziging" />

      <p className="mt-6 max-w-2xl text-[15px] text-warm">
        Past een maat niet meer? Vraag hier een andere maat aan. Frederiks Bedrijfskleding bekijkt je verzoek en past je
        geregistreerde maat daarna aan. Je krijgt bericht zodra het geregeld is.
      </p>

      {sp.ok && <p className="mt-6 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">Je verzoek is verstuurd. We laten het je weten zodra je maat is aangepast.</p>}
      {sp.fout && FOUT[sp.fout] && <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-ink-800" role="alert">{FOUT[sp.fout]}</p>}

      {!ik ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-4 py-3 text-sm text-warm">{FOUT.geen}</p>
      ) : artikelen.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-mist px-4 py-3 text-sm text-warm">Er staan nog geen artikelen met maten in je assortiment.</p>
      ) : (
        <form action={vraagMaatwijzigingActie} className="mt-6 max-w-xl rounded-2xl border border-line bg-white p-5 shadow-soft">
          <label className="block text-sm font-semibold text-ink-900" htmlFor="mw-product">Artikel</label>
          <select id="mw-product" name="product_id" required defaultValue={sp.product ?? ''} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm">
            <option value="">Kies een artikel</option>
            {artikelen.map((a) => (
              <option key={a.id} value={a.id}>{a.naam}{a.huidig ? ` (nu maat ${a.huidig})` : ''}</option>
            ))}
          </select>
          <label className="mt-4 block text-sm font-semibold text-ink-900" htmlFor="mw-maat">Gewenste maat</label>
          <select id="mw-maat" name="gewenste_maat" required className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm">
            <option value="">Kies een maat</option>
            {sorteerMaten([...new Set(artikelen.flatMap((a) => a.maten))]).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <p className="mt-1 text-xs text-warm">Kies een maat die bij het artikel bestaat. Twijfel je? Zet het in de toelichting.</p>
          <label className="mt-4 block text-sm font-semibold text-ink-900" htmlFor="mw-toelichting">Toelichting (optioneel)</label>
          <textarea id="mw-toelichting" name="toelichting" rows={3} maxLength={500} placeholder="Bijv. de broek zit te strak in de taille" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
          <button type="submit" className="btn-primary mt-4">Verzoek versturen</button>
        </form>
      )}

      {verzoeken.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="font-display text-xl font-extrabold text-ink-900">Mijn verzoeken</h2>
          <ul className="mt-4 space-y-2">
            {verzoeken.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold text-ink-900">{naamVan.get(v.product_id) ?? 'Artikel'}</span>
                  <span className="text-warm"> · {v.huidige_maat ?? '?'} naar {v.gewenste_maat} · {datum(v.created_at)}</span>
                  {v.notitie && <span className="block text-xs text-warm">{v.notitie}</span>}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS[v.status]?.klasse ?? ''}`}>{STATUS[v.status]?.tekst ?? v.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-sm"><Link href="/portaal/webshop" className="font-semibold text-amber-700 hover:text-amber-800">Terug naar kleding bestellen</Link></p>
    </main>
  );
}
