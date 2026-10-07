'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { koppelBestand, type KoppelArtikel, type Koppeling } from '@/lib/kms/fotoKoppelen';
import { koppelArtikelenActie, koppelFotoActie } from './actions';

type Rij = {
  sleutel: string;
  bestand: File;
  voorbeeld: string;
  koppeling: Koppeling;
  /** Handmatig gekozen, als de naam niets opleverde. */
  artikelId: string;
  kleur: string;
  uitkomst: 'wacht' | 'bezig' | 'klaar' | 'fout' | 'overgeslagen';
  fout?: string;
};

const MAX_ZIJDE = 1600;

/** Verkleint in de browser naar maximaal 1600 px en JPEG: van 7 MB naar een paar honderd kB. */
async function verklein(bestand: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(bestand);
    const schaal = Math.min(1, MAX_ZIJDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * schaal);
    canvas.height = Math.round(bitmap.height * schaal);
    const ctx = canvas.getContext('2d');
    if (!ctx) return bestand;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
    if (!blob) return bestand;
    return new File([blob], bestand.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return bestand;
  }
}

export default function FotosKoppelen() {
  const [artikelen, setArtikelen] = useState<KoppelArtikel[] | null>(null);
  const [rijen, setRijen] = useState<Rij[]>([]);
  const [vervangen, setVervangen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [sleep, setSleep] = useState(false);
  const bestandenRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    koppelArtikelenActie().then(setArtikelen);
  }, []);
  useEffect(() => () => rijen.forEach((r) => URL.revokeObjectURL(r.voorbeeld)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const perId = useMemo(() => new Map((artikelen ?? []).map((a) => [a.id, a])), [artikelen]);
  const artikelOpties = useMemo(
    () => [...(artikelen ?? [])].filter((a) => a.kleuren.length).sort((a, b) => `${a.merk} ${a.artNr} ${a.naam}`.localeCompare(`${b.merk} ${b.artNr} ${b.naam}`, 'nl')),
    [artikelen],
  );

  function voegToe(lijst: FileList | File[] | null) {
    if (!lijst || !artikelen) return;
    const nieuw: Rij[] = [];
    for (const f of Array.from(lijst)) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type) && !/\.(jpe?g|png|webp)$/i.test(f.name)) continue;
      const k = koppelBestand(f.name, artikelen);
      nieuw.push({
        sleutel: `${f.name}-${f.size}-${f.lastModified}`,
        bestand: f,
        voorbeeld: URL.createObjectURL(f),
        koppeling: k,
        artikelId: k.status !== 'geen-artikel' ? k.artikel.id : '',
        kleur: k.status === 'gevonden' ? k.kleur : '',
        uitkomst: 'wacht',
      });
    }
    setRijen((oud) => {
      const bestaand = new Set(oud.map((r) => r.sleutel));
      return [...oud, ...nieuw.filter((r) => !bestaand.has(r.sleutel))];
    });
  }

  /** Wat er met een rij gebeurt als je op Koppelen drukt. */
  function plan(r: Rij): 'koppelen' | 'achterkant' | 'heeft-foto' | 'onbekend' {
    if (r.koppeling.zijde !== 'voor') return 'achterkant';
    if (!r.artikelId || !r.kleur) return 'onbekend';
    const heeft = perId.get(r.artikelId)?.kleuren.find((k) => k.kleur === r.kleur)?.heeftFoto;
    if (heeft && !vervangen) return 'heeft-foto';
    return 'koppelen';
  }
  // Per artikel en kleur maar één foto: de eerste in de lijst.
  const teKoppelen = useMemo(() => {
    const gezien = new Set<string>();
    return rijen.filter((r) => {
      if (r.uitkomst === 'klaar' || plan(r) !== 'koppelen') return false;
      const s = `${r.artikelId}|${r.kleur}`;
      if (gezien.has(s)) return false;
      gezien.add(s);
      return true;
    });
  }, [rijen, vervangen, perId]); // eslint-disable-line react-hooks/exhaustive-deps

  const telling = {
    koppelen: teKoppelen.length,
    achterkant: rijen.filter((r) => plan(r) === 'achterkant').length,
    heeftFoto: rijen.filter((r) => plan(r) === 'heeft-foto').length,
    onbekend: rijen.filter((r) => plan(r) === 'onbekend').length,
    klaar: rijen.filter((r) => r.uitkomst === 'klaar').length,
  };

  function wijzig(sleutel: string, veld: Partial<Rij>) {
    setRijen((oud) => oud.map((r) => (r.sleutel === sleutel ? { ...r, ...veld } : r)));
  }

  async function koppelAlles() {
    setBezig(true);
    for (const r of teKoppelen) {
      wijzig(r.sleutel, { uitkomst: 'bezig' });
      const klein = await verklein(r.bestand);
      const fd = new FormData();
      fd.set('productId', r.artikelId);
      fd.set('kleur', r.kleur);
      fd.set('naam', r.bestand.name);
      fd.set('bestand', klein);
      try {
        const res = await koppelFotoActie(fd);
        wijzig(r.sleutel, res.ok ? { uitkomst: 'klaar' } : { uitkomst: 'fout', fout: res.fout });
      } catch {
        wijzig(r.sleutel, { uitkomst: 'fout', fout: 'Verbinding mislukt.' });
      }
    }
    // Opnieuw ophalen, zodat "heeft al een foto" klopt voor een volgende ronde.
    setArtikelen(await koppelArtikelenActie());
    setBezig(false);
  }

  const chip = (r: Rij) => {
    if (r.uitkomst === 'klaar') return <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800">Gekoppeld</span>;
    if (r.uitkomst === 'bezig') return <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-900">Bezig…</span>;
    if (r.uitkomst === 'fout') return <span className="rounded bg-red-50 px-1.5 py-0.5 font-semibold text-red-800">{r.fout ?? 'Mislukt'}</span>;
    const p = plan(r);
    if (p === 'koppelen') return <span className="rounded bg-ink-900 px-1.5 py-0.5 font-semibold text-white">Wordt gekoppeld</span>;
    if (p === 'achterkant') return <span className="rounded bg-mist px-1.5 py-0.5 text-warm">Achterkant, overgeslagen</span>;
    if (p === 'heeft-foto') return <span className="rounded bg-mist px-1.5 py-0.5 text-warm">Heeft al een foto</span>;
    return <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-900">Kies artikel en kleur</span>;
  };

  return (
    <div className="mt-5 space-y-5">
      <section className="panel p-5 text-[14px] text-ink-800">
        <p className="font-semibold text-ink-900">Zo werkt het</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Download bij de leverancier de kleurfoto&apos;s, zoals ze daar staan. Niets hernoemen.</li>
          <li>Sleep ze hier in één keer naartoe, of kies de hele map.</li>
          <li>Het systeem herkent artikel en kleur aan de bestandsnaam, bijvoorbeeld <span className="font-mono text-[13px]">Konrad_91490_1220_front.jpg</span> wordt Konrad in Antraciet/Zwart 1220.</li>
          <li>Controleer de lijst en klik op Koppelen. Grote foto&apos;s worden eerst verkleind; achterkanten worden overgeslagen.</li>
        </ol>
      </section>

      <div
        onDragOver={(e) => { e.preventDefault(); setSleep(true); }}
        onDragLeave={() => setSleep(false)}
        onDrop={(e) => { e.preventDefault(); setSleep(false); voegToe(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-5 py-10 text-center ${sleep ? 'border-amber-500 bg-amber-50' : 'border-line bg-white'}`}
      >
        <p className="text-[15px] font-semibold text-ink-900">{artikelen ? 'Sleep de foto’s hierheen' : 'Artikelen laden…'}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" disabled={!artikelen} onClick={() => bestandenRef.current?.click()} className="knop-donker">Foto&apos;s kiezen</button>
          <button type="button" disabled={!artikelen} onClick={() => mapRef.current?.click()} className="knop-stil">Hele map kiezen</button>
        </div>
        <input ref={bestandenRef} type="file" accept="image/*" multiple hidden onChange={(e) => { voegToe(e.target.files); e.target.value = ''; }} />
        <input
          ref={mapRef}
          type="file"
          multiple
          hidden
          // @ts-expect-error webkitdirectory is geen standaard React-attribuut, maar werkt in alle grote browsers.
          webkitdirectory=""
          onChange={(e) => { voegToe(e.target.files); e.target.value = ''; }}
        />
      </div>

      {rijen.length > 0 && (
        <>
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <span><strong>{telling.koppelen}</strong> te koppelen</span>
              <span className="text-warm">{telling.heeftFoto} hebben al een foto</span>
              <span className="text-warm">{telling.achterkant} achterkanten</span>
              {telling.onbekend > 0 && <span className="font-semibold text-amber-800">{telling.onbekend} niet herkend</span>}
              {telling.klaar > 0 && <span className="font-semibold text-emerald-800">{telling.klaar} gekoppeld</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] text-ink-800">
                <input type="checkbox" checked={vervangen} onChange={(e) => setVervangen(e.target.checked)} disabled={bezig} />
                Bestaande kleurfoto&apos;s vervangen
              </label>
              <button type="button" onClick={koppelAlles} disabled={bezig || telling.koppelen === 0} className="knop-primair disabled:opacity-50">
                {bezig ? 'Bezig met koppelen…' : `Koppel ${telling.koppelen} foto${telling.koppelen === 1 ? '' : '’s'}`}
              </button>
            </div>
          </div>

          <ul className="panel divide-y divide-line">
            {rijen.map((r) => {
              const a = r.artikelId ? perId.get(r.artikelId) : undefined;
              const handmatig = r.koppeling.status !== 'gevonden';
              return (
                <li key={r.sleutel} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.voorbeeld} alt="" className="h-14 w-14 rounded border border-line bg-white object-contain" />
                  <div className="min-w-0 text-[13px]">
                    <p className="truncate font-mono text-[12px] text-warm">{r.bestand.name}</p>
                    {!handmatig && a ? (
                      <p className="font-semibold text-ink-900">
                        {a.merk} {a.artNr} · {a.naam} <span className="font-normal text-ink-700">in {r.kleur}</span>
                      </p>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <select
                          aria-label={`Artikel voor ${r.bestand.name}`}
                          value={r.artikelId}
                          onChange={(e) => wijzig(r.sleutel, { artikelId: e.target.value, kleur: '' })}
                          className="max-w-[16rem] rounded-md border border-line bg-white px-2 py-1 text-[13px]"
                        >
                          <option value="">Kies artikel…</option>
                          {artikelOpties.map((o) => (
                            <option key={o.id} value={o.id}>{[o.merk, o.artNr, o.naam].filter(Boolean).join(' · ')}</option>
                          ))}
                        </select>
                        <select
                          aria-label={`Kleur voor ${r.bestand.name}`}
                          value={r.kleur}
                          disabled={!a}
                          onChange={(e) => wijzig(r.sleutel, { kleur: e.target.value })}
                          className="rounded-md border border-line bg-white px-2 py-1 text-[13px]"
                        >
                          <option value="">Kies kleur…</option>
                          {(a?.kleuren ?? []).map((k) => (
                            <option key={k.kleur} value={k.kleur}>{k.kleur}{k.heeftFoto ? ' (heeft foto)' : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 text-[12px] sm:col-span-1 sm:text-right">{chip(r)}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
