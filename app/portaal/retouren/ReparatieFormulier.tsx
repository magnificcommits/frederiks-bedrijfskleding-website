'use client';
import { useMemo, useState, useTransition } from 'react';
import { vraagReparatie } from './actions';
import type { RetourneerbareOrder } from '@/lib/portaal/service';
import { useVertaler } from '@/lib/i18n/portaal/client';

const veld =
  'mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none';

/** Volgorde van de onderdelen; de labels komen uit de vertalingen (status.onderdeel). */
const ONDERDELEN = ['naad', 'rits', 'knoop', 'logo', 'reflectie', 'anders'] as const;

const MAX_FOTOS = 3;
const MAX_ZIJDE = 1600;

type Foto = { file: File; url: string };

/**
 * Verkleint een foto in de browser naar maximaal 1600 pixels en JPEG. Een foto van
 * een telefoon is al snel 4 MB of meer; zo blijft het formulier onder de uploadgrens
 * en gaat het versturen ook op mobiel internet snel. Lukt verkleinen niet (oude
 * browser, onbekend formaat), dan gaat het origineel mee.
 */
async function verklein(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const schaal = Math.min(1, MAX_ZIJDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * schaal);
    canvas.height = Math.round(bitmap.height * schaal);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82));
    if (!blob) return file;
    const naam = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${naam}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function ReparatieFormulier({
  orders,
  kosten,
  fout,
}: {
  orders: RetourneerbareOrder[];
  kosten: number | null;
  fout?: string | null;
}) {
  const v = useVertaler();
  const { t } = v;
  const [orderId, setOrderId] = useState('');
  const [regelId, setRegelId] = useState('');
  const [onderdeel, setOnderdeel] = useState('');
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [bezig, start] = useTransition();
  const [verwerken, setVerwerken] = useState(false);

  const order = useMemo(() => orders.find((o) => o.id === orderId) ?? null, [orders, orderId]);
  const regel = order?.regels.find((r) => r.orderregel_id === regelId) ?? null;

  async function kiesFotos(lijst: FileList | null) {
    if (!lijst || lijst.length === 0) return;
    setVerwerken(true);
    const ruimte = MAX_FOTOS - fotos.length;
    const nieuw: Foto[] = [];
    for (const f of Array.from(lijst).slice(0, Math.max(0, ruimte))) {
      const klein = await verklein(f);
      nieuw.push({ file: klein, url: URL.createObjectURL(klein) });
    }
    setFotos((v) => [...v, ...nieuw]);
    setVerwerken(false);
  }

  function haalWeg(i: number) {
    setFotos((v) => {
      URL.revokeObjectURL(v[i]?.url ?? '');
      return v.filter((_, j) => j !== i);
    });
  }

  function verstuur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete('fotos_kiezen');
    for (const f of fotos) fd.append('fotos', f.file);
    start(() => vraagReparatie(fd));
  }

  const euro = (n: number) => v.euro(n);

  return (
    <form onSubmit={verstuur} className="mt-4">
      {fout && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-ink-800" role="alert">
          {fout}
        </p>
      )}

      {orders.length > 0 && (
        <>
          <label htmlFor="rep-order" className="block text-sm font-semibold text-ink-900">
            {t('algemeen.bestelling')} <span className="font-normal text-warm">{t('reparatie.alsJeDieWeet')}</span>
          </label>
          <select
            id="rep-order"
            name="order_id"
            className={veld}
            value={orderId}
            onChange={(e) => {
              setOrderId(e.target.value);
              setRegelId('');
            }}
          >
            <option value="">{t('reparatie.weetNiet')}</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.ordernummer ? t('algemeen.order', { nr: o.ordernummer }) : t('algemeen.bestelling')} {'·'}{' '}
                {v.datum(o.besteldatum)}
              </option>
            ))}
          </select>
        </>
      )}

      {order && (
        <>
          <label htmlFor="rep-regel" className="mt-4 block text-sm font-semibold text-ink-900">
            {t('reparatie.welkKledingstuk')}
          </label>
          <select id="rep-regel" name="orderregel_id" className={veld} value={regelId} onChange={(e) => setRegelId(e.target.value)}>
            <option value="">{t('reparatie.staatNietTussen')}</option>
            {order.regels.map((r) => (
              <option key={r.orderregel_id} value={r.orderregel_id}>
                {r.item_naam}
                {r.maat || r.kleur ? ` (${[r.maat, r.kleur].filter(Boolean).join(' / ')})` : ''}
              </option>
            ))}
          </select>
        </>
      )}

      {!regel && (
        <>
          <label htmlFor="rep-kleding" className="mt-4 block text-sm font-semibold text-ink-900">
            {order ? t('reparatie.ofBeschrijf') : t('reparatie.welkKledingstuk')}
          </label>
          <input
            id="rep-kleding"
            name="kledingstuk"
            required
            maxLength={200}
            placeholder={t('reparatie.kledingPlaceholder')}
            className={veld}
          />
        </>
      )}

      <label htmlFor="rep-aantal" className="mt-4 block text-sm font-semibold text-ink-900">
        {t('algemeen.aantal')}
      </label>
      <input
        id="rep-aantal"
        name="aantal"
        type="number"
        inputMode="numeric"
        min={1}
        max={regel ? regel.besteld_aantal : 50}
        defaultValue={1}
        className={`${veld} w-24`}
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-ink-900">{t('reparatie.watKapot')}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ONDERDELEN.map((code) => (
            <label
              key={code}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                onderdeel === code ? 'border-amber-500 bg-amber-50 text-ink-900' : 'border-line bg-white text-ink-800'
              }`}
            >
              <input
                type="radio"
                name="onderdeel"
                value={code}
                required
                checked={onderdeel === code}
                onChange={() => setOnderdeel(code)}
              />
              {t(`status.onderdeel.${code}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="rep-toel" className="mt-4 block text-sm font-semibold text-ink-900">
        {t('reparatie.toelichting')} {onderdeel !== 'anders' && <span className="font-normal text-warm">{t('reparatie.optioneel')}</span>}
      </label>
      <textarea
        id="rep-toel"
        name="toelichting"
        rows={3}
        maxLength={2000}
        required={onderdeel === 'anders'}
        placeholder={t('reparatie.toelichtingPlaceholder')}
        className={veld}
      />

      <div className="mt-4">
        <span className="block text-sm font-semibold text-ink-900">
          {t('reparatie.fotos')} <span className="font-normal text-warm">{t('reparatie.fotosUitleg', { max: MAX_FOTOS })}</span>
        </span>
        {fotos.length > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <li key={f.url} className="relative overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={t('reparatie.fotoAlt', { n: i + 1 })} className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  onClick={() => haalWeg(i)}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-ink-900 shadow"
                  aria-label={t('reparatie.fotoWeg', { n: i + 1 })}
                >
                  {'×'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {fotos.length < MAX_FOTOS && (
          <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-line bg-mist px-3 py-2 text-sm font-semibold text-ink-800">
            {verwerken ? t('reparatie.fotoVerwerken') : fotos.length ? t('reparatie.nogFoto') : t('reparatie.fotoKiezen')}
            <input
              type="file"
              name="fotos_kiezen"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                void kiesFotos(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      <p className="mt-4 rounded-lg bg-mist px-3 py-2 text-xs text-warm">
        {kosten != null && kosten > 0
          ? t('reparatie.kostenStandaard', { bedrag: euro(kosten) })
          : t('reparatie.kostenOnbekend')}
      </p>

      <button
        type="submit"
        disabled={bezig || verwerken || !onderdeel}
        className="btn-primary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
      >
        {bezig ? t('reparatie.bezig') : t('retouren.aanmeldenReparatie')}
      </button>
    </form>
  );
}
