import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar, kmsAdmin } from '@/lib/kms/adminClient';
import Drawer from '@/components/dashboard/Drawer';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { aanbrengingenVan, berekenStanden, grootboekVan, laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import { listBeloningen, listKlantKeuzes } from '@/lib/kms/sparenData';
import { niveauVoordelen } from '@/lib/kms/sparenTypes';
import {
  boekHandmatigActie,
  kenRegelToeActie,
  mailOverzichtActie,
  nieuweInwisselingActie,
  registreerAanbrengingActie,
  zetKlantkortingActie,
} from '../../actions';
import { Meldingen, MigratieBanner, NiveauBadge, NiveauVoortgang, StatusBadge, datumKort, euro0, euro2, getal } from '../../_ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sparen: klant', robots: { index: false, follow: false } };

const SOORT_LABEL: Record<string, string> = {
  per_euro: 'Order',
  niveau_bonus: 'Niveaubonus',
  drempel_bonus: 'Grote order',
  eerste_order: 'Eerste order',
  nabestellen: 'Nabestellen',
  periode_actie: 'Actie',
  jubileum: 'Jaren klant',
  aanbrengen: 'Aangebracht',
  review: 'Review',
  handmatig: 'Handmatig',
  verval: 'Verval',
};

export default async function SparenKlant({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fout?: string; melding?: string; alles?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { id } = await params;
  const { fout, melding, alles } = await searchParams;

  const b = await laadEnSynchroniseer(id);
  const stand = berekenStanden(b).find((s) => s.organisatieId === id);
  if (!stand) notFound();

  const sb = kmsAdmin();
  const [{ beloningen }, klanten, orgExtra] = await Promise.all([
    listBeloningen(),
    listKlantKeuzes(),
    sb
      ? sb.from('organisaties').select('korting_pct, telefoon, mobiel, contactpersoon, email_algemeen, factuur_email').eq('id', id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const extra = orgExtra.data as {
    korting_pct: number | null;
    telefoon: string | null;
    mobiel: string | null;
    contactpersoon: string | null;
    email_algemeen: string | null;
    factuur_email: string | null;
  } | null;

  const basis = b.instellingen.niveauBasis;
  const boek = grootboekVan(b, id);
  const zichtbaar = alles ? boek : boek.slice(0, 40);
  const aanbrengingen = aanbrengingenVan(b);
  const handmatigeRegels = b.regels.filter((r) => r.actief && r.soort === 'review');
  const aanbrengRegel = b.regels.find((r) => r.actief && r.soort === 'aanbrengen');
  const inwisselbaar = beloningen.filter((x) => x.actief);
  const huidig = stand.niveau.huidig;
  const voordelen = niveauVoordelen(huidig);
  const klantKorting = Number(extra?.korting_pct ?? 0);
  const terugPad = `/dashboard/sparen/klanten/${id}`;
  const andereKlanten = klanten.filter((k) => k.id !== id);

  return (
    <div className="pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/dashboard/sparen/klanten" className="text-[12px] font-semibold text-warm hover:text-ink-900">&larr; Alle spaarders</Link>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 font-display text-lg font-bold text-ink-900">
            {stand.naam}
            <NiveauBadge niveau={huidig} />
          </h2>
          <p className="text-[12px] text-warm">
            {[stand.plaats, extra?.contactpersoon, extra?.telefoon || extra?.mobiel].filter(Boolean).join(' · ')}
            {' · '}
            <Link href={`/dashboard/klanten/${id}`} className="underline-offset-2 hover:underline">Klantkaart</Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Drawer knop="Punten boeken" titel="Punten bijboeken of corrigeren" beschrijving="Elke boeking komt met reden en naam in de historie." knopKlasse="knop-stil" breedte="sm:max-w-lg">
            <form action={boekHandmatigActie} className="space-y-4">
              <input type="hidden" name="organisatie_id" value={id} />
              <input type="hidden" name="terug" value={terugPad} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="veld-label" htmlFor="richting">Soort</label>
                  <select id="richting" name="richting" className="veld" defaultValue="bij">
                    <option value="bij">Bijboeken</option>
                    <option value="af">Afboeken</option>
                  </select>
                </div>
                <div>
                  <label className="veld-label" htmlFor="punten">Punten</label>
                  <input id="punten" name="punten" type="number" min="1" step="1" required className="veld" />
                </div>
              </div>
              <div>
                <label className="veld-label" htmlFor="reden">Reden</label>
                <input id="reden" name="reden" required maxLength={500} className="veld" placeholder="Bijv. compensatie late levering order 1042" />
              </div>
              <VerzendKnop className="knop-donker">Boeken</VerzendKnop>
            </form>
          </Drawer>
          {handmatigeRegels.length > 0 && (
            <Drawer knop="Review toekennen" titel="Punten voor een review" beschrijving="Ken toe zodra je de review hebt gezien." knopKlasse="knop-stil" breedte="sm:max-w-lg">
              <form action={kenRegelToeActie} className="space-y-4">
                <input type="hidden" name="organisatie_id" value={id} />
                <input type="hidden" name="terug" value={terugPad} />
                <div>
                  <label className="veld-label" htmlFor="regel_id">Regel</label>
                  <select id="regel_id" name="regel_id" className="veld">
                    {handmatigeRegels.map((r) => (
                      <option key={r.id} value={r.id}>{r.naam} ({getal(r.punten)} punten)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="veld-label" htmlFor="notitie">Notitie</label>
                  <input id="notitie" name="notitie" className="veld" placeholder="Bijv. Google-review van 3 oktober, 5 sterren" />
                </div>
                <VerzendKnop className="knop-donker">Toekennen</VerzendKnop>
              </form>
            </Drawer>
          )}
          <Drawer knop="Klant aangebracht" titel={`${stand.naam} bracht een klant aan`} knopKlasse="knop-stil" breedte="sm:max-w-lg">
            {aanbrengRegel ? (
              <form action={registreerAanbrengingActie} className="space-y-4">
                <input type="hidden" name="organisatie_id" value={id} />
                <input type="hidden" name="terug" value={terugPad} />
                <p className="text-[13px] text-warm">Levert {getal(aanbrengRegel.punten)} punten op voor {stand.naam}.</p>
                <div>
                  <label className="veld-label" htmlFor="nieuwe_organisatie_id">Nieuwe klant</label>
                  <select id="nieuwe_organisatie_id" name="nieuwe_organisatie_id" className="veld" defaultValue="">
                    <option value="">Staat nog niet in het systeem</option>
                    {andereKlanten.map((k) => (
                      <option key={k.id} value={k.id}>{k.naam}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="veld-label" htmlFor="nieuwe_naam">Of de naam</label>
                  <input id="nieuwe_naam" name="nieuwe_naam" className="veld" placeholder="Bijv. Bouwbedrijf Te Brake" />
                </div>
                <div>
                  <label className="veld-label" htmlFor="moment">Wanneer punten geven</label>
                  <select id="moment" name="moment" className="veld" defaultValue="eerste_order">
                    <option value="eerste_order">Na de eerste order van de nieuwe klant</option>
                    <option value="direct">Direct</option>
                  </select>
                  <p className="veld-hint">Na de eerste order is gebruikelijk: dan beloon je echte klanten, geen namen.</p>
                </div>
                <div>
                  <label className="veld-label" htmlFor="notitie_aanbreng">Notitie</label>
                  <input id="notitie_aanbreng" name="notitie" className="veld" />
                </div>
                <VerzendKnop className="knop-donker">Vastleggen</VerzendKnop>
              </form>
            ) : (
              <p className="text-[13px] text-warm">
                De regel &quot;Klant aangebracht&quot; staat uit. <Link href="/dashboard/sparen/regels" className="font-semibold text-ink-900 underline">Zet hem aan bij Regels</Link>.
              </p>
            )}
          </Drawer>
          <Drawer knop="Inwisselen" titel={`Inwisselen voor ${stand.naam}`} beschrijving={`Beschikbaar: ${getal(stand.saldo)} punten.`} breedte="sm:max-w-lg">
            <form action={nieuweInwisselingActie} className="space-y-4">
              <input type="hidden" name="organisatie_id" value={id} />
              <input type="hidden" name="terug" value={terugPad} />
              <div>
                <label className="veld-label" htmlFor="beloning_id">Beloning</label>
                <select id="beloning_id" name="beloning_id" className="veld" defaultValue="">
                  <option value="">Vrij aantal punten als korting</option>
                  {inwisselbaar.map((x) => (
                    <option key={x.id} value={x.id} disabled={x.puntenPrijs > stand.saldo}>
                      {x.naam}, {getal(x.puntenPrijs)} punten{x.puntenPrijs > stand.saldo ? ' (te weinig punten)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="veld-label" htmlFor="punten_vrij">Punten (alleen bij vrij aantal)</label>
                <input id="punten_vrij" name="punten" type="number" min="1" max={Math.max(1, stand.saldo)} step="1" className="veld" />
                <p className="veld-hint">1 punt = {euro2(b.instellingen.euroPerPunt)}.</p>
              </div>
              <div>
                <label className="veld-label" htmlFor="notitie_inw">Notitie</label>
                <input id="notitie_inw" name="notitie" className="veld" />
              </div>
              <p className="text-[12px] text-warm">Wordt meteen goedgekeurd. Korting komt op een open conceptfactuur als die er is, anders krijg je een taak.</p>
              <VerzendKnop className="knop-donker" disabled={stand.saldo <= 0}>Inwisselen</VerzendKnop>
            </form>
          </Drawer>
        </div>
      </div>

      <Meldingen fout={fout} melding={melding} />
      <MigratieBanner toon={!b.loyaliteit} />

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <section className="panel p-4">
          <p className="text-[12px] font-medium text-warm">Saldo</p>
          <p className="mt-1 font-display text-[28px] font-bold leading-none tabular-nums text-ink-900">
            {getal(stand.saldo)} <span className="text-[14px] font-semibold text-warm">punten</span>
          </p>
          <p className="mt-1 text-[13px] text-ink-700">Waarde {euro2(stand.euroWaarde)}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[12px]">
            <div><dt className="text-warm">Gespaard</dt><dd className="font-semibold tabular-nums text-ink-900">{getal(stand.verdiend)}</dd></div>
            <div><dt className="text-warm">Ingewisseld</dt><dd className="font-semibold tabular-nums text-ink-900">{getal(stand.ingewisseld)}</dd></div>
            <div><dt className="text-warm">Vervallen</dt><dd className="font-semibold tabular-nums text-ink-900">{getal(stand.vervallen)}</dd></div>
          </dl>
          {stand.gereserveerd > 0 && <p className="mt-3 text-[12px] text-warm">{getal(stand.gereserveerd)} punten zitten in een lopende aanvraag.</p>}
          {stand.vervaltBinnenkort > 0 && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              {getal(stand.vervaltBinnenkort)} punten vervallen op {datumKort(stand.vervaltOp)}.
            </p>
          )}
          <form action={mailOverzichtActie} className="mt-3">
            <input type="hidden" name="organisatie_id" value={id} />
            <input type="hidden" name="terug" value={terugPad} />
            <VerzendKnop className="knop-tekst -ml-2" bezigTekst="Mailen">
              Spaaroverzicht mailen{extra?.email_algemeen || extra?.factuur_email ? ` naar ${extra?.email_algemeen || extra?.factuur_email}` : ''}
            </VerzendKnop>
          </form>
        </section>

        <section className="panel p-4">
          <p className="text-[12px] font-medium text-warm">Niveau</p>
          <div className="mt-1 flex items-center gap-2">
            <NiveauBadge niveau={huidig} />
            <span className="text-[12px] text-warm">
              {basis === 'punten' ? `${getal(stand.punten12m)} punten` : euro0(stand.omzet12m)} in 12 maanden
            </span>
          </div>
          <div className="mt-3"><NiveauVoortgang stand={stand.niveau} basis={basis} /></div>
          {stand.niveau.huidig && (stand.niveau.straks?.drempel ?? -1) < stand.niveau.huidig.drempel && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Zonder nieuwe bestelling zakt deze klant binnen 60 dagen naar {stand.niveau.straks?.naam ?? 'geen niveau'}.
            </p>
          )}
          {voordelen.length > 0 ? (
            <ul className="mt-3 space-y-1 text-[13px] text-ink-800">
              {voordelen.map((v) => (
                <li key={v} className="flex gap-2"><span aria-hidden className="text-amber-600">&bull;</span>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12px] text-warm">Geen extra voordelen op dit niveau.</p>
          )}
          {huidig && huidig.kortingPct !== klantKorting && (
            <form action={zetKlantkortingActie} className="mt-3 rounded-md border border-line bg-mist px-3 py-2 text-[12px] text-ink-700">
              <input type="hidden" name="organisatie_id" value={id} />
              <input type="hidden" name="korting_pct" value={huidig.kortingPct} />
              <input type="hidden" name="terug" value={terugPad} />
              <p>
                Klantkorting staat op {klantKorting.toLocaleString('nl-NL')}%, het niveau geeft {huidig.kortingPct.toLocaleString('nl-NL')}%.
              </p>
              <VerzendKnop className="knop-stil mt-2">Zet klantkorting op {huidig.kortingPct.toLocaleString('nl-NL')}%</VerzendKnop>
            </form>
          )}
        </section>

        <section className="panel p-4">
          <p className="text-[12px] font-medium text-warm">Aangebracht door {stand.naam}</p>
          {aanbrengingen.length === 0 ? (
            <p className="mt-2 text-[13px] text-warm">Nog geen klanten aangebracht. Vraag het eens: tevreden klanten kennen vaak collega-ondernemers.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line text-[13px]">
              {aanbrengingen.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate text-ink-900">{a.nieuweNaamWeergave}</span>
                  <span className={a.status === 'beloond' ? 'badge-klaar' : a.status === 'wacht' ? 'badge-actie' : 'badge-rust'}>
                    {a.status === 'beloond' ? `+${getal(a.punten)}` : a.status === 'wacht' ? 'wacht op order' : 'vervallen'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[12px] font-medium text-warm">Orders</p>
          <p className="text-[13px] text-ink-800">
            {getal(stand.aantalOrders)} {stand.aantalOrders === 1 ? 'order' : 'orders'}, laatste {datumKort(stand.laatsteOrder) || 'nog geen'}
          </p>
        </section>
      </div>

      <section className="panel mt-3" aria-labelledby="historie-kop">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
          <h3 id="historie-kop" className="font-display text-base font-bold text-ink-900">Puntenhistorie</h3>
          <span className="text-[12px] text-warm">{getal(boek.length)} boekingen</span>
        </div>
        {boek.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-warm">Nog geen boekingen. De eerste punten komen binnen met een order die een bedrag heeft.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Omschrijving</th>
                  <th>Soort</th>
                  <th className="num">Bij</th>
                  <th className="num">Af</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {zichtbaar.map((r) => {
                  const afgewezen = r.soort === 'inwisseling' && r.inwisselStatus === 'afgewezen';
                  return (
                    <tr key={`${r.soort}-${r.id}`} className={afgewezen ? 'opacity-50' : ''}>
                      <td className="stil whitespace-nowrap">{datumKort(r.datum)}</td>
                      <td>
                        <span className={afgewezen ? 'line-through' : 'text-ink-900'}>{r.omschrijving}</span>
                        {(r.reden || (r.door && r.door !== 'systeem')) && (
                          <span className="block text-[11px] text-warm">{[r.reden, r.door && r.door !== 'systeem' ? r.door : null].filter(Boolean).join(' · ')}</span>
                        )}
                      </td>
                      <td>
                        {r.soort === 'inwisseling' ? (
                          <StatusBadge status={r.inwisselStatus ?? 'verwerkt'} />
                        ) : r.soort === 'vervallen' ? (
                          <span className="badge-rust">Vervallen</span>
                        ) : (
                          <span className="badge-rust">{SOORT_LABEL[r.regelSoort ?? ''] ?? (r.punten > 0 ? 'Bij' : 'Af')}</span>
                        )}
                      </td>
                      <td className="num text-green-800">{r.punten > 0 ? `+${getal(r.punten)}` : ''}</td>
                      <td className="num text-ink-700">{r.punten < 0 ? getal(r.punten) : ''}</td>
                      <td className="num font-semibold text-ink-900">{getal(r.saldoNa)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!alles && boek.length > zichtbaar.length && (
          <div className="border-t border-line px-4 py-2.5">
            <Link href={`${terugPad}?alles=1`} className="knop-tekst -ml-2">Toon alle {getal(boek.length)} boekingen</Link>
          </div>
        )}
      </section>
    </div>
  );
}
