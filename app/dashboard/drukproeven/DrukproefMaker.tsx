'use client';

import { useState } from 'react';
import { kledingtypes, kleuren, logoposities } from '@/content/configurator';
import { maakDrukproefActie } from './actions';
import DrukproefPreview from './DrukproefPreview';

const inputCls =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

/**
 * Formulier waarmee Jessi een drukproef voor een klant maakt. Links beweegt een live
 * voorbeeld mee met de keuzes (kledingstuk, kleur, positie, techniek, logo). Optioneel
 * upload je een eigen afbeelding; die wordt dan de definitieve proef in plaats van de render.
 */
export default function DrukproefMaker({ orgId, klantLogoUrl }: { orgId: string; klantLogoUrl?: string | null }) {
  const [type, setType] = useState<string>(kledingtypes[0].id);
  const [kleur, setKleur] = useState<number>(0);
  const [positie, setPositie] = useState<string>(logoposities[0].id);
  const [techniek, setTechniek] = useState<string>('borduren');
  const [logoUrl, setLogoUrl] = useState<string>(klantLogoUrl ?? '');

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe drukproef</h2>
      <p className="mt-1 text-xs text-warm">
        Stel het kledingstuk samen of upload een eigen afbeelding als definitieve proef. Het voorbeeld beweegt mee met je keuzes.
      </p>

      <div className="mt-4 rounded-xl border border-line bg-mist p-4">
        <DrukproefPreview type={type} kleur={kleur} logoUrl={logoUrl || null} positie={positie} techniek={techniek} />
        <p className="mt-3 text-center text-xs text-warm">Voorbeeld met het klantlogo. Een eigen upload vervangt dit beeld.</p>
      </div>

      <form action={maakDrukproefActie} className="mt-5 flex flex-col gap-3">
        <input type="hidden" name="org_id" value={orgId} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="kleur" value={kleur} />
        <input type="hidden" name="positie" value={positie} />
        <input type="hidden" name="techniek" value={techniek} />
        <input type="hidden" name="logo_url" value={logoUrl} />

        <div>
          <label className="block text-xs font-semibold text-warm">Naam</label>
          <input name="naam" required placeholder="Bijv. Polo borduren borst links" className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-warm">Kledingstuk</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {kledingtypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-warm">Kleur</label>
          <select value={kleur} onChange={(e) => setKleur(Number(e.target.value))} className={inputCls}>
            {kleuren.map((k, i) => (
              <option key={k.name} value={i}>
                {k.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-warm">Logopositie</label>
          <select value={positie} onChange={(e) => setPositie(e.target.value)} className={inputCls}>
            {logoposities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-warm">Techniek</label>
          <select value={techniek} onChange={(e) => setTechniek(e.target.value)} className={inputCls}>
            <option value="borduren">Borduren</option>
            <option value="bedrukken">Bedrukken</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-warm">Logo (URL)</label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-warm">Voorgevuld met het klantlogo. Pas aan als je een ander logo wilt tonen.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-warm">Omschrijving</label>
          <textarea
            name="omschrijving"
            rows={3}
            placeholder="Extra toelichting voor de klant of voor jezelf"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-warm">Eigen afbeelding (optioneel)</label>
          <input
            type="file"
            name="afbeelding"
            accept="image/*"
            className="mt-1 w-full text-sm text-warm file:mr-3 file:rounded-md file:border-0 file:bg-ink-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ink-800"
          />
          <p className="mt-1 text-[11px] text-warm">Upload je een afbeelding, dan wordt die de definitieve proef in plaats van de render.</p>
        </div>

        <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">
          Drukproef aanmaken
        </button>
      </form>
    </div>
  );
}
