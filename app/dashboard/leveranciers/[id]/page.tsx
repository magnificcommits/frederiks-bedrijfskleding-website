import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { CONTACT_ROLLEN, getLeverancierDetail, type Contact } from '@/lib/kms/leveranciers';
import { portaalLink, INKOOPORDER_LABEL, INKOOPORDER_BADGE } from '@/lib/kms/inkoop';
import Logo from '../Logo';
import LeverancierVelden from '../LeverancierVelden';
import InkoopGrafiek from './InkoopGrafiek';
import {
  bewaarNotities,
  bewerkContactActie,
  bewerkLeverancier,
  verwijderContactActie,
  verwijderDocumentActie,
  voegContactActie,
  voegDocumentActie,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leverancier', robots: { index: false, follow: false } };

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const euro0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const datum = (d: string | null) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '-');
const telLink = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;

const MELDINGEN: Record<string, string> = {
  mislukt: 'Dat is niet gelukt. Probeer het nog een keer.',
  migratie: 'Dit onderdeel werkt pas als de databasemigratie van 4 oktober gedraaid is.',
  deels: 'De basisgegevens zijn opgeslagen. Website, klantnummer, franco, logo en notities kunnen pas na de databasemigratie.',
  link: 'Vul een naam en een geldige link in (beginnend met https:// of www.).',
};

function ContactVelden({ c }: { c?: Contact }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="veld-label" htmlFor={`c-naam-${c?.id ?? 'nieuw'}`}>Naam</label>
        <input id={`c-naam-${c?.id ?? 'nieuw'}`} name="naam" required defaultValue={c?.naam ?? ''} className="veld" />
      </div>
      <div>
        <label className="veld-label" htmlFor={`c-rol-${c?.id ?? 'nieuw'}`}>Rol</label>
        <select id={`c-rol-${c?.id ?? 'nieuw'}`} name="rol" defaultValue={c?.rol ?? 'binnendienst'} className="veld">
          {CONTACT_ROLLEN.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="veld-label" htmlFor={`c-mail-${c?.id ?? 'nieuw'}`}>E-mail</label>
        <input id={`c-mail-${c?.id ?? 'nieuw'}`} name="email" type="email" defaultValue={c?.email ?? ''} className="veld" />
      </div>
      <div>
        <label className="veld-label" htmlFor={`c-tel-${c?.id ?? 'nieuw'}`}>Telefoon</label>
        <input id={`c-tel-${c?.id ?? 'nieuw'}`} name="telefoon" defaultValue={c?.telefoon ?? ''} className="veld" />
      </div>
      <div className="sm:col-span-2">
        <label className="veld-label" htmlFor={`c-not-${c?.id ?? 'nieuw'}`}>Notitie</label>
        <input id={`c-not-${c?.id ?? 'nieuw'}`} name="notitie" defaultValue={c?.notitie ?? ''} placeholder="Bijv. bereikbaar ma t/m do tot 16:00" className="veld" />
      </div>
    </div>
  );
}

function Blok({ titel, actie, children }: { titel: string; actie?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="font-display text-[14px] font-bold text-ink-900">{titel}</h2>
        {actie}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function Regel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 py-1.5 text-[13px]">
      <dt className="text-warm">{label}</dt>
      <dd className="min-w-0 break-words text-ink-900">{children}</dd>
    </div>
  );
}

export default async function LeverancierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ melding?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  if (!kmsAdmin()) redirect('/dashboard/leveranciers');
  const { id } = await params;
  const { melding } = await searchParams;
  const d = await getLeverancierDetail(id);
  if (!d) notFound();

  const l = d.leverancier;
  const portaal = portaalLink(l.bestelportaal_url);
  const b = d.betrouwbaarheid;
  const pctOpTijd = b.gemeten ? Math.round((b.opTijd / b.gemeten) * 100) : null;
  const merkFilter = (l.merken ?? [])[0] ?? l.naam;

  return (
    <main className="container-app pb-12">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/leveranciers" className="knop-tekst !px-1" aria-label="Terug naar leveranciers">&larr;</Link>
          <Logo naam={l.naam} logo={d.logo} grootte="h-9 w-16" />
          <div className="min-w-0">
            <h1 className="dash-h1 truncate">{l.naam}</h1>
            {l.inkoop_bij && <p className="truncate text-[12px] text-warm">Inkoop bij {l.inkoop_bij}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {portaal && (
            <a href={portaal} target="_blank" rel="noopener noreferrer" className="knop-primair">Bestelportaal openen</a>
          )}
          <Drawer knop="Bewerken" knopKlasse="knop-stil" titel={`${l.naam} bewerken`} soort="lade">
            <form action={bewerkLeverancier} className="flex flex-col gap-5">
              <input type="hidden" name="id" value={l.id} />
              <LeverancierVelden l={l} nieuwKlaar={d.velden.nieuw} />
              <button type="submit" className="self-start knop-donker">Opslaan</button>
            </form>
          </Drawer>
        </div>
      </div>

      {melding && MELDINGEN[melding] && (
        <p className={`mt-3 rounded-md border px-3 py-2 text-[13px] font-semibold ${melding === 'deels' || melding === 'migratie' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {MELDINGEN[melding]}
        </p>
      )}

      <section aria-label="Kerncijfers" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTegel label={`Ingekocht ${new Date().getFullYear()}`} waarde={euro0.format(d.inkoopJaar)} href="#inkoop-kop" sub={<span className="text-warm">tegen inkoopprijs</span>} />
        <KpiTegel
          label="Openstaand"
          waarde={String(d.open.length)}
          href="#open"
          sub={<span className={d.open.some((o) => o.teLaat) ? 'font-semibold text-red-700' : 'text-warm'}>{euro0.format(d.openWaarde)} nog te ontvangen{d.open.some((o) => o.teLaat) ? ' · iets is te laat' : ''}</span>}
        />
        <KpiTegel
          label="Op tijd geleverd"
          waarde={pctOpTijd === null ? '-' : `${pctOpTijd}%`}
          href="#open"
          sub={
            <span className="text-warm">
              {b.gemeten === 0
                ? 'Meet zodra inkooporders met verwachte datum binnenkomen'
                : `${b.opTijd} van ${b.gemeten} op tijd${b.gemDagenTeLaat ? ` · te laat gem. ${b.gemDagenTeLaat} d` : ''}`}
            </span>
          }
        />
        <KpiTegel
          label="Levertijd"
          waarde={b.gemLevertijd != null ? `${b.gemLevertijd} dagen` : l.levertijd_dagen != null ? `${l.levertijd_dagen} dagen` : '-'}
          href="#afspraken"
          sub={<span className="text-warm">{b.gemLevertijd != null ? `gemeten · afgesproken ${l.levertijd_dagen ?? '-'} d` : 'afgesproken, nog niet gemeten'}</span>}
        />
        <KpiTegel label="Producten" waarde={String(d.aantalProducten)} href="#producten" sub={<span className="text-warm">{(l.merken ?? []).join(', ') || 'geen merk ingevuld'}</span>} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <InkoopGrafiek maanden={d.maanden} />

          <section id="open" className="panel scroll-mt-20">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <h2 className="font-display text-[14px] font-bold text-ink-900">Openstaande bestellingen</h2>
              <Link href={`/dashboard/inkoop?tab=orders${l.inkoop_bij ? `&partij=${encodeURIComponent(l.inkoop_bij)}` : ''}`} className="knop-tekst text-[12px]">Alle inkooporders</Link>
            </div>
            {d.open.length === 0 ? (
              <div className="p-4">
                <LegeStaat titel="Niets onderweg" tekst="Er staat bij deze leverancier niets open. Nieuwe bestellingen maak je vanuit Inkoop." actieHref="/dashboard/inkoop" actieLabel="Naar inkoop" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Bestelling</th>
                      <th>Status</th>
                      <th>Besteld</th>
                      <th>Verwacht</th>
                      <th className="text-right">Ontvangen</th>
                      <th className="text-right">Nog te ontvangen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.open.map((o) => (
                      <tr key={o.id}>
                        <td>
                          {o.soort === 'inkooporder' ? (
                            <Link href={`/dashboard/inkoop/${o.id}`} className="rij-link">{o.titel}</Link>
                          ) : (
                            <span className="stil">{o.titel}</span>
                          )}
                        </td>
                        <td><span className={INKOOPORDER_BADGE[o.status] ?? 'badge-rust'}>{INKOOPORDER_LABEL[o.status] ?? o.status}</span></td>
                        <td className="stil">{datum(o.besteld_op)}</td>
                        <td className={o.teLaat ? 'font-semibold text-red-700' : 'stil'}>
                          {datum(o.verwacht_op)}{o.teLaat ? ' (te laat)' : ''}
                        </td>
                        <td className="num">{o.ontvangen} / {o.stuks}</td>
                        <td className="num">{euro.format(o.waarde)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section id="producten" className="panel scroll-mt-20">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <h2 className="font-display text-[14px] font-bold text-ink-900">Producten <span className="chip-tel">{d.aantalProducten}</span></h2>
              <Link href={`/dashboard/producten?merk=${encodeURIComponent(merkFilter)}`} className="knop-tekst text-[12px]">In productenlijst</Link>
            </div>
            {d.producten.length === 0 ? (
              <div className="p-4">
                <LegeStaat titel="Nog geen producten" tekst="Er zijn geen producten gekoppeld aan deze leverancier of aan zijn merken." />
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-4">
                {d.producten.slice(0, 48).map((p) => (
                  <li key={p.id} className="bg-white">
                    <Link href={`/dashboard/producten/${p.id}`} className={`flex h-full items-center gap-2.5 px-3 py-2 hover:bg-mist ${p.actief ? '' : 'opacity-60'}`}>
                      {p.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.foto} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded border border-line bg-white object-contain" />
                      ) : (
                        <span className="h-10 w-10 shrink-0 rounded border border-dashed border-line bg-mist" aria-hidden />
                      )}
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-ink-900">{p.naam}</span>
                        <span className="block truncate text-[11px] text-warm">{p.categorie ?? ''}{p.actief ? '' : ' · inactief'}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {d.producten.length > 48 && (
              <p className="border-t border-line px-4 py-2 text-[12px] text-warm">
                En nog {d.producten.length - 48}.{' '}
                <Link href={`/dashboard/producten?merk=${encodeURIComponent(merkFilter)}`} className="font-semibold text-ink-900 hover:text-amber-700">Bekijk ze in de productenlijst</Link>
              </p>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <div id="afspraken" className="scroll-mt-20">
            <Blok titel="Bestellen en afspraken">
              <dl className="divide-y divide-line">
                <Regel label="Bestelwijze">{l.bestelwijze ?? (portaal ? 'Via het bestelportaal' : 'Niet ingevuld')}</Regel>
                <Regel label="Portaal">
                  {portaal ? <a href={portaal} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-2 hover:text-amber-700 hover:underline">{portaal.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a> : '-'}
                </Regel>
                <Regel label="Bestelmail">{l.email ? <a href={`mailto:${l.email}`} className="font-semibold hover:text-amber-700">{l.email}</a> : '-'}</Regel>
                <Regel label="Korting">{l.kortingspercentage != null ? `${String(l.kortingspercentage).replace('.', ',')}%` : '-'}</Regel>
                <Regel label="Betaling">{l.betaalcondities ?? '-'}</Regel>
                <Regel label="Levertijd">{l.levertijd_dagen != null ? `${l.levertijd_dagen} dagen` : '-'}</Regel>
                {d.velden.nieuw && <Regel label="Franco vanaf">{l.franco_bedrag != null ? euro0.format(Number(l.franco_bedrag)) : '-'}</Regel>}
                {d.velden.nieuw && <Regel label="Klantnummer">{l.klantnummer ?? '-'}</Regel>}
                {l.website && (
                  <Regel label="Website"><a href={l.website} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-amber-700">{l.website.replace(/^https?:\/\//, '')}</a></Regel>
                )}
              </dl>
            </Blok>
          </div>

          <Blok
            titel="Contactpersonen"
            actie={
              d.contactenKlaar ? (
                <Drawer knop="Toevoegen" knopKlasse="knop-tekst text-[12px]" titel="Contactpersoon toevoegen" breedte="sm:max-w-lg">
                  <form action={voegContactActie} className="flex flex-col gap-4">
                    <input type="hidden" name="leverancier_id" value={l.id} />
                    <ContactVelden />
                    <button type="submit" className="self-start knop-donker">Toevoegen</button>
                  </form>
                </Drawer>
              ) : null
            }
          >
            {(l.contactpersoon || l.telefoon || l.telefoon_hoofdkantoor) && (
              <div className="mb-2 rounded-md bg-mist px-3 py-2 text-[13px]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">Algemeen</p>
                {l.contactpersoon && <p className="font-semibold text-ink-900">{l.contactpersoon}</p>}
                {l.telefoon && <a href={telLink(l.telefoon)} className="block text-ink-800 hover:text-amber-700">{l.telefoon}</a>}
                {l.telefoon_hoofdkantoor && l.telefoon_hoofdkantoor !== l.telefoon && (
                  <a href={telLink(l.telefoon_hoofdkantoor)} className="block text-warm hover:text-amber-700">Hoofdkantoor {l.telefoon_hoofdkantoor}</a>
                )}
              </div>
            )}
            {!d.contactenKlaar ? (
              <p className="text-[13px] text-warm">Meerdere contactpersonen met een rol kan pas na de databasemigratie van 4 oktober.</p>
            ) : d.contacten.length === 0 ? (
              <p className="text-[13px] text-warm">Nog geen contactpersonen. Voeg de binnendienst en de accountmanager toe, dan hoef je niet in oude mails te zoeken.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.contacten.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 py-2">
                    <div className="min-w-0 text-[13px]">
                      <p>
                        <span className="font-semibold text-ink-900">{c.naam}</span>
                        {c.rol && <span className="ml-1.5 badge-rust">{c.rol}</span>}
                      </p>
                      {c.email && <a href={`mailto:${c.email}`} className="block truncate text-ink-800 hover:text-amber-700">{c.email}</a>}
                      {c.telefoon && <a href={telLink(c.telefoon)} className="block text-ink-800 hover:text-amber-700">{c.telefoon}</a>}
                      {c.notitie && <p className="text-[12px] text-warm">{c.notitie}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Drawer knop="Wijzig" knopKlasse="knop-tekst !px-1.5 text-[12px]" titel={`${c.naam} wijzigen`} breedte="sm:max-w-lg">
                        <form action={bewerkContactActie} className="flex flex-col gap-4">
                          <input type="hidden" name="leverancier_id" value={l.id} />
                          <input type="hidden" name="contact_id" value={c.id} />
                          <ContactVelden c={c} />
                          <button type="submit" className="self-start knop-donker">Opslaan</button>
                        </form>
                      </Drawer>
                      <form action={verwijderContactActie}>
                        <input type="hidden" name="leverancier_id" value={l.id} />
                        <input type="hidden" name="contact_id" value={c.id} />
                        <button type="submit" className="knop-tekst !px-1.5 text-[12px] hover:!text-red-700" aria-label={`${c.naam} verwijderen`}>Weg</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Blok>

          <Blok titel="Documenten en prijslijsten">
            {(l.documenten ?? []).length === 0 ? (
              <p className="text-[13px] text-warm">Nog geen links. Zet hier de prijslijst, de catalogus of de leveringsvoorwaarden neer.</p>
            ) : (
              <ul className="divide-y divide-line">
                {(l.documenten ?? []).map((doc) => (
                  <li key={doc.url} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-semibold text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">{doc.naam}</a>
                    <form action={verwijderDocumentActie}>
                      <input type="hidden" name="leverancier_id" value={l.id} />
                      <input type="hidden" name="url" value={doc.url} />
                      <button type="submit" className="knop-tekst !px-1.5 text-[12px] hover:!text-red-700" aria-label={`${doc.naam} verwijderen`}>Weg</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {d.velden.nieuw ? (
              <form action={voegDocumentActie} className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                <input type="hidden" name="leverancier_id" value={l.id} />
                <input name="naam" required placeholder="Naam, bijv. Prijslijst 2026" aria-label="Naam document" className="veld" />
                <input name="url" required placeholder="https://..." aria-label="Link document" className="veld" />
                <button type="submit" className="knop-stil">Toevoegen</button>
              </form>
            ) : (
              <p className="mt-2 text-[12px] text-warm">Documenten toevoegen kan na de databasemigratie.</p>
            )}
          </Blok>

          <Blok titel="Notities">
            <form action={bewaarNotities} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={l.id} />
              <textarea
                name="notities"
                rows={5}
                defaultValue={l.notities ?? ''}
                disabled={!d.velden.nieuw}
                placeholder={d.velden.nieuw ? 'Bijv. vrijdag besteld = dinsdag binnen. Retouren altijd eerst aanmelden bij de binnendienst.' : 'Notities kunnen na de databasemigratie.'}
                className="veld"
              />
              {d.velden.nieuw && <button type="submit" className="self-start knop-stil">Notities opslaan</button>}
            </form>
          </Blok>

          {d.partijGenoten.length > 0 && (
            <Blok titel={`Ook bij ${l.inkoop_bij}`}>
              <ul className="flex flex-wrap gap-1.5">
                {d.partijGenoten.map((g) => (
                  <li key={g.id}><Link href={`/dashboard/leveranciers/${g.id}`} className="chip">{g.naam}</Link></li>
                ))}
              </ul>
            </Blok>
          )}
        </aside>
      </div>
    </main>
  );
}
