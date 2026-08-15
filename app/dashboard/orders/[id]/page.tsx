import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getOrder, ORDER_STATUSSEN, GOEDKEURING_STATUSSEN } from '@/lib/kms/orders';
import { listInkoopregelsVoorOrder } from '@/lib/kms/inkoop';
import { facturenVoorOrder } from '@/lib/kms/facturen';
import { listDrukproevenVoorOrder } from '@/lib/kms/drukproeven';
import { voegRegelToe, verwijderRegel, wijzigStatus, beslisGoedkeuring, maakInkoopregels, zetTrackTrace } from './actions';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import TotaalKaart from '@/components/dashboard/TotaalKaart';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order', robots: { index: false, follow: false } };

const inputCls = 'veld';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
const inkoopBadge: Record<string, string> = {
  te_bestellen: 'bg-amber-100 text-amber-800',
  besteld: 'bg-ink-100 text-ink-700',
  deels: 'bg-ink-100 text-ink-700',
  geleverd: 'bg-green-100 text-green-800',
};
const drukproefBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-700',
  verstuurd: 'bg-amber-100 text-amber-800',
  goedgekeurd: 'bg-green-100 text-green-800',
  afgekeurd: 'bg-red-100 text-red-700',
};

type VariantRij = { id: string; product_id: string; maat: string | null; kleur: string | null; verkoopprijs: number | null; meerprijs: number | null; voorraad: number };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/orders" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar orders</Link>
        </div>
      </main>
    );
  }

  const order = await getOrder(id);
  if (!order) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Order niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze order bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/orders" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar orders</Link>
        </div>
      </main>
    );
  }

  const [{ data: prodData }, { data: varData }, inkoopregels, facturen, drukproeven] = await Promise.all([
    sb.from('producten').select('id, naam').eq('actief', true).order('naam'),
    sb.from('product_varianten').select('id, product_id, maat, kleur, verkoopprijs, meerprijs, voorraad').eq('actief', true),
    listInkoopregelsVoorOrder(id),
    facturenVoorOrder(id),
    listDrukproevenVoorOrder(id),
  ]);
  const producten = (prodData as { id: string; naam: string }[]) ?? [];
  const varianten = (varData as VariantRij[]) ?? [];
  const variantData = JSON.stringify(varianten);

  const totaal = order.regels.reduce((t, r) => t + (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0), 0);

  // Inkoopwaarde van de order: de inkoopprijs van de gekozen varianten.
  // Regels zonder variant (vrije regels) tellen niet mee, dus de marge is
  // een indicatie zolang niet elke regel aan een variant hangt.
  const variantIds = order.regels.map((r) => r.variant_id).filter((v): v is string => !!v);
  const { data: inkoopData } = variantIds.length
    ? await sb.from('product_varianten').select('id, inkoopprijs').in('id', variantIds)
    : { data: [] as { id: string; inkoopprijs: number | null }[] };
  const inkoopPerVariant = new Map(((inkoopData as { id: string; inkoopprijs: number | null }[]) ?? []).map((v) => [v.id, Number(v.inkoopprijs) || 0]));
  const inkooptotaal = order.regels.reduce((t, r) => t + (Number(r.aantal) || 0) * (r.variant_id ? inkoopPerVariant.get(r.variant_id) ?? 0 : 0), 0);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">Order #{order.ordernummer}</h1>
          <p className="mt-1 text-sm text-warm">{order.organisatie_naam || 'Onbekende klant'}{order.medewerker_naam ? ` · ${order.medewerker_naam}` : ''} · {fmt(order.besteldatum)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {facturen.length > 0 ? (
            facturen.map((f) => (
              <Link key={f.id} href={`/dashboard/facturen/${f.id}`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">
                Factuur {f.factuurnummer || 'concept'}
              </Link>
            ))
          ) : (
            <Link href={`/dashboard/facturen?order=${order.id}`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Maak factuur</Link>
          )}
          <Link href={`/dashboard/orders/${order.id}/werkbon`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Werkbon</Link>
          <Link href={`/dashboard/orders/${order.id}/pakbon`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Pakbon</Link>
          <Link href={`/dashboard/orders/${order.id}/picklijst`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Picklijst</Link>
          <Link href={`/dashboard/orders/${order.id}/sticker`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Sticker</Link>
          <Link href="/dashboard/orders" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar orders</Link>
        </div>
      </div>

      {/* Werkblad links, financiën en acties in een meelopend spoor rechts. */}
      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
      <section>
        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Verzending (track en trace)</h2>
          <form action={zetTrackTrace} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label className="veld-label">Vervoerder</label>
              <input name="vervoerder" defaultValue={(order as unknown as { vervoerder: string | null }).vervoerder ?? ''} placeholder="Bijv. PostNL" className={inputCls} />
            </div>
            <div>
              <label className="veld-label">Track en trace-code</label>
              <input name="track_trace_code" defaultValue={(order as unknown as { track_trace_code: string | null }).track_trace_code ?? ''} placeholder="Code of link" className={inputCls} />
            </div>
            <button type="submit" className="knop-donker">Opslaan</button>
          </form>
        </div>
      </section>


      <section>
        <h2 className="font-display text-xl font-bold text-ink-900">Orderregels</h2>
          {order.regels.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen regels op deze order.</p>
          ) : (
            <div className="panel overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Maat / kleur</th>
                    <th>Aantal</th>
                    <th>Stukprijs</th>
                    <th>Totaal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {order.regels.map((r) => (
                    <tr key={r.id} className="border-b border-line">
                      <td className="font-semibold text-ink-900">{r.item_naam}</td>
                      <td className="text-warm">{[r.maat, r.kleur].filter(Boolean).join(' · ') || '-'}</td>
                      <td className="text-warm">{r.aantal}x</td>
                      <td className="text-warm">{r.stukprijs != null ? euro(Number(r.stukprijs)) : '-'}</td>
                      <td className="font-medium text-ink-900">{euro((Number(r.aantal) || 0) * (Number(r.stukprijs) || 0))}</td>
                      <td>
                        <form action={verwijderRegel}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="regelId" value={r.id} />
                          <ConfirmSubmit message="Deze orderregel verwijderen?" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijder</ConfirmSubmit>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-mist">
                    <td colSpan={4} className="text-right text-sm font-semibold text-warm">Totaal</td>
                    <td colSpan={2} className="text-sm font-extrabold text-ink-900">{euro(totaal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}


        <div className="panel p-4">
          <h3 className="font-display text-base font-bold text-ink-900">Regel toevoegen</h3>
          <form action={voegRegelToe} className="mt-4 flex flex-col gap-3" id="regelForm">
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label className="veld-label">Product</label>
              <select name="product_id" id="productSelect" className={inputCls}>
                <option value="">Vrije regel (geen product)</option>
                {producten.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="veld-label">Variant</label>
              <select name="variant_id" id="variantSelect" className={inputCls} disabled>
                <option value="">Kies eerst een product</option>
              </select>
            </div>
            <div>
              <label className="veld-label">Itemnaam</label>
              <input name="item_naam" id="itemNaam" required placeholder="Naam van het item" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="veld-label">Maat</label>
                <input name="maat" id="maatVeld" placeholder="Maat" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Kleur</label>
                <input name="kleur" id="kleurVeld" placeholder="Kleur" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="veld-label">Aantal</label>
                <input name="aantal" type="number" min="1" defaultValue="1" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Stukprijs</label>
                <input name="stukprijs" id="stukprijsVeld" inputMode="decimal" placeholder="bedrag" className={inputCls} />
              </div>
            </div>
            <button type="submit" className="self-start knop-donker">Regel toevoegen</button>
          </form>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){
                var V = ${variantData};
                var prods = {}; ${JSON.stringify(producten)}.forEach(function(p){ prods[p.id]=p.naam; });
                var ps = document.getElementById('productSelect');
                var vs = document.getElementById('variantSelect');
                var naam = document.getElementById('itemNaam');
                var maat = document.getElementById('maatVeld');
                var kleur = document.getElementById('kleurVeld');
                var prijs = document.getElementById('stukprijsVeld');
                function vulVarianten(){
                  var pid = ps.value;
                  vs.innerHTML='';
                  var lijst = V.filter(function(v){ return v.product_id===pid; });
                  if(!pid){ vs.disabled=true; var o=document.createElement('option'); o.value=''; o.textContent='Kies eerst een product'; vs.appendChild(o); return; }
                  vs.disabled=false;
                  var o0=document.createElement('option'); o0.value=''; o0.textContent='Kies een variant'; vs.appendChild(o0);
                  lijst.forEach(function(v){
                    var o=document.createElement('option'); o.value=v.id;
                    var label=[v.maat,v.kleur].filter(Boolean).join(' / ')||'standaard';
                    o.textContent=label+' (voorraad '+v.voorraad+')'; vs.appendChild(o);
                  });
                  if(prods[pid]) naam.value=prods[pid];
                }
                function vulVariant(){
                  var v = V.filter(function(x){ return x.id===vs.value; })[0];
                  if(!v) return;
                  maat.value=v.maat||''; kleur.value=v.kleur||'';
                  var p=(Number(v.verkoopprijs)||0)+(Number(v.meerprijs)||0);
                  prijs.value = p ? String(p) : '';
                }
                ps.addEventListener('change', vulVarianten);
                vs.addEventListener('change', vulVariant);
              })();`,
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-ink-900">Inkoopregels</h2>
        {inkoopregels.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen inkoopregels. Gebruik de knop Genereer inkoopregels hierboven.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Merk / leverancier</th>
                  <th>Maat / kleur</th>
                  <th>Aantal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inkoopregels.map((r) => (
                  <tr key={r.id} className="border-b border-line">
                    <td className="font-semibold text-ink-900">{r.item_naam || '-'}</td>
                    <td className="text-warm">{[r.merk, r.leverancier_naam].filter(Boolean).join(' · ') || '-'}</td>
                    <td className="text-warm">{[r.maat, r.kleur].filter(Boolean).join(' · ') || '-'}</td>
                    <td className="text-warm">{r.aantal}x{r.geleverd_aantal ? ` (${r.geleverd_aantal} geleverd)` : ''}</td>
                    <td>
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${inkoopBadge[r.status] ?? 'bg-ink-100 text-ink-600'}`}>{r.status.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-900">Drukproeven</h2>
          <Link href={`/dashboard/drukproeven?org=${order.organisatie_id}&order=${order.id}`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Drukproef maken</Link>
        </div>
        <p className="mt-1 text-sm text-warm">Een goedgekeurde drukproef zet deze order automatisch door naar borduren of bedrukken.</p>
        {drukproeven.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen drukproeven aan deze order gekoppeld.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {drukproeven.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 panel p-4">
                <div>
                  <p className="font-semibold text-ink-900">{d.naam}</p>
                  <p className="text-xs text-warm">{[d.techniek, d.positie].filter(Boolean).join(' · ')}</p>
                  {d.opmerking && (d.status === 'goedgekeurd' || d.status === 'afgekeurd') && (
                    <p className="mt-1 text-xs text-warm">Reactie klant: {d.opmerking}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${drukproefBadge[d.status] ?? 'bg-ink-100 text-ink-600'}`}>{d.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-16">
        <TotaalKaart
          regels={[{ label: 'Subtotaal', waarde: totaal }]}
          totaalLabel="Ordertotaal"
          totaal={totaal}
          marge={inkooptotaal > 0 ? Math.round((totaal - inkooptotaal) * 100) / 100 : null}
          toelichting="Op basis van de inkoopprijs van de gekozen varianten."
        />
        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Status</h2>
          <form action={wijzigStatus} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <select name="status" defaultValue={order.status} className={inputCls}>
              {ORDER_STATUSSEN.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <button type="submit" className="self-start knop-donker">Status opslaan</button>
          </form>
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Goedkeuring</h2>
          <p className="mt-1 text-xs text-warm">Huidig: <span className="font-semibold text-ink-900">{order.goedkeuring_status.replace(/_/g, ' ')}</span>{order.goedgekeurd_door ? ` (${order.goedgekeurd_door})` : ''}</p>
          <form action={beslisGoedkeuring} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <input name="door_wie" placeholder="Door wie" defaultValue={order.goedgekeurd_door ?? ''} className={inputCls} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" name="goedkeuring" value="goedgekeurd" className="rounded-md bg-ink-900 px-3 py-2 text-sm font-semibold text-white hover:bg-ink-800">Goedkeuren</button>
              <button type="submit" name="goedkeuring" value="afgewezen" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">Afwijzen</button>
              <button type="submit" name="goedkeuring" value="wacht" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">Wacht</button>
            </div>
            <div className="mt-1 text-xs text-warm">Mogelijk: {GOEDKEURING_STATUSSEN.join(', ').replace(/_/g, ' ')}</div>
          </form>
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Inkoop</h2>
          <p className="mt-1 text-xs text-warm">Genereer inkoopregels voor regels waar de voorraad tekortschiet.</p>
          <form action={maakInkoopregels} className="mt-3">
            <input type="hidden" name="orderId" value={order.id} />
            <button type="submit" className="knop-donker">Genereer inkoopregels</button>
          </form>
        </div>
      </aside>
      </div>

    </main>
  );
}
