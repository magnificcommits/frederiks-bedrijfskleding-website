import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isLeadsDbConfigured } from '@/lib/env';
import { dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { listTaakPersonen, standaardPersoon } from '@/lib/kms/taakPersonen';
import { getTaak } from '@/lib/kms/taken';
import {
  conceptOfferteVanLead,
  isUuid,
  klantNaam,
  listActiviteiten,
  listLeadKaarten,
  listLeadRegels,
  listOffertesVanLead,
  listOngezieneWebleads,
  markeerLeadGezien,
  migratieStand,
  zoekKlantKandidaten,
} from '@/lib/kms/leads';
import { listLeadLogos } from '@/lib/kms/leadLogos';
import { bronKanaalLabel, padSoort } from '@/lib/leadHerkomst';
import {
  ACTIVITEIT_LABEL,
  AANTAL_OPTIES,
  BRANCHE_OPTIES,
  STANDAARD_KANS,
  VERLOREN,
  datumKort,
  datumTijd,
  duurKort,
  euro,
  heeftEmail,
  isOpen,
  ontleedAanvraag,
  statusLabel,
  telLink,
  vandaagNl,
  whatsappLink,
} from '@/lib/kms/leadsModel';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { OpvolgLabel, ScoreBadge, StatusLabel, WachtLabel } from '../onderdelen';
import {
  koppelKlantActie,
  logActiviteitActie,
  nieuweKlantActie,
  offerteActie,
  voegSamenActie,
  werkContactBijActie,
  werkLeadBijActie,
} from '../actions';
import AiOpvolg from '../AiOpvolg';
import LeadMelding from '../LeadMelding';
import StatusKiezer from './StatusKiezer';
import VolgendeStap from './VolgendeStap';

export const metadata: Metadata = { title: 'Lead', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const LOG_SOORTEN = [
  { value: 'notitie', label: 'Notitie' },
  { value: 'telefoon', label: 'Gebeld' },
  { value: 'mail', label: 'Gemaild' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'reactie', label: 'Klant reageerde' },
  { value: 'afspraak', label: 'Afspraak gehad' },
] as const;

const SOORT_STIP: Record<string, string> = {
  notitie: 'bg-ink-300',
  telefoon: 'bg-ink-800',
  mail: 'bg-ink-800',
  whatsapp: 'bg-ink-800',
  afspraak: 'bg-ink-800',
  reactie: 'bg-green-600',
  status: 'bg-amber-500',
  taak: 'bg-amber-300',
  systeem: 'bg-ink-200',
  binnen: 'bg-amber-500',
};

function Paneel({ titel, id, children, rechts }: { titel: string; id?: string; children: React.ReactNode; rechts?: React.ReactNode }) {
  const kopId = `${id ?? titel.toLowerCase().replace(/[^a-z]+/g, '-')}-kop`;
  return (
    <section id={id} className="panel scroll-mt-20 p-4" aria-labelledby={kopId}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={kopId} className="font-display text-[15px] font-bold text-ink-900">{titel}</h2>
        {rechts}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await dashAuthed())) redirect('/dashboard');
  if (!isLeadsDbConfigured) redirect('/dashboard');
  if (!isUuid(id)) notFound();

  const [alle, personen, admin, tijdlijn, offertes, migratie, regels, logos, concept] = await Promise.all([
    listLeadKaarten(),
    listTaakPersonen(),
    getHuidigeAdmin().catch(() => null),
    listActiviteiten(id),
    listOffertesVanLead(id),
    migratieStand(),
    listLeadRegels(id),
    listLeadLogos(id),
    conceptOfferteVanLead(id),
  ]);
  const lead = alle.find((l) => l.id === id);
  if (!lead) notFound();
  // Geopend: telt niet meer als nieuwe webaanvraag in de melding.
  if (!lead.gezien_op) await markeerLeadGezien(lead.id).catch(() => null);
  // Startstand voor de melding "nieuwe webaanvraag" terwijl je in deze lead werkt.
  const ongezien = await listOngezieneWebleads(1).catch(() => ({ aantal: 0, leads: [] }));

  const vandaag = vandaagNl();
  const actief = personen.filter((p) => p.actief);
  const mijn = standaardPersoon(personen, admin?.email ?? null);
  const eigenaarNaam = (lead.eigenaar_id && personen.find((p) => p.id === lead.eigenaar_id)?.naam) || lead.eigenaar || null;
  const [orgNaam, kandidaten, vorigeTaak] = await Promise.all([
    klantNaam(lead.organisatie_id),
    lead.organisatie_id ? Promise.resolve([]) : zoekKlantKandidaten(lead),
    isUuid(lead.volgende_taak_id) ? getTaak(lead.volgende_taak_id).catch(() => null) : Promise.resolve(null),
  ]);
  const dubbelen = alle.filter((l) => lead.dubbelVan.includes(l.id));
  const aanvraag = ontleedAanvraag(lead.bericht);
  const titel = lead.company || lead.name;
  const tel = telLink(lead.phone);
  const voornaam = lead.name.split(' ')[0] || lead.name;
  const ikNaam = personen.find((p) => p.id === mijn)?.naam ?? null;
  const wa = whatsappLink(lead.phone, `Hoi ${voornaam}, ${ikNaam ? `met ${ikNaam} ` : ''}van Frederiks Bedrijfskleding. `);
  const mail = heeftEmail(lead.email) ? lead.email : null;
  const standaardKans = STANDAARD_KANS[lead.status] ?? 10;
  const aiContext = tijdlijn.regels
    .slice(0, 5)
    .map((r) => `${datumKort(r.created_at)} ${ACTIVITEIT_LABEL[r.soort] ?? r.soort}${r.tekst ? `: ${r.tekst}` : ''}`)
    .join(' | ');
  const totaalStuks = aanvraag.stukken.reduce((t, s) => t + (s.aantal ?? 0), 0);
  const regelStuks = regels.reduce((t, r) => t + (r.aantal ?? 0), 0);
  const paden = lead.bezochte_paden ?? [];
  const heeftHerkomst = !!(lead.bron_kanaal || lead.utm_source || lead.utm_campaign || lead.referrer || lead.landingspagina || lead.gclid);
  const tijdOp = (sec: number) => (sec < 60 ? `${sec} s` : sec < 3600 ? `${Math.floor(sec / 60)} min` : `${Math.round(sec / 360) / 10} uur`);
  const PAD_LABEL: Record<string, string> = { prijs: 'offerte/prijs', assortiment: 'assortiment', configurator: 'configurator', branche: 'branche', overig: '' };
  const vorigeOpen = !!vorigeTaak && vorigeTaak.status !== 'klaar' && !vorigeTaak.verwijderd_op;
  const stapSuggestie = lead.status === 'offerte' ? 'Offerte nabellen' : lead.status === 'nieuw' ? 'Terugbellen' : lead.status === 'contact' ? 'Pasafspraak plannen' : '';

  return (
    <main className="container-app py-6">
      <LeadMelding webleads={{ aantal: ongezien.aantal }} />
      <div className="dash-kop flex-wrap justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/leads" className="knop-tekst -ml-2 shrink-0" aria-label="Terug naar leads">
            <span aria-hidden>←</span> Leads
          </Link>
          <h1 className="dash-h1 truncate">{titel}</h1>
          <StatusLabel status={lead.status} />
          <ScoreBadge score={lead.scoreWaarde} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tel && <a href={`tel:${tel}`} className="knop-stil">Bellen</a>}
          {mail && <a href={`mailto:${mail}`} className="knop-stil">Mailen</a>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="knop-stil">WhatsApp</a>}
          {concept ? (
            <Link href={`/dashboard/offertes/${concept.id}`} className="knop-primair">
              Open conceptofferte{concept.offertenummer ? ` ${concept.offertenummer}` : ''}
            </Link>
          ) : lead.organisatie_id ? (
            <form action={offerteActie}>
              <input type="hidden" name="id" value={lead.id} />
              <VerzendKnop className="knop-primair" bezigTekst="Offerte maken…">Offerte maken</VerzendKnop>
            </form>
          ) : (
            <a href="#klant" className="knop-primair">Offerte maken</a>
          )}
        </div>
      </div>

      <p className="mt-3 text-[13px] text-warm">
        {[lead.company ? lead.name : null, lead.branche, lead.aantal ? `${lead.aantal.replace(/\s*medewerkers/i, '')} medewerkers` : null].filter(Boolean).join(' · ')}
        {' · '}binnen op {datumTijd(lead.created_at)} via {lead.kanaal}
        {eigenaarNaam ? ` · eigenaar ${eigenaarNaam}` : ''}
      </p>

      {/* Signalen */}
      {(lead.wachtUren != null && lead.wachtUren >= 24) || lead.opvolg === 'verlopen' ? (
        <div role="status" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-800">
          {lead.wachtUren != null && lead.wachtUren >= 24 ? (
            <><span className="font-semibold">Wacht al {duurKort(lead.wachtUren)} op reactie.</span> Op de website staat dat we binnen 24 uur terugbellen.</>
          ) : (
            <><span className="font-semibold">Opvolging verlopen sinds {datumKort(lead.opvolgdatum)}</span>{lead.volgende_stap ? `: ${lead.volgende_stap}` : ''}. Plan een nieuwe stap of zet de lead op verloren.</>
          )}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        {/* Linkerkolom */}
        <div className="grid gap-5">
          {dubbelen.length > 0 && (
            <Paneel titel="Mogelijk dezelfde aanvraag" rechts={<span className="text-[12px] text-warm">zelfde e-mail of bedrijf</span>}>
              <ul className="divide-y divide-line">
                {dubbelen.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0 text-[13px]">
                      <Link href={`/dashboard/leads/${d.id}`} className="font-semibold text-ink-900 hover:text-amber-700">{d.company || d.name}</Link>
                      <span className="text-warm"> · {d.name} · {datumKort(d.created_at)} · {statusLabel(d.status)} · {d.kanaal}</span>
                    </div>
                    <form action={voegSamenActie}>
                      <input type="hidden" name="hoofd_id" value={lead.id} />
                      <input type="hidden" name="dubbel_id" value={d.id} />
                      <VerzendKnop className="knop-stil" bezigTekst="Samenvoegen…">Voeg samen in deze lead</VerzendKnop>
                    </form>
                  </li>
                ))}
              </ul>
              <p className="veld-hint">Lege velden worden aangevuld, de andere aanvraag komt op de tijdlijn en daarna verdwijnt de dubbele lead.</p>
            </Paneel>
          )}

          <Paneel
            titel={aanvraag.soort === 'configurator' ? 'Aanvraag uit de pakketconfigurator' : aanvraag.soort === 'advies' ? 'Aanvraag via kledingadvies' : 'Aanvraag'}
            rechts={<span className="text-[12px] text-warm" title={lead.bron ?? undefined}>{lead.bron && lead.bron !== lead.kanaal ? lead.bron : null}</span>}
          >
            {aanvraag.velden.length > 0 && (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                {aanvraag.velden.map((v) => (
                  <div key={v.label} className="flex justify-between gap-3 border-b border-line pb-1.5 sm:block sm:border-0 sm:pb-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-warm">{v.label}</dt>
                    <dd className={`text-ink-900 ${/passen op locatie/i.test(v.label) && /^ja/i.test(v.waarde) ? 'font-semibold text-amber-700' : ''}`}>{v.waarde}</dd>
                  </div>
                ))}
              </dl>
            )}

            {aanvraag.stukken.length > 0 && regels.length === 0 && (
              <div className="mt-4 overflow-x-auto rounded-md border border-line">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Kledingstuk</th>
                      <th>Kleur</th>
                      <th>Logo</th>
                      <th className="text-right">Aantal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aanvraag.stukken.map((s, i) => (
                      <tr key={i}>
                        <td className="font-medium text-ink-900">
                          {s.naam}
                          {s.voorkeur && <span className="block text-[11px] font-normal text-warm">voorkeur: {s.voorkeur}</span>}
                        </td>
                        <td>{s.kleur ?? '-'}</td>
                        <td className="text-warm">{s.logo ?? '-'}</td>
                        <td className="num">{s.aantal ? `${s.aantal}x` : '-'}</td>
                      </tr>
                    ))}
                    {totaalStuks > 0 && (
                      <tr>
                        <td colSpan={3} className="text-right text-[12px] font-semibold uppercase tracking-wide text-warm">Totaal</td>
                        <td className="num font-semibold text-ink-900">{totaalStuks} stuks</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {aanvraag.lijsten.filter((l) => l.regels.length).map((l) => (
              <div key={l.kop} className="mt-4">
                <p className="veld-label">{l.kop}</p>
                <ul className="list-inside list-disc text-[13px] text-ink-800">
                  {l.regels.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            ))}

            {aanvraag.vrijeTekst && (
              <p className={`whitespace-pre-wrap text-[13px] leading-relaxed text-ink-800 ${aanvraag.velden.length || aanvraag.stukken.length ? 'mt-4' : ''}`}>{aanvraag.vrijeTekst}</p>
            )}
            {!lead.bericht && <p className="text-[13px] text-warm">Geen bericht meegestuurd.</p>}

            {lead.notitie && (
              <div className="mt-4 rounded-md bg-mist px-3 py-2 text-[13px]">
                <p className="veld-label">Notitie</p>
                <p className="whitespace-pre-wrap text-ink-800">{lead.notitie}</p>
              </div>
            )}
          </Paneel>

          {(regels.length > 0 || logos.length > 0) && (
            <Paneel
              titel="Gekozen artikelen"
              id="artikelen"
              rechts={
                concept ? (
                  <Link href={`/dashboard/offertes/${concept.id}`} className="text-[12px] font-semibold text-amber-700 hover:underline">
                    Open conceptofferte
                  </Link>
                ) : null
              }
            >
              {regels.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-line">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Artikel</th>
                        <th>Kleur</th>
                        <th>Opmerking</th>
                        <th className="text-right">Aantal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regels.map((r) => (
                        <tr key={r.id}>
                          <td className="font-medium text-ink-900">
                            {r.product_id ? (
                              <Link href={`/dashboard/producten/${r.product_id}`} className="hover:text-amber-700 hover:underline">{r.omschrijving}</Link>
                            ) : (
                              r.omschrijving
                            )}
                            {r.maat && <span className="block text-[11px] font-normal text-warm">maat {r.maat}</span>}
                            {!r.product_id && <span className="block text-[11px] font-normal text-warm">geen artikel uit de catalogus</span>}
                          </td>
                          <td>{r.kleur ?? '-'}</td>
                          <td className="text-warm">{r.opmerking ?? '-'}</td>
                          <td className="num">{r.aantal ? `${r.aantal}x` : '-'}</td>
                        </tr>
                      ))}
                      {regelStuks > 0 && (
                        <tr>
                          <td colSpan={3} className="text-right text-[12px] font-semibold uppercase tracking-wide text-warm">Totaal</td>
                          <td className="num font-semibold text-ink-900">{regelStuks} stuks</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {logos.length > 0 && (
                <div className={regels.length ? 'mt-4' : ''}>
                  <p className="veld-label">Aangeleverd logo</p>
                  <ul className="mt-1 flex flex-wrap gap-3">
                    {logos.map((l) => (
                      <li key={l.id} className="w-36 rounded-md border border-line p-2 text-[11px]">
                        <a href={l.logo_url} target="_blank" rel="noopener noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={l.logo_url} alt={`Logo ${lead.company || lead.name}`} className="h-20 w-full object-contain" />
                        </a>
                        <p className="mt-1 truncate text-ink-800" title={l.logo_naam ?? undefined}>{l.logo_naam ?? 'logo'}</p>
                        {l.logo_id ? (
                          <Link href={`/dashboard/logos/${l.logo_id}`} className="font-semibold text-amber-700 hover:underline">In de logobibliotheek</Link>
                        ) : (
                          <span className="text-warm">Gaat naar de logobibliotheek zodra dit een klant is</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {regels.length > 0 && !concept && offertes.length === 0 && (
                <p className="veld-hint">Er staat nog geen offerte klaar. Maak eerst een klant van deze lead; de artikelen komen dan met catalogusprijzen op de offerte.</p>
              )}
            </Paneel>
          )}

          <Paneel titel="Tijdlijn" id="tijdlijn" rechts={tijdlijn.viaAudit ? <span className="text-[11px] text-warm">tijdelijk uit het auditlog</span> : null}>
            <form action={logActiviteitActie} className="rounded-md border border-line bg-mist/60 p-3">
              <input type="hidden" name="id" value={lead.id} />
              <fieldset className="flex flex-wrap gap-1">
                <legend className="sr-only">Soort</legend>
                {LOG_SOORTEN.map((s, i) => (
                  <label key={s.value} className="cursor-pointer">
                    <input type="radio" name="soort" value={s.value} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="chip px-2 py-0.5 text-[12px] peer-checked:border-ink-900 peer-checked:bg-ink-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400">
                      {s.label}
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="mt-2 block">
                <span className="sr-only">Wat is er besproken?</span>
                <textarea name="tekst" rows={2} maxLength={4000} className="veld bg-white" placeholder="Wat is er besproken of afgesproken?" />
              </label>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-warm">Gebeld, gemaild of WhatsApp telt als contact en stopt de wacht-timer.</p>
                <VerzendKnop className="knop-donker" bezigTekst="Opslaan…">Vastleggen</VerzendKnop>
              </div>
            </form>

            <ol className="relative mt-4 border-l border-line pl-5">
              {tijdlijn.regels.map((r) => (
                <li key={r.id} className="relative pb-4 last:pb-0">
                  <span aria-hidden className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${SOORT_STIP[r.soort] ?? 'bg-ink-300'}`} />
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                    <span className="font-semibold text-ink-900">{ACTIVITEIT_LABEL[r.soort] ?? r.soort}</span>
                    <time dateTime={r.created_at} className="text-warm">{datumTijd(r.created_at)}</time>
                    {r.door && <span className="text-ink-400">{r.door === 'dashboard-wachtwoord' ? 'via dashboard' : r.door}</span>}
                  </p>
                  {r.tekst && <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-800">{r.tekst}</p>}
                </li>
              ))}
              <li className="relative">
                <span aria-hidden className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${SOORT_STIP.binnen}`} />
                <p className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="font-semibold text-ink-900">Aanvraag binnengekomen</span>
                  <time dateTime={lead.created_at} className="text-warm">{datumTijd(lead.created_at)}</time>
                </p>
                <p className="mt-0.5 text-[13px] text-ink-800">Via {lead.kanaal}{lead.bron && lead.bron !== lead.kanaal ? ` (${lead.bron})` : ''}.</p>
              </li>
            </ol>
          </Paneel>
        </div>

        {/* Rechterkolom */}
        <div className="grid gap-5">
          {isOpen(lead.status) && (
            <Paneel titel="Volgende stap">
              {lead.opvolgdatum || lead.wachtUren != null ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-mist px-3 py-2">
                  {lead.wachtUren != null ? <WachtLabel uren={lead.wachtUren} /> : null}
                  {lead.opvolgdatum ? <OpvolgLabel stand={lead.opvolg} datum={lead.opvolgdatum} stap={lead.volgende_stap} /> : null}
                  {vorigeTaak && (
                    <Link href="/dashboard/taken" className="ml-auto text-[11px] font-semibold text-warm hover:text-ink-900">
                      {vorigeOpen ? 'Staat in Taken' : 'Afgevinkt in Taken'}
                    </Link>
                  )}
                </div>
              ) : null}
              <VolgendeStap
                id={lead.id}
                vandaag={vandaag}
                personen={actief.map((p) => ({ id: p.id, naam: p.naam }))}
                standaardPersoon={lead.eigenaar_id ?? mijn}
                heeftVorige={vorigeOpen}
                suggestie={stapSuggestie}
              />
            </Paneel>
          )}

          <Paneel titel="Pijplijn">
            <StatusKiezer id={lead.id} status={lead.status} reden={lead.verloren_reden ?? null} />
            {lead.status === VERLOREN && lead.verloren_reden && (
              <p className="mt-2 text-[12px] text-warm">Reden: <span className="text-ink-800">{lead.verloren_reden}</span></p>
            )}
            <form action={werkLeadBijActie} className="mt-4 grid gap-3 border-t border-line pt-4">
              <input type="hidden" name="id" value={lead.id} />
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="veld-label">Waarde</span>
                  <input
                    name="offertewaarde"
                    inputMode="decimal"
                    defaultValue={lead.offertewaarde ?? ''}
                    placeholder={lead.waardeGeschat && lead.waarde ? `≈ ${Math.round(lead.waarde)}` : 'bedrag'}
                    className="veld tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="veld-label">Kans %</span>
                  <input
                    name="kans"
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    defaultValue={lead.kans ?? ''}
                    placeholder={String(standaardKans)}
                    disabled={!migratie.kolommen}
                    className="veld tabular-nums disabled:bg-mist"
                  />
                </label>
              </div>
              {migratie.kolommen && actief.length > 0 && (
                <label className="block">
                  <span className="veld-label">Eigenaar</span>
                  <select name="eigenaar_id" defaultValue={lead.eigenaar_id ?? ''} className="veld">
                    <option value="">Nog niemand</option>
                    {actief.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
                  </select>
                </label>
              )}
              <p className="text-[12px] text-warm">
                {lead.waarde > 0 ? (
                  <>
                    {lead.waardeGeschat ? 'Geschat op teamgrootte: ' : ''}
                    {euro(lead.waarde)} × {lead.kansPct}% = <span className="font-semibold text-ink-800">{euro((lead.waarde * lead.kansPct) / 100)}</span> gewogen.
                  </>
                ) : (
                  <>Vul een bedrag in voor de openstaande waarde. Zonder eigen kans geldt {standaardKans}% voor deze fase.</>
                )}
              </p>
              <VerzendKnop className="knop-stil justify-center" bezigTekst="Opslaan…">Opslaan</VerzendKnop>
            </form>
          </Paneel>

          <Paneel titel="Klant" id="klant">
            {lead.organisatie_id ? (
              <div className="grid gap-3 text-[13px]">
                <p>
                  Gekoppeld aan{' '}
                  <Link href={`/dashboard/klanten/${lead.organisatie_id}`} className="font-semibold text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">
                    {orgNaam ?? 'klant'}
                  </Link>
                </p>
                <form action={offerteActie}>
                  <input type="hidden" name="id" value={lead.id} />
                  <VerzendKnop className="knop-primair w-full justify-center" bezigTekst="Offerte maken…">Offerte maken</VerzendKnop>
                </form>
              </div>
            ) : (
              <div className="grid gap-3 text-[13px]">
                <p className="text-warm">Voor een offerte hoort de lead bij een klant. Controleer eerst of die al bestaat.</p>
                {kandidaten.length > 0 ? (
                  <ul className="grid gap-2">
                    {kandidaten.map((k) => (
                      <li key={k.id} className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5">
                        <p className="font-semibold text-ink-900">
                          {k.naam}
                          {k.plaats ? <span className="font-normal text-warm"> · {k.plaats}</span> : null}
                          {k.klantnummer ? <span className="font-normal text-warm"> · {k.klantnummer}</span> : null}
                        </p>
                        <p className="text-[11px] text-amber-800">Bestaat al: {k.reden}</p>
                        <form action={koppelKlantActie} className="mt-2 flex flex-wrap gap-2">
                          <input type="hidden" name="id" value={lead.id} />
                          <input type="hidden" name="organisatie_id" value={k.id} />
                          <VerzendKnop name="daarna" value="offerte" className="knop-donker" bezigTekst="Bezig…">Koppel en maak offerte</VerzendKnop>
                          <VerzendKnop className="knop-stil" bezigTekst="Bezig…">Alleen koppelen</VerzendKnop>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md bg-mist px-3 py-2 text-[12px] text-warm">Geen bestaande klant gevonden met dit e-mailadres of deze bedrijfsnaam.</p>
                )}
                <form action={nieuweKlantActie} className="grid gap-2 border-t border-line pt-3">
                  <input type="hidden" name="id" value={lead.id} />
                  <p className="text-[12px] text-warm">
                    {kandidaten.length ? 'Toch een andere klant?' : 'Nieuwe klant'}: {lead.company || lead.name}, met {lead.name} als contactpersoon.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <VerzendKnop name="daarna" value="offerte" className={kandidaten.length ? 'knop-stil' : 'knop-primair'} bezigTekst="Bezig…">
                      Maak klant + offerte
                    </VerzendKnop>
                    <VerzendKnop className="knop-stil" bezigTekst="Bezig…">Converteer naar klant</VerzendKnop>
                  </div>
                </form>
              </div>
            )}
            {offertes.length > 0 && (
              <ul className="mt-3 grid gap-1 border-t border-line pt-3 text-[13px]">
                {offertes.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <Link href={`/dashboard/offertes/${o.id}`} className="font-semibold text-ink-900 hover:text-amber-700">
                      Offerte {o.offertenummer ?? ''}
                    </Link>
                    <span className="text-[12px] text-warm">{o.status} · {datumKort(o.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Paneel>

          <Paneel titel="Herkomst" id="herkomst">
            <dl className="grid gap-1.5 text-[13px]">
              <div className="flex justify-between gap-3"><dt className="text-warm">Ingang</dt><dd className="text-right font-medium text-ink-900">{lead.bron_kanaal ? bronKanaalLabel(lead.bron_kanaal) : 'onbekend'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-warm">Kanaal</dt><dd className="text-right text-ink-900">{lead.kanaal}</dd></div>
              {(lead.utm_campaign || lead.utm_source) && (
                <div className="flex justify-between gap-3">
                  <dt className="text-warm">Campagne</dt>
                  <dd className="min-w-0 text-right text-ink-900">
                    {lead.utm_campaign ?? '-'}
                    <span className="block text-[11px] text-warm">{[lead.utm_source, lead.utm_medium, lead.utm_content].filter(Boolean).join(' / ')}</span>
                  </dd>
                </div>
              )}
              {lead.utm_term && <div className="flex justify-between gap-3"><dt className="text-warm">Zoekwoord</dt><dd className="text-right text-ink-900">{lead.utm_term}</dd></div>}
              {lead.gclid && <div className="flex justify-between gap-3"><dt className="text-warm">Google Ads</dt><dd className="text-right text-ink-900">klik-id bewaard</dd></div>}
              {lead.referrer && <div className="flex justify-between gap-3"><dt className="text-warm">Verwijzer</dt><dd className="text-right text-ink-900">{lead.referrer}</dd></div>}
              {lead.landingspagina && <div className="flex justify-between gap-3"><dt className="text-warm">Eerste pagina</dt><dd className="min-w-0 truncate text-right text-ink-900" title={lead.landingspagina}>{lead.landingspagina}</dd></div>}
              {lead.conversiepagina && <div className="flex justify-between gap-3"><dt className="text-warm">Aanvraag vanaf</dt><dd className="min-w-0 truncate text-right text-ink-900" title={lead.conversiepagina}>{lead.conversiepagina}</dd></div>}
              {lead.eerste_bezoek_op && <div className="flex justify-between gap-3"><dt className="text-warm">Eerste bezoek</dt><dd className="text-right text-ink-900">{datumTijd(lead.eerste_bezoek_op)}</dd></div>}
              {(lead.bezoeken != null || lead.paginas_bekeken != null) && (
                <div className="flex justify-between gap-3">
                  <dt className="text-warm">Gedrag</dt>
                  <dd className="text-right text-ink-900">
                    {[lead.bezoeken != null ? `${lead.bezoeken}e bezoek` : null, lead.paginas_bekeken != null ? `${lead.paginas_bekeken} pagina's deze sessie` : null].filter(Boolean).join(', ')}
                  </dd>
                </div>
              )}
            </dl>
            {paden.length > 0 && (
              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-[12px] font-semibold text-warm hover:text-ink-900">Bekeken pagina&rsquo;s ({paden.length})</summary>
                <ol className="mt-2 grid gap-1 text-[12px]">
                  {paden.map((p, i) => (
                    <li key={`${p.p}-${i}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
                      <span className="tabular-nums text-ink-400">{i === 0 ? 'start' : `+${tijdOp(p.s)}`}</span>
                      <span className="min-w-0 truncate text-ink-800" title={p.p}>
                        {p.p}
                        {PAD_LABEL[padSoort(p.p)] ? <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-700">{PAD_LABEL[padSoort(p.p)]}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {!heeftHerkomst && <p className="mt-2 text-[12px] text-warm">Geen herkomst vastgelegd. Oudere aanvragen en zelf ingevoerde leads hebben alleen de bron hierboven.</p>}
            {heeftHerkomst && paden.length === 0 && lead.bron_kanaal && ['formulier', 'configurator', 'selectie'].includes(lead.bron_kanaal) && (
              <p className="mt-2 text-[12px] text-warm">Geen bekeken pagina&rsquo;s: de bezoeker gaf geen toestemming voor statistieken.</p>
            )}
          </Paneel>

          <Paneel titel="Leadscore" rechts={<ScoreBadge score={lead.scoreWaarde} groot />}>
            <ul className="grid gap-2">
              {lead.scoreInfo.delen.map((d) => (
                <li key={d.label} className="text-[12px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink-800">{d.label}</span>
                    <span className="tabular-nums text-warm">{d.punten}/{d.max}</span>
                  </div>
                  <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1 h-1.5 w-full" aria-hidden>
                    <rect width="100" height="4" rx="2" className="fill-mist" />
                    <rect width={(d.punten / d.max) * 100} height="4" rx="2" className={d.punten / d.max >= 0.66 ? 'fill-amber-500' : 'fill-ink-300'} />
                  </svg>
                  <p className="mt-0.5 text-[11px] text-warm">{d.uitleg}</p>
                </li>
              ))}
            </ul>
          </Paneel>

          <Paneel titel="Contact">
            <dl className="grid gap-1.5 text-[13px]">
              <div className="flex justify-between gap-3"><dt className="text-warm">Naam</dt><dd className="text-right font-medium text-ink-900">{lead.name}</dd></div>
              {lead.company && <div className="flex justify-between gap-3"><dt className="text-warm">Bedrijf</dt><dd className="text-right text-ink-900">{lead.company}</dd></div>}
              <div className="flex justify-between gap-3">
                <dt className="text-warm">Telefoon</dt>
                <dd className="text-right">{tel ? <a href={`tel:${tel}`} className="font-medium text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">{lead.phone}</a> : <span className="text-ink-300">onbekend</span>}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-warm">E-mail</dt>
                <dd className="min-w-0 truncate text-right">{mail ? <a href={`mailto:${mail}`} className="font-medium text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">{mail}</a> : <span className="text-ink-300">onbekend</span>}</dd>
              </div>
            </dl>
            <details className="mt-3 border-t border-line pt-3">
              <summary className="cursor-pointer text-[12px] font-semibold text-warm hover:text-ink-900">Gegevens aanpassen</summary>
              <form action={werkContactBijActie} className="mt-3 grid gap-2.5">
                <input type="hidden" name="id" value={lead.id} />
                <label className="block"><span className="veld-label">Naam</span><input name="name" required defaultValue={lead.name} className="veld" /></label>
                <label className="block"><span className="veld-label">Bedrijf</span><input name="company" defaultValue={lead.company ?? ''} className="veld" /></label>
                <label className="block"><span className="veld-label">Telefoon</span><input name="phone" type="tel" defaultValue={lead.phone ?? ''} className="veld" /></label>
                <label className="block"><span className="veld-label">E-mail</span><input name="email" type="email" defaultValue={lead.email ?? ''} className="veld" /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="veld-label">Branche</span>
                    <select name="branche" defaultValue={lead.branche ?? ''} className="veld">
                      <option value="">Onbekend</option>
                      {[...new Set([...(lead.branche ? [lead.branche] : []), ...BRANCHE_OPTIES])].map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="veld-label">Medewerkers</span>
                    <select name="aantal" defaultValue={lead.aantal ?? ''} className="veld">
                      <option value="">Onbekend</option>
                      {[...new Set([...(lead.aantal ? [lead.aantal] : []), ...AANTAL_OPTIES])].map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </label>
                </div>
                <VerzendKnop className="knop-stil justify-center" bezigTekst="Opslaan…">Gegevens opslaan</VerzendKnop>
              </form>
            </details>
          </Paneel>

          <Paneel titel="AI-opvolgmail">
            <AiOpvolg
              naam={lead.name}
              bedrijf={lead.company ?? ''}
              branche={lead.branche ?? ''}
              bericht={lead.bericht ?? ''}
              status={statusLabel(lead.status)}
              context={aiContext}
              email={mail}
              open
            />
          </Paneel>
        </div>
      </div>

    </main>
  );
}
