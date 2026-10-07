'use client';
import { useState } from 'react';
import { leesFotoLinks, type FotoLinkFout } from '@/lib/kms/fotoLinks';
import type { KoppelArtikel } from '@/lib/kms/fotoKoppelen';
import { fotoVanLinkActie, koppelArtikelenActie } from './actions';

type Uitkomst = { regel: number; wat: string; ok: boolean; fout?: string };

const norm = (s: string) => s.trim().toLowerCase();

/** Plak een lijst 'artikelnummer ; kleur ; link' en koppel alle foto's in één keer. */
export default function FotoLinks() {
  const [tekst, setTekst] = useState('');
  const [bezig, setBezig] = useState(false);
  const [uitkomsten, setUitkomsten] = useState<Uitkomst[]>([]);
  const [fouten, setFouten] = useState<FotoLinkFout[]>([]);

  const start = async () => {
    const { regels, fouten: f } = leesFotoLinks(tekst);
    setUitkomsten([]);
    setBezig(true);
    const artikelen: KoppelArtikel[] = await koppelArtikelenActie();
    const perNr = new Map<string, KoppelArtikel[]>();
    for (const a of artikelen) if (a.artNr) perNr.set(norm(a.artNr), [...(perNr.get(norm(a.artNr)) ?? []), a]);
    const extra: FotoLinkFout[] = [];
    const taken: { regel: number; wat: string; productId: string; kleur: string; url: string }[] = [];
    for (const r of regels) {
      const kandidaten = perNr.get(norm(r.artNr)) ?? [];
      if (kandidaten.length !== 1) {
        extra.push({ regel: r.regel, tekst: r.artNr, reden: kandidaten.length ? 'Artikelnummer komt vaker voor' : 'Artikelnummer niet gevonden' });
        continue;
      }
      const a = kandidaten[0];
      let kleur = '';
      if (r.kleur) {
        const k = a.kleuren.find((k) => norm(k.kleur) === norm(r.kleur));
        if (!k) {
          extra.push({ regel: r.regel, tekst: `${r.artNr} ${r.kleur}`, reden: `Kleur niet gevonden (heeft: ${a.kleuren.map((k) => k.kleur).join(', ') || 'geen'})` });
          continue;
        }
        kleur = k.kleur;
      }
      taken.push({ regel: r.regel, wat: `${a.naam}${kleur ? ` · ${kleur}` : ' · algemene foto'}`, productId: a.id, kleur, url: r.url });
    }
    setFouten([...f, ...extra]);
    const rij = [...taken];
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (rij.length) {
          const t = rij.shift()!;
          let r: { ok: boolean; fout?: string };
          try {
            r = await fotoVanLinkActie(t.productId, t.kleur, t.url);
          } catch {
            r = { ok: false, fout: 'Verbinding verbroken.' };
          }
          setUitkomsten((u) => [...u, { regel: t.regel, wat: t.wat, ok: r.ok, fout: r.fout }]);
        }
      }),
    );
    setBezig(false);
  };

  const gelukt = uitkomsten.filter((u) => u.ok).length;
  const mislukt = uitkomsten.filter((u) => !u.ok);

  return (
    <section className="mt-6 rounded-xl border border-line bg-white p-5 shadow-soft">
      <h2 className="text-base font-bold text-ink-900">Foto&apos;s via link</h2>
      <p className="mt-1 max-w-2xl text-sm text-warm">
        Voor merken zonder eigen knop. Eén regel per foto: <code>artikelnummer ; kleur ; link</code>. Laat de kleur weg voor de algemene
        productfoto. De link moet direct naar de foto wijzen (rechtermuisknop op de foto, &lsquo;Adres van afbeelding kopiëren&rsquo;).
      </p>
      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={'X3387 ; NAVY ; https://...\n6244 ; https://...'}
        className="mt-3 w-full rounded-md border border-line px-3 py-2 font-mono text-[13px] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={bezig || !tekst.trim()} onClick={start}>
          {bezig ? 'Bezig…' : 'Foto’s ophalen en koppelen'}
        </button>
        {uitkomsten.length > 0 && (
          <span className="text-sm text-ink-800">
            {gelukt} gekoppeld · {mislukt.length} mislukt{bezig ? '' : ' · klaar'}
          </span>
        )}
      </div>
      {(fouten.length > 0 || mislukt.length > 0) && !bezig && (
        <ul className="mt-3 max-h-72 divide-y divide-line overflow-auto rounded-lg border border-line text-sm">
          {fouten.map((f) => (
            <li key={`f${f.regel}`} className="flex flex-wrap justify-between gap-2 px-3 py-2">
              <span className="min-w-0 font-medium text-ink-900">
                Regel {f.regel}: {f.tekst}
              </span>
              <span className="text-warm">{f.reden}</span>
            </li>
          ))}
          {mislukt.map((m) => (
            <li key={`m${m.regel}`} className="flex flex-wrap justify-between gap-2 px-3 py-2">
              <span className="min-w-0 font-medium text-ink-900">
                Regel {m.regel}: {m.wat}
              </span>
              <span className="text-warm">{m.fout}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
