'use client';
import { useEffect, useRef, useState } from 'react';
import { kleuren, kledingtypes, logoposities, broekposities, positiesVoor, teamgroottes, starterpakketten } from '@/content/configurator';
import { branches } from '@/content/branches';
import { Garment } from '@/components/Garments';
import { getHerkomst } from '@/lib/herkomst';
import { site } from '@/content/site';

type Status = 'idle' | 'sending' | 'ok' | 'error';
type Item = { id: number; type: string; kleur: number; positie: string; aantal: string };

const extrasOpties = [
  { id: 'schoenen', label: 'Veiligheidsschoenen' },
  { id: 'accessoires', label: 'Accessoires (muts, handschoenen)' },
];
const totaalStappen = 4;
const chip = 'cursor-pointer rounded-md border-2 px-4 py-2.5 text-sm font-semibold transition select-none';
const swatch = 'h-9 w-9 rounded-full border-2 transition';
const field = 'mt-1 w-full rounded-md border border-line bg-white px-4 py-3 text-sm text-ink-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

/** UTF-8-veilig base64 coderen en decoderen, zodat accenten en speciale tekens heel blijven. */
function encodeState(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function decodeState(s: string): unknown {
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}

function Preview({ type, kleur, logo, positie, techniek }: { type: string; kleur: number; logo: string | null; positie: string; techniek: string }) {
  const k = kleuren[kleur];
  return (
    <div className="relative mx-auto aspect-square w-full">
      <Garment type={type} color={k.hex} light={k.licht} logo={logo} pos={positie} techniek={techniek} />
    </div>
  );
}

export function PakketConfigurator({ defaultBranche = '', initialLogo = null, portaal }: {
  defaultBranche?: string;
  initialLogo?: string | null;
  portaal?: { onAanvraag: (p: { regels: { item_naam: string; kleur: string | null; aantal: number }[]; notitie: string }) => Promise<{ ok: boolean; error?: string }>; bedrijfsnaam?: string };
}) {
  const [step, setStep] = useState(0);
  const [branche, setBranche] = useState(defaultBranche);
  const [team, setTeam] = useState('');
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [logoNaam, setLogoNaam] = useState<string | null>(null);
  const [techniek, setTechniek] = useState<'borduren' | 'bedrukken'>('borduren');
  const [defPositie, setDefPositie] = useState('borst-links');
  const [draft, setDraft] = useState<{ type: string; kleur: number; positie: string; aantal: string }>({ type: 'polo', kleur: 0, positie: 'borst-links', aantal: '' });
  const [items, setItems] = useState<Item[]>([]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, { on: boolean; aantal: string }>>({});
  const [contact, setContact] = useState({ name: '', company: '', email: '', phone: '' });
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [gedeeld, setGedeeld] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailEmail, setMailEmail] = useState('');
  const [mailConsent, setMailConsent] = useState(false);
  const [mailStatus, setMailStatus] = useState<Status>('idle');
  const [mailError, setMailError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const allePosities = [...logoposities, ...broekposities];
  const typeLabel = (id: string) => kledingtypes.find((t) => t.id === id)?.label ?? id;
  const posLabel = (id: string) => allePosities.find((p) => p.id === id)?.label ?? id;
  const starter = starterpakketten[branche];

  // Hydrateren uit een gedeelde link (?p=...). Kapotte param negeren we stil.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('p');
      if (!p) return;
      const data = decodeState(p) as Partial<{
        branche: string; team: string; techniek: 'borduren' | 'bedrukken';
        defPositie: string; items: Item[]; extras: Record<string, { on: boolean; aantal: string }>;
      }>;
      if (typeof data.branche === 'string') setBranche(data.branche);
      if (typeof data.team === 'string') setTeam(data.team);
      if (data.techniek === 'borduren' || data.techniek === 'bedrukken') setTechniek(data.techniek);
      if (typeof data.defPositie === 'string') setDefPositie(data.defPositie);
      if (Array.isArray(data.items)) {
        setItems(data.items.map((i, n) => ({
          id: Date.now() + n,
          type: String(i.type),
          kleur: Number(i.kleur) || 0,
          positie: String(i.positie),
          aantal: String(i.aantal ?? ''),
        })));
      }
      if (data.extras && typeof data.extras === 'object') setExtras(data.extras);
    } catch {
      /* kapotte of verouderde link: gewoon leeg starten */
    }
  }, []);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) { setError('Logo is te groot (max 2 MB).'); return; }
    setError('');
    setLogoNaam(f.name);
    const r = new FileReader();
    r.onload = () => setLogo(typeof r.result === 'string' ? r.result : null);
    r.readAsDataURL(f);
  }
  function chooseType(id: string) {
    setLastAdded(null);
    setDraft((d) => {
      const valid = positiesVoor(id).some((p) => p.id === d.positie);
      return { ...d, type: id, positie: valid ? d.positie : positiesVoor(id)[0].id };
    });
  }
  function addItem() {
    setItems((p) => [...p, { id: Date.now(), ...draft }]);
    setLastAdded(typeLabel(draft.type));
    setDraft((d) => ({ ...d, aantal: '' }));
  }
  function removeItem(id: number) { setItems((p) => p.filter((i) => i.id !== id)); }
  function toggleExtra(id: string) { setExtras((p) => ({ ...p, [id]: { on: !p[id]?.on, aantal: p[id]?.aantal ?? '' } })); }

  function vulMetStarter() {
    if (!starter) return;
    const basis = Date.now();
    setItems(starter.map((s, n) => ({ id: basis + n, type: s.type, kleur: s.kleur, positie: s.positie, aantal: s.aantal })));
    setLastAdded(null);
  }

  function buildResumeUrl(): string {
    const payload = { branche, team, techniek, defPositie, items, extras };
    return `${window.location.origin}${window.location.pathname}?p=${encodeURIComponent(encodeState(payload))}`;
  }

  function buildBericht(): string {
    const kledingLijst = items.length
      ? items.map((i) => `- ${typeLabel(i.type)}, ${kleuren[i.kleur].name}, logo ${posLabel(i.positie).toLowerCase()}${i.aantal ? `, ${i.aantal}x` : ''}`).join('\n')
      : '- (nog geen kledingstukken toegevoegd)';
    const extraLijst = extrasOpties.filter((e) => extras[e.id]?.on).map((e) => `- ${e.label}${extras[e.id].aantal ? ` (${extras[e.id].aantal}x)` : ''}`).join('\n');
    return [
      'Pakket samengesteld via de configurator.',
      `Branche: ${branche || 'niet opgegeven'}`,
      `Teamgrootte: ${team || 'niet opgegeven'}`,
      `Logo: ${logo ? 'aangeleverd' : 'volgt later'}, techniek ${techniek}`,
      'Kledingstukken:', kledingLijst,
      ...(extraLijst ? ['Aanvullend:', extraLijst] : []),
    ].join('\n');
  }

  function svgNaarImage(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      try {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', '240');
        clone.setAttribute('height', '260');
        const xml = new XMLSerializer().serializeToString(clone);
        const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      } catch { resolve(null); }
    });
  }

  /** Rendert het ontwerp (de kledingstukken met logo) tot één gebrande PNG, voor in de e-mail. */
  async function genereerOntwerpPng(): Promise<string | null> {
    try {
      if (typeof document === 'undefined') return null;
      const doc = document.getElementById('ontwerp-doc');
      const svgs = doc ? Array.from(doc.querySelectorAll('svg')) : [];
      if (svgs.length === 0) return null;
      const labels = items.map((i) => ({
        titel: `${typeLabel(i.type)}${i.aantal ? ` (${i.aantal}x)` : ''}`,
        sub: `${kleuren[i.kleur].name}, logo ${posLabel(i.positie).toLowerCase()}`,
      }));
      const cols = Math.min(3, svgs.length);
      const cell = 230, pad = 28, headerH = 96, labelH = 52;
      const rows = Math.ceil(svgs.length / cols);
      const W = pad * 2 + cols * cell;
      const H = headerH + pad + rows * (cell + labelH);
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1c1c1c';
      ctx.fillRect(0, 0, W, headerH);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 28px Arial, sans-serif';
      ctx.fillText('FREDERIKS', pad, 46);
      ctx.fillStyle = '#ec6726';
      ctx.font = '700 12px Arial, sans-serif';
      ctx.fillText('B E D R I J F S K L E D I N G', pad, 66);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 15px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Jouw werkkledingontwerp', W - pad, 52);
      ctx.textAlign = 'left';
      const imgs = await Promise.all(svgs.map((s) => svgNaarImage(s as SVGSVGElement)));
      imgs.forEach((img, idx) => {
        const r = Math.floor(idx / cols), c = idx % cols;
        const x = pad + c * cell, y = headerH + pad + r * (cell + labelH);
        if (img) ctx.drawImage(img, x + 8, y, cell - 16, cell - 16);
        const m = labels[idx];
        if (m) {
          ctx.fillStyle = '#1c1c1c';
          ctx.font = '700 14px Arial, sans-serif';
          ctx.fillText(m.titel, x + 8, y + cell - 4);
          ctx.fillStyle = '#52504e';
          ctx.font = '12px Arial, sans-serif';
          ctx.fillText(m.sub, x + 8, y + cell + 14);
        }
      });
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  function buildRegels(): { item_naam: string; kleur: string | null; aantal: number }[] {
    const kleding = items.map((i) => ({
      item_naam: `${typeLabel(i.type)}, logo ${posLabel(i.positie).toLowerCase()} (${techniek})`,
      kleur: kleuren[i.kleur].name,
      aantal: Math.max(1, parseInt(i.aantal || '1', 10) || 1),
    }));
    const extra = extrasOpties.filter((e) => extras[e.id]?.on).map((e) => ({
      item_naam: e.label,
      kleur: null,
      aantal: Math.max(1, parseInt(extras[e.id].aantal || '1', 10) || 1),
    }));
    return [...kleding, ...extra];
  }

  async function submitPortaal() {
    if (!portaal) return;
    if (items.length === 0) { setError('Voeg eerst minstens één kledingstuk toe aan je pakket.'); return; }
    setStatus('sending'); setError('');
    try {
      const res = await portaal.onAanvraag({ regels: buildRegels(), notitie: buildBericht() });
      if (!res.ok) throw new Error(res.error ?? 'Er ging iets mis.');
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', { event_label: 'pakket-configurator-portaal' });
      setStatus('ok');
    } catch (e) { setStatus('error'); setError(e instanceof Error ? e.message : 'Onbekende fout'); }
  }

  async function mailOntwerp() {
    if (!mailEmail || !mailConsent) { setMailError('Vul je e-mailadres in en geef toestemming.'); return; }
    setMailStatus('sending'); setMailError('');
    const ontwerp = await genereerOntwerpPng();
    try {
      const res = await fetch('/api/ontwerp-mail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contact.name || '', email: mailEmail, bericht: buildBericht(), resumeUrl: buildResumeUrl(), ontwerp: ontwerp ?? '', bron: getHerkomst(), consent: true }),
      });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error ?? 'Er ging iets mis.'); }
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', { event_label: 'pakket-configurator-ontwerp-mail' });
      setMailStatus('ok');
    } catch (e) { setMailStatus('error'); setMailError(e instanceof Error ? e.message : 'Onbekende fout'); }
  }

  async function kopieerLink() {
    const url = buildResumeUrl();
    try {
      await navigator.clipboard.writeText(url);
      setGedeeld(true);
      setTimeout(() => setGedeeld(false), 2500);
    } catch {
      setError('Kopiëren lukte niet. Kopieer de link handmatig uit de adresbalk.');
    }
  }

  async function submit() {
    if (!contact.name || !contact.email || !consent) { setError('Vul je naam en e-mailadres in en geef toestemming.'); return; }
    setStatus('sending'); setError('');
    const bericht = buildBericht();
    const ontwerp = await genereerOntwerpPng();
    try {
      const res = await fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contact, branche, aantal: team, bericht, bron: getHerkomst(), consent: true, logo: logo ?? '', logoNaam: logoNaam ?? '', ontwerp: ontwerp ?? '' }),
      });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error ?? 'Er ging iets mis.'); }
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', { event_label: 'pakket-configurator' });
      setStatus('ok');
    } catch (e) { setStatus('error'); setError(e instanceof Error ? e.message : 'Onbekende fout'); }
  }

  if (status === 'ok') {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border-2 border-amber-500 bg-white p-8 text-center shadow-card">
        {portaal ? (
          <>
            <p className="font-display text-2xl font-extrabold text-ink-900">Je ontwerp staat klaar.</p>
            <p className="mt-3 text-warm">We hebben je ontwerpaanvraag als concept ontvangen. Frederiks werkt het uit tot producten, maten en een offerte, en neemt contact op. Je ziet de aanvraag terug bij Mijn bestellingen.</p>
            <a href="/portaal/bestellingen" className="btn-primary mt-5 inline-block">Naar mijn bestellingen</a>
          </>
        ) : (
          <>
            <p className="font-display text-2xl font-extrabold text-ink-900">Bedankt, {contact.name.split(' ')[0]}.</p>
            <p className="mt-3 text-warm">We hebben je samengestelde pakket binnen. We bellen je binnen een werkdag terug om het door te nemen en maken een offerte op maat. Je krijgt ook een bevestiging per e-mail.</p>
          </>
        )}
      </div>
    );
  }

  const next = () => setStep((s) => Math.min(totaalStappen - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const stapTitels = ['Voor wie', 'Je logo', 'Kleding', 'Aanvragen'];
  const kant = draft.type === 'werkbroek' ? 'Voorkant' : draft.positie === 'rug' ? 'Achterkant' : 'Voorkant';

  return (
    <div className="mx-auto max-w-4xl">
      {/* Bij printen verbergen we de wizard en tonen we het gebrande ontwerpdocument. */}
      <style>{`@media print { @page { margin: 12mm; } .no-print { display: none !important; } }`}</style>

      {/* Voortgang */}
      <div className="no-print print:hidden flex items-center gap-2">
        {Array.from({ length: totaalStappen }).map((_, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-amber-500' : 'bg-line'}`} />
            <p className={`mt-2 text-xs font-bold uppercase tracking-wide ${i === step ? 'text-amber-600' : 'text-warm'}`}>{i + 1}. {stapTitels[i]}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8 print:hidden">
        {step === 0 && (
          <div className="no-print">
            <h3 className="text-xl font-extrabold text-ink-900">Voor wie is de kleding?</h3>
            <p className="mt-1 text-sm text-warm">Zo stemmen we de modellen en het advies af op jouw werk.</p>
            <p className="mt-5 text-sm font-semibold text-ink-800">Branche</p>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {branches.map((b) => (
                <button key={b.slug} type="button" onClick={() => setBranche(b.navLabel)}
                  className={`${chip} ${branche === b.navLabel ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>{b.navLabel}</button>
              ))}
              <button type="button" onClick={() => setBranche('Anders')} className={`${chip} ${branche === 'Anders' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>Anders</button>
            </div>
            <p className="mt-6 text-sm font-semibold text-ink-800">Teamgrootte</p>
            <select className={`${field} max-w-xs`} value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">Kies een teamgrootte</option>
              {teamgroottes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        {step === 1 && (
          <div className="no-print grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-xl font-extrabold text-ink-900">Je logo en afwerking</h3>
              <p className="mt-1 text-sm text-warm">Upload je logo, dan zie je het zo op de kleding. Geen logo bij de hand? Sla over, je kunt het later aanleveren.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline px-4 py-2 text-[13px]">{logo ? 'Ander logo kiezen' : 'Upload je logo'}</button>
                {logo && <button type="button" onClick={() => { setLogo(null); setLogoNaam(null); }} className="text-sm text-warm hover:text-ink-800">Verwijderen</button>}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogo} className="hidden" />
              </div>
              <p className="mt-2 text-xs text-warm">Tip: een logo met transparante achtergrond (PNG of SVG) staat het mooist op gekleurde kleding.</p>
              <p className="mt-5 text-sm font-semibold text-ink-800">Techniek</p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {(['borduren', 'bedrukken'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTechniek(t)} className={`${chip} ${techniek === t ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>{t === 'borduren' ? 'Borduren' : 'Bedrukken'}</button>
                ))}
              </div>
              <p className="mt-5 text-sm font-semibold text-ink-800">Standaardpositie</p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {logoposities.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setDefPositie(p.id); setDraft((d) => ({ ...d, positie: p.id })); }} className={`${chip} ${defPositie === p.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-mist p-6">
              <Preview type={draft.type} kleur={draft.kleur} logo={logo} positie={defPositie} techniek={techniek} />
              <p className="mt-3 text-center text-xs text-warm">Voorbeeld met je logo. In de volgende stap kies je de kledingstukken.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="no-print grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-xl font-extrabold text-ink-900">Stel je kleding samen</h3>
              <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-warm">
                <li><span className="text-amber-600">1.</span> Stel een stuk samen</li>
                <li><span className="text-amber-600">2.</span> Voeg het toe</li>
                <li><span className="text-amber-600">3.</span> Herhaal of ga verder</li>
              </ol>
              <div className="relative mt-4 rounded-xl border border-line bg-mist p-4">
                <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-600 shadow-sm">{kant}</span>
                <Preview type={draft.type} kleur={draft.kleur} logo={logo} positie={draft.positie} techniek={techniek} />
              </div>
              <p className="mt-5 text-sm font-semibold text-ink-800">Kledingstuk</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {kledingtypes.map((t) => (
                  <button key={t.id} type="button" onClick={() => chooseType(t.id)} className={`${chip} ${draft.type === t.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>{t.label}</button>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold text-ink-800">Kleur: <span className="text-warm">{kleuren[draft.kleur].name}</span></p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {kleuren.map((k, i) => (
                  <button key={k.name} type="button" aria-label={k.name} onClick={() => setDraft((d) => ({ ...d, kleur: i }))} className={`${swatch} ${i === draft.kleur ? 'border-amber-500 ring-2 ring-amber-200' : 'border-line'}`} style={{ background: k.hex }} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div>
                  <p className="text-sm font-semibold text-ink-800">Logo-positie</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {positiesVoor(draft.type).map((p) => (
                      <button key={p.id} type="button" onClick={() => setDraft((d) => ({ ...d, positie: p.id }))} className={`${chip} px-3 py-2 ${draft.positie === p.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-800">Aantal</p>
                  <input type="number" min={0} value={draft.aantal} onChange={(e) => setDraft((d) => ({ ...d, aantal: e.target.value }))} placeholder="bijv. 10" className="mt-2 w-28 rounded-md border border-line px-3 py-2 text-sm" />
                </div>
              </div>
              {lastAdded && (
                <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{lastAdded} staat in je pakket. Kies hierboven een ander stuk en voeg het toe, of ga verder.</p>
              )}
              <button type="button" onClick={addItem} className="btn-primary mt-3 w-full justify-center text-base">+ Voeg toe aan je pakket</button>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Jouw pakket ({items.length})</p>
              {starter && items.length === 0 && (
                <button type="button" onClick={vulMetStarter} className="mt-3 w-full rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-800 transition hover:bg-amber-100">
                  Begin met een voorbeeldpakket voor {branche}
                  <span className="mt-0.5 block text-xs font-normal text-amber-700">Een paar veelgekozen stukken als startpunt. Je past het daarna naar wens aan.</span>
                </button>
              )}
              {items.length === 0 && (
                <div className="mt-3 rounded-lg border border-dashed border-line bg-mist p-4 text-sm text-warm">
                  Nog leeg. Stel links een kledingstuk samen en klik op <span className="font-semibold text-ink-700">Voeg toe aan je pakket</span>. Je kunt zoveel verschillende stukken toevoegen als je wilt.
                </div>
              )}
              <ul className="mt-3 space-y-3">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 rounded-lg border border-line bg-white p-3">
                    <div className="h-14 w-14 shrink-0 rounded bg-mist p-1"><Preview type={i.type} kleur={i.kleur} logo={logo} positie={i.positie} techniek={techniek} /></div>
                    <div className="min-w-0 grow text-sm">
                      <p className="font-bold text-ink-900">{typeLabel(i.type)}{i.aantal ? ` · ${i.aantal}x` : ''}</p>
                      <p className="text-warm">{kleuren[i.kleur].name}, logo {posLabel(i.positie).toLowerCase()}</p>
                    </div>
                    <button type="button" onClick={() => removeItem(i.id)} className="shrink-0 text-sm text-warm hover:text-amber-700">Verwijder</button>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm font-semibold text-ink-800">Aanvullend nodig?</p>
              <p className="text-xs text-warm">Items zonder bedrukking, zoals schoenen.</p>
              <div className="mt-2 space-y-2">
                {extrasOpties.map((e) => (
                  <div key={e.id} className={`flex items-center gap-3 rounded-lg border-2 p-2.5 ${extras[e.id]?.on ? 'border-amber-500 bg-amber-50' : 'border-line'}`}>
                    <label className="flex grow cursor-pointer items-center gap-2 text-sm font-semibold text-ink-900">
                      <input type="checkbox" checked={!!extras[e.id]?.on} onChange={() => toggleExtra(e.id)} className="h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                      {e.label}
                    </label>
                    {extras[e.id]?.on && <input type="number" min={0} value={extras[e.id].aantal} onChange={(ev) => setExtras((p) => ({ ...p, [e.id]: { on: true, aantal: ev.target.value } }))} placeholder="aantal" className="w-20 rounded-md border border-line px-2 py-1 text-sm" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div id="pakket-print" className="rounded-2xl bg-ink-900 p-6 text-white print:bg-white print:text-ink-900">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400 print:text-amber-700">Jouw pakket</p>
              <ul className="mt-4 space-y-1 text-sm text-ink-100 print:text-ink-800">
                <li><span className="text-ink-300 print:text-warm">Branche:</span> {branche || 'niet opgegeven'}</li>
                <li><span className="text-ink-300 print:text-warm">Team:</span> {team || 'niet opgegeven'}</li>
                <li><span className="text-ink-300 print:text-warm">Logo:</span> {logo ? `aangeleverd, ${techniek}` : 'volgt later'}</li>
              </ul>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-300 print:text-warm">Kledingstukken</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-100 print:text-ink-800">
                {items.length ? items.map((i) => <li key={i.id}>{typeLabel(i.type)}, {kleuren[i.kleur].name}, logo {posLabel(i.positie).toLowerCase()}{i.aantal ? `, ${i.aantal}x` : ''}</li>) : <li className="text-ink-400">Geen kledingstukken gekozen</li>}
                {extrasOpties.filter((e) => extras[e.id]?.on).map((e) => <li key={e.id}>{e.label}{extras[e.id].aantal ? `, ${extras[e.id].aantal}x` : ''}</li>)}
              </ul>
              <div className="mt-5 hidden border-t border-ink-700 pt-3 text-xs text-warm print:block">
                <p>Frederiks Bedrijfskleding. Samenvatting van je samengestelde pakket.</p>
                {(contact.name || contact.company || contact.email || contact.phone) && (
                  <p className="mt-1">Contact: {[contact.name, contact.company, contact.email, contact.phone].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </div>
            {portaal ? (
            <div className="no-print rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-card">
              <h3 className="text-lg font-extrabold text-ink-900">Verstuur als ontwerpaanvraag</h3>
              <p className="mt-1 text-sm text-warm">Je ontwerp komt als concept binnen bij Frederiks{portaal.bedrijfsnaam ? ` voor ${portaal.bedrijfsnaam}` : ''}. We werken het uit tot producten, maten en een offerte, en nemen contact op.</p>
              {error && <p className="mt-3 text-sm font-medium text-amber-700" role="alert">{error}</p>}
              <button type="button" onClick={submitPortaal} disabled={status === 'sending'} className="btn-primary mt-4 w-full">{status === 'sending' ? 'Versturen' : 'Verstuur ontwerpaanvraag'}</button>
              <button type="button" onClick={() => window.print()} className="btn-outline mt-3 w-full px-4 py-2 text-[13px]">Download samenvatting (PDF)</button>
            </div>
            ) : (
            <div className="no-print rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-card">
              <h3 className="text-lg font-extrabold text-ink-900">Vraag je pakket als offerte aan</h3>
              <p className="mt-1 text-sm text-warm">We bellen je binnen een werkdag terug en denken vrijblijvend mee.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input className={field} placeholder="Naam *" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" />
                <input className={field} placeholder="Bedrijf" value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} autoComplete="organization" />
                <input className={field} type="email" placeholder="E-mail *" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" />
                <input className={field} type="tel" placeholder="Telefoon" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" />
              </div>
              <label className="mt-3 flex items-start gap-3 text-sm text-warm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                Ik ga ermee akkoord dat mijn gegevens worden gebruikt om mijn aanvraag te beantwoorden.
              </label>
              {error && <p className="mt-3 text-sm font-medium text-amber-700" role="alert">{error}</p>}
              <button type="button" onClick={submit} disabled={status === 'sending'} className="btn-primary mt-4 w-full">{status === 'sending' ? 'Versturen' : 'Verstuur mijn pakket'}</button>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <button type="button" onClick={kopieerLink} className="btn-outline px-4 py-2 text-[13px]">{gedeeld ? 'Gekopieerd' : 'Kopieer deelbare link'}</button>
                <button type="button" onClick={() => window.print()} className="btn-outline px-4 py-2 text-[13px]">Download samenvatting (PDF)</button>
              </div>
              <p className="mt-2 text-xs text-warm">Bewaar je samenstelling of stuur de link naar een collega. De PDF maak je via je printervenster (kies daar &ldquo;Opslaan als PDF&rdquo;).</p>
            </div>
            )}
          </div>
        )}

        {error && step !== 3 && <p className="no-print mt-4 text-sm font-medium text-amber-700" role="alert">{error}</p>}

        {!portaal && step < totaalStappen - 1 && (
          <div className="no-print mt-8 rounded-xl border border-dashed border-line bg-mist p-4">
            {mailStatus === 'ok' ? (
              <p className="text-sm font-medium text-ink-800">Gelukt. Je ontwerp staat in je mail, met een link om later verder te gaan.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-800">Nu geen tijd? Mail jezelf je ontwerp en ga later verder.</p>
                  {!mailOpen && <button type="button" onClick={() => setMailOpen(true)} className="btn-outline px-4 py-2 text-[13px]">Mail mij mijn ontwerp</button>}
                </div>
                {mailOpen && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      <input className={`${field} max-w-xs flex-1`} type="email" placeholder="Je e-mailadres" value={mailEmail} onChange={(e) => setMailEmail(e.target.value)} autoComplete="email" />
                      <button type="button" onClick={mailOntwerp} disabled={mailStatus === 'sending'} className="btn-primary px-4 py-2 text-[13px]">{mailStatus === 'sending' ? 'Versturen' : 'Stuur mij de link'}</button>
                    </div>
                    <label className="mt-2 flex items-start gap-2 text-xs text-warm">
                      <input type="checkbox" checked={mailConsent} onChange={(e) => setMailConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                      Ik ga ermee akkoord dat Frederiks mijn ontwerp en e-mailadres gebruikt om contact met me op te nemen.
                    </label>
                    {mailError && <p className="mt-2 text-xs font-medium text-amber-700" role="alert">{mailError}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="no-print mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          <button type="button" onClick={back} className={`text-sm font-semibold text-warm hover:text-ink-800 ${step === 0 ? 'invisible' : ''}`}>Terug</button>
          {step < totaalStappen - 1 && <button type="button" onClick={next} className="btn-primary">Volgende</button>}
        </div>
      </div>

      <div id="ontwerp-doc" className="hidden print:block" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}>
        <div className="flex items-end justify-between border-b-2 border-dashed border-amber-500 pb-3">
          <div>
            <p className="font-display text-2xl font-extrabold tracking-wide text-ink-900">FREDERIKS</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-600">Bedrijfskleding</p>
          </div>
          <div className="text-right text-xs text-warm">
            <p className="font-semibold text-ink-900">Jouw werkkledingontwerp</p>
            <p>{branche || 'Bedrijfskleding'}{team ? `, ${team}` : ''}</p>
          </div>
        </div>

        <h2 className="mt-5 text-lg font-extrabold text-ink-900">Je samengestelde pakket</h2>
        {items.length ? (
          <div className="mt-3 grid grid-cols-3 gap-4">
            {items.map((i) => (
              <div key={i.id} className="rounded-lg border border-line p-2 text-center">
                <div className="mx-auto aspect-square w-full max-w-[150px]"><Preview type={i.type} kleur={i.kleur} logo={logo} positie={i.positie} techniek={techniek} /></div>
                <p className="mt-1 text-[12px] font-bold text-ink-900">{typeLabel(i.type)}{i.aantal ? `, ${i.aantal}x` : ''}</p>
                <p className="text-[11px] text-warm">{kleuren[i.kleur].name}, logo {posLabel(i.positie).toLowerCase()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-warm">Nog geen kledingstukken gekozen.</p>
        )}

        {extrasOpties.some((e) => extras[e.id]?.on) && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Aanvullend</p>
            <ul className="mt-1 text-sm text-ink-800">
              {extrasOpties.filter((e) => extras[e.id]?.on).map((e) => <li key={e.id}>{e.label}{extras[e.id].aantal ? `, ${extras[e.id].aantal}x` : ''}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-5 grid grid-cols-4 gap-3 border-t border-line pt-4 text-sm text-ink-800">
          <p><span className="block text-[11px] uppercase tracking-wide text-warm">Branche</span>{branche || 'n.t.b.'}</p>
          <p><span className="block text-[11px] uppercase tracking-wide text-warm">Team</span>{team || 'n.t.b.'}</p>
          <p><span className="block text-[11px] uppercase tracking-wide text-warm">Techniek</span>{techniek === 'borduren' ? 'Borduren' : 'Bedrukken'}</p>
          <p><span className="block text-[11px] uppercase tracking-wide text-warm">Logo</span>{logo ? 'aangeleverd' : 'volgt later'}</p>
        </div>

        <div className="mt-5 rounded-lg bg-ink-900 p-4 text-white" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}>
          <p className="text-sm font-extrabold text-amber-400">Vraag je offerte vrijblijvend aan</p>
          <p className="mt-1 text-xs text-ink-100">We denken mee, kiezen samen de juiste maten en komen langs om te passen. Bel of mail {site.phone}, {site.email}.</p>
        </div>
        {(contact.name || contact.company || contact.email || contact.phone) && (
          <p className="mt-3 text-xs text-warm">Jouw gegevens: {[contact.name, contact.company, contact.email, contact.phone].filter(Boolean).join(', ')}</p>
        )}
      </div>
    </div>
  );
}
