import Link from 'next/link';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { listOntvangers, type CampagneDetail } from '@/lib/kms/campagnes';
import { afgemeldeAdressen, schoonEmail, zoekKandidaten } from '@/lib/kms/campagneContacten';
import { PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import { LEAD_STATUSSEN } from '@/lib/kms/leadsModel';
import { DOELGROEP_LABEL, DOELGROEPEN, INSCHRIJVING_STATUS_LABEL, type Doelgroep } from '@/lib/campagnes/flow';
import { gereageerdActie, schrijfInActie, stopOntvangerActie } from './actions';
import { InschrijvingBadge, datumKort, volgendeRunTekst } from '../onderdelen';

type Zoek = { ostatus?: string; oq?: string; dg?: string; fs?: string; fb?: string; fp?: string; fbron?: string; fq?: string; kies?: string };

const SOORT_LABEL = { prospect: 'Prospect', lead: 'Lead', klant: 'Klant' } as const;
const SOORT_HREF = { prospect: '/dashboard/prospects', lead: '/dashboard/leads', klant: '/dashboard/klanten' } as const;

export default async function OntvangersTab({ campagne: c, zoek }: { campagne: CampagneDetail; zoek: Zoek }) {
  const dg: Doelgroep = (DOELGROEPEN as readonly string[]).includes(zoek.dg ?? '') ? (zoek.dg as Doelgroep) : c.doelgroep;
  const filters = { status: zoek.fs || undefined, branche: zoek.fb || undefined, plaats: zoek.fp || undefined, bron: zoek.fbron || undefined, q: zoek.fq || undefined };
  const kiezen = zoek.kies === '1';

  const [{ rijen, perStatus, meer }, kandidaten] = await Promise.all([
    listOntvangers(c.id, { status: zoek.ostatus, q: zoek.oq }),
    kiezen ? zoekKandidaten(dg, filters, 2000) : Promise.resolve([]),
  ]);
  const afgemeld = kiezen ? await afgemeldeAdressen(kandidaten.map((k) => k.email ?? '')) : new Set<string>();
  const bruikbaar = kandidaten.filter((k) => !afgemeld.has(schoonEmail(k.email)));
  const statusOpties = dg === 'prospect' ? PROSPECT_STATUSSEN.filter((s) => s !== 'afgemeld') : dg === 'lead' ? LEAD_STATUSSEN : ['actief', 'inactief'];
  const terug = `/dashboard/campagnes/${c.id}?tab=ontvangers${zoek.ostatus ? `&ostatus=${zoek.ostatus}` : ''}`;
  const verborgen = (
    <>
      <input type="hidden" name="campagneId" value={c.id} />
      <input type="hidden" name="doelgroep" value={dg} />
      <input type="hidden" name="f_status" value={filters.status ?? ''} />
      <input type="hidden" name="f_branche" value={filters.branche ?? ''} />
      <input type="hidden" name="f_plaats" value={filters.plaats ?? ''} />
      <input type="hidden" name="f_bron" value={filters.bron ?? ''} />
      <input type="hidden" name="f_q" value={filters.q ?? ''} />
    </>
  );

  return (
    <div className="mt-4 flex flex-col gap-5">
      <details className="panel group" open={kiezen || c.totaal === 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="text-[14px] font-bold text-ink-900">Mensen inschrijven</span>
          <span className="text-[12px] text-warm group-open:hidden">Prospects, leads of klanten met filters</span>
        </summary>
        <div className="border-t border-line px-4 py-4">
          <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="tab" value="ontvangers" />
            <input type="hidden" name="kies" value="1" />
            <div>
              <label className="veld-label" htmlFor="i-dg">Wie</label>
              <select id="i-dg" name="dg" defaultValue={dg} className="veld">
                {DOELGROEPEN.map((d) => (
                  <option key={d} value={d}>
                    {DOELGROEP_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="veld-label" htmlFor="i-fs">Status</label>
              <select id="i-fs" name="fs" defaultValue={filters.status ?? ''} className="veld">
                <option value="">{dg === 'klant' ? 'Actieve klanten' : dg === 'prospect' ? 'Alle (geen klanten)' : 'Alle'}</option>
                {statusOpties.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="veld-label" htmlFor="i-fb">Branche bevat</label>
              <input id="i-fb" name="fb" defaultValue={filters.branche ?? ''} className="veld" placeholder="bouw" />
            </div>
            {dg !== 'lead' ? (
              <div>
                <label className="veld-label" htmlFor="i-fp">Plaats bevat</label>
                <input id="i-fp" name="fp" defaultValue={filters.plaats ?? ''} className="veld" placeholder="Doetinchem" />
              </div>
            ) : (
              <div>
                <label className="veld-label" htmlFor="i-fbron">Bron bevat</label>
                <input id="i-fbron" name="fbron" defaultValue={filters.bron ?? ''} className="veld" placeholder="Google" />
              </div>
            )}
            <div>
              <label className="veld-label" htmlFor="i-fq">Naam of e-mail</label>
              <input id="i-fq" name="fq" defaultValue={filters.q ?? ''} className="veld" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="knop-donker w-full">
                Zoeken
              </button>
            </div>
          </form>

          {kiezen && (
            <form action={schrijfInActie} className="mt-4">
              {verborgen}
              {bruikbaar.length === 0 ? (
                <p className="rounded-md bg-mist px-3 py-3 text-[13px] text-warm">Geen {DOELGROEP_LABEL[dg].toLowerCase()} met een e-mailadres die hierbij passen{afgemeld.size ? ` (${afgemeld.size} staan op de afmeldlijst)` : ''}.</p>
              ) : (
                <>
                  <p className="text-[13px] text-ink-800">
                    <strong>{bruikbaar.length}</strong> {DOELGROEP_LABEL[dg].toLowerCase()} gevonden
                    {afgemeld.size ? `, ${afgemeld.size} overgeslagen omdat ze zich hebben afgemeld` : ''}. Vink uit wie je niet wilt. Wie er al in zit, wordt overgeslagen.
                  </p>
                  <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-line">
                    <table className="tbl">
                      <thead className="sticky top-0">
                        <tr>
                          <th className="w-8" />
                          <th>Bedrijf</th>
                          <th>Contact</th>
                          <th className="hidden md:table-cell">E-mail</th>
                          <th className="hidden md:table-cell">Status</th>
                          <th className="hidden lg:table-cell">Branche</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bruikbaar.slice(0, 500).map((k) => (
                          <tr key={k.id}>
                            <td>
                              <input type="checkbox" name="contact" value={k.id} defaultChecked aria-label={`${k.bedrijfsnaam ?? k.email} inschrijven`} className="h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                            </td>
                            <td className="font-semibold text-ink-900">{k.bedrijfsnaam || '–'}</td>
                            <td>{k.naam || '–'}</td>
                            <td className="stil hidden md:table-cell">{k.email}</td>
                            <td className="stil hidden md:table-cell">{k.status ?? '–'}</td>
                            <td className="stil hidden lg:table-cell">{k.branche ?? '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {bruikbaar.length > 500 && <p className="veld-hint">Je ziet de eerste 500. Verfijn de filters om de rest te kiezen.</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <ConfirmSubmit message={`De aangevinkte ${DOELGROEP_LABEL[dg].toLowerCase()} inschrijven?${c.status === 'actief' ? ' De campagne is actief: de eerste stap gaat in bij de volgende run.' : ''}`} className="knop-primair">
                      Aangevinkte inschrijven
                    </ConfirmSubmit>
                    <span className="text-[12px] text-warm">{c.status === 'actief' ? 'De campagne is actief: de eerste stap gaat in bij de volgende dagelijkse run.' : 'De campagne staat niet aan; er gebeurt pas iets na Starten.'}</span>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </details>

      {c.totaal === 0 ? (
        <EmptyState tekst={c.trigger.soort === 'handmatig' ? 'Nog niemand ingeschreven.' : 'Nog niemand ingeschreven. Zodra de campagne actief is, komen nieuwe mensen er automatisch in.'} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {['', ...Object.keys(INSCHRIJVING_STATUS_LABEL).filter((st) => perStatus[st])].map((st) => {
                const p = new URLSearchParams({ tab: 'ontvangers' });
                if (st) p.set('ostatus', st);
                if (zoek.oq) p.set('oq', zoek.oq);
                const aan = (zoek.ostatus ?? '') === st;
                return (
                  <Link key={st || 'alle'} href={`/dashboard/campagnes/${c.id}?${p.toString()}`} className={`chip ${aan ? 'chip-aan' : ''}`}>
                    {st ? INSCHRIJVING_STATUS_LABEL[st] : 'Iedereen'}
                    <span className="chip-tel">{st ? perStatus[st] : c.totaal}</span>
                  </Link>
                );
              })}
            </div>
            <LiveZoekveld param="oq" placeholder="Zoek op naam, bedrijf of e-mail" ariaLabel="Zoek ontvangers" breedte="w-full sm:w-72" />
          </div>
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ontvanger</th>
                  <th className="hidden md:table-cell">Soort</th>
                  <th>Status</th>
                  <th>Huidige stap</th>
                  <th className="hidden lg:table-cell">Volgende actie</th>
                  <th className="hidden md:table-cell text-right">Mails</th>
                  <th className="hidden xl:table-cell">Ingeschreven</th>
                  <th className="text-right">
                    <span className="sr-only">Acties</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-[16rem]">
                      <Link href={`/dashboard/campagnes/${c.id}/ontvanger/${r.id}`} className="rij-link block truncate">
                        {r.bedrijf || r.naam || r.email}
                      </Link>
                      <span className="block truncate text-[12px] text-warm">{[r.bedrijf ? r.naam : '', r.email].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td className="stil hidden md:table-cell">
                      {r.soort && r.contactId ? (
                        <Link href={`${SOORT_HREF[r.soort]}/${r.contactId}`} className="hover:underline">
                          {SOORT_LABEL[r.soort]}
                        </Link>
                      ) : (
                        '–'
                      )}
                    </td>
                    <td>
                      <InschrijvingBadge status={r.status} />
                      {r.gereageerd && <span className="badge-klaar ml-1">reageerde</span>}
                    </td>
                    <td className="max-w-[14rem] truncate">{r.stapTitel || <span className="text-warm">–</span>}</td>
                    <td className="stil hidden lg:table-cell">{r.status === 'actief' ? volgendeRunTekst(r.volgendeActie) : '–'}</td>
                    <td className="num hidden md:table-cell">
                      <span title="verzonden / geopend / geklikt">
                        {r.verzonden} <span className="text-ink-300">/</span> {r.geopend} <span className="text-ink-300">/</span> {r.geklikt}
                      </span>
                    </td>
                    <td className="stil hidden xl:table-cell">{datumKort(r.ingeschreven)}</td>
                    <td className="whitespace-nowrap text-right">
                      {r.status === 'actief' && (
                        <div className="inline-flex gap-1">
                          {!r.gereageerd && (
                            <form action={gereageerdActie}>
                              <input type="hidden" name="campagneId" value={c.id} />
                              <input type="hidden" name="inschrijvingId" value={r.id} />
                              <input type="hidden" name="terug" value={terug} />
                              <button type="submit" className="knop-tekst text-[12px]" title="Telt voor de splitsing 'heeft gereageerd' en voor het doel">
                                Reageerde
                              </button>
                            </form>
                          )}
                          <form action={stopOntvangerActie}>
                            <input type="hidden" name="campagneId" value={c.id} />
                            <input type="hidden" name="inschrijvingId" value={r.id} />
                            <input type="hidden" name="terug" value={terug} />
                            <ConfirmSubmit message="Deze persoon uit de campagne halen?" className="knop-tekst text-[12px]">
                              Stoppen
                            </ConfirmSubmit>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rijen.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-warm">Niemand gevonden met deze filters.</p>}
          </div>
          {meer && <p className="text-[12px] text-warm">Je ziet de eerste 300. Filter op status of zoek om de rest te vinden.</p>}
        </>
      )}
    </div>
  );
}
