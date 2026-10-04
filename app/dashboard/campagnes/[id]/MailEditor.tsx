'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import type { MailKnoop, MailStijl } from '@/lib/campagnes/flow';
import { MERGE_TAGS, VOORBEELD_CONTEXT, renderMail } from '@/lib/campagnes/mail';
import { testmailActie, voorbeeldActie } from './actions';

export type NieuwsbriefKeuze = { id: string; naam: string; isTemplate: boolean };

const STIJLEN: { id: MailStijl; label: string; uitleg: string }[] = [
  { id: 'persoonlijk', label: 'Persoonlijk', uitleg: 'Oogt als een gewone mail van jou. Beste kans op een antwoord.' },
  { id: 'huisstijl', label: 'Huisstijl', uitleg: 'Met logo en oranje accent. Goed voor klanten.' },
  { id: 'nieuwsbrief', label: 'Nieuwsbriefontwerp', uitleg: 'Een ontwerp uit de nieuwsbrief-editor, met afbeeldingen en blokken.' },
];

export default function MailEditor({
  campagneId,
  knoop,
  onChange,
  nieuwsbrieven,
  mailIngesteld,
}: {
  campagneId: string;
  knoop: MailKnoop;
  onChange: (patch: Partial<MailKnoop>) => void;
  nieuwsbrieven: NieuwsbriefKeuze[];
  mailIngesteld: boolean;
}) {
  const tekstRef = useRef<HTMLTextAreaElement>(null);
  const onderwerpRef = useRef<HTMLInputElement>(null);
  const laatsteVeld = useRef<'onderwerp' | 'inhoud'>('inhoud');
  const [weergave, setWeergave] = useState<'bewerken' | 'voorbeeld'>('bewerken');
  const [smal, setSmal] = useState(false);
  const [linkInvoer, setLinkInvoer] = useState<null | 'link' | 'knop'>(null);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkTekst, setLinkTekst] = useState('');
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const [serverHtml, setServerHtml] = useState<string | null>(null);
  const [bezig, start] = useTransition();

  const voorbeeldHtml = useMemo(() => {
    if (knoop.stijl === 'nieuwsbrief') return serverHtml;
    return renderMail({ stijl: knoop.stijl, onderwerp: knoop.onderwerp, preheader: knoop.preheader, inhoud: knoop.inhoud, ctx: VOORBEELD_CONTEXT, afmeldUrl: '#' });
  }, [knoop.stijl, knoop.onderwerp, knoop.preheader, knoop.inhoud, serverHtml]);

  function zetTekst(nieuw: string, selVan: number, selTot: number) {
    onChange({ inhoud: nieuw });
    requestAnimationFrame(() => {
      const ta = tekstRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(selVan, selTot);
    });
  }

  function omhul(voor: string, na: string, standaard: string) {
    const ta = tekstRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || standaard;
    zetTekst(value.slice(0, s) + voor + sel + na + value.slice(e), s + voor.length, s + voor.length + sel.length);
  }

  function opsomming() {
    const ta = tekstRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const begin = value.lastIndexOf('\n', s - 1) + 1;
    const blok = value.slice(begin, e) || 'Eerste punt';
    const nieuw = blok
      .split('\n')
      .map((r) => (r.startsWith('- ') ? r : `- ${r}`))
      .join('\n');
    zetTekst(value.slice(0, begin) + nieuw + value.slice(Math.max(e, begin)), begin, begin + nieuw.length);
  }

  function voegTagIn(tag: string) {
    if (laatsteVeld.current === 'onderwerp' && onderwerpRef.current) {
      const el = onderwerpRef.current;
      const s = el.selectionStart ?? el.value.length;
      const e = el.selectionEnd ?? s;
      onChange({ onderwerp: el.value.slice(0, s) + tag + el.value.slice(e) });
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(s + tag.length, s + tag.length);
      });
      return;
    }
    const ta = tekstRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    zetTekst(value.slice(0, s) + tag + value.slice(e), s + tag.length, s + tag.length);
  }

  function linkInvoegen() {
    const url = linkUrl.trim();
    if (!url || url === 'https://') return;
    const ta = tekstRef.current;
    const sel = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : '';
    const label = linkTekst.trim() || sel || (linkInvoer === 'knop' ? 'Plan een afspraak' : 'deze pagina');
    const code = linkInvoer === 'knop' ? `\n\n[knop: ${label}](${url})\n\n` : `[${label}](${url})`;
    if (ta) {
      const { selectionStart: s, selectionEnd: e, value } = ta;
      zetTekst(value.slice(0, s) + code + value.slice(e), s + code.length, s + code.length);
    }
    setLinkInvoer(null);
    setLinkUrl('https://');
    setLinkTekst('');
  }

  function toonVoorbeeld() {
    setWeergave('voorbeeld');
    if (knoop.stijl === 'nieuwsbrief') {
      setServerHtml(null);
      start(async () => {
        const r = await voorbeeldActie(campagneId, knoop);
        setServerHtml(r.ok ? r.html ?? '' : `<p style="font-family:Arial;padding:20px;color:#b04318">${r.fout ?? 'Geen voorbeeld beschikbaar.'}</p>`);
      });
    }
  }

  function testmail() {
    setMelding(null);
    start(async () => {
      const r = await testmailActie(campagneId, knoop);
      setMelding({ ok: r.ok, tekst: r.melding });
    });
  }

  const zonderAiTag = knoop.ai && !/\{\{\s*ai\s*\}\}/i.test(knoop.inhoud + knoop.onderwerp);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="veld-label" htmlFor={`ond-${knoop.id}`}>Onderwerp</label>
        <input
          id={`ond-${knoop.id}`}
          ref={onderwerpRef}
          value={knoop.onderwerp}
          onFocus={() => (laatsteVeld.current = 'onderwerp')}
          onChange={(e) => onChange({ onderwerp: e.target.value })}
          placeholder="Bijv. Werkkleding voor {{bedrijfsnaam}}"
          className="veld"
          maxLength={200}
        />
        <p className="veld-hint">Kort en gewoon, alsof je het zelf typt. {knoop.onderwerp.length > 60 ? `Nu ${knoop.onderwerp.length} tekens; op een telefoon valt alles na zo'n 40 weg.` : ''}</p>
      </div>
      <div>
        <label className="veld-label" htmlFor={`pre-${knoop.id}`}>Voorbeeldtekst in de inbox (optioneel)</label>
        <input id={`pre-${knoop.id}`} value={knoop.preheader} onChange={(e) => onChange({ preheader: e.target.value })} className="veld" maxLength={200} placeholder="Het grijze zinnetje naast het onderwerp" />
      </div>

      <fieldset>
        <legend className="veld-label">Uiterlijk</legend>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-line bg-mist p-1">
          {STIJLEN.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange({ stijl: s.id });
                setServerHtml(null);
              }}
              aria-pressed={knoop.stijl === s.id}
              className={`rounded px-2 py-1 text-[12px] font-semibold transition-colors ${knoop.stijl === s.id ? 'bg-white text-ink-900 shadow-sm' : 'text-warm hover:text-ink-900'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="veld-hint">{STIJLEN.find((s) => s.id === knoop.stijl)?.uitleg}</p>
      </fieldset>

      {knoop.stijl === 'nieuwsbrief' ? (
        <div>
          <label className="veld-label" htmlFor={`nb-${knoop.id}`}>Ontwerp</label>
          <select id={`nb-${knoop.id}`} value={knoop.nieuwsbriefId ?? ''} onChange={(e) => onChange({ nieuwsbriefId: e.target.value || null })} className="veld">
            <option value="">Kies een ontwerp…</option>
            {nieuwsbrieven.map((n) => (
              <option key={n.id} value={n.id}>
                {n.naam}
                {n.isTemplate ? ' (sjabloon)' : ''}
              </option>
            ))}
          </select>
          <p className="veld-hint">
            Het ontwerp maak je in de <a href={knoop.nieuwsbriefId ? `/dashboard/nieuwsbrief/${knoop.nieuwsbriefId}` : '/dashboard/nieuwsbrief'} className="font-semibold text-amber-700 underline" target="_blank" rel="noreferrer">nieuwsbrief-editor</a>. Wijzigingen daar gelden meteen voor deze mail. In het ontwerp werken {'{{voornaam}}'} en {'{{bedrijf}}'}, en ook {'{{kennismakingslink}}'} en de andere campagnevelden.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 rounded-md border border-line bg-mist p-1" role="tablist">
              <button type="button" role="tab" aria-selected={weergave === 'bewerken'} onClick={() => setWeergave('bewerken')} className={`rounded px-2.5 py-1 text-[12px] font-semibold ${weergave === 'bewerken' ? 'bg-white text-ink-900 shadow-sm' : 'text-warm'}`}>
                Bewerken
              </button>
              <button type="button" role="tab" aria-selected={weergave === 'voorbeeld'} onClick={toonVoorbeeld} className={`rounded px-2.5 py-1 text-[12px] font-semibold ${weergave === 'voorbeeld' ? 'bg-white text-ink-900 shadow-sm' : 'text-warm'}`}>
                Voorbeeld
              </button>
            </div>
            {weergave === 'voorbeeld' && (
              <button type="button" onClick={() => setSmal((s) => !s)} className="knop-tekst">
                {smal ? 'Breed' : 'Als telefoon'}
              </button>
            )}
          </div>

          {weergave === 'bewerken' ? (
            <div className="rounded-md border border-line focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-mist px-1.5 py-1">
                <button type="button" onClick={() => omhul('**', '**', 'vet')} className="knop-tekst px-2 font-bold" title="Vet (selecteer eerst tekst)">
                  B
                </button>
                <button type="button" onClick={() => omhul('_', '_', 'cursief')} className="knop-tekst px-2 italic" title="Cursief">
                  I
                </button>
                <button type="button" onClick={() => setLinkInvoer(linkInvoer === 'link' ? null : 'link')} className="knop-tekst px-2" title="Link invoegen">
                  Link
                </button>
                <button type="button" onClick={() => setLinkInvoer(linkInvoer === 'knop' ? null : 'knop')} className="knop-tekst px-2" title="Knop invoegen">
                  Knop
                </button>
                <button type="button" onClick={opsomming} className="knop-tekst px-2" title="Opsomming">
                  Lijst
                </button>
                <select
                  aria-label="Veld invoegen"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) voegTagIn(e.target.value);
                  }}
                  className="ml-auto rounded border border-line bg-white px-1.5 py-0.5 text-[12px] text-ink-700"
                >
                  <option value="">Veld invoegen…</option>
                  {MERGE_TAGS.map((t) => (
                    <option key={t.tag} value={t.tag}>
                      {t.tag.replace(/[{}]/g, '')}: {t.uitleg}
                    </option>
                  ))}
                </select>
              </div>
              {linkInvoer && (
                <div className="flex flex-wrap items-end gap-2 border-b border-line bg-white px-2 py-2">
                  <div className="min-w-[10rem] flex-1">
                    <label className="veld-label">Adres</label>
                    <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="veld" placeholder="https:// of {{kennismakingslink}}" autoFocus />
                  </div>
                  <div className="min-w-[8rem] flex-1">
                    <label className="veld-label">Tekst</label>
                    <input value={linkTekst} onChange={(e) => setLinkTekst(e.target.value)} className="veld" placeholder={linkInvoer === 'knop' ? 'Plan een afspraak' : 'geselecteerde tekst'} />
                  </div>
                  <button type="button" onClick={linkInvoegen} className="knop-donker">
                    Invoegen
                  </button>
                  <button type="button" onClick={() => setLinkInvoer(null)} className="knop-tekst">
                    Annuleren
                  </button>
                  <p className="w-full text-[11px] text-warm">Tip: {'{{kennismakingslink}}'}, {'{{portaallink}}'} of {'{{reviewlink}}'} kun je ook als adres gebruiken. Voor mailen: mailto:info@frederiksbedrijfskleding.nl</p>
                </div>
              )}
              <textarea
                ref={tekstRef}
                value={knoop.inhoud}
                onFocus={() => (laatsteVeld.current = 'inhoud')}
                onChange={(e) => onChange({ inhoud: e.target.value })}
                rows={16}
                className="block w-full resize-y border-0 bg-white px-3 py-2 text-[13px] leading-relaxed text-ink-900 focus:outline-none focus:ring-0"
                aria-label="Tekst van de mail"
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-line bg-mist">
              <div className="border-b border-line bg-white px-3 py-2 text-[12px]">
                <p className="truncate font-semibold text-ink-900">{knoop.onderwerp.replace(/\{\{\s*bedrijfsnaam\s*\}\}/gi, VOORBEELD_CONTEXT.bedrijfsnaam ?? '').replace(/\{\{\s*voornaam\s*\}\}/gi, VOORBEELD_CONTEXT.voornaam ?? '') || '(geen onderwerp)'}</p>
                <p className="text-warm">Voorbeeld met de gegevens van {VOORBEELD_CONTEXT.contactpersoon}, {VOORBEELD_CONTEXT.bedrijfsnaam}</p>
              </div>
              {voorbeeldHtml === null ? (
                <p className="p-6 text-center text-[13px] text-warm">Voorbeeld laden…</p>
              ) : (
                <iframe title="Voorbeeld van de mail" srcDoc={voorbeeldHtml} sandbox="" className="mx-auto block h-[540px] bg-white transition-[width]" style={{ width: smal ? 375 : '100%' }} />
              )}
            </div>
          )}
          <p className="veld-hint">
            <code>**vet**</code>, <code>_cursief_</code>, regels met <code>- </code> worden een opsomming. Onderaan komt altijd jouw adres en een afmeldlink.
          </p>
        </>
      )}

      {knoop.stijl === 'nieuwsbrief' && (
        <button type="button" onClick={toonVoorbeeld} className="knop-stil self-start" disabled={!knoop.nieuwsbriefId || bezig}>
          Voorbeeld tonen
        </button>
      )}
      {knoop.stijl === 'nieuwsbrief' && weergave === 'voorbeeld' && (
        <div className="overflow-hidden rounded-md border border-line bg-mist">
          {serverHtml === null ? <p className="p-6 text-center text-[13px] text-warm">Voorbeeld laden…</p> : <iframe title="Voorbeeld van de mail" srcDoc={serverHtml} sandbox="" className="block h-[540px] w-full bg-white" />}
        </div>
      )}

      <label className="flex items-start gap-2 text-[12px] text-ink-700">
        <input type="checkbox" checked={knoop.ai} onChange={(e) => onChange({ ai: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
        <span>
          AI-openingszin: {'{{ai}}'} wordt per ontvanger een korte, persoonlijke zin over hun bedrijf.
          {zonderAiTag && <span className="block font-semibold text-amber-800">Zet {'{{ai}}'} ergens in de tekst, anders gebeurt er niets.</span>}
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button type="button" onClick={testmail} disabled={bezig} className="knop-stil">
          {bezig ? 'Bezig…' : 'Testmail naar mezelf'}
        </button>
        {!mailIngesteld && <span className="text-[12px] text-warm">Mail staat nog niet aan; gebruik Voorbeeld.</span>}
      </div>
      {melding && <p className={`rounded-md px-3 py-2 text-[12px] ${melding.ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>{melding.tekst}</p>}
    </div>
  );
}
