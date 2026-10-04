import Kruimelpad from '@/components/dashboard/ui/Kruimelpad';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isLeadsDbConfigured } from '@/lib/env';
import { dashAuthed } from '@/lib/kms/adminClient';
import { getOrganisatie, getGebruikers, listItems, listBestellingen } from '@/lib/portaalAdmin';
import { listContactpersonen, listActiviteiten, getKlantVerkoop, listBranches, ACTIVITEIT_SOORTEN, type Contactpersoon } from '@/lib/kms/crm';
import { listLogos } from '@/lib/kms/logos';
import { listKlantAssortiment } from '@/lib/kms/assortiment';
import { listAfdelingen, listVestigingen } from '@/lib/kms/structuur';
import { listWerknemers, pasdagGegevens } from '@/lib/kms/werknemers';
import { werkOrganisatie, koppelGebruiker, voegItemToe, wisselItemActief, zetStatus, nieuwContact, werkContactActie, verwijderContactActie, contactNaarWerknemerActie, nieuweActiviteit, verwijderActiviteitActie, zetRetourenActiefActie } from './actions';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import Tabs, { type TabDef } from '@/components/dashboard/Tabs';
import Drawer from '@/components/dashboard/Drawer';
import PersoonKiezer from '@/components/dashboard/PersoonKiezer';
import { standaardInternePersoon } from '@/lib/kms/personen';
import InloglinkKnop from './InloglinkKnop';
import AssortimentBeheer from './AssortimentBeheer';
import WerknemersTab from './WerknemersTab';
import AfdelingenTab from './AfdelingenTab';
import InrichtingChecklist from './InrichtingChecklist';
import LogosTab from './LogosTab';
import DrukproevenTab from './DrukproevenTab';
import KoppelingenTab from './KoppelingenTab';
import { telDrukproevenVoorKlant } from '@/lib/kms/drukproeven';
import { inrichtingPunten, eersteOpenStap, wizardUrl, type InrichtingTelling } from '../_delen/inrichting';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klant', robots: { index: false, follow: false } };

const bestelStatussen = ['aangevraagd', 'bevestigd', 'geleverd'] as const;

/** Zelfde toegangsregel als de dashboard-layout: wachtwoord-cookie OF ingelogde admin. */
async function authed() {
  return dashAuthed();
}

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}
function fmtDatum(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

const SOORT_LABEL: Record<string, string> = {
  notitie: 'Notitie', telefoon: 'Telefoon', bezoek: 'Bezoek', offerte: 'Offerte', mail: 'Mail',
};

const inputCls = 'veld py-2 text-[15px]';

const TAB_IDS = ['gegevens', 'assortiment', 'werknemers', 'afdelingen', 'contact', 'verkoop', 'logos', 'drukproeven', 'koppelingen'];

export default async function KlantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; afdeling?: string; maten?: string; melding?: string }>;
}) {
  if (!(await authed())) redirect('/dashboard');
  const { id } = await params;
  const { tab, afdeling: afdelingParam, maten: matenParam, melding: meldingParam } = await searchParams;
  const startTab = tab && TAB_IDS.includes(tab) ? tab : 'gegevens';

  if (!isLeadsDbConfigured) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/klanten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar klanten</Link>
        </div>
      </main>
    );
  }

  const org = await getOrganisatie(id);
  if (!org) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Klant niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze klant bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/klanten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar klanten</Link>
        </div>
      </main>
    );
  }
  const retourenAan = (org as { retouren_actief?: boolean | null }).retouren_actief !== false;
  // Kolommen die select('*') meelevert maar niet in het type Organisatie staan.
  const orgExtra = org as unknown as {
    email_algemeen?: string | null;
    factuur_email?: string | null;
    kvk?: string | null;
    btw_nummer?: string | null;
  };

  const [gebruikers, items, bestellingen, contactpersonen, activiteiten, verkoop, logos, assortiment, werknemers, afdelingen, vestigingen, branches, standaardDoor] = await Promise.all([
    getGebruikers(id),
    listItems(id),
    listBestellingen(id),
    listContactpersonen(id),
    listActiviteiten(id),
    getKlantVerkoop(id),
    listLogos(id),
    listKlantAssortiment(id),
    listWerknemers(id),
    listAfdelingen(id),
    listVestigingen(id),
    listBranches(),
    standaardInternePersoon(),
  ]);
  const actieveWerknemers = werknemers.filter((w) => w.actief);
  const pasdag = await pasdagGegevens(id, actieveWerknemers);
  const afdelingKeuzes = afdelingen.map((a) => ({ id: a.id, naam: a.naam }));
  const hoofdcontact = contactpersonen.find((c) => c.hoofdcontact) ?? null;
  const facturatiecontact = contactpersonen.find((c) => c.facturatie) ?? null;
  // Filter op één afdeling (link 'Artikelen voor deze afdeling'), alleen als die bij deze klant hoort.
  const startGroep = afdelingParam && afdelingen.some((a) => a.id === afdelingParam) ? afdelingParam : '';

  const telling: InrichtingTelling = {
    contactpersonen: contactpersonen.length,
    // Ook goed: een factuur-e-mailadres op de klant (daar gaan facturen dan heen).
    facturatiecontact: Boolean(facturatiecontact) || Boolean(orgExtra.factuur_email?.trim()),
    afdelingen: afdelingen.length,
    werknemers: actieveWerknemers.length,
    assortiment: assortiment.length,
    portaalgebruikers: gebruikers.length,
  };
  const inrichting = inrichtingPunten(id, telling);

  // Wie van de contactpersonen al werknemer is of al kan inloggen (zelfde e-mail, anders zelfde naam).
  const werknemerSleutels = new Set(
    werknemers.flatMap((w) => [w.naam.trim().toLowerCase(), (w.email ?? '').trim().toLowerCase()]).filter(Boolean),
  );
  const isWerknemer = (c: Contactpersoon) =>
    c.email?.trim()
      ? werknemerSleutels.has(c.email.trim().toLowerCase())
      : werknemerSleutels.has(c.naam.trim().toLowerCase());
  const portaalMails = new Set(gebruikers.map((g) => (g.email ?? '').trim().toLowerCase()).filter(Boolean));

  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const isOpvolgingDue = (d: string | null) => {
    if (!d) return false;
    const dd = new Date(d); dd.setHours(0, 0, 0, 0);
    return dd.getTime() <= vandaag.getTime();
  };

  const gegevensTab = (
    <>
      <section>
        <h2 className="font-display text-xl font-bold text-ink-900">Gegevens</h2>
        <form action={werkOrganisatie} className="mt-4 grid gap-4 panel p-4 sm:grid-cols-2">
          <input type="hidden" name="orgId" value={id} />
          <div>
            <label className="veld-label" htmlFor="org-naam">Bedrijfsnaam</label>
            <input id="org-naam" name="naam" required defaultValue={org.naam} className={inputCls} />
          </div>
          <div>
            <label className="veld-label" htmlFor="org-branche">Branche</label>
            <input
              id="org-branche"
              name="branche"
              list="branche-suggesties"
              defaultValue={org.branche ?? ''}
              placeholder="Kies of typ een branche"
              autoComplete="off"
              className={inputCls}
            />
            <datalist id="branche-suggesties">
              {branches.map((b) => <option key={b} value={b} />)}
            </datalist>
            <p className="veld-hint">Kies bij voorkeur een bestaande branche, dan werkt het filter op de klantenlijst.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="veld-label">Adres</label>
            <input name="adres" defaultValue={org.adres ?? ''} placeholder="Straat en huisnummer" className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Postcode</label>
            <input name="postcode" defaultValue={org.postcode ?? ''} placeholder="0000 AA" className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Plaats</label>
            <input name="plaats" defaultValue={org.plaats ?? ''} placeholder="Plaats" className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Telefoon</label>
            <input name="telefoon" defaultValue={org.telefoon ?? ''} placeholder="06 12 34 56 78" className={inputCls} />
          </div>
          <div>
            <label className="veld-label" htmlFor="org-email">Algemeen e-mailadres</label>
            <input id="org-email" name="email_algemeen" type="email" defaultValue={orgExtra.email_algemeen ?? ''} placeholder="info@bedrijf.nl" className={inputCls} />
          </div>
          <div>
            <label className="veld-label" htmlFor="org-factuur">Factuur-e-mailadres</label>
            <input id="org-factuur" name="factuur_email" type="email" defaultValue={orgExtra.factuur_email ?? ''} placeholder="administratie@bedrijf.nl" className={inputCls} />
            <p className="veld-hint">Heeft een contactpersoon het vinkje Facturatie, dan gaan facturen naar die persoon.</p>
          </div>
          <div>
            <label className="veld-label" htmlFor="org-kvk">KvK</label>
            <input id="org-kvk" name="kvk" defaultValue={orgExtra.kvk ?? ''} inputMode="numeric" className={inputCls} />
          </div>
          <div>
            <label className="veld-label" htmlFor="org-btw">Btw-nummer</label>
            <input id="org-btw" name="btw_nummer" defaultValue={orgExtra.btw_nummer ?? ''} placeholder="NL..." className={inputCls} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="knop-donker">Gegevens opslaan</button>
          </div>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 panel p-4">
          <div>
            <p className="font-display text-base font-bold text-ink-900">Retouren via het portaal</p>
            <p className="mt-1 text-xs text-warm">{retourenAan ? 'Deze klant kan retouren aanmelden in het portaal.' : 'Retouren staan uit voor deze klant.'}</p>
          </div>
          <form action={zetRetourenActiefActie}>
            <input type="hidden" name="orgId" value={id} />
            <input type="hidden" name="aan" value={retourenAan ? 'false' : 'true'} />
            <button type="submit" className={`rounded-md px-4 py-2 text-sm font-semibold ${retourenAan ? 'border border-line text-ink-700 hover:bg-mist' : 'bg-ink-900 text-white hover:bg-ink-800'}`}>{retourenAan ? 'Retouren uitzetten' : 'Retouren aanzetten'}</button>
          </form>
        </div>
      </section>
    </>
  );

  const bestellingenSectie = (
    <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Bestellingen</h2>
        {bestellingen.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen herbestellingen.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {bestellingen.map((b) => (
              <div key={b.id} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{fmt(b.created_at)}</p>
                    <p className="text-sm text-warm">Aangevraagd door {b.aangevraagd_door || 'onbekend'}</p>
                    {(b.medewerker_naam || b.waarde != null) && (
                      <p className="text-sm text-warm">{b.medewerker_naam ? `Voor ${b.medewerker_naam}` : ''}{b.medewerker_naam && b.waarde != null ? ' · ' : ''}{b.waarde != null ? `waarde ${euro(Number(b.waarde))}` : ''}</p>
                    )}
                  </div>
                  <form action={zetStatus} className="flex items-center gap-2">
                    <input type="hidden" name="orgId" value={id} />
                    <input type="hidden" name="bestelId" value={b.id} />
                    <select name="status" defaultValue={b.status} className="rounded-md border border-line px-2 py-1 text-xs">
                      {bestelStatussen.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="submit" className="rounded-md bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
                  </form>
                </div>
                <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
                  {b.portaal_bestelregels.map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <span className="text-ink-900">{r.item_naam}{r.maat ? ` · maat ${r.maat}` : ''}</span>
                      <span className="text-warm">{r.aantal}x</span>
                    </li>
                  ))}
                </ul>
                {b.notitie && <p className="mt-3 whitespace-pre-wrap rounded-md bg-mist px-3 py-2 text-xs text-warm">{b.notitie}</p>}
              </div>
            ))}
          </div>
        )}
    </section>
  );

  const verkoopTab = (
    <>
      <section>
        <h2 className="font-display text-xl font-bold text-ink-900">Verkoopoverzicht</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-warm">Orders</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{verkoop.orders.length}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-warm">Facturen</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{verkoop.facturen.length}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-warm">Omzet (betaald)</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{euro(verkoop.omzetBetaald)}</p>
          </div>
        </div>
        {verkoop.herkomstLead && (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-3 text-sm text-warm">
            Aangebracht via: <span className="font-semibold text-ink-900">{verkoop.herkomstLead.bron || 'onbekende bron'}</span>
          </p>
        )}
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">Laatste orders</h3>
            {verkoop.orders.length === 0 ? (
              <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen orders.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line panel text-sm">
                {verkoop.orders.slice(0, 5).map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-ink-900">{o.ordernummer != null ? `#${o.ordernummer}` : 'order'} {"·"} {fmtDatum(o.besteldatum)}</span>
                    <span className="flex items-center gap-3 text-warm">
                      {o.bedrag != null && <span>{euro(Number(o.bedrag))}</span>}
                      <span className="inline-block rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-ink-700">{o.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">Laatste facturen</h3>
            {verkoop.facturen.length === 0 ? (
              <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen facturen.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line panel text-sm">
                {verkoop.facturen.slice(0, 5).map((f) => (
                  <li key={f.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-ink-900">{f.factuurnummer || 'factuur'} {"·"} {fmtDatum(f.factuurdatum)}</span>
                    <span className="flex items-center gap-3 text-warm">
                      {f.bedrag_incl != null && <span>{euro(Number(f.bedrag_incl))}</span>}
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${f.status === 'betaald' ? 'bg-green-100 text-green-800' : 'bg-mist text-ink-700'}`}>{f.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
      {bestellingenSectie}
    </>
  );

  function contactFormulier(c: Contactpersoon | null) {
    const sleutel = c?.id ?? 'nieuw';
    return (
      <form action={c ? werkContactActie : nieuwContact} className="flex flex-col gap-4">
        <input type="hidden" name="orgId" value={id} />
        {c && <input type="hidden" name="contactId" value={c.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="veld-label" htmlFor={`cp-naam-${sleutel}`}>Naam</label>
            <input id={`cp-naam-${sleutel}`} name="naam" required defaultValue={c?.naam ?? ''} placeholder="Naam" className={inputCls} />
          </div>
          <div>
            <label className="veld-label" htmlFor={`cp-functie-${sleutel}`}>Functie</label>
            <input id={`cp-functie-${sleutel}`} name="functie" defaultValue={c?.functie ?? ''} placeholder="Bijv. inkoop" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="veld-label" htmlFor={`cp-mail-${sleutel}`}>E-mail</label>
          <input id={`cp-mail-${sleutel}`} name="email" type="email" defaultValue={c?.email ?? ''} placeholder="naam@bedrijf.nl" className={inputCls} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="veld-label" htmlFor={`cp-tel-${sleutel}`}>Telefoon</label>
            <input id={`cp-tel-${sleutel}`} name="telefoon" defaultValue={c?.telefoon ?? ''} placeholder="0314 12 34 56" className={inputCls} />
          </div>
          <div>
            <label className="veld-label" htmlFor={`cp-mob-${sleutel}`}>Mobiel</label>
            <input id={`cp-mob-${sleutel}`} name="mobiel" defaultValue={c?.mobiel ?? ''} placeholder="06 12 34 56 78" className={inputCls} />
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-mist p-4">
          <label className="flex items-start gap-3 text-ink-900">
            <input name="hoofdcontact" type="checkbox" defaultChecked={c?.hoofdcontact ?? false} className="mt-0.5 h-5 w-5 rounded border-line" />
            <span>
              <span className="block font-semibold">Hoofdcontact</span>
              <span className="block text-[13px] text-warm">De vaste persoon met wie je afspraken maakt.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-ink-900">
            <input name="facturatie" type="checkbox" defaultChecked={c?.facturatie ?? false} className="mt-0.5 h-5 w-5 rounded border-line" />
            <span>
              <span className="block font-semibold">Facturatie</span>
              <span className="block text-[13px] text-warm">
                Facturen gaan naar het e-mailadres van deze persoon. Er is er maar één per klant: vink je dit aan, dan
                gaat het vinkje bij de vorige uit.
              </span>
            </span>
          </label>
        </div>
        <button type="submit" className="self-start knop-donker px-4 py-2.5 text-[15px]">{c ? 'Wijzigingen opslaan' : 'Toevoegen'}</button>
      </form>
    );
  }

  const contactTab = (
    <>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">Contactpersonen</h2>
          <Drawer knop="Contactpersoon toevoegen" titel="Contactpersoon toevoegen">
            {contactFormulier(null)}
          </Drawer>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="panel px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">Hoofdcontact</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink-900">{hoofdcontact ? hoofdcontact.naam : 'Nog niet gekozen'}</p>
            {hoofdcontact?.email && <p className="text-[13px] text-warm">{hoofdcontact.email}</p>}
          </div>
          <div className={`panel px-4 py-3 ${facturatiecontact ? '' : 'border-amber-300 bg-amber-50'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">Facturatiecontact</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink-900">{facturatiecontact ? facturatiecontact.naam : 'Nog niet gekozen'}</p>
            <p className="text-[13px] text-warm">
              {facturatiecontact
                ? facturatiecontact.email
                  ? `Facturen gaan naar ${facturatiecontact.email}`
                  : 'Let op: deze persoon heeft nog geen e-mailadres.'
                : 'Vink bij een contactpersoon Facturatie aan, dan gaan facturen naar diens e-mailadres.'}
            </p>
          </div>
        </div>

        {contactpersonen.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen contactpersonen.</p>
        ) : (
          <div className="panel mt-4 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Functie</th>
                  <th>E-mail</th>
                  <th>Telefoon</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contactpersonen.map((c) => (
                  <tr key={c.id} className="border-b border-line align-top">
                    <td className="font-semibold text-ink-900">
                      {c.naam}
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {c.hoofdcontact && <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">hoofdcontact</span>}
                        {c.facturatie && <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">facturatie</span>}
                        {isWerknemer(c) && <span className="badge-rust">ook werknemer</span>}
                        {c.email && portaalMails.has(c.email.trim().toLowerCase()) && <span className="badge-rust">kan inloggen</span>}
                      </span>
                    </td>
                    <td className="text-warm">{c.functie || '-'}</td>
                    <td className="text-warm">{c.email || '-'}</td>
                    <td className="text-warm">{[c.telefoon, c.mobiel].filter(Boolean).join(' · ') || '-'}</td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Drawer knop="Bewerken" titel={`Contactpersoon bewerken: ${c.naam}`} knopKlasse="knop-stil">
                          {contactFormulier(c)}
                        </Drawer>
                        {!isWerknemer(c) && (
                          <form action={contactNaarWerknemerActie}>
                            <input type="hidden" name="orgId" value={id} />
                            <input type="hidden" name="contactId" value={c.id} />
                            <button type="submit" className="knop-stil" title="Maakt een werknemer met dezelfde naam, e-mail en telefoon en opent meteen zijn maten">Maak werknemer</button>
                          </form>
                        )}
                        <form action={verwijderContactActie}>
                          <input type="hidden" name="orgId" value={id} />
                          <input type="hidden" name="contactId" value={c.id} />
                          <ConfirmSubmit message="Deze contactpersoon verwijderen?" className="knop-stil">Verwijderen</ConfirmSubmit>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[13px] text-warm">
          Contactpersonen zijn de mensen met wie je zaken doet. Wie kleding draagt, zet je op het tabblad Werknemers;
          met Maak werknemer neem je een contactpersoon daar in één klik over.
        </p>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">Activiteiten en opvolging</h2>
          <Drawer knop="Activiteit toevoegen" titel="Activiteit toevoegen">
            <form action={nieuweActiviteit} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={id} />
              <div>
                <label className="veld-label">Soort</label>
                <select name="soort" defaultValue="notitie" className={inputCls}>
                  {ACTIVITEIT_SOORTEN.map((s) => <option key={s} value={s}>{SOORT_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="veld-label">Omschrijving</label>
                <textarea name="omschrijving" required rows={3} placeholder="Wat is er gebeurd of afgesproken?" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Datum (mag leeg = vandaag)</label>
                <input name="datum" type="date" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Opvolgdatum (optioneel)</label>
                <input name="opvolgdatum" type="date" className={inputCls} />
              </div>
              <PersoonKiezer
                naam="door"
                label="Door"
                bron="intern"
                begin={standaardDoor ? { id: standaardDoor.id, soort: 'intern', naam: standaardDoor.naam } : undefined}
                hint="Collega's beheer je onder Taken, Instellingen."
              />
              <button type="submit" className="self-start knop-donker">Vastleggen</button>
            </form>
          </Drawer>
        </div>

        {activiteiten.length === 0 ? (
          <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen activiteiten vastgelegd.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {activiteiten.map((a) => {
              const due = isOpvolgingDue(a.opvolgdatum);
              return (
                <li key={a.id} className={`rounded-2xl border p-5 shadow-soft ${due ? 'border-amber-300 bg-amber-50' : 'border-line bg-white'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        <span className="mr-2 inline-block rounded-full bg-mist px-2.5 py-0.5 text-xs font-semibold text-ink-700">{SOORT_LABEL[a.soort] || a.soort}</span>
                        {fmtDatum(a.datum)}
                        {a.door && <span className="ml-2 font-normal text-warm">door {a.door}</span>}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-warm">{a.omschrijving}</p>
                      {a.opvolgdatum && (
                        <p className={`mt-2 text-xs font-semibold ${due ? 'text-amber-800' : 'text-warm'}`}>
                          Opvolgen op {fmtDatum(a.opvolgdatum)}{due ? ' (actie nodig)' : ''}
                        </p>
                      )}
                    </div>
                    <form action={verwijderActiviteitActie}>
                      <input type="hidden" name="orgId" value={id} />
                      <input type="hidden" name="activiteitId" value={a.id} />
                      <ConfirmSubmit message="Deze activiteit verwijderen?" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijderen</ConfirmSubmit>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="gebruikers" className="mt-12 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">Gebruikers</h2>
          <Drawer knop="E-mail koppelen" titel="E-mail koppelen">
            <form action={koppelGebruiker} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={id} />
              <div>
                <label className="veld-label">E-mail</label>
                <input name="email" type="email" required placeholder="naam@bedrijf.nl" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Naam</label>
                <input name="naam" placeholder="Naam" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-[13px] text-ink-800">
                <input type="checkbox" name="uitnodigen" defaultChecked />
                Stuur een uitnodiging per mail
              </label>
              <button type="submit" className="self-start knop-donker">Koppelen</button>
            </form>
          </Drawer>
        </div>
        {startTab === 'contact' && meldingParam && (
          <p className="mb-3 rounded-lg border border-line bg-mist px-4 py-2.5 text-[13px] font-semibold text-ink-800">{meldingParam}</p>
        )}

        {gebruikers.length === 0 ? (
          <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen gebruikers gekoppeld.</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>E-mail</th><th>Naam</th><th>Rol</th><th>Inloggen als</th></tr>
              </thead>
              <tbody>
                {gebruikers.map((g) => (
                  <tr key={g.id} className="border-b border-line">
                    <td className="font-medium text-ink-900">{g.email}</td>
                    <td className="text-warm">{g.naam || '-'}</td>
                    <td className="text-warm">{g.rol}</td>
                    <td>
                      <InloglinkKnop gebruikerId={g.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );

  const assortimentTab = (
    <>
      <section>
        <div className="max-w-3xl">
          <h2 className="font-display text-xl font-bold text-ink-900">Assortiment</h2>
          <p className="mt-1 text-[13px] text-warm">
            De artikelen die {org.naam} mag bestellen, met de vaste kleur erbij en hoe de werknemer ze krijgt:
            van het budget, met punten of een aantal gratis per periode. Dit is de lijst die het portaal en
            de passessie gebruiken, dus foto, maten en prijs komen recht uit de catalogus.
          </p>
        </div>
        <AssortimentBeheer key={startGroep || 'alles'} orgId={id} regels={assortiment} afdelingen={afdelingKeuzes} startGroep={startGroep} />
        <p className="mt-6 max-w-3xl text-[13px] text-warm">
          Bij elk artikel kies je of het voor de hele klant is of alleen voor bepaalde afdelingen, bijvoorbeeld
          laskleding alleen voor de lassers. Afdelingen maak je aan op het tabblad Afdelingen. Een werknemer ziet in het
          portaal de artikelen van de hele klant plus die van zijn eigen afdeling.
        </p>
      </section>

      <section className="mt-12">
        {/* Staat er nog geen assortiment maar wel een oude kledinglijn, dan klapt die
            open: anders lijkt het alsof het werk van vorig jaar verdwenen is. */}
        <details className="panel p-4" open={assortiment.length === 0 && items.length > 0}>
          <summary className="cursor-pointer font-display text-base font-bold text-ink-900">
            Kledinglijn: het losse notitielijstje{items.length > 0 ? ` (${items.length})` : ''}
          </summary>
          <p className="mt-2 max-w-3xl text-[13px] text-warm">
            Het verschil in het kort: in het assortiment hierboven kies je echte artikelen uit de catalogus,
            en dat is wat de klant kan bestellen. De kledinglijn is een lijstje dat je zelf typt, zonder
            koppeling aan een artikel, dus prijzen en maten kloppen daar niet vanzelf. Gebruik hem alleen om
            een oude afspraak of een schets van een kledingpakket te bewaren. Moet de klant het kunnen
            bestellen, zet het dan in het assortiment.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-bold text-ink-900">Items in de kledinglijn</h3>
            <Drawer knop="Item toevoegen" titel="Item toevoegen">
              <form action={voegItemToe} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="orgId" value={id} />
                <div>
                  <label className="veld-label">Naam</label>
                  <input name="naam" required placeholder="Bijv. Softshell jas" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Merk</label>
                  <input name="merk" placeholder="Merk" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Kleur</label>
                  <input name="kleur" placeholder="Kleur" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Logopositie</label>
                  <input name="logopositie" placeholder="Bijv. borst links" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Techniek</label>
                  <input name="techniek" placeholder="Bijv. borduren" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Richtprijs (mag leeg)</label>
                  <input name="richtprijs" inputMode="decimal" placeholder="bedrag" className={inputCls} />
                </div>
                <button type="submit" className="self-start knop-donker">Toevoegen</button>
              </form>
            </Drawer>
          </div>

          {items.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">
              Nog geen items in de kledinglijn. Voor artikelen die de klant echt kan bestellen gebruik je het
              assortiment hierboven; dit lijstje is alleen voor losse notities.
            </p>
          ) : (
            <div className="panel overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Merk / kleur</th>
                    <th>Logo</th>
                    <th>Richtprijs</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b border-line align-top">
                      <td className="font-semibold text-ink-900">{it.naam}</td>
                      <td className="text-warm">{[it.merk, it.kleur].filter(Boolean).join(' · ') || '-'}</td>
                      <td className="text-warm">{[it.logopositie, it.techniek].filter(Boolean).join(' · ') || '-'}</td>
                      <td className="text-warm">{it.richtprijs != null ? euro(Number(it.richtprijs)) : '-'}</td>
                      <td>
                        <form action={wisselItemActief} className="flex items-center gap-2">
                          <input type="hidden" name="orgId" value={id} />
                          <input type="hidden" name="itemId" value={it.id} />
                          <input type="hidden" name="actief" value={it.actief ? 'false' : 'true'} />
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${it.actief ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-500'}`}>{it.actief ? 'actief' : 'inactief'}</span>
                          <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">{it.actief ? 'Inactief' : 'Actief'}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </section>
    </>
  );

  // Logo's en drukproeven: eigen componenten (LogosTab.tsx, DrukproevenTab.tsx).
  const logosTab = <LogosTab orgId={id} orgNaam={org.naam} logos={logos} />;
  const drukproevenTab = <DrukproevenTab orgId={id} orgNaam={org.naam} />;
  const drukproefTelling = await telDrukproevenVoorKlant(id);

  // Assortiment staat vooraan na Gegevens: dit is het tabblad waar het dagelijkse
  // werk zit. De kledinglijn heeft geen eigen tabblad meer, die staat als klein
  // onderdeel onder het assortiment zodat het verschil meteen zichtbaar is.
  const werknemersTab = (
    <WerknemersTab
      orgId={id}
      orgNaam={org.naam}
      werknemers={werknemers}
      afdelingen={afdelingen}
      vestigingen={vestigingen}
      contactpersonen={contactpersonen}
      pasdag={pasdag}
      openWerknemerId={startTab === 'werknemers' ? matenParam ?? null : null}
      melding={startTab === 'werknemers' ? meldingParam ?? null : null}
    />
  );
  const afdelingenTab = (
    <AfdelingenTab
      orgId={id}
      afdelingen={afdelingen}
      vestigingen={vestigingen}
      werknemers={werknemers}
      assortiment={assortiment}
    />
  );

  const tabs: TabDef[] = [
    { id: 'gegevens', label: 'Gegevens', content: gegevensTab },
    { id: 'assortiment', label: 'Assortiment', content: assortimentTab, badge: assortiment.length || null },
    { id: 'werknemers', label: 'Werknemers', content: werknemersTab, badge: actieveWerknemers.length || null },
    { id: 'afdelingen', label: 'Afdelingen', content: afdelingenTab, badge: afdelingen.length || null },
    { id: 'contact', label: 'Contact', content: contactTab, badge: contactpersonen.length || null },
    { id: 'verkoop', label: 'Verkoop', content: verkoopTab, badge: verkoop.orders.length || null },
    { id: 'logos', label: "Logo's", content: logosTab, badge: logos.length || null },
    { id: 'drukproeven', label: 'Drukproeven', content: drukproevenTab, badge: drukproefTelling.totaal || null },
    { id: 'koppelingen', label: 'Koppelingen', content: <KoppelingenTab orgId={id} melding={startTab === 'koppelingen' ? meldingParam ?? null : null} /> },
  ];

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Kruimelpad />
          <h1 className="dash-h1">{org.naam}</h1>
          <p className="mt-1 text-sm text-warm">
            {[org.klantnummer ? `Klantnummer ${org.klantnummer}` : null, org.plaats || 'Geen plaats', org.branche].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/dashboard/klanten/${id}/structuur`} className="knop-stil">Inrichting</Link>
          <Link href={`/dashboard/offertes/nieuw?klant=${id}`} className="knop-primair">Nieuwe offerte</Link>
        </div>
      </div>

      <InrichtingChecklist orgId={id} punten={inrichting} wizardHref={wizardUrl(id, eersteOpenStap(telling))} />

      <div className="mt-8">
        {/* key: na opslaan stuurt de actie terug met ?tab=..., dan opent dat tabblad. */}
        <Tabs key={startTab} tabs={tabs} initial={startTab} />
      </div>
    </main>
  );
}
