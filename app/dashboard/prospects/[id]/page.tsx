import Kruimelpad from '@/components/dashboard/ui/Kruimelpad';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { getProspect, PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import LogoOpKleding from '@/components/kennismaking/LogoOpKleding';
import { getProspectRij, listBezoeken, mockupVoorProspect, zoekArtikelen } from '@/lib/prospect/dashboard';
import { kennismakingUrl, korteUrl, websiteHref } from '@/lib/prospect/prospect';
import { BRANCHE_LABELS, brancheGroep, toonKleur } from '@/content/kennismaking';
import {
  werkProspectActie,
  uploadLogoActie,
  haalLogoVanWebsiteActie,
  haalLogoVanBronActie,
  accepteerLogoActie,
  verwijderLogoActie,
  zetHuisstijlKleurActie,
  zetMockupArtikelActie,
  resetMockupActie,
  markeerBriefVerstuurdActie,
} from './actions';
import KopieerKnop from './KopieerKnop';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import { brievenVanProspecten } from '@/lib/prospect/briefData';
import { ONTVANGER_BADGE, ONTVANGER_LABEL, ONTVANGER_STATUSSEN, isOntvangerStatus } from '@/lib/prospect/briefStatus';
import { zetOntvangerStatusActie } from '../brieven/actions';

export const dynamic = 'force-dynamic';
// "Logo ophalen" mag tot ~16 s duren (homepage + afbeelding, elk max 8 s).
export const maxDuration = 60;
export const metadata = { title: 'Prospect', robots: { index: false, follow: false } };

const inputCls = 'veld';
const labelCls = 'block text-xs font-semibold text-warm';
const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

function fmtDatum(d: string | null | undefined, metTijd = false) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('nl-NL', {
      timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', year: 'numeric',
      ...(metTijd ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  } catch {
    return d;
  }
}

const SOORT_LABEL: Record<string, { tekst: string; cls: string }> = {
  qr: { tekst: 'QR-code gescand', cls: 'badge-actie' },
  link: { tekst: 'Pagina geopend via link', cls: 'badge-rust' },
  portaal: { tekst: 'Voorbeeldportaal bekeken', cls: 'badge-actie' },
  aanvraag: { tekst: 'Pasdag aangevraagd', cls: 'badge-klaar' },
};

type Zoek = {
  ok?: string; kandidaat?: string; bron?: string; alt?: string | string[]; logofout?: string;
  artikelzoek?: string; plek?: string;
};

export default async function ProspectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { id } = await params;
  const sp = await searchParams;
  const p = await getProspect(id);

  if (!p) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Prospect niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze prospect bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/prospects" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar prospects</Link>
        </div>
      </main>
    );
  }

  const rij = await getProspectRij(id);
  const [bezoeken, mockup, zoekResultaten, brievenMap] = await Promise.all([
    rij ? listBezoeken(id) : Promise.resolve([]),
    rij ? mockupVoorProspect(rij) : Promise.resolve(null),
    sp.artikelzoek ? zoekArtikelen(sp.artikelzoek) : Promise.resolve([]),
    brievenVanProspecten([id]),
  ]);
  const brieven = brievenMap.get(id) ?? [];
  const alt = (Array.isArray(sp.alt) ? sp.alt : sp.alt ? [sp.alt] : []).filter((u) => /^https?:\/\//.test(u)).slice(0, 5);
  const plek = Math.max(0, Math.min(3, Number(sp.plek ?? 0) || 0));
  const token = rij?.token ?? null;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Kruimelpad />
          <h1 className="dash-h1">{p.bedrijfsnaam}</h1>
          <p className="mt-1 text-sm text-warm">{[p.branche, p.plaats].filter(Boolean).join(' · ') || 'Prospect'}{p.bron ? ` · bron: ${p.bron}` : ''}</p>
        </div>
        <div className="flex items-center gap-4">
          {token && (
            <a href={`/kennismaking/${token}`} target="_blank" rel="noopener" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Voorbeeld bekijken</a>
          )}
          {p.website && (
            <a href={websiteHref(p.website)} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Website openen</a>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,48rem)_minmax(0,1fr)]">
        <form action={werkProspectActie} className="panel p-4">
          <input type="hidden" name="id" value={p.id} />

          <h2 className="font-display text-base font-bold text-ink-900">Bedrijf</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Bedrijfsnaam</label>
              <input name="bedrijfsnaam" required defaultValue={p.bedrijfsnaam} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Branche</label>
              <input name="branche" defaultValue={p.branche ?? ''} placeholder="Bijv. Bouw" className={inputCls} />
              <p className="veld-hint">Telt voor de artikelkeuze als: {BRANCHE_LABELS[brancheGroep(p.branche)]}</p>
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input name="website" defaultValue={p.website ?? ''} placeholder="https://..." className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Adres (voor de brief)</label>
              <input name="adres" defaultValue={rij?.adres ?? ''} placeholder="Straat en huisnummer" autoComplete="off" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Postcode</label>
              <input name="postcode" defaultValue={rij?.postcode ?? ''} placeholder="7255 AG" autoComplete="off" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Plaats</label>
              <input name="plaats" defaultValue={p.plaats ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Grootte</label>
              <input name="grootte" defaultValue={p.grootte ?? ''} placeholder="Bijv. 10-20 medewerkers" className={inputCls} />
            </div>
          </div>

          <h2 className="mt-7 font-display text-base font-bold text-ink-900">Contact</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Eigenaar</label>
              <input name="eigenaar" defaultValue={p.eigenaar ?? ''} placeholder="Naam van de eigenaar" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contactpersoon (aanhef in de brief)</label>
              <input name="contactpersoon" defaultValue={p.contactpersoon ?? ''} placeholder="Leeg = t.a.v. de directie" className={inputCls} />
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
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        {/* Brief en kennismaking */}
        {rij && token ? (
          <div className="flex flex-col gap-6">
            <section className="panel p-4">
              <h2 className="font-display text-base font-bold text-ink-900">Brief en QR-code</h2>
              {rij.afgemeld_op && (
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-800">Afgemeld op {fmtDatum(rij.afgemeld_op)}. De persoonlijke pagina werkt niet meer en deze prospect krijgt geen brief.</p>
              )}
              <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
                <div><dt className="text-warm">Scans</dt><dd className="font-display text-xl font-bold text-ink-900">{rij.aantal_scans ?? 0}</dd></div>
                <div><dt className="text-warm">Eerste scan</dt><dd className="text-ink-900">{fmtDatum(rij.eerste_scan_op, true)}</dd></div>
                <div><dt className="text-warm">Laatste scan</dt><dd className="text-ink-900">{fmtDatum(rij.laatste_scan_op, true)}</dd></div>
                <div><dt className="text-warm">Brief verstuurd</dt><dd className="text-ink-900">{fmtDatum(rij.brief_verstuurd_op)}</dd></div>
              </dl>
              <div className="mt-4 space-y-2">
                <div>
                  <p className="veld-label">Persoonlijke link</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-mist px-2 py-1 text-[12px] text-ink-800">{kennismakingUrl(token)}</code>
                    <KopieerKnop tekst={kennismakingUrl(token)} label="Kopieer link" />
                  </div>
                </div>
                <div>
                  <p className="veld-label">Korte link (in de QR-code, telt als scan)</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-mist px-2 py-1 text-[12px] text-ink-800">{korteUrl(token)}</code>
                    <KopieerKnop tekst={korteUrl(token)} label="Kopieer" />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`/kennismaking/${token}`} target="_blank" rel="noopener" className="knop-donker">Voorbeeld bekijken</a>
                <Link href={`/dashboard/prospects/brieven/nieuw?id=${p.id}&brief=alle`} className="knop-stil">In een verzending zetten</Link>
                <Link href={`/dashboard/prospects/brieven/snel?id=${p.id}&toon=1`} className="knop-tekst">Losse brief printen</Link>
                {!rij.brief_verstuurd_op && !rij.afgemeld_op && (
                  <form action={markeerBriefVerstuurdActie}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="knop-stil">Markeer brief als verstuurd</button>
                  </form>
                )}
              </div>
              {brieven.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="veld-label">Brieven in verzendingen</p>
                  <ul className="space-y-1.5">
                    {brieven.map((b) => (
                      <li key={b.ontvangerId} className="flex flex-wrap items-center gap-2 text-[13px]">
                        <form action={zetOntvangerStatusActie}>
                          <input type="hidden" name="id" value={b.ontvangerId} />
                          <input type="hidden" name="batch" value={b.batchId} />
                          <input type="hidden" name="terug" value={`/dashboard/prospects/${p.id}`} />
                          <AutoSubmitSelect
                            name="status"
                            defaultValue={b.status}
                            aria-label={`Briefstatus in ${b.batchNaam}`}
                            className={`rounded border-0 py-0.5 pl-1.5 pr-6 text-[11px] font-semibold focus:ring-2 focus:ring-amber-300 ${isOntvangerStatus(b.status) ? ONTVANGER_BADGE[b.status] : 'badge-rust'}`}
                            options={ONTVANGER_STATUSSEN.map((st) => ({ value: st, label: ONTVANGER_LABEL[st] }))}
                          />
                        </form>
                        <Link href={`/dashboard/prospects/brieven/${b.batchId}?stap=volgen`} className="font-semibold text-ink-900 hover:text-amber-700">{b.batchNaam}</Link>
                        {b.verstuurd_op && <span className="text-[12px] text-warm">verstuurd {fmtDatum(b.verstuurd_op)}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="veld-hint">Afspraak of klant zet de prospectstatus mee omhoog.</p>
                </div>
              )}
              <p className="veld-hint mt-3">Jouw eigen klikken op deze links tellen niet mee zolang je in het dashboard bent ingelogd.</p>
            </section>

            {/* Logo */}
            <section id="logo" className="panel scroll-mt-20 p-4">
              <h2 className="font-display text-base font-bold text-ink-900">Logo en huisstijl</h2>
              {sp.logofout && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{sp.logofout}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-4">
                {rij.logo_url ? (
                  <>
                    <span className="inline-flex h-16 w-32 items-center justify-center rounded border border-line bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rij.logo_url} alt="Huidig logo" className="max-h-full max-w-full object-contain" />
                    </span>
                    <span className="inline-flex h-16 w-32 items-center justify-center rounded bg-ink-900 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rij.logo_url} alt="Huidig logo op donker" className="max-h-full max-w-full object-contain" />
                    </span>
                    <form action={verwijderLogoActie}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="knop-tekst">Logo weghalen</button>
                    </form>
                  </>
                ) : (
                  <p className="text-[13px] text-warm">Nog geen logo. Zonder logo zetten we de bedrijfsnaam als tekst op de kleding.</p>
                )}
              </div>

              {sp.kandidaat && (
                <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
                  <p className="text-[13px] font-semibold text-ink-900">Gevonden op de website</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="inline-flex h-20 w-40 items-center justify-center rounded border border-line bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sp.kandidaat} alt="Gevonden logo" className="max-h-full max-w-full object-contain" />
                    </span>
                    <span className="inline-flex h-20 w-40 items-center justify-center rounded bg-ink-900 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sp.kandidaat} alt="Gevonden logo op donker" className="max-h-full max-w-full object-contain" />
                    </span>
                    <form action={accepteerLogoActie}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="url" value={sp.kandidaat} />
                      <VerzendKnop className="knop-primair" bezigTekst="Opslaan…">Gebruik dit logo</VerzendKnop>
                    </form>
                    <Link href={`/dashboard/prospects/${p.id}#logo`} className="knop-tekst">Niet gebruiken</Link>
                  </div>
                  {sp.bron && <p className="mt-2 break-all text-[12px] text-warm">Bron: {sp.bron}</p>}
                </div>
              )}

              {alt.length > 0 && (
                <div className="mt-3">
                  <p className="veld-label">Andere afbeeldingen op de site</p>
                  <ul className="flex flex-wrap gap-2">
                    {alt.map((a) => (
                      <li key={a}>
                        <form action={haalLogoVanBronActie} className="flex items-center gap-2 rounded border border-line bg-white p-1.5">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="bron" value={a} />
                          {alt.filter((x) => x !== a).map((x) => <input key={x} type="hidden" name="alt" value={x} />)}
                          {sp.bron && <input type="hidden" name="alt" value={sp.bron} />}
                          {/* Extern plaatje alleen als voorbeeld; opslaan gebeurt pas na de veilige download. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a} alt="" referrerPolicy="no-referrer" className="h-10 w-20 object-contain" />
                          <VerzendKnop className="knop-stil" bezigTekst="Ophalen…">Probeer deze</VerzendKnop>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <form action={haalLogoVanWebsiteActie} className="flex flex-col gap-1">
                  <input type="hidden" name="id" value={p.id} />
                  <VerzendKnop className="knop-donker self-start" disabled={!p.website} bezigTekst="Logo zoeken… (max. 15 sec)">Logo ophalen van website</VerzendKnop>
                  <p className="veld-hint">{p.website ? `Zoekt op ${p.website}. Duurt tot 15 seconden.` : 'Vul eerst een website in.'}</p>
                </form>
                <form action={uploadLogoActie} className="flex flex-col gap-1">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="file" name="logo" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" required className="text-[13px]" />
                  <VerzendKnop className="knop-stil self-start" bezigTekst="Uploaden…">Logo uploaden</VerzendKnop>
                  <p className="veld-hint">png, jpg, webp of svg, maximaal 4 MB. Liefst met transparante achtergrond.</p>
                </form>
              </div>

              <form action={zetHuisstijlKleurActie} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={p.id} />
                <div>
                  <label className="veld-label" htmlFor="kleur">Huisstijlkleur</label>
                  <input id="kleur" type="color" name="kleur" defaultValue={rij.huisstijl_kleur ?? '#1c1c1c'} className="h-9 w-16 cursor-pointer rounded border border-line" />
                </div>
                <button className="knop-stil">Kleur opslaan</button>
                {rij.huisstijl_kleur && (
                  <button name="wissen" value="1" className="knop-tekst">Kleur wissen</button>
                )}
                <span className="veld-hint">{rij.huisstijl_kleur ? `Nu: ${rij.huisstijl_kleur}` : 'Nog niet ingesteld.'} Het voorbeeldportaal gebruikt deze kleur.</span>
              </form>
            </section>

            {/* Mockup-artikelen */}
            <section id="artikelen" className="panel scroll-mt-20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-ink-900">Kleding op de pagina</h2>
                <span className={mockup?.handmatig ? 'badge-actie' : 'badge-rust'}>{mockup?.handmatig ? 'Zelf gekozen' : `Automatisch (${BRANCHE_LABELS[brancheGroep(p.branche)]})`}</span>
              </div>
              {mockup && mockup.artikelen.length === 0 && (
                <p className="mt-2 text-[13px] text-warm">Geen artikelen met foto gevonden. Zoek hieronder zelf een artikel.</p>
              )}
              <ol className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {(mockup?.artikelen ?? []).map((a, i) => (
                  <li key={`${a.productId}-${i}`} className={`rounded-md border bg-white p-2 ${plek === i && sp.artikelzoek !== undefined ? 'border-amber-500' : 'border-line'}`}>
                    <LogoOpKleding fotoUrl={a.fotoUrl} alt={a.naam} logoUrl={rij.logo_url} bedrijfsnaam={p.bedrijfsnaam} positie={a.logoPositie} className="aspect-square" />
                    <p className="mt-2 text-[12px] font-semibold leading-tight text-ink-900">{a.merk ? `${a.merk} ` : ''}{a.naam}</p>
                    <p className="text-[12px] text-warm">{a.prijs != null ? `vanaf ${euro.format(a.prijs)}` : 'geen prijs'}</p>
                    {(mockup?.kleuren[a.productId]?.length ?? 0) > 0 && (
                      <form action={zetMockupArtikelActie} className="mt-1.5 flex gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="plek" value={i} />
                        <input type="hidden" name="productId" value={a.productId} />
                        <select name="kleur" defaultValue={a.kleur ?? ''} aria-label="Kleur" className="veld py-1 text-[12px]">
                          {!a.kleur && <option value="">Hoofdfoto</option>}
                          {mockup?.kleuren[a.productId]?.map((k) => <option key={k} value={k}>{toonKleur(k)}</option>)}
                        </select>
                        <button className="knop-stil px-2 text-[12px]">Zet</button>
                      </form>
                    )}
                    <Link href={`/dashboard/prospects/${p.id}?plek=${i}&artikelzoek=#artikelen`} className="mt-1 inline-block text-[12px] font-semibold text-amber-700 hover:text-amber-800">Ander artikel</Link>
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex flex-wrap items-end gap-2">
                {/* Plek kiezen verstuurt meteen; de zoekterm reist mee. */}
                <form method="get">
                  <span className="veld-label" aria-hidden="true">Plek</span>
                  <AutoSubmitSelect
                    name="plek"
                    aria-label="Plek"
                    defaultValue={String(plek)}
                    options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: String(n + 1) }))}
                    className="veld"
                  />
                  <input type="hidden" name="artikelzoek" value={sp.artikelzoek ?? ''} />
                </form>
                {/* Zoekt live terwijl je typt; de gekozen plek blijft staan. */}
                <LiveZoekveld
                  param="artikelzoek"
                  label="Zoek in de catalogus"
                  placeholder="Bijv. softshell, polo, Snickers, koksbuis"
                  breedte="grow min-w-[14rem]"
                  leegBehouden
                />
              </div>
              {sp.artikelzoek && sp.artikelzoek.trim().length >= 2 && (
                zoekResultaten.length === 0 ? (
                  <p className="mt-3 text-[13px] text-warm">Niets gevonden met een foto voor &quot;{sp.artikelzoek}&quot;.</p>
                ) : (
                  <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {zoekResultaten.map((z) => {
                      const kleuren = z.kleurenMetFoto.length ? z.kleurenMetFoto : z.kleuren;
                      return (
                        <li key={z.id} className="flex gap-2 rounded-md border border-line p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {z.foto && <img src={z.foto} alt="" className="h-16 w-16 shrink-0 object-contain" />}
                          <form action={zetMockupArtikelActie} className="flex min-w-0 grow flex-col gap-1">
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="plek" value={plek} />
                            <input type="hidden" name="productId" value={z.id} />
                            <p className="truncate text-[13px] font-semibold text-ink-900">{z.merk ? `${z.merk} ` : ''}{z.naam}</p>
                            <p className="text-[11px] text-warm">{z.categorie ?? ''}{z.kleurenMetFoto.length ? ` · ${z.kleurenMetFoto.length} ${z.kleurenMetFoto.length === 1 ? 'kleur' : 'kleuren'} met foto` : ''}</p>
                            <div className="flex gap-1">
                              <select name="kleur" aria-label="Kleur" className="veld py-1 text-[12px]">
                                <option value="">Hoofdfoto</option>
                                {kleuren.map((k) => <option key={k} value={k}>{toonKleur(k)}</option>)}
                              </select>
                              <button className="knop-primair whitespace-nowrap px-2 text-[12px]">Op plek {plek + 1}</button>
                            </div>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}
              {mockup?.handmatig && (
                <form action={resetMockupActie} className="mt-4">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="knop-tekst">Terug naar automatische keuze</button>
                </form>
              )}
            </section>

            {/* Tijdlijn */}
            <section className="panel p-4">
              <h2 className="font-display text-base font-bold text-ink-900">Tijdlijn</h2>
              {bezoeken.length === 0 ? (
                <p className="mt-2 text-[13px] text-warm">Nog geen bezoeken. Zodra de QR-code gescand wordt zie je het hier, en staat er een beltaak klaar.</p>
              ) : (
                <ol className="mt-3 space-y-1.5">
                  {bezoeken.map((b) => {
                    const l = SOORT_LABEL[b.soort] ?? { tekst: b.soort, cls: 'badge-rust' };
                    return (
                      <li key={b.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="w-36 shrink-0 tabular-nums text-warm">{fmtDatum(b.created_at, true)}</span>
                        <span className={l.cls}>{l.tekst}</span>
                        {b.pad && <span className="truncate text-[12px] text-ink-400">{b.pad.replace(/[0-9a-f]{10}/i, '…')}</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        ) : (
          <div className="panel p-4 text-[13px] text-warm">Deze prospect heeft nog geen token. Draai de prospect-migratie in Supabase.</div>
        )}
      </div>
    </main>
  );
}
