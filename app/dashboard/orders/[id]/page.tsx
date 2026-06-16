import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getOrder, ORDER_STATUSSEN, GOEDKEURING_STATUSSEN } from '@/lib/kms/orders';
import { listInkoopregelsVoorOrder } from '@/lib/kms/inkoop';
import { voegRegelToe, verwijderRegel, wijzigStatus, beslisGoedkeuring, maakInkoopregels } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
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

type VariantRij = { id: string; product_id: string; maat: string | null; kleur: string | null; verkoopprijs: number | null; meerprijs: number | null; voorraad: number };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/orders" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar orders</Link>
        </div>
      </main>
    );
  }

  const order = await getOrder(id);
  if (!order) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Order niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze order bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/orders" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar orders</Link>
        </div>
      </main>
    );
  }

  const [{ data: prodData }, { data: varData }, inkoopregels] = await Promise.all([
    sb.from('producten').select('id, naam').eq('actief', true).order('naam'),
    sb.from('product_varianten').select('id, product_id, maat, kleur, verkoopprijs, meerprijs, voorraad').eq('actief', true),
    listInkoopregelsVoorOrder(id),
  ]);
  const producten = (prodData as { id: string; naam: string }[]) ?? [];
  const varianten = (varData as VariantRij[]) ?? [];
  const variantData = JSON.stringify(varianten);

  const totaal = order.regels.reduce((t, r) => t + (Number(r.aantal) || 0) * (Number(r.stukprijs) || 0), 0);

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Order #{order.ordernummer}</h1>
          <p className="mt-1 text-sm text-warm">{order.organisatie_naam || 'Onbekende klant'}{order.medewerker_naam ? ` · ${order.medewerker_naam}` : ''} · {fmt(order.besteldatum)}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/facturen?order=${order.id}`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Maak factuur</Link>
          <Link href={`/dashboard/orders/${order.id}/werkbon`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Werkbon</Link>
          <Link href="/dashboard/orders" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar orders</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-base font-bold text-ink-900">Status</h2>
          <form action={wijzigStatus} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <select name="status" defaultValue={order.status} className={inputCls}>
              {ORDER_STATUSSEN.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Status opslaan</button>
          </form>
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
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

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-base font-bold text-ink-900">Inkoop</h2>
          <p className="mt-1 text-xs text-warm">Genereer inkoopregels voor regels waar de voorraad tekortschiet.</p>
          <form action={maakInkoopregels} className="mt-3">
            <input type="hidden" name="orderId" value={order.id} />
            <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Genereer inkoopregels</button>
          </form>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Orderregels</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {order.regels.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen regels op deze order.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Maat / kleur</th>
                      <th className="px-4 py-3">Aantal</th>
                      <th className="px-4 py-3">Stukprijs</th>
                      <th className="px-4 py-3">Totaal</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.regels.map((r) => (
                      <tr key={r.id} className="border-b border-line">
                        <td className="px-4 py-3 font-semibold text-ink-900">{r.item_naam}</td>
                        <td className="px-4 py-3 text-warm">{[r.maat, r.kleur].filter(Boolean).join(' · ') || '-'}</td>
                        <td className="px-4 py-3 text-warm">{r.aantal}x</td>
                        <td className="px-4 py-3 text-warm">{r.stukprijs != null ? euro(Number(r.stukprijs)) : '-'}</td>
                        <td className="px-4 py-3 font-medium text-ink-900">{euro((Number(r.aantal) || 0) * (Number(r.stukprijs) || 0))}</td>
                        <td className="px-4 py-3">
                          <form action={verwijderRegel}>
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijder</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-mist">
                      <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-warm">Totaal</td>
                      <td colSpan={2} className="px-4 py-3 text-sm font-extrabold text-ink-900">{euro(totaal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h3 className="font-display text-base font-bold text-ink-900">Regel toevoegen</h3>
            <form action={voegRegelToe} className="mt-4 flex flex-col gap-3" id="regelForm">
              <input type="hidden" name="orderId" value={order.id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Product</label>
                <select name="product_id" id="productSelect" className={inputCls}>
                  <option value="">Vrije regel (geen product)</option>
                  {producten.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Variant</label>
                <select name="variant_id" id="variantSelect" className={inputCls} disabled>
                  <option value="">Kies eerst een product</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Itemnaam</label>
                <input name="item_naam" id="itemNaam" required placeholder="Naam van het item" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-warm">Maat</label>
                  <input name="maat" id="maatVeld" placeholder="Maat" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-warm">Kleur</label>
                  <input name="kleur" id="kleurVeld" placeholder="Kleur" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-warm">Aantal</label>
                  <input name="aantal" type="number" min="1" defaultValue="1" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-warm">Stukprijs</label>
                  <input name="stukprijs" id="stukprijsVeld" inputMode="decimal" placeholder="bedrag" className={inputCls} />
                </div>
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Regel toevoegen</button>
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
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Inkoopregels</h2>
        {inkoopregels.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen inkoopregels. Gebruik de knop Genereer inkoopregels hierboven.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Merk / leverancier</th>
                  <th className="px-4 py-3">Maat / kleur</th>
                  <th className="px-4 py-3">Aantal</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {inkoopregels.map((r) => (
                  <tr key={r.id} className="border-b border-line">
                    <td className="px-4 py-3 font-semibold text-ink-900">{r.item_naam || '-'}</td>
                    <td className="px-4 py-3 text-warm">{[r.merk, r.leverancier_naam].filter(Boolean).join(' · ') || '-'}</td>
                    <td className="px-4 py-3 text-warm">{[r.maat, r.kleur].filter(Boolean).join(' · ') || '-'}</td>
                    <td className="px-4 py-3 text-warm">{r.aantal}x{r.geleverd_aantal ? ` (${r.geleverd_aantal} geleverd)` : ''}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${inkoopBadge[r.status] ?? 'bg-ink-100 text-ink-600'}`}>{r.status.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
