'use client';
import { useRef, useState } from 'react';
import { kleuren, kledingtypes, pakketitems, logoposities } from '@/content/configurator';
import { branches } from '@/content/branches';
import { Garment, logoBoxStyle } from '@/components/Garments';

type Status = 'idle' | 'sending' | 'ok' | 'error';
type ItemState = { on: boolean; aantal: number };

export function PakketConfigurator({ defaultBranche = '' }: { defaultBranche?: string }) {
  const [branche, setBranche] = useState(defaultBranche);
  const [type, setType] = useState<string>('tshirt');
  const [kleurIdx, setKleurIdx] = useState(0);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoPos, setLogoPos] = useState('borst-links');
  const [techniek, setTechniek] = useState<'bedrukken' | 'borduren'>('borduren');
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [team, setTeam] = useState('');
  const [contact, setContact] = useState({ name: '', company: '', email: '', phone: '' });
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const kleur = kleuren[kleurIdx];

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4_000_000) { setError('Logo is te groot (max 4 MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(f);
  }
  function toggleItem(id: string) {
    setItems((p) => ({ ...p, [id]: { on: !p[id]?.on, aantal: p[id]?.aantal ?? 0 } }));
  }
  function setAantal(id: string, n: number) {
    setItems((p) => ({ ...p, [id]: { on: true, aantal: Math.max(0, n) } }));
  }

  const gekozen = pakketitems.filter((i) => items[i.id]?.on);

  async function submit() {
    if (!contact.name || !contact.email || !consent) { setError('Vul je naam en e-mailadres in en geef toestemming.'); return; }
    setStatus('sending'); setError('');
    const lijst = gekozen.map((i) => `- ${i.label}${items[i.id].aantal ? ` (${items[i.id].aantal}x)` : ''}`).join('\n') || '- (nog geen items gekozen)';
    const bericht = [
      'Pakket samengesteld via de website.',
      `Branche: ${branche || 'niet opgegeven'}`,
      `Kledingstuk in preview: ${kledingtypes.find((t) => t.id === type)?.label}`,
      `Kleur: ${kleur.name}`,
      `Logo: ${logo ? 'aangeleverd' : 'nog niet aangeleverd'}, positie ${logoPos}, ${techniek}`,
      `Teamgrootte: ${team || 'niet opgegeven'}`,
      'Gewenste artikelen:',
      lijst,
    ].join('\n');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contact, branche, aantal: team, bericht, consent: true }),
      });
      if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(j?.error ?? 'Er ging iets mis.'); }
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'generate_lead', { event_label: 'pakket-configurator' });
      setStatus('ok');
    } catch (e) { setStatus('error'); setError(e instanceof Error ? e.message : 'Onbekende fout'); }
  }

  if (status === 'ok') {
    return (
      <div className="rounded-2xl border-2 border-amber-500 bg-white p-8 shadow-card">
        <p className="font-display text-2xl font-extrabold text-ink-900">Bedankt, {contact.name.split(' ')[0]}.</p>
        <p className="mt-3 text-warm">We hebben je samengestelde pakket binnen. We bellen je binnen een werkdag terug om het door te nemen en maken een offerte op maat. Je krijgt ook een bevestiging per e-mail.</p>
      </div>
    );
  }

  const swatch = 'h-9 w-9 rounded-full border-2 transition';
  const chip = 'cursor-pointer rounded-md border-2 px-4 py-2.5 text-sm font-semibold transition select-none';
  const field = 'mt-1 w-full rounded-md border border-line bg-white px-4 py-3 text-sm text-ink-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Preview */}
        <div className="rounded-2xl border border-line bg-mist p-6">
          <div className="relative mx-auto aspect-square w-full max-w-sm">
            <Garment color={kleur.hex} light={kleur.licht} type={type} />
            {logo && (
              <span style={logoBoxStyle(type, logoPos)}>
                <img src={logo} alt="Jouw logo op de kleding" className="w-full object-contain"
                  style={techniek === 'borduren' ? { filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.45)) saturate(1.05)' } : undefined} />
              </span>
            )}
            {logoPos === 'rug' && logo && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-ink-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Rugzijde</span>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-warm">Indicatieve weergave. Het echte resultaat laten we je vooraf zien.</p>
        </div>

        {/* Stijlkeuzes */}
        <div>
          <p className="eyebrow">Stel samen</p>
          <h3 className="mt-2 text-xl font-extrabold text-ink-900">Kies je kledingstuk en stijl</h3>

          <p className="mt-5 text-sm font-semibold text-ink-800">Kledingstuk</p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {kledingtypes.map((t) => (
              <button key={t.id} type="button" onClick={() => setType(t.id)}
                className={`${chip} ${type === t.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>{t.label}</button>
            ))}
          </div>

          <p className="mt-5 text-sm font-semibold text-ink-800">Kleur: <span className="text-warm">{kleur.name}</span></p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {kleuren.map((k, i) => (
              <button key={k.name} type="button" onClick={() => setKleurIdx(i)} aria-label={k.name}
                className={`${swatch} ${i === kleurIdx ? 'border-amber-500 ring-2 ring-amber-200' : 'border-line'}`}
                style={{ background: k.hex }} />
            ))}
          </div>

          <p className="mt-5 text-sm font-semibold text-ink-800">Jouw logo</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline px-4 py-2 text-[13px]">{logo ? 'Ander logo kiezen' : 'Upload je logo'}</button>
            {logo && <button type="button" onClick={() => setLogo(null)} className="text-sm text-warm hover:text-ink-800">Verwijderen</button>}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogo} className="hidden" />
          </div>

          <p className="mt-5 text-sm font-semibold text-ink-800">Positie</p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {logoposities.map((p) => (
              <button key={p.id} type="button" onClick={() => setLogoPos(p.id)}
                className={`${chip} ${logoPos === p.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>{p.label}</button>
            ))}
          </div>

          <p className="mt-5 text-sm font-semibold text-ink-800">Techniek</p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {(['borduren', 'bedrukken'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTechniek(t)}
                className={`${chip} ${techniek === t ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-line text-ink-700 hover:border-ink-300'}`}>{t === 'borduren' ? 'Borduren' : 'Bedrukken'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Pakket + branche */}
      <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h3 className="text-xl font-extrabold text-ink-900">Wat heb je nodig voor je team?</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pakketitems.map((i) => {
            const st = items[i.id];
            return (
              <div key={i.id} className={`rounded-lg border-2 p-3 transition ${st?.on ? 'border-amber-500 bg-amber-50' : 'border-line'}`}>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-900">
                  <input type="checkbox" checked={!!st?.on} onChange={() => toggleItem(i.id)} className="h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                  {i.label}
                </label>
                {st?.on && (
                  <input type="number" min={0} value={st.aantal || ''} onChange={(e) => setAantal(i.id, parseInt(e.target.value || '0', 10))}
                    placeholder="aantal" className="mt-2 w-full rounded-md border border-line px-3 py-1.5 text-sm" />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-ink-800">Branche</label>
            <select className={field} value={branche} onChange={(e) => setBranche(e.target.value)}>
              <option value="">Kies een branche</option>
              {branches.map((b) => <option key={b.slug} value={b.navLabel}>{b.navLabel}</option>)}
              <option value="Anders">Anders</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-ink-800">Teamgrootte</label>
            <input className={field} value={team} onChange={(e) => setTeam(e.target.value)} placeholder="bijv. 8 medewerkers" />
          </div>
        </div>
      </div>

      {/* Overzicht + contact */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl bg-ink-900 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400">Jouw pakket</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-100">
            <li><span className="text-ink-300">Kledingstuk:</span> {kledingtypes.find((t) => t.id === type)?.label}, {kleur.name}</li>
            <li><span className="text-ink-300">Logo:</span> {logo ? `aangeleverd, ${logoposities.find((p) => p.id === logoPos)?.label.toLowerCase()}, ${techniek}` : 'nog niet aangeleverd'}</li>
            <li><span className="text-ink-300">Team:</span> {team || 'nog niet opgegeven'}</li>
          </ul>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-300">Artikelen</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-100">
            {gekozen.length ? gekozen.map((i) => <li key={i.id}>{i.label}{items[i.id].aantal ? ` (${items[i.id].aantal}x)` : ''}</li>) : <li className="text-ink-400">Nog geen artikelen gekozen</li>}
          </ul>
        </div>

        <div className="rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-card">
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
          <button type="button" onClick={submit} disabled={status === 'sending'} className="btn-primary mt-4 w-full">
            {status === 'sending' ? 'Versturen' : 'Verstuur mijn pakket'}
          </button>
        </div>
      </div>
    </div>
  );
}
